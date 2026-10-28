/**
 * The structured-output shim that lets the e2e runner talk to an endpoint that
 * does not implement `response_format`.
 *
 * Every fixture below is a REAL response captured from api.minimax.io against
 * MiniMax-M3 (scripts/probe-response-format.mjs, 2026-10-15). The endpoint
 * returns valid JSON with the right values and paraphrases the requested key
 * names, or answers the inner question without the runner's envelope.
 */
import { describe, expect, it } from "vite-plus/test";

import { repairStructuredOutput } from "../../e2e-structured-output-shim";

const extractSchema = {
	type: "object",
	additionalProperties: false,
	required: ["found", "value", "missing"],
	properties: {
		found: { type: "boolean" },
		value: {
			anyOf: [
				{
					type: "object",
					properties: {
						withTemario: { type: "integer" },
						total: { type: "integer" },
					},
					required: ["withTemario", "total"],
					additionalProperties: false,
				},
				{ type: "null" },
			],
		},
		missing: { type: ["string", "null"] },
	},
};

const judgmentSchema = {
	type: "object",
	additionalProperties: false,
	required: ["protocolVersion", "explanation", "verdict"],
	properties: {
		protocolVersion: { type: "string" },
		explanation: { type: "string" },
		verdict: { type: "string" },
	},
};

describe("repairStructuredOutput", () => {
	it("renames a paraphrased key and leaves the one it got right alone", () => {
		// Observed verbatim: asked for withTemario, answered "publicadas".
		const out = repairStructuredOutput('{"publicadas":7,"total":68}', extractSchema);
		expect(JSON.parse(out!)).toEqual({
			found: true,
			value: { withTemario: 7, total: 68 },
			missing: null,
		});
	});

	it("picks the candidate that matches the shape out of several answers", () => {
		// Observed verbatim: two complete JSON objects and prose after them.
		const text =
			'{"publicados": 7, "total": 68} or {"con_temario": 7, "total_materias": 68}\n\nBut the user just said "the ';
		const out = repairStructuredOutput(text, extractSchema);
		expect(JSON.parse(out!)).toEqual({
			found: true,
			value: { withTemario: 7, total: 68 },
			missing: null,
		});
	});

	it("passes through a response that already matches", () => {
		const exact = { found: true, value: { withTemario: 7, total: 68 }, missing: null };
		expect(JSON.parse(repairStructuredOutput(JSON.stringify(exact), extractSchema)!)).toEqual(
			exact,
		);
	});

	it("does not invent the envelope when the model already sent one", () => {
		// The runner asks for found/value/missing. A model that honours it must
		// not be re-wrapped into a second layer.
		const wrapped = { found: true, value: { withTemario: 7, total: 68 }, missing: null };
		expect(JSON.parse(repairStructuredOutput(JSON.stringify(wrapped), extractSchema)!)).toEqual(
			wrapped,
		);
	});

	it("reports a miss instead of guessing", () => {
		// Nothing here resembles the requested shape. Returning something here
		// would turn "the model did not answer" into a passing test.
		expect(repairStructuredOutput("No puedo determinarlo.", extractSchema)).toBeUndefined();
		expect(repairStructuredOutput('{"unrelated":true}', judgmentSchema)).toBeUndefined();
	});

	it("repairs a flat judgment whose key was paraphrased", () => {
		const out = repairStructuredOutput(
			'{"verdicto":"holds","explanation":"la pantalla lo dice","protocolVersion":"agent-judgment-2"}',
			judgmentSchema,
		);
		expect(JSON.parse(out!)).toEqual({
			verdict: "holds",
			explanation: "la pantalla lo dice",
			protocolVersion: "agent-judgment-2",
		});
	});

	it("never touches a value, only key names", () => {
		// A wrong guess about a key must show up as a failing assertion in the
		// test, not as a passing one: the numbers are the model's, verbatim.
		const out = repairStructuredOutput('{"publicadas":999,"total":68}', extractSchema);
		expect(JSON.parse(out!).value).toEqual({ withTemario: 999, total: 68 });
	});

	it("returns undefined when the text holds no JSON at all", () => {
		expect(repairStructuredOutput("", extractSchema)).toBeUndefined();
		expect(repairStructuredOutput("```json\n```", judgmentSchema)).toBeUndefined();
	});
});
