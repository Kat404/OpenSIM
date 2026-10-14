/**
 * Dos hipótesis sobre el fallo de structured output del gateway.
 *
 * Lo observado al medir: muchos intentos terminan en `finish_reason: length`
 * sin emitir tool_calls, y uno devolvió los números transpuestos
 * ({"withTemario":1,"total":7} para un "7 de 68"). Eso sugiere dos causas
 * distintas, y aquí se separan:
 *
 *   A) El razonamiento del modelo se come el presupuesto de tokens y nunca
 *      llega a emitir la llamada. Se prueba subiendo max_tokens.
 *   B) El enunciado en inglés con datos en español se lee mal. Se prueba
 *      enunciando en español.
 *
 * Uso: node scripts/probe-budget.mjs [veces]
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

const ES =
	"La página dice '7 de 68 materias tienen temario publicado'. ¿Cuántas materias tienen temario publicado?";
const EN =
	"The page says '7 de 68 materias tienen temario published'. How many subjects have a published syllabus?";

async function attempt({ model, maxTokens, prompt }) {
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model,
			temperature: 0,
			messages: [{ role: "user", content: prompt }],
			tools: [TOOL],
			tool_choice: { type: "function", function: { name: "answer" } },
			max_tokens: maxTokens,
		}),
	});
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { ok: false, why: "http no-JSON" };
	}
	if (json?.error) return { ok: false, why: `error: ${String(json.error).slice(0, 50)}` };
	const choice = json?.choices?.[0];
	const call = choice?.message?.tool_calls?.[0];
	if (!call) return { ok: false, why: `sin tool_calls (finish=${choice?.finish_reason})` };
	try {
		const p = JSON.parse(call.function?.arguments ?? "");
		return p.withTemario === 7 && p.total === 68
			? { ok: true, why: "ok" }
			: { ok: false, why: `dato ${JSON.stringify(p)}` };
	} catch {
		return { ok: false, why: "arguments no-JSON" };
	}
}

const CASES = [
	{ label: "M3  max=400  EN (base)", model: "MiniMax-M3", maxTokens: 400, prompt: EN },
	{ label: "M3  max=4000 EN", model: "MiniMax-M3", maxTokens: 4000, prompt: EN },
	{ label: "M3  max=4000 ES", model: "MiniMax-M3", maxTokens: 4000, prompt: ES },
	{ label: "M2.5 max=4000 ES", model: "MiniMax-M2.5", maxTokens: 4000, prompt: ES },
	{ label: "M2.5 max=12000 ES", model: "MiniMax-M2.5", maxTokens: 12000, prompt: ES },
];

let best = { pct: 0, label: "" };
for (const c of CASES) {
	let good = 0;
	const whys = [];
	for (let i = 0; i < runs; i++) {
		const r = await attempt(c);
		if (r.ok) good++;
		else whys.push(r.why);
	}
	const pct = Math.round((good / runs) * 100);
	if (pct > best.pct) best = { pct, label: c.label };
	console.log(
		`${c.label.padEnd(24)} ${good}/${runs} (${String(pct).padStart(3)}%)  ${[...new Set(whys)].join(" | ")}`,
	);
}
console.log(`\nmejor: ${best.label} (${best.pct}%)`);
process.exit(best.pct >= 80 ? 0 : 1);
