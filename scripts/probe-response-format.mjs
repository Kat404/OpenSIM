/**
 * ¿Qué `response_format` entiende de verdad este endpoint?
 *
 * El SDK decide así (node_modules/@ai-sdk/openai-compatible/dist/index.js):
 *
 *   supportsStructuredOutputs === true  → { type: "json_schema", json_schema }
 *   supportsStructuredOutputs === false → { type: "json_object" }
 *
 * Así que la opción del provider decide qué se envía, y cada endpoint acepta
 * una cosa distinta. Este script pregunta los tres modos y compara: sin nada,
 * json_object, y json_schema. Con el mismo esquema y la misma pregunta.
 *
 * Uso: node scripts/probe-response-format.mjs [veces]
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

const runs = Number(process.argv[2] ?? 3);
const model = process.argv[3] ?? "MiniMax-M2.7";
const key = process.env.LLM_API_KEY;
if (!key) {
	console.error("LLM_API_KEY no está definida");
	process.exit(1);
}

const SCHEMA = {
	type: "object",
	properties: { withTemario: { type: "integer" }, total: { type: "integer" } },
	required: ["withTemario", "total"],
	additionalProperties: false,
};

const MODES = [
	{ label: "sin response_format", rf: undefined },
	{ label: "json_object", rf: { type: "json_object" } },
	{
		label: "json_schema",
		rf: { type: "json_schema", json_schema: { name: "answer", schema: SCHEMA, strict: true } },
	},
];

for (const mode of MODES) {
	let good = 0;
	const whys = [];
	for (let i = 0; i < runs; i++) {
		const body = {
			model,
			temperature: 0,
			messages: [
				{
					role: "user",
					content:
						"La página dice '7 de 68 materias tienen temario publicado'. Devuelve sólo el JSON con las dos cifras, sin texto alrededor.",
				},
			],
			max_tokens: 2000,
		};
		if (mode.rf) body.response_format = mode.rf;
		const res = await fetch("https://api.minimax.io/v1/chat/completions", {
			method: "POST",
			headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
			body: JSON.stringify(body),
		});
		let json;
		try {
			json = JSON.parse(await res.text());
		} catch {
			whys.push("http no-JSON");
			continue;
		}
		if (json?.error) {
			whys.push(`error ${json.error.code}: ${String(json.error.message).slice(0, 40)}`);
			continue;
		}
		const choice = json?.choices?.[0];
		const raw = choice?.message?.content ?? "";
		if (choice?.finish_reason === "length") {
			whys.push(`cortó (finish=length, ${raw.length} chars)`);
			continue;
		}
		// El razonamiento del modelo vive dentro de content: hay que buscar el
		// primer objeto, no asumir que content ES json.
		const start = raw.indexOf("{");
		const end = raw.lastIndexOf("}");
		if (start === -1 || end <= start) {
			whys.push(
				`sin objeto (finish=${choice?.finish_reason}, ${JSON.stringify(raw.slice(0, 40))})`,
			);
			continue;
		}
		try {
			const p = JSON.parse(raw.slice(start, end + 1));
			if (p.withTemario === 7 && p.total === 68) good++;
			else whys.push(`dato ${JSON.stringify(p)}`);
		} catch {
			whys.push(`objeto no parseable: ${JSON.stringify(raw.slice(start, start + 60))}`);
		}
	}
	console.log(
		`${mode.label.padEnd(22)} ${good}/${runs}` +
			(whys.length ? `   ${[...new Set(whys)].join(" | ")}` : ""),
	);
}
