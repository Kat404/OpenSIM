/**
 * OpenSIM — Academic constants and helpers unit tests.
 *
 * The constants here are the single source of truth for the TecNM
 * 0-10 grade scale; the test pins the value so a typo cannot
 * silently regress the passing threshold.
 */

import { describe, expect, it } from "vitest";
import { isPassing, MAX_GRADE, MIN_GRADE, MIN_PASSING_GRADE } from "../../src/lib/utils/academic";

describe("academic scale constants", () => {
	it("declares the TecNM minimum passing grade as 6.0", () => {
		// TecNM ISIC-2010-224 academic regulations: passing threshold
		// is 6.0 on the 0-10 scale. Do not regress this number; the
		// kardex badge and any future \"passed / failed\" logic depend
		// on it.
		expect(MIN_PASSING_GRADE).toBe(6.0);
	});

	it("declares the floor and ceiling of the 0-10 scale", () => {
		expect(MIN_GRADE).toBe(0.0);
		expect(MAX_GRADE).toBe(10.0);
	});

	it("places the passing threshold strictly between the floor and the ceiling", () => {
		expect(MIN_PASSING_GRADE).toBeGreaterThan(MIN_GRADE);
		expect(MIN_PASSING_GRADE).toBeLessThan(MAX_GRADE);
	});
});

describe("isPassing", () => {
	it("returns true for a grade exactly at the passing threshold", () => {
		expect(isPassing(MIN_PASSING_GRADE)).toBe(true);
	});

	it("returns true for a grade above the passing threshold", () => {
		expect(isPassing(6.1)).toBe(true);
		expect(isPassing(8.5)).toBe(true);
		expect(isPassing(10)).toBe(true);
	});

	it("returns false for a grade just below the passing threshold", () => {
		expect(isPassing(5.9)).toBe(false);
	});

	it("returns false for a grade at the floor of the scale", () => {
		expect(isPassing(0)).toBe(false);
	});

	it("returns false for a null grade (course in progress, no mark yet)", () => {
		expect(isPassing(null)).toBe(false);
	});
});
