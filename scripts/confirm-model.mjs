/**
 * Confirma o descarta el candidato antes de tocar la configuración.
 *
 * El barrido amplio dio 5/5 para MiniMax-M2.7 a temperatura 1, pero cinco
 * muestras no prueban una tasa del 80%: cinco aciertos seguidos también encajan
 * con un 60% real. Este script repite SOLO el candidato, con más intentos, y
 * además mide que el dato leído sea el correcto y no sólo que la llamada
 * tenga forma — un sweep anterior produjo {"withTemario":7,"total":7}, que
 * "funciona" y miente.
 *
 * Uso: node scripts/confirm-model.mjs [veces] [modelo] [temperatura]
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

const runs = Number(process.argv[2] ?? 12);
const model = process.argv[3] ?? "MiniMax-M2.7";
const temperature = Number(process.argv[4] ?? 1);
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

const CASES = [
	{
		q: "La página dice '7 de 68 materias tienen temario publicado'. ¿Cuántas tienen temario?",
		want: [7, 68],
	},
	{ q: "La página dice '3 de 12 grupos disponibles'. ¿Cuántos grupos hay?", want: [3, 12] },
	{
		q: "La tabla muestra '182 créditos reticulares'. ¿Cuántos créditos reticulares pide?",
		want: [182, 182],
	},
	{
		q: "El resumen dice '0 de 5 créditos complementarios'. ¿Cuántos complementarios faltan?",
		want: [0, 5],
	},
];

let good = 0;
const whys = [];
for (let i = 0; i < runs; i++) {
	const c = CASES[i % CASES.length];
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model,
			temperature,
			messages: [{ role: "user", content: c.q }],
			tools: [TOOL],
			tool_choice: { type: "function", function: { name: "answer" } },
			max_tokens: 400,
		}),
	});
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		whys.push("http no-JSON");
		continue;
	}
	if (json?.error) {
		whys.push(`error ${json.error.code}`);
		continue;
	}
	const choice = json?.choices?.[0];
	const call = choice?.message?.tool_calls?.[0];
	if (!call) {
		whys.push(`sin tool_calls (finish=${choice?.finish_reason})`);
		continue;
	}
	let p;
	try {
		p = JSON.parse(call.function?.arguments ?? "");
	} catch {
		whys.push("arguments no-JSON");
		continue;
	}
	const [w0, w1] = c.want;
	// El primer campo es la respuesta, el segundo el total de la frase.
	const ok = p.withTemario === w0 && (w0 === w1 ? p.total === w1 : p.total === w1);
	if (ok) good++;
	else whys.push(`dato ${JSON.stringify(p)} esperaba ${w0}/${w1}`);
}

const pct = Math.round((good / runs) * 100);
console.log(`${model} temp=${temperature}: ${good}/${runs} (${pct}%)`);
if (whys.length) console.log(`fallos: ${[...new Set(whys)].join(" | ")}`);
process.exit(pct >= 80 ? 0 : 1);
