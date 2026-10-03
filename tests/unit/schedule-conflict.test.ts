/**
 * OpenSIM — Schedule conflict detection unit tests.
 *
 * The conflict detector is the heart of the Reinscripción simulator
 * (Phase 4 Tarea 4.1). It is a pure function on
 * `(candidate, existing) -> Set<id>`, which means it can be unit
 * tested without D1 — these tests pin every branch of the overlap
 * rule.
 *
 * Rule under test (see src/lib/utils/schedule-conflict.ts):
 *   Two blocks conflict when they share a day-letter AND their
 *   `[startTime, endTime)` intervals overlap. Touching intervals
 *   (one ends exactly when the other starts) do NOT conflict.
 */

import { describe, it, expect } from 'vitest';
import { annotateConflicts, findConflicts, type ConflictBlock } from '../../src/lib/utils/schedule-conflict';

describe('findConflicts', () => {
	it('returns an empty set when the candidate list is empty', () => {
		const existing: ConflictBlock[] = [{ id: 'a', day: 'L', startTime: '08:00', endTime: '10:00' }];
		expect(findConflicts([], existing).size).toBe(0);
	});

	it('returns an empty set when the existing list is empty', () => {
		const candidate: ConflictBlock[] = [{ id: 'a', day: 'L', startTime: '08:00', endTime: '10:00' }];
		expect(findConflicts(candidate, []).size).toBe(0);
	});

	it('flags a candidate that overlaps an existing block on the same day', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '09:00', endTime: '11:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		const result = findConflicts(candidate, existing);
		expect(result.has('c1')).toBe(true);
	});

	it('does not flag a candidate that runs on a different day', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'M', startTime: '09:00', endTime: '11:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(false);
	});

	it('does not flag back-to-back blocks (one ends when the other starts)', () => {
		// TecNM rule: touching intervals are NOT a conflict. 10:00-11:00
		// and 11:00-12:00 on the same day → student can take both.
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '11:00', endTime: '12:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '10:00', endTime: '11:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(false);
	});

	it('flags a partial overlap (10:00-12:00 vs 11:00-13:00)', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '10:00', endTime: '12:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '11:00', endTime: '13:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(true);
	});

	it('flags a fully-nested overlap (10:00-14:00 vs 11:00-12:00)', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '10:00', endTime: '14:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '11:00', endTime: '12:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(true);
	});

	it('returns each conflicting candidate id only once even when it overlaps multiple existing blocks', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '09:00', endTime: '12:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' },
			{ id: 'e2', day: 'L', startTime: '11:00', endTime: '13:00' }
		];
		const result = findConflicts(candidate, existing);
		expect(result.has('c1')).toBe(true);
		expect(result.size).toBe(1);
	});

	it('flags a candidate that overlaps any of the existing blocks (multi-block candidate)', () => {
		// Candidate group has 2 blocks: L and X. X overlaps an existing
		// block on Wednesday, L is free. The group as a whole conflicts.
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '08:00', endTime: '10:00' },
			{ id: 'c2', day: 'X', startTime: '08:00', endTime: '10:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'X', startTime: '09:00', endTime: '11:00' }
		];
		const result = findConflicts(candidate, existing);
		expect(result.has('c2')).toBe(true);
		expect(result.has('c1')).toBe(false);
	});

	it('ignores malformed time strings (does not throw, does not flag)', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: 'not-a-time', endTime: '10:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(false);
	});

	it('ignores blocks with end <= start (no valid time range)', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '10:00', endTime: '10:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(false);
	});

	it('normalises day-letter casing (l vs L are the same day)', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'l', startTime: '09:00', endTime: '11:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		expect(findConflicts(candidate, existing).has('c1')).toBe(true);
	});
});

describe('annotateConflicts', () => {
	it('attaches hasConflict: true only to the conflicting candidates', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '09:00', endTime: '11:00' },
			{ id: 'c2', day: 'M', startTime: '08:00', endTime: '10:00' }
		];
		const existing: ConflictBlock[] = [
			{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }
		];
		const annotated = annotateConflicts(candidate, existing);
		expect(annotated[0]?.hasConflict).toBe(true);
		expect(annotated[1]?.hasConflict).toBe(false);
	});

	it('preserves the input order in the output', () => {
		const candidate: ConflictBlock[] = [
			{ id: 'c1', day: 'L', startTime: '08:00', endTime: '10:00' },
			{ id: 'c2', day: 'M', startTime: '08:00', endTime: '10:00' },
			{ id: 'c3', day: 'X', startTime: '08:00', endTime: '10:00' }
		];
		const annotated = annotateConflicts(candidate, []);
		expect(annotated.map((b) => b.id)).toEqual(['c1', 'c2', 'c3']);
	});

	it('returns an empty array for an empty candidate list', () => {
		expect(annotateConflicts([], [{ id: 'e1', day: 'L', startTime: '08:00', endTime: '10:00' }])).toEqual(
			[]
		);
	});
});
