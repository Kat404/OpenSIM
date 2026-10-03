/**
 * OpenSIM — DAG algorithm unit tests.
 *
 * Pure tests, no environment setup. The DAG is hand-built in-memory using
 * small graphs (2-6 nodes) to exercise the contract documented in
 * src/lib/utils/dag.ts and odd/tasks/opensim.md §7.1.
 */

import { describe, it, expect } from 'vitest';
import { getAncestors, getDescendants, evaluateCreditThresholds } from '../../src/lib/utils/dag';
import type { Edge } from '../../src/lib/utils/dag';

describe('getAncestors', () => {
	it('returns an empty set when the target has no parents', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'c', to: 'd' }
		];
		const result = getAncestors('a', edges);
		expect(result.size).toBe(0);
	});

	it('returns the direct parents of the target', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'c' },
			{ from: 'b', to: 'c' }
		];
		const result = getAncestors('c', edges);
		expect(result.size).toBe(2);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
	});

	it('returns transitive ancestors through a chain of three or more nodes', () => {
		// a -> b -> c -> d (target)
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'c' },
			{ from: 'c', to: 'd' }
		];
		const result = getAncestors('d', edges);
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('does not include the target itself in its ancestors', () => {
		const edges: Edge[] = [{ from: 'a', to: 'b' }];
		const result = getAncestors('b', edges);
		expect(result.has('b')).toBe(false);
	});

	it('handles a diamond (DAG) without double-counting nodes', () => {
		// a -> b, a -> c, b -> d, c -> d
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'a', to: 'c' },
			{ from: 'b', to: 'd' },
			{ from: 'c', to: 'd' }
		];
		const result = getAncestors('d', edges);
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});
});

describe('getDescendants', () => {
	it('returns an empty set when the target has no children', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'c', to: 'd' }
		];
		const result = getDescendants('d', edges);
		expect(result.size).toBe(0);
	});

	it('returns the direct children of the target', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'a', to: 'c' }
		];
		const result = getDescendants('a', edges);
		expect(result.size).toBe(2);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('returns transitive descendants through a chain of three or more nodes', () => {
		// a -> b -> c -> d
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'c' },
			{ from: 'c', to: 'd' }
		];
		const result = getDescendants('a', edges);
		expect(result.size).toBe(3);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
		expect(result.has('d')).toBe(true);
	});

	it('does not include the target itself in its descendants', () => {
		const edges: Edge[] = [{ from: 'a', to: 'b' }];
		const result = getDescendants('a', edges);
		expect(result.has('a')).toBe(false);
	});
});

describe('evaluateCreditThresholds', () => {
	it('returns all false for 50 approved credits (below every threshold)', () => {
		const result = evaluateCreditThresholds(50);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
		expect(result.canTakeTallerInv1).toBe(false);
	});

	it('returns canTakeTallerInv1 true at exactly 130 approved credits', () => {
		const result = evaluateCreditThresholds(130);
		expect(result.canTakeTallerInv1).toBe(true);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
	});

	it('returns canStartSocialService true at exactly 182 approved credits', () => {
		const result = evaluateCreditThresholds(182);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
		expect(result.canStartResidency).toBe(false);
	});

	it('returns all true at exactly 208 approved credits (full residency threshold)', () => {
		const result = evaluateCreditThresholds(208);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canStartResidency).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
	});

	it('returns all true for approved credits above the maximum threshold', () => {
		const result = evaluateCreditThresholds(260);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canStartResidency).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
	});

	it('returns all false for zero approved credits', () => {
		const result = evaluateCreditThresholds(0);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
		expect(result.canTakeTallerInv1).toBe(false);
	});
});
