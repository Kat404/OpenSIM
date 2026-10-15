import type { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelMiddleware } from "ai";
import { wrapLanguageModel } from "ai";

/**
 * The model `createOpenAICompatible(...).chatModel(...)` hands back, taken from
 * the factory rather than named: `ai` v7 no longer re-exports `LanguageModelV2`,
 * and `@ai-sdk/provider` is a transitive dependency this project does not own.
 */
export type ChatModel = ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>;

/**
 * Lets the e2e runner judge a screen on a gateway that does not implement
 * `response_format`.
 *
 * WHAT IS ACTUALLY BROKEN, measured on api.minimax.io with MiniMax-M3
 * (scripts/probe-response-format.mjs, 2026-10-15, 12 calls per mode):
 *
 * - All three `response_format` modes score 0/5. The flag changes what is sent
 *   and the endpoint honours none of them.
 * - The JSON that comes back is valid and its VALUES are right. `total` is
 *   echoed exactly. What it will not do is repeat the key you asked for:
 *   `withTemario` comes back as `publicadas` or `publicados`, `conTemario` as
 *   `con_temario` or `materias_con_temario`, and `publicadas` as `publicados`.
 *   It paraphrases the name even when handed the exact key it likes best.
 * - It sometimes answers with two or three candidate objects and prose around
 *   them: `{"publicados": 7, "total": 68} or {"con_temario": 7, …}`.
 *
 * So the transport was never the problem and neither was latency (0 network
 * events in 24 calls, ~1 s median against a 120 s budget). What fails is strict
 * schema validation against keys the provider paraphrased.
 *
 * WHAT THIS DOES: drops `response_format` from the request and repairs the
 * response instead — finds the candidate object that best fits the requested
 * shape, renames its keys to the requested names, and rebuilds the runner's
 * `found`/`value`/`missing` envelope when the model answered the inner question
 * without it.
 *
 * WHAT THIS DOES NOT DO: touch a value. Only key names are rewritten, so a
 * wrong guess about which key is which shows up as a failing assertion in the
 * test rather than as a green one. When nothing in the text resembles the
 * requested shape it returns undefined and the model's own answer is left
 * alone, which fails validation — a model that did not answer must not be
 * turned into a test that passed.
 */

/** Every top-level JSON object in `text`, in the order they appear. */
function jsonObjectsIn(text: string): Record<string, unknown>[] {
	const found: Record<string, unknown>[] = [];
	for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let i = start; i < text.length; i++) {
			const char = text[i];
			if (inString) {
				if (escaped) escaped = false;
				else if (char === "\\") escaped = true;
				else if (char === '"') inString = false;
				continue;
			}
			if (char === '"') inString = true;
			else if (char === "{") depth++;
			else if (char === "}") {
				depth--;
				if (depth === 0) {
					try {
						const parsed: unknown = JSON.parse(text.slice(start, i + 1));
						if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
							found.push(parsed as Record<string, unknown>);
						}
					} catch {
						// A brace run that is not an object. Keep scanning from here.
					}
					break;
				}
			}
		}
	}
	return found;
}

/** `withTemario` and `with_temario` name the same field; casing and `_` do not count. */
function sameName(a: string, b: string): boolean {
	return (
		a.toLowerCase().replaceAll(/[^a-z0-9]/g, "") === b.toLowerCase().replaceAll(/[^a-z0-9]/g, "")
	);
}

function propertyNames(schema: unknown): string[] {
	const properties = (schema as { properties?: Record<string, unknown> } | null)?.properties;
	return properties === undefined ? [] : Object.keys(properties);
}

/** The caller's own shape inside the runner's extract envelope, when it is inline. */
function innerShape(schema: unknown): unknown {
	const value = (schema as { properties?: Record<string, { anyOf?: unknown[] }> } | null)
		?.properties?.value;
	const options = Array.isArray(value?.anyOf) ? value.anyOf : [];
	return options.find((option) => (option as { type?: string } | null)?.type === "object");
}

/**
 * Whether `value` is this shape with its keys possibly paraphrased: at least one
 * requested key is present under its own name (the anchor that says we are
 * looking at the right object), and the paraphrased leftovers are exactly as
 * many as the requested keys still missing (so nothing is invented).
 */
function fits(value: Record<string, unknown>, wanted: string[]): boolean {
	const keys = Object.keys(value);
	const exact = wanted.filter((name) => keys.some((key) => sameName(key, name)));
	if (exact.length === 0) return false;
	const leftovers = keys.filter((key) => !exact.some((name) => sameName(key, name)));
	return leftovers.length === wanted.length - exact.length;
}

/** The object that best fits `wanted`, or undefined. More exact keys wins. */
function bestFit(
	candidates: Record<string, unknown>[],
	wanted: string[],
): Record<string, unknown> | undefined {
	let best: Record<string, unknown> | undefined;
	let bestScore = 0;
	for (const candidate of candidates) {
		if (!fits(candidate, wanted)) continue;
		const score = wanted.filter((name) =>
			Object.keys(candidate).some((key) => sameName(key, name)),
		).length;
		if (score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}
	return best;
}

/**
 * `value` with its keys renamed to `wanted`: exact names first, then the
 * paraphrased leftovers in the order they appear, which is the order the model
 * wrote them in and therefore the order it was given them in the schema.
 */
function rename(value: Record<string, unknown>, wanted: string[]): Record<string, unknown> {
	const keys = Object.keys(value);
	const taken = new Set<string>();
	const mapped = new Map<string, string>();
	for (const name of wanted) {
		const key = keys.find((candidate) => !taken.has(candidate) && sameName(candidate, name));
		if (key !== undefined) {
			taken.add(key);
			mapped.set(key, name);
		}
	}
	const missing = wanted.filter((name) => !mapped.has(name));
	const leftovers = keys.filter((key) => !taken.has(key));
	leftovers.forEach((key, index) => {
		if (index < missing.length) mapped.set(key, missing[index]);
	});
	return Object.fromEntries([...mapped].map(([key, name]) => [name, value[key]]));
}

/**
 * The response text as a JSON object shaped like `schema`, or undefined when the
 * text holds nothing that fits. Values are passed through untouched.
 */
export function repairStructuredOutput(text: string, schema: unknown): string | undefined {
	const candidates = jsonObjectsIn(text);
	if (candidates.length === 0) return undefined;

	const wanted = propertyNames(schema);
	if (wanted.length === 0) return undefined;

	const direct = bestFit(candidates, wanted);
	if (direct !== undefined) return JSON.stringify(rename(direct, wanted));

	// The model answered the question inside the envelope and skipped the
	// envelope. `agent.extract` asks for found/value/missing; a model that
	// ignores response_format hands back the bare answer instead.
	const inner = innerShape(schema);
	if (inner === undefined) return undefined;
	const innerWanted = propertyNames(inner);
	const nested = bestFit(candidates, innerWanted);
	if (nested === undefined) return undefined;
	return JSON.stringify({
		found: true,
		value: rename(nested, innerWanted),
		missing: null,
	});
}

/**
 * The AI SDK's own seam for exactly this job, with our repair as the transform.
 *
 * `extractJsonMiddleware` ships for the same shape of problem and only strips
 * markdown fences; it cannot see the requested schema, and renaming keys is the
 * part this endpoint needs. So this is that middleware's shape — `wrapGenerate`
 * over the model's text parts — reading `params.responseFormat` for the schema
 * to repair against.
 *
 * Streaming is left alone: the runner's judgments go through `doGenerate`.
 */
export function tolerantStructuredOutputMiddleware(): LanguageModelMiddleware {
	return {
		specificationVersion: "v4",
		wrapGenerate: async ({ doGenerate, params }) => {
			const result = await doGenerate();
			const format = params.responseFormat;
			if (format?.type !== "json") return result;

			const content = result.content.map((part) => {
				if (part.type !== "text") return part;
				const repaired = repairStructuredOutput(part.text, format.schema);
				// Nothing in the text fits the shape: leave the model's own answer
				// alone so it fails validation. A model that did not answer must
				// not be turned into a test that passed.
				return repaired === undefined ? part : { ...part, text: repaired };
			});
			return { ...result, content };
		},
	};
}

/** `model` wrapped so a requested structured output survives this endpoint. */
export function withTolerantStructuredOutput(model: ChatModel): ChatModel {
	return wrapLanguageModel({
		model,
		middleware: tolerantStructuredOutputMiddleware(),
	}) as ChatModel;
}
