/**
 * OpenSIM — Timezone-aware day / date helpers unit tests.
 *
 * Anchors used in the assertions:
 *   2026-10-02 is a Friday.
 *   2026-10-03 is a Saturday.
 *   Morelia (America/Mexico_City) is UTC-6 (no DST observed in
 *   October; Mexico abolished DST in 2022, so the offset is fixed).
 *
 * Edge case under test: at UTC 2026-10-03T02:00 the UTC day is
 * already Saturday, but Morelia local is still Friday 20:00. The
 * old `now.getDay()` path returned 'S' (Saturday); the new helper
 * must return 'V' (Friday) for the same instant.
 */

import { describe, expect, it } from "vitest";
import { getTodayDate, getTodayDayLetter } from "../../src/lib/utils/time";

const MORELIA = "America/Mexico_City";

describe("getTodayDayLetter", () => {
	it("returns V (Friday) at 2026-10-02T18:00:00Z in Morelia", () => {
		// 18:00 UTC = 12:00 Morelia local on 2026-10-02 (Friday).
		expect(getTodayDayLetter(new Date("2026-10-02T18:00:00Z"), MORELIA)).toBe("V");
	});

	it("returns V (Friday) at 2026-10-03T02:00:00Z in Morelia", () => {
		// 02:00 UTC = 20:00 Morelia local on 2026-10-02 (Friday).
		// The old `getDay()` path returned 'S' for this instant; the
		// new helper must NOT.
		expect(getTodayDayLetter(new Date("2026-10-03T02:00:00Z"), MORELIA)).toBe("V");
	});

	it("returns S (Saturday) at 2026-10-03T18:00:00Z in Morelia", () => {
		// 18:00 UTC = 12:00 Morelia local on 2026-10-03 (Saturday).
		expect(getTodayDayLetter(new Date("2026-10-03T18:00:00Z"), MORELIA)).toBe("S");
	});

	it("returns L (Monday) at 2026-09-28T18:00:00Z in Morelia", () => {
		// 2026-09-28 is a Monday; 18:00 UTC = 12:00 local.
		expect(getTodayDayLetter(new Date("2026-09-28T18:00:00Z"), MORELIA)).toBe("L");
	});

	it("defaults to America/Mexico_City when no timezone is given", () => {
		// Same instant as the second test above; default TZ must
		// behave the same as the explicit one.
		expect(getTodayDayLetter(new Date("2026-10-03T02:00:00Z"))).toBe("V");
	});

	it("uses UTC explicitly when asked (sanity check on the pin)", () => {
		// 2026-10-03T02:00:00Z is Saturday in UTC, so the helper
		// returns 'S' when pinned to UTC.
		expect(getTodayDayLetter(new Date("2026-10-03T02:00:00Z"), "UTC")).toBe("S");
	});
});

describe("getTodayDate", () => {
	it("returns 2026-10-02 for 2026-10-02T18:00:00Z in Morelia", () => {
		expect(getTodayDate(new Date("2026-10-02T18:00:00Z"), MORELIA)).toBe("2026-10-02");
	});

	it("returns 2026-10-02 for 2026-10-03T02:00:00Z in Morelia (same day locally)", () => {
		// 02:00 UTC on the 3rd is still the 2nd in Morelia.
		expect(getTodayDate(new Date("2026-10-03T02:00:00Z"), MORELIA)).toBe("2026-10-02");
	});

	it("returns 2026-10-03 for 2026-10-03T18:00:00Z in Morelia", () => {
		expect(getTodayDate(new Date("2026-10-03T18:00:00Z"), MORELIA)).toBe("2026-10-03");
	});
});
