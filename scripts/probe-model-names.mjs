/**
 * Lista los modelos que el gateway declara, vía el endpoint oficial.
 *
 * Los nombres de modelo que se hardcodearon en `e2e.config.ts` venían de un
 * comentario, no de la documentación. Este script pregunta al propio gateway
 * con GET /v1/models, que es la fuente de verdad, y además prueba un nombre
 * inventado para saber qué hace con uno que no existe: si responde 200 con un
 * finish_reason, está enroutando en silencio y cualquier barrido de modelos
 * anterior pudo estar midiendo el mismo modelo varias veces.
 *
 * Uso: node scripts/probe-model-names.mjs
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

const key = process.env.LLM_API_KEY;
if (!key) {
	console.error("LLM_API_KEY no está definida");
	process.exit(1);
}

const auth = { authorization: `Bearer ${key}` };

// 1. Lo que el gateway dice tener.
const listed = await fetch("https://api.minimax.io/v1/models", { headers: auth });
const listedText = await listed.text();
console.log(`GET /v1/models → ${listed.status}`);
let ids = [];
try {
	ids = (JSON.parse(listedText).data ?? []).map((m) => m.id);
} catch {
	console.log(listedText.slice(0, 300));
}
if (ids.length) {
	console.log(`\n${ids.length} modelos declarados:`);
	for (const id of ids) console.log(`  ${id}`);
}

// 2. Un nombre que no existe: ¿error honesto o sustitución silenciosa?
async function probe(name) {
	const res = await fetch("https://api.minimax.io/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", ...auth },
		body: JSON.stringify({
			model: name,
			messages: [{ role: "user", content: "di OK" }],
			max_tokens: 16,
		}),
	});
	let json;
	try {
		json = JSON.parse(await res.text());
	} catch {
		return { status: res.status, verdict: "respuesta no-JSON" };
	}
	if (json?.error) {
		return {
			status: res.status,
			verdict: `error: ${json.error.message ?? JSON.stringify(json.error)}`.slice(0, 90),
		};
	}
	const choice = json?.choices?.[0];
	return {
		status: res.status,
		verdict: `respondió, finish=${choice?.finish_reason}, modelo=${choice?.message?.model ?? "?"}`,
	};
}

console.log("\nnombres inventados (deben fallar si no hay sustitución):");
for (const bogus of ["MiniMax-M2", "MiniMax-M3", "no-existe-este-modelo-xyz"]) {
	const r = await probe(bogus);
	const declared = ids.length
		? ids.includes(bogus)
			? "declarado"
			: "NO declarado"
		: "lista no disponible";
	console.log(
		`  ${bogus.padEnd(26)} ${String(r.status).padEnd(4)} ${declared.padEnd(14)} ${r.verdict}`,
	);
}

process.exit(0);
