/**
 * ¿Apagar el razonamiento arregla el structured output?
 *
 * La documentación de MiniMax trae la tabla que faltaba: `thinking.type =
 * "disabled"` hace que MiniMax-M3 "skips thinking and answers directly",
 * mientras que en los M2.x el parámetro se "accepts but ignored; thinking
 * remains on". Es decir, el modelo configurado hasta ahora (M2.5) era
 * precisamente el que NO puede apagar el razonamiento.
 *
 * Esa es una causa plausible de todo lo medido antes: el modelo escribe su
 * razonamiento dentro de `content` (con etiquetas <think> literales) y
 * contests prose en vez de emitir la tool call.
 *
 * Este script mide exactamente eso: mismo tool-calling, con y sin thinking,
 * sobre los modelos donde el parámetro significa algo.
 *
 * Uso: node scripts/probe-thinking.mjs [veces]
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

const QUESTION =
	"La página dice '7 de 68 materias tienen temario publicado'. ¿Cuántas materias tienen temario publicado?";

async function attempt(model, thinking) {
	const body = {
		model,
		temperature: 0,
		messages: [{ role: "user", content: QUESTION }],
		tools: [TOOL],
		tool_choice: { type: "function", function: { name: "answer" } },
		max_tokens: 400,
	};
	if (thinking) body.thinking = { type: "disabled" };
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
		body: JSON.stringify(body),
	});
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { ok: false, why: "http no-JSON" };
	}
	if (json?.error) {
		return {
			ok: false,
			why: `error ${json.error.code ?? ""}: ${String(json.error.message).slice(0, 50)}`,
		};
	}
	const choice = json?.choices?.[0];
	const msg = choice?.message;
	const call = msg?.tool_calls?.[0];
	const think = typeof msg?.content === "string" && msg.content.includes("<think>");
	if (!call) {
		return { ok: false, why: `sin tool_calls (finish=${choice?.finish_reason}, think=${think})` };
	}
	try {
		const p = JSON.parse(call.function?.arguments ?? "");
		return p.withTemario === 7 && p.total === 68
			? { ok: true, why: `ok (think en content=${think})` }
			: { ok: false, why: `dato ${JSON.stringify(p)}` };
	} catch {
		return { ok: false, why: "arguments no-JSON" };
	}
}

const CASES = [
	{ label: "M3    thinking ON  (base)", model: "MiniMax-M3", thinking: false },
	{ label: "M3    thinking OFF", model: "MiniMax-M3", thinking: true },
	{ label: "M2.5  thinking OFF (ignorado)", model: "MiniMax-M2.5", thinking: true },
	{ label: "M2.7  thinking OFF (ignorado)", model: "MiniMax-M2.7", thinking: true },
	{ label: "M3.1  thinking OFF (400)", model: "MiniMax-M3.1-Flash-Preview", thinking: true },
];

const results = [];
for (const c of CASES) {
	let good = 0;
	let thinks = 0;
	const whys = [];
	for (let i = 0; i < runs; i++) {
		const r = await attempt(c.model, c.thinking);
		if (r.ok) good++;
		if (r.why.includes("think=true")) thinks++;
		else whys.push(r.why);
	}
	const pct = Math.round((good / runs) * 100);
	results.push({ ...c, pct });
	console.log(
		`${c.label.padEnd(34)} ${good}/${runs} (${String(pct).padStart(3)}%)  <think>=${thinks}  ${[...new Set(whys)].join(" | ")}`,
	);
}

const best = results.reduce((a, b) => (b.pct > a.pct ? b : a));
console.log(`\nmejor: ${best.label} (${best.pct}%)`);
process.exit(best.pct >= 80 ? 0 : 1);
