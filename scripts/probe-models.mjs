/**
 * Barre modelos y temperatura para structured output.
 *
 * El runner e2e saca sus juicios de tool-calling. Un sondeo dio 38% de aciertos
 * con MiniMax-M3, lo que basta para explicar seis MODEL_OUTPUT_INVALID seguidos:
 * con una ronda de reparación, un test pasa ~62% de las veces y seis tests
 * seguidos fallan casi con seguridad. Antes de cambiar de proveedor conviene
 * agotar las palancas baratas: temperatura cero, y los otros ids que el mismo
 * gateway dice aceptar.
 *
 * Uso: node scripts/probe-models.mjs [veces] [model-id]
 *   veces      corridas por combinación (default 4)
 *   model-id   opcional, acota el barrido a un modelo
 * Salida: una línea por modelo con su tasa, los fallos de red y la latencia
 * mediana/p95, y código 1 si ninguno llega a 80%.
 */
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) {
	for (const line of readFileSync(".env", "utf8").split("\n")) {
		const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!m) continue;
		const value = m[2].replace(/^["']|["']$/g, "");
		if (process.env[m[1]] === undefined) process.env[m[1]] = value;
	}
}

const runs = Number(process.argv[2] ?? 4);
const key = process.env.LLM_API_KEY;
if (!key) {
	console.error("LLM_API_KEY no está definida");
	process.exit(1);
}

const TOOL = {
	type: "function",
	function: {
		name: "answer",
		description: "Answer the question about the page.",
		parameters: {
			type: "object",
			properties: { withTemario: { type: "integer" }, total: { type: "integer" } },
			required: ["withTemario", "total"],
			additionalProperties: false,
		},
	},
};

// Latencia y clase de fallo por llamada. La distinción que importa: "la red se
// cayó" (fetch lanzó, HTTP 429/5xx, body no-JSON) frente a "el modelo respondió
// otra cosa" (HTTP 200, turno cerrado, sin tool call). Un 0% es una de dos cosas
// y sin esta separación no se sabe cuál.
async function attempt(model, temperature) {
	const t0 = performance.now();
	const elapsed = () => Math.round(performance.now() - t0);
	let res;
	try {
		res = await fetch("https://api.minimax.io/v1/chat/completions", {
			method: "POST",
			headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model,
				temperature,
				messages: [
					{
						role: "user",
						content:
							"The page says '7 de 68 materias tienen temario publicado'. How many subjects have a published syllabus?",
					},
				],
				tools: [TOOL],
				tool_choice: { type: "function", function: { name: "answer" } },
				max_tokens: 400,
			}),
		});
	} catch (e) {
		// fetch sólo lanza por DNS/TLS/socket o por un corte a media lectura.
		return { ok: false, why: `red: ${e.name ?? "Error"}`, net: true, ms: elapsed() };
	}
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { ok: false, why: `http ${res.status} no-JSON`, net: true, ms: elapsed() };
	}
	if (json?.error) {
		// 429 y errores de cuota llegan como 200 + cuerpo de error.
		return {
			ok: false,
			why: `error: ${String(json.error).slice(0, 60)}`,
			net: true,
			ms: elapsed(),
		};
	}
	const call = json?.choices?.[0]?.message?.tool_calls?.[0];
	if (!call) {
		const finish = json?.choices?.[0]?.finish_reason;
		// HTTP 200 con el turno cerrado en prosa: respuesta completa, mal formada.
		// Esto no es una conexión caída.
		return { ok: false, why: `sin tool_calls (finish=${finish})`, net: false, ms: elapsed() };
	}
	try {
		const p = JSON.parse(call.function?.arguments ?? "");
		return {
			ok: p.withTemario === 7 && p.total === 68,
			why: p.withTemario === 7 && p.total === 68 ? "ok" : `dato incorrecto ${JSON.stringify(p)}`,
			net: false,
			ms: elapsed(),
		};
	} catch {
		return { ok: false, why: "arguments no-JSON", net: false, ms: elapsed() };
	}
}

// La lista sale del propio gateway (GET /v1/models), no de un comentario:
// hardcodear ids es justo lo que produjo el barrido inicial incompleto.
const listed = await fetch("https://api.minimax.io/v1/models", {
	headers: { authorization: `Bearer ${key}` },
}).then((r) => r.json());
const MODELS = (listed?.data ?? []).map((m) => m.id);
// Un solo id acota el gasto: barrer los ocho por dos temperaturas son 16 vuelta
// por el gateway, y se paga con tokens.
const only = process.argv[3];
const TARGETS = only ? MODELS.filter((m) => m === only) : MODELS;
if (only && TARGETS.length === 0) {
	console.error(`El gateway no declara "${only}". Declarados: ${MODELS.join(", ")}`);
	process.exit(1);
}
console.log(`Modelos declarados por el gateway: ${MODELS.join(", ")}\n`);
const TEMPS = [0, 1];
const table = [];

for (const model of TARGETS) {
	for (const temperature of TEMPS) {
		let good = 0;
		let net = 0;
		const ms = [];
		const whys = [];
		for (let i = 0; i < runs; i++) {
			const r = await attempt(model, temperature);
			if (r.ok) good++;
			else {
				whys.push(r.why);
				if (r.net) net++;
			}
			ms.push(r.ms);
		}
		ms.sort((a, b) => a - b);
		const med = ms[Math.floor(ms.length / 2)];
		const p95 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))];
		const pct = Math.round((good / runs) * 100);
		table.push({ model, temperature, pct, whys: [...new Set(whys)].join(" | ") });
		console.log(
			`${model.padEnd(16)} temp=${String(temperature).padEnd(2)} ${String(good).padStart(2)}/${runs} (${String(pct).padStart(3)}%)  red=${net}/${runs}  lat ${String(med).padStart(5)}/${String(p95).padStart(5)} ms  ${[...new Set(whys)].join(" | ")}`,
		);
	}
}

const best = table.reduce((a, b) => (b.pct > a.pct ? b : a));
console.log(`\nmejor: ${best.model} temp=${best.temperature} (${best.pct}%)`);
process.exit(best.pct >= 80 ? 0 : 1);
