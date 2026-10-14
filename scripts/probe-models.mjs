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
 * Uso: node scripts/probe-models.mjs [veces]
 * Salida: una línea por modelo con su tasa, y código 1 si ninguno llega a 80%.
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

async function attempt(model, temperature) {
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
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
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { ok: false, why: "http no-JSON" };
	}
	if (json?.error) return { ok: false, why: `error: ${String(json.error).slice(0, 60)}` };
	const call = json?.choices?.[0]?.message?.tool_calls?.[0];
	if (!call) {
		const finish = json?.choices?.[0]?.finish_reason;
		return { ok: false, why: `sin tool_calls (finish=${finish})` };
	}
	try {
		const p = JSON.parse(call.function?.arguments ?? "");
		return p.withTemario === 7 && p.total === 68
			? { ok: true, why: "ok" }
			: { ok: false, why: `dato incorrecto ${JSON.stringify(p)}` };
	} catch {
		return { ok: false, why: "arguments no-JSON" };
	}
}

// La lista sale del propio gateway (GET /v1/models), no de un comentario:
// hardcodear ids es justo lo que produjo el barrido inicial incompleto.
const listed = await fetch("https://api.minimax.io/v1/models", {
	headers: { authorization: `Bearer ${key}` },
}).then((r) => r.json());
const MODELS = (listed?.data ?? []).map((m) => m.id);
console.log(`Modelos declarados por el gateway: ${MODELS.join(", ")}\n`);
const TEMPS = [0, 1];
const table = [];

for (const model of MODELS) {
	for (const temperature of TEMPS) {
		let good = 0;
		const whys = [];
		for (let i = 0; i < runs; i++) {
			const r = await attempt(model, temperature);
			if (r.ok) good++;
			else whys.push(r.why);
		}
		const pct = Math.round((good / runs) * 100);
		table.push({ model, temperature, pct, whys: [...new Set(whys)].join(" | ") });
		console.log(
			`${model.padEnd(16)} temp=${String(temperature).padEnd(2)} ${String(good).padStart(2)}/${runs} (${String(pct).padStart(3)}%)  ${[...new Set(whys)].join(" | ")}`,
		);
	}
}

const best = table.reduce((a, b) => (b.pct > a.pct ? b : a));
console.log(`\nmejor: ${best.model} temp=${best.temperature} (${best.pct}%)`);
process.exit(best.pct >= 80 ? 0 : 1);
