/**
 * OpenSIM — DAG algorithm unit tests.
 *
 * Pure tests, no environment setup. The DAG is hand-built in-memory using
 * small graphs (2-6 nodes) to exercise the contract documented in
 * src/lib/utils/dag.ts and odd/tasks/opensim.md §7.1.
 */

import { describe, expect, it } from "vitest";
import type { Edge } from "../../src/lib/utils/dag";
import {
	buildAdjacency,
	decomposeChains,
	describeSeriation,
	evaluateCreditThresholds,
	getAncestors,
	getAncestorsFromMap,
	getDescendants,
	getDescendantsFromMap,
} from "../../src/lib/utils/dag";

/**
 * The 14 verified prerequisite edges of ISIC-2010-224, mirrored from
 * `subject_prerequisites` as seeded from
 * `src/lib/server/db/data/curriculum-isic-2010-224.json`. Canonical ids
 * are the lowercased subject codes, so these ids are stable against the
 * Spanish display names.
 */
const VERIFIED_EDGES: Edge[] = [
	{ from: "acf-0901", to: "acf-0902" },
	{ from: "acf-0902", to: "acf-0904" },
	{ from: "aed-1285", to: "aed-1286" },
	{ from: "aed-1286", to: "aed-1026" },
	{ from: "aed-1026", to: "scd-1027" },
	{ from: "aef-1031", to: "sca-1025" },
	{ from: "sca-1025", to: "scb-1001" },
	{ from: "scc-1007", to: "scd-1011" },
	{ from: "scd-1011", to: "scg-1009" },
	{ from: "aec-1034", to: "scd-1021" },
	{ from: "scd-1021", to: "scd-1004" },
	{ from: "scd-1004", to: "sca-1002" },
	{ from: "scd-1015", to: "scd-1016" },
	{ from: "scc-1014", to: "scc-1023" },
];

describe("getAncestors", () => {
	it("returns an empty set when the target has no parents", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "c", to: "d" },
		];
		const result = getAncestors("a", edges);
		expect(result.size).toBe(0);
	});

	it("returns the direct parents of the target", () => {
		const edges: Edge[] = [
			{ from: "a", to: "c" },
			{ from: "b", to: "c" },
		];
		const result = getAncestors("c", edges);
		expect(result.size).toBe(2);
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
	});

	it("returns transitive ancestors through a chain of three or more nodes", () => {
		// a -> b -> c -> d (target)
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "b", to: "c" },
			{ from: "c", to: "d" },
		];
		const result = getAncestors("d", edges);
		expect(result.size).toBe(3);
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});

	it("does not include the target itself in its ancestors", () => {
		const edges: Edge[] = [{ from: "a", to: "b" }];
		const result = getAncestors("b", edges);
		expect(result.has("b")).toBe(false);
	});

	it("handles a diamond (DAG) without double-counting nodes", () => {
		// a -> b, a -> c, b -> d, c -> d
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
			{ from: "b", to: "d" },
			{ from: "c", to: "d" },
		];
		const result = getAncestors("d", edges);
		expect(result.size).toBe(3);
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});
});

describe("getDescendants", () => {
	it("returns an empty set when the target has no children", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "c", to: "d" },
		];
		const result = getDescendants("d", edges);
		expect(result.size).toBe(0);
	});

	it("returns the direct children of the target", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
		];
		const result = getDescendants("a", edges);
		expect(result.size).toBe(2);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});

	it("returns transitive descendants through a chain of three or more nodes", () => {
		// a -> b -> c -> d
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "b", to: "c" },
			{ from: "c", to: "d" },
		];
		const result = getDescendants("a", edges);
		expect(result.size).toBe(3);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
		expect(result.has("d")).toBe(true);
	});

	it("does not include the target itself in its descendants", () => {
		const edges: Edge[] = [{ from: "a", to: "b" }];
		const result = getDescendants("a", edges);
		expect(result.has("a")).toBe(false);
	});
});

describe("evaluateCreditThresholds", () => {
	it("returns all false for 50 approved credits (below every threshold)", () => {
		const result = evaluateCreditThresholds(50);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
		expect(result.canTakeTallerInv1).toBe(false);
	});

	it("returns canTakeTallerInv1 true at exactly 130 approved credits", () => {
		const result = evaluateCreditThresholds(130);
		expect(result.canTakeTallerInv1).toBe(true);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
	});

	it("returns canStartSocialService true at exactly 182 approved credits", () => {
		const result = evaluateCreditThresholds(182);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
		expect(result.canStartResidency).toBe(false);
	});

	it("returns all true at exactly 208 approved credits (full residency threshold)", () => {
		const result = evaluateCreditThresholds(208);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canStartResidency).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
	});

	it("returns all true for approved credits above the maximum threshold", () => {
		const result = evaluateCreditThresholds(260);
		expect(result.canStartSocialService).toBe(true);
		expect(result.canStartResidency).toBe(true);
		expect(result.canTakeTallerInv1).toBe(true);
	});

	it("returns all false for zero approved credits", () => {
		const result = evaluateCreditThresholds(0);
		expect(result.canStartSocialService).toBe(false);
		expect(result.canStartResidency).toBe(false);
		expect(result.canTakeTallerInv1).toBe(false);
	});
});

describe("buildAdjacency", () => {
	it("returns an empty adjacency for an empty edge list", () => {
		const map = buildAdjacency([]);
		expect(map.children.size).toBe(0);
		expect(map.parents.size).toBe(0);
	});

	it("records every (from -> to) edge in the children map", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
			{ from: "b", to: "d" },
		];
		const map = buildAdjacency(edges);
		expect(map.children.get("a")).toEqual(["b", "c"]);
		expect(map.children.get("b")).toEqual(["d"]);
		expect(map.children.get("c")).toBeUndefined();
		expect(map.children.get("d")).toBeUndefined();
	});

	it("records every (from -> to) edge in the parents map (inverse index)", () => {
		const edges: Edge[] = [
			{ from: "a", to: "c" },
			{ from: "b", to: "c" },
			{ from: "b", to: "d" },
		];
		const map = buildAdjacency(edges);
		expect(map.parents.get("c")).toEqual(["a", "b"]);
		expect(map.parents.get("d")).toEqual(["b"]);
		expect(map.parents.get("a")).toBeUndefined();
		expect(map.parents.get("b")).toBeUndefined();
	});

	it("preserves the input order of siblings in both maps", () => {
		// The retícula connectors rely on stable child order so the
		// Bézier list does not reshuffle between SSR and CSR.
		const edges: Edge[] = [
			{ from: "a", to: "d" },
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
		];
		const map = buildAdjacency(edges);
		expect(map.children.get("a")).toEqual(["d", "b", "c"]);
	});
});

describe("getAncestorsFromMap", () => {
	const edges: Edge[] = [
		{ from: "a", to: "b" },
		{ from: "b", to: "c" },
		{ from: "c", to: "d" },
	];

	it("returns an empty set when the target has no parents", () => {
		const map = buildAdjacency(edges);
		expect(getAncestorsFromMap("a", map).size).toBe(0);
	});

	it("returns the transitive ancestor set", () => {
		const map = buildAdjacency(edges);
		const result = getAncestorsFromMap("d", map);
		expect(result.size).toBe(3);
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});

	it("handles a diamond through the map without double-counting", () => {
		const map = buildAdjacency([
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
			{ from: "b", to: "d" },
			{ from: "c", to: "d" },
		]);
		const result = getAncestorsFromMap("d", map);
		expect(result.size).toBe(3);
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});

	it("is equivalent to getAncestors(id, edges) for the same edge set", () => {
		const map = buildAdjacency(edges);
		// Equivalence: every reachable ancestor via raw edges is
		// also reachable via the pre-built map, and vice versa.
		for (const id of ["a", "b", "c", "d"]) {
			const fromMap = getAncestorsFromMap(id, map);
			const fromEdges = getAncestors(id, edges);
			expect([...fromMap].sort()).toEqual([...fromEdges].sort());
		}
	});
});

describe("getDescendantsFromMap", () => {
	const edges: Edge[] = [
		{ from: "a", to: "b" },
		{ from: "b", to: "c" },
		{ from: "c", to: "d" },
	];

	it("returns an empty set when the target has no children", () => {
		const map = buildAdjacency(edges);
		expect(getDescendantsFromMap("d", map).size).toBe(0);
	});

	it("returns the transitive descendant set", () => {
		const map = buildAdjacency(edges);
		const result = getDescendantsFromMap("a", map);
		expect(result.size).toBe(3);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
		expect(result.has("d")).toBe(true);
	});

	it("is equivalent to getDescendants(id, edges) for the same edge set", () => {
		const map = buildAdjacency(edges);
		for (const id of ["a", "b", "c", "d"]) {
			const fromMap = getDescendantsFromMap(id, map);
			const fromEdges = getDescendants(id, edges);
			expect([...fromMap].sort()).toEqual([...fromEdges].sort());
		}
	});
});

describe("cycle contract", () => {
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

	it("terminates on a 2-node cycle a <-> b without recursing forever", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "b", to: "a" },
		];
		const map = buildAdjacency(edges);
		const ancestors = getAncestorsFromMap("a", map);
		const descendants = getDescendantsFromMap("a", map);
		// `a`'s ancestors include `b`; `a` is NOT in its own
		// ancestors (per the documented "excluding targetId itself"
		// contract).
		expect(ancestors.has("b")).toBe(true);
		expect(ancestors.has("a")).toBe(false);
		expect(descendants.has("b")).toBe(true);
		expect(descendants.has("a")).toBe(false);
	});

	it("terminates on a 3-node cycle a -> b -> c -> a", () => {
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "b", to: "c" },
			{ from: "c", to: "a" },
		];
		const map = buildAdjacency(edges);
		// From `a`, ancestors and descendants both cover the cycle
		// without infinite recursion.
		const ancestors = getAncestorsFromMap("a", map);
		const descendants = getDescendantsFromMap("a", map);
		expect(ancestors.has("b")).toBe(true);
		expect(ancestors.has("c")).toBe(true);
		expect(ancestors.has("a")).toBe(false);
		expect(descendants.has("b")).toBe(true);
		expect(descendants.has("c")).toBe(true);
		expect(descendants.has("a")).toBe(false);
	});

	it("does not include the target itself in its own ancestor / descendant set", () => {
		// Belt-and-suspenders: a cycle must not turn the set into
		// {target, ...rest} even when every other node is reachable
		// through the cycle.
		const edges: Edge[] = [
			{ from: "a", to: "b" },
			{ from: "b", to: "a" },
		];
		const map = buildAdjacency(edges);
		expect(getAncestorsFromMap("a", map).has("a")).toBe(false);
		expect(getDescendantsFromMap("a", map).has("a")).toBe(false);
	});
});

describe("decomposeChains", () => {
	it("returns no chains for an edge-less graph", () => {
		const { chains, chainIndexBySubject } = decomposeChains([]);
		expect(chains).toEqual([]);
		expect(chainIndexBySubject.size).toBe(0);
	});

	it("splits the 14 verified ISIC-2010-224 edges into the seven documented chains", () => {
		const { chains } = decomposeChains(VERIFIED_EDGES);
		const asText = chains.map((c) => c.join(" -> ")).sort();
		expect(asText).toEqual([
			"acf-0901 -> acf-0902 -> acf-0904",
			"aec-1034 -> scd-1021 -> scd-1004 -> sca-1002",
			"aed-1285 -> aed-1286 -> aed-1026 -> scd-1027",
			"aef-1031 -> sca-1025 -> scb-1001",
			"scc-1007 -> scd-1011 -> scg-1009",
			"scc-1014 -> scc-1023",
			"scd-1015 -> scd-1016",
		]);
	});

	it("covers exactly the 21 SERIALIZED subjects, each in exactly one chain", () => {
		const { chains, chainIndexBySubject } = decomposeChains(VERIFIED_EDGES);
		const members = chains.flat();
		expect(members).toHaveLength(21);
		expect(new Set(members).size).toBe(21);
		expect(chainIndexBySubject.size).toBe(21);
		for (const id of members) {
			const chain = chains[chainIndexBySubject.get(id) ?? -1];
			expect(chain.includes(id)).toBe(true);
		}
	});

	it("orders every chain prerequisite-first for every edge", () => {
		const { chains } = decomposeChains(VERIFIED_EDGES);
		for (const chain of chains) {
			for (const edge of VERIFIED_EDGES) {
				const from = chain.indexOf(edge.from);
				const to = chain.indexOf(edge.to);
				if (from < 0 || to < 0) continue;
				expect(from).toBeLessThan(to);
			}
		}
	});

	it("keeps a subject with no incoming edge out of every chain and every traversal", () => {
		// `aca-0910` is one of the 16 specialty modules: no verified edge
		// reaches it, so it is not part of any seriation chain and its
		// traversal sets are empty.
		const map = buildAdjacency(VERIFIED_EDGES);
		const { chainIndexBySubject } = decomposeChains(VERIFIED_EDGES);
		expect(map.parents.get("aca-0910")).toBeUndefined();
		expect(chainIndexBySubject.has("aca-0910")).toBe(false);
		expect(getAncestorsFromMap("aca-0910", map).size).toBe(0);
		expect(getDescendantsFromMap("aca-0910", map).size).toBe(0);
	});

	it("keeps a branching subject in a single chain, still prerequisite-first", () => {
		// a -> b, a -> c, b -> d, c -> d: a diamond, not a path.
		const { chains, chainIndexBySubject } = decomposeChains([
			{ from: "a", to: "b" },
			{ from: "a", to: "c" },
			{ from: "b", to: "d" },
			{ from: "c", to: "d" },
		]);
		expect(chains).toHaveLength(1);
		expect([...chains[0]].sort()).toEqual(["a", "b", "c", "d"]);
		expect(chains[0].indexOf("a")).toBeLessThan(chains[0].indexOf("d"));
		expect(chainIndexBySubject.get("d")).toBe(0);
	});

	it("terminates on a cyclic input, emitting every subject exactly once", () => {
		// Same cycle contract as the traversals: the walk must not hang and
		// must not drop or duplicate a node.
		const { chains, chainIndexBySubject } = decomposeChains([
			{ from: "a", to: "b" },
			{ from: "b", to: "c" },
			{ from: "c", to: "a" },
		]);
		expect(chains).toHaveLength(1);
		expect([...chains[0]].sort()).toEqual(["a", "b", "c"]);
		expect(chainIndexBySubject.size).toBe(3);
	});

	it("separates a cycle from the acyclic chain next to it", () => {
		const { chains } = decomposeChains([
			{ from: "a", to: "b" },
			{ from: "b", to: "a" },
			{ from: "x", to: "y" },
		]);
		expect(chains).toHaveLength(2);
		expect([...chains[0]].sort()).toEqual(["a", "b"]);
		expect([...chains[1]].sort()).toEqual(["x", "y"]);
	});
});

describe("describeSeriation", () => {
	const decomposition = decomposeChains(VERIFIED_EDGES);

	it("returns the chain and position of a SERIALIZED subject", () => {
		const info = describeSeriation("aed-1026", "SERIALIZED", decomposition);
		expect(info.state).toBe("SERIALIZED");
		if (info.state !== "SERIALIZED") throw new Error("expected SERIALIZED");
		expect(info.chain?.subjects).toEqual(["aed-1285", "aed-1286", "aed-1026", "scd-1027"]);
		expect(info.chain?.position).toBe(2);
		expect(decomposition.chains[info.chain?.index ?? -1]).toEqual(info.chain?.subjects);
	});

	it("returns INDEPENDENT with no chain field at all", () => {
		// The documented triple: the INDEPENDENT verdict is a source
		// statement, not an inference from an empty edge list.
		expect(describeSeriation("scc-1017", "INDEPENDENT", decomposition)).toStrictEqual({
			state: "INDEPENDENT",
		});
	});

	it("never reports an UNKNOWN subject as INDEPENDENT", () => {
		const info = describeSeriation("scc-1017", "UNKNOWN", decomposition);
		expect(info).toStrictEqual({ state: "UNKNOWN" });
		expect(info.state).not.toBe("INDEPENDENT");
		expect("chain" in info).toBe(false);
	});

	it("does not invent a chain for an UNKNOWN subject that sits in one", () => {
		// Even when the edge list locates the subject, a stored UNKNOWN
		// state is returned verbatim — it means "not established", never
		// "independent" and never "serialized".
		expect(describeSeriation("acf-0902", "UNKNOWN", decomposition)).toStrictEqual({
			state: "UNKNOWN",
		});
	});

	it("surfaces a SERIALIZED subject that no edge locates as a null chain", () => {
		// Data defect: the column claims a chain the edge list cannot
		// produce. Reported honestly instead of being hidden.
		expect(describeSeriation("aca-0910", "SERIALIZED", decomposition)).toStrictEqual({
			state: "SERIALIZED",
			chain: null,
		});
	});

	it("hands out a copy of the chain so a caller cannot reorder the decomposition", () => {
		const info = describeSeriation("acf-0901", "SERIALIZED", decomposition);
		if (info.state !== "SERIALIZED" || !info.chain) throw new Error("expected a chain");
		info.chain.subjects.reverse();
		expect(decomposeChains(VERIFIED_EDGES).chains[info.chain.index]).toEqual([
			"acf-0901",
			"acf-0902",
			"acf-0904",
		]);
	});
});
