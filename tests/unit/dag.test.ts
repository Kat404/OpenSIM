/**
 * OpenSIM — DAG algorithm unit tests.
 *
 * Pure tests, no environment setup. The DAG is hand-built in-memory using
 * small graphs (2-6 nodes) to exercise the contract documented in
 * src/lib/utils/dag.ts and odd/tasks/opensim.md §7.1.
 */

import { describe, it, expect } from 'vitest';
import {
	buildAdjacency,
	evaluateCreditThresholds,
	getAncestors,
	getAncestorsFromMap,
	getDescendants,
	getDescendantsFromMap
} from '../../src/lib/utils/dag';
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

describe('buildAdjacency', () => {
	it('returns an empty adjacency for an empty edge list', () => {
		const map = buildAdjacency([]);
		expect(map.children.size).toBe(0);
		expect(map.parents.size).toBe(0);
	});

	it('records every (from -> to) edge in the children map', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'a', to: 'c' },
			{ from: 'b', to: 'd' }
		];
		const map = buildAdjacency(edges);
		expect(map.children.get('a')).toEqual(['b', 'c']);
		expect(map.children.get('b')).toEqual(['d']);
		expect(map.children.get('c')).toBeUndefined();
		expect(map.children.get('d')).toBeUndefined();
	});

	it('records every (from -> to) edge in the parents map (inverse index)', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'c' },
			{ from: 'b', to: 'c' },
			{ from: 'b', to: 'd' }
		];
		const map = buildAdjacency(edges);
		expect(map.parents.get('c')).toEqual(['a', 'b']);
		expect(map.parents.get('d')).toEqual(['b']);
		expect(map.parents.get('a')).toBeUndefined();
		expect(map.parents.get('b')).toBeUndefined();
	});

	it('preserves the input order of siblings in both maps', () => {
		// The retícula connectors rely on stable child order so the
		// Bézier list does not reshuffle between SSR and CSR.
		const edges: Edge[] = [
			{ from: 'a', to: 'd' },
			{ from: 'a', to: 'b' },
			{ from: 'a', to: 'c' }
		];
		const map = buildAdjacency(edges);
		expect(map.children.get('a')).toEqual(['d', 'b', 'c']);
	});
});

describe('getAncestorsFromMap', () => {
	const edges: Edge[] = [
		{ from: 'a', to: 'b' },
		{ from: 'b', to: 'c' },
		{ from: 'c', to: 'd' }
	];

	it('returns an empty set when the target has no parents', () => {
		const map = buildAdjacency(edges);
		expect(getAncestorsFromMap('a', map).size).toBe(0);
	});

	it('returns the transitive ancestor set', () => {
		const map = buildAdjacency(edges);
		const result = getAncestorsFromMap('d', map);
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('handles a diamond through the map without double-counting', () => {
		const map = buildAdjacency([
			{ from: 'a', to: 'b' },
			{ from: 'a', to: 'c' },
			{ from: 'b', to: 'd' },
			{ from: 'c', to: 'd' }
		]);
		const result = getAncestorsFromMap('d', map);
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('is equivalent to getAncestors(id, edges) for the same edge set', () => {
		const map = buildAdjacency(edges);
		// Equivalence: every reachable ancestor via raw edges is
		// also reachable via the pre-built map, and vice versa.
		for (const id of ['a', 'b', 'c', 'd']) {
			const fromMap = getAncestorsFromMap(id, map);
			const fromEdges = getAncestors(id, edges);
			expect([...fromMap].sort()).toEqual([...fromEdges].sort());
		}
	});
});

describe('getDescendantsFromMap', () => {
	const edges: Edge[] = [
		{ from: 'a', to: 'b' },
		{ from: 'b', to: 'c' },
		{ from: 'c', to: 'd' }
	];

	it('returns an empty set when the target has no children', () => {
		const map = buildAdjacency(edges);
		expect(getDescendantsFromMap('d', map).size).toBe(0);
	});

	it('returns the transitive descendant set', () => {
		const map = buildAdjacency(edges);
		const result = getDescendantsFromMap('a', map);
		expect(result.size).toBe(3);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
		expect(result.has('d')).toBe(true);
	});

	it('is equivalent to getDescendants(id, edges) for the same edge set', () => {
		const map = buildAdjacency(edges);
		for (const id of ['a', 'b', 'c', 'd']) {
			const fromMap = getDescendantsFromMap(id, map);
			const fromEdges = getDescendants(id, edges);
			expect([...fromMap].sort()).toEqual([...fromEdges].sort());
		}
	});
});

describe('cycle contract', () => {
	// Documented contract (see src/lib/utils/dag.ts):
	//   "The `traverse` recursion tracks visited ids in the result
	//    set before recursing, so a malformed cyclic input is
	//    tolerated (the same node is never re-entered). The caller
	//    should still ensure the input is a DAG upstream; the data
	//    layer enforces this via Drizzle FKs and the seed script
	//    rejects forward references that do not resolve."
	//
	// These tests pin the behaviour: cycles must terminate and the
	// visited set must contain every node the traversal can reach
	// before it re-enters a visited one.

	it('terminates on a 2-node cycle a <-> b without recursing forever', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'a' }
		];
		const map = buildAdjacency(edges);
		const ancestors = getAncestorsFromMap('a', map);
		const descendants = getDescendantsFromMap('a', map);
		// `a`'s ancestors include `b`; `a` is NOT in its own
		// ancestors (per the documented "excluding targetId itself"
		// contract).
		expect(ancestors.has('b')).toBe(true);
		expect(ancestors.has('a')).toBe(false);
		expect(descendants.has('b')).toBe(true);
		expect(descendants.has('a')).toBe(false);
	});

	it('terminates on a 3-node cycle a -> b -> c -> a', () => {
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'c' },
			{ from: 'c', to: 'a' }
		];
		const map = buildAdjacency(edges);
		// From `a`, ancestors and descendants both cover the cycle
		// without infinite recursion.
		const ancestors = getAncestorsFromMap('a', map);
		const descendants = getDescendantsFromMap('a', map);
		expect(ancestors.has('b')).toBe(true);
		expect(ancestors.has('c')).toBe(true);
		expect(ancestors.has('a')).toBe(false);
		expect(descendants.has('b')).toBe(true);
		expect(descendants.has('c')).toBe(true);
		expect(descendants.has('a')).toBe(false);
	});

	it('does not include the target itself in its own ancestor / descendant set', () => {
		// Belt-and-suspenders: a cycle must not turn the set into
		// {target, ...rest} even when every other node is reachable
		// through the cycle.
		const edges: Edge[] = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'a' }
		];
		const map = buildAdjacency(edges);
		expect(getAncestorsFromMap('a', map).has('a')).toBe(false);
		expect(getDescendantsFromMap('a', map).has('a')).toBe(false);
	});
});
