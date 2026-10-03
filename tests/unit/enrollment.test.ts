/**
 * OpenSIM — Enrollment helper unit tests (Phase 4 N6).
 *
 * The helper (`src/lib/server/enrollment.ts`) is the single source
 * of truth for "what is this student currently enrolled in this
 * period?" The function:
 *   - filters `student_progress` to `status = 'ENROLLED'` in the
 *     requested period (Tarea 4.1 N6);
 *   - returns `groups` + `schedule` for that period;
 *   - returns the period in the result envelope so the page can
 *     render "Periodo actual: {period}".
 *
 * Mocking strategy:
 *   Drizzle's query builder is thenable: the chain
 *     `db.select(...).from(...).where(...).orderBy(...).limit(1)`
 *   returns a Promise. The mock is a tiny queue-based proxy: each
 *   await pulls the next canned result from a queue. This keeps the
 *   test free of `better-sqlite3` and runs in the Vitest server
 *   project without extra dependencies.
 */

import { describe, it, expect } from 'vitest';
import { getCurrentEnrollment, getCurrentPeriod } from '../../src/lib/server/enrollment';
import type { Database } from '../../src/lib/server/db';

/**
 * Build a thenable proxy that records the chain shape but resolves
 * with a pre-canned result on `await`. Any method called on the
 * chain (`.select`, `.from`, `.where`, `.orderBy`, `.limit`, …)
 * returns the same proxy so the chain compiles.
 */
function makeMockDb(results: unknown[]): Database {
	let cursor = 0;
	const resolved: { value: unknown } = { value: [] };
	const proxy: unknown = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					return (onFulfilled: (v: unknown) => unknown) => {
						const value = cursor < results.length ? results[cursor++] : resolved.value;
						return Promise.resolve(onFulfilled(value));
					};
				}
				// All method/property accesses return the same proxy so
				// the chain compiles and the final await returns the
				// next queued result.
				return () => proxy;
			}
		}
	);
	return proxy as Database;
}

describe('getCurrentPeriod', () => {
	it('returns null when the student has no progress rows', async () => {
		const db = makeMockDb([[]]);
		const period = await getCurrentPeriod(db, '<NUMERO DE CONTROL PURGADO>');
		expect(period).toBeNull();
	});

	it('returns the most recent period string from student_progress', async () => {
		// Drizzle's `orderBy(desc(period)).limit(1)` returns the
		// first row; the mock pretends the DB already sorted.
		const db = makeMockDb([[{ period: 'AGOSTO-DICIEMBRE/2026' }]]);
		const period = await getCurrentPeriod(db, '<NUMERO DE CONTROL PURGADO>');
		expect(period).toBe('AGOSTO-DICIEMBRE/2026');
	});
});

describe('getCurrentEnrollment with explicit period', () => {
	it('returns empty arrays + the period when the student has no progress in that period', async () => {
		// 1) getCurrentPeriod (caller resolves it in production; this
		//    test passes the period explicitly so the helper skips it
		//    and goes straight to the enrollment query).
		// 2) The enrollment query returns zero rows → empty result.
		const db = makeMockDb([[]]);
		const out = await getCurrentEnrollment(db, '<NUMERO DE CONTROL PURGADO>', 'AGOSTO-DICIEMBRE/2026');
		expect(out.groups).toEqual([]);
		expect(out.schedule).toEqual([]);
		expect(out.period).toBe('AGOSTO-DICIEMBRE/2026');
	});

	it('joins groups + schedule blocks for the enrollment set', async () => {
		const enrolledRows = [{ subjectCanonicalId: 'graficacion' }];
		const groups = [
			{ id: 'G-SCC1027-1', subjectCanonicalId: 'graficacion', groupCode: 'A', teacherName: 'X', hasLab: true }
		];
		const blocks = [
			{
				id: 1,
				groupId: 'G-SCC1027-1',
				day: 'L',
				startTime: '08:00',
				endTime: '10:00',
				classroom: 'Lab 1'
			}
		];
		const db = makeMockDb([enrolledRows, groups, blocks]);
		const out = await getCurrentEnrollment(db, '<NUMERO DE CONTROL PURGADO>', 'AGOSTO-DICIEMBRE/2026');
		expect(out.groups).toEqual(groups);
		expect(out.schedule).toEqual(blocks);
		expect(out.period).toBe('AGOSTO-DICIEMBRE/2026');
	});
});

describe('getCurrentEnrollment without explicit period', () => {
	it('resolves the most recent period via getCurrentPeriod', async () => {
		// 1) getCurrentPeriod → 'AGOSTO-DICIEMBRE/2026'
		// 2) enrollment query filtered to that period → one row
		// 3) groups query → one group
		// 4) schedule query → one block
		const db = makeMockDb([
			[{ period: 'AGOSTO-DICIEMBRE/2026' }],
			[{ subjectCanonicalId: 'graficacion' }],
			[
				{
					id: 'G-SCC1027-1',
					subjectCanonicalId: 'graficacion',
					groupCode: 'A',
					teacherName: 'X',
					hasLab: true
				}
			],
			[
				{
					id: 1,
					groupId: 'G-SCC1027-1',
					day: 'L',
					startTime: '08:00',
					endTime: '10:00',
					classroom: 'Lab 1'
				}
			]
		]);
		const out = await getCurrentEnrollment(db, '<NUMERO DE CONTROL PURGADO>');
		expect(out.period).toBe('AGOSTO-DICIEMBRE/2026');
		expect(out.groups).toHaveLength(1);
		expect(out.schedule).toHaveLength(1);
	});

	it('returns empty arrays when the student has no progress at all', async () => {
		// 1) getCurrentPeriod → null → return early before any other query.
		const db = makeMockDb([[]]);
		const out = await getCurrentEnrollment(db, '<NUMERO DE CONTROL PURGADO>');
		expect(out.groups).toEqual([]);
		expect(out.schedule).toEqual([]);
		expect(out.period).toBeNull();
	});
});
