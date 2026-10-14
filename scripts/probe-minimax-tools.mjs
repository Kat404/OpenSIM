/**
 * Mide la fiabilidad del gateway para structured output.
 *
 * Un sondeo puntual no alcanza: si el tool-calling funciona una vez de cada
 * dos, la explicación de seis MODEL_OUTPUT_INVALID seguidos no es que el
 * proveedor no pueda, sino que es intermitente. Este script repite el mismo
 * tool-calling N veces y reporta la tasa, que es el número que decide si el
 * carril agentic es viable o si hay que cambiar de proveedor.
 *
 * Uso: node scripts/probe-minimax-tools.mjs [veces] [modelo]
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

const runs = Number(process.argv[2] ?? 5);
const model = process.argv[3] ?? process.env.PROBE_MODEL ?? "MiniMax-M3";
const key = process.env.LLM_API_KEY;
if (!key) {
	console.error("LLM_API_KEY no está definida");
	process.exit(1);
}

const tool = {
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

async function attempt(n) {
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model,
			messages: [
				{
					role: "user",
					content: `The page says '${n} de 68 materias tienen temario publicado'. How many subjects have a published syllabus?`,
				},
			],
			tools: [tool],
			tool_choice: { type: "function", function: { name: "answer" } },
			max_tokens: 400,
		}),
	});
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { ok: false, why: "respuesta no-JSON" };
	}
	const msg = json?.choices?.[0]?.message;
	const call = msg?.tool_calls?.[0];
	if (!call)
		return { ok: false, why: `sin tool_calls (finish=${json?.choices?.[0]?.finish_reason})` };
	let parsed;
	try {
		parsed = JSON.parse(call.function?.arguments ?? "");
	} catch {
		return { ok: false, why: "arguments no-JSON" };
	}
	// El dato tiene que ser el de la pantalla, no un número inventado.
	const right = parsed.withTemario === n && parsed.total === 68;
	return { ok: right, why: right ? "ok" : `respondió ${JSON.stringify(parsed)}, esperaba ${n}/68` };
}

let good = 0;
for (let i = 1; i <= runs; i++) {
	const r = await attempt(i);
	if (r.ok) good++;
	console.log(`${String(i).padStart(2)}. ${r.ok ? "✓" : "✗"} ${r.why}`);
}
const pct = Math.round((good / runs) * 100);
console.log(`\n${model}: ${good}/${runs} structured outputs correctos (${pct}%)`);
process.exit(pct >= 80 ? 0 : 1);
