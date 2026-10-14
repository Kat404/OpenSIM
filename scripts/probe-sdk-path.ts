/**
 * Aísla el camino del SDK de la persona que responde.
 *
 * Los sondeos anteriores usaron fetch crudo contra /v1/chat/completions. Eso
 * mide al MODELO, pero no al camino que realmente usa el runner: provider de
 * AI SDK + `generateObject` con un esquema zod. Si este script pasa y el
 * runner falla, el problema está en nuestra configuración y no en el
 * proveedor. Si falla aquí también, es el proveedor.
 *
 * Usa la MISMA construcción que e2e.config.ts, sin cambios.
 */

import { existsSync, readFileSync } from "node:fs";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, generateText } from "ai";
import { z } from "zod";

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

const provider = createOpenAICompatible({
	name: "openai-compatible",
	baseURL: "https://api.minimax.io/v1",
	apiKey: key,
	// El nombre exacto lo tiene el paquete instalado, no la intuición:
	// `grep supportsStructuredOutputs node_modules/@ai-sdk/openai-compatible/dist/index.js`
	// → `this.supportsStructuredOutputs = config.supportsStructuredOutputs ?? false`.
	// Sin él el SDK avisa "The feature 'responseFormat' is not supported" y
	// `generateObject` con esquema no tiene por dónde pedirlo.
	supportsStructuredOutputs: process.env.PROBE_STRUCTURED !== "0",
});

const modelId = process.argv[2] ?? "MiniMax-M2.7";
const model = provider.chatModel(modelId);

const Schema = z.object({
	withTemario: z.number().int(),
	total: z.number().int(),
});

let ok = 0;
const RUNS = 5;

for (let i = 1; i <= RUNS; i++) {
	try {
		const { object } = await generateObject({
			model,
			schema: Schema,
			mode: "json",
			prompt: `La página dice '7 de 68 materias tienen temario publicado'. ¿Cuántas tienen temario?`,
		});
		const good = object.withTemario === 7 && object.total === 68;
		if (good) ok++;
		console.log(
			`${i}. ${good ? "✓" : "✗"} generateObject(json) → ${JSON.stringify(object)}${good ? "" : "  (dato incorrecto)"}`,
		);
	} catch (e) {
		console.log(`${i}. ✗ generateObject(json) → ${String(e).slice(0, 120)}`);
	}
}

// El otro modo: structured output por tool-calling, que es lo que el runner
// usa para `extract` con schema y para `act`.
for (let i = 1; i <= RUNS; i++) {
	try {
		const { toolCalls } = await generateText({
			model,
			prompt: `La página dice '7 de 68 materias tienen temario publicado'. ¿Cuántas tienen temario?`,
			tools: {
				answer: {
					description: "Answer the question about the page.",
					inputSchema: Schema,
				},
			},
			toolChoice: { type: "tool", toolName: "answer" },
		});
		const args = toolCalls[0]?.input;
		const good = args?.withTemario === 7 && args?.total === 68;
		if (good) ok++;
		console.log(`${i}. ${good ? "✓" : "✗"} generateText(tool)  → ${JSON.stringify(args)}`);
	} catch (e) {
		console.log(`${i}. ✗ generateText(tool)  → ${String(e).slice(0, 120)}`);
	}
}

console.log(`\n${modelId}: ${ok}/${RUNS * 2} structured outputs correctos por el SDK`);
process.exit(ok >= RUNS * 1.5 ? 0 : 1);
