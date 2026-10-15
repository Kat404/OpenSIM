/**
 * OpenSIM — DAG traversal helpers.
 *
 * Pure, side-effect-free functions over an array of directed edges.
 * Used by the curriculum retícula (Phase 3 Tarea 3.4) to compute the
 * prerequisite fan-in/fan-out of a subject node and to decide whether
 * a student can start procedures (social service, residency) based on
 * approved credits. T9.9 added the seriation view: which prerequisite
 * chain a subject belongs to, and what the retícula may honestly say
 * about a subject whose seriation is SERIALIZED / INDEPENDENT /
 * UNKNOWN.
 *
 * Edge convention:
 *   { from, to }  means  from -> to   (i.e. `from` is a prerequisite of `to`).
 *   `getAncestors(targetId)` therefore returns the transitive set of `from`
 *   nodes that lead into `targetId`. `getDescendants(targetId)` returns the
 *   transitive set of `to` nodes reachable from `targetId`.
 *
 * Cycle safety:
 *   The `traverse` recursion tracks visited ids in the result set before
 *   recursing, so a malformed cyclic input is tolerated (the same node is
 *   never re-entered). The caller should still ensure the input is a DAG
 *   upstream; the data layer enforces this via Drizzle FKs and the seed
 *   script rejects forward references that do not resolve.
 *
 * See: odd/tasks/opensim.md §7.1
 */

import type { SubjectSeriationState } from "#lib/server/db/schema";

// ---------- Edge model ----------

export interface Edge {
	from: string;
	to: string;
}

/**
 * Adjacency map keyed by node id; each value lists the direct
 * children (`to`) reachable from that node. Pre-computed once from an
 * `Edge[]` array, this map turns traversal into O(V+E) work without
 * re-scanning the edge list on every step — the hot path for the
 * retícula DAG (Phase 3 Tarea 3.4) where hover highlighting must
 * stay under the INP 200ms budget.
 */
export type AdjacencyMap = Map<string, string[]>;

export interface ParentMap {
	// For a child node, the list of its direct parents.
	children: AdjacencyMap;
	parents: Map<string, string[]>;
}

/**
 * Builds a `{ children, parents }` map from an `Edge[]` in O(E).
 * Pass the result to `getAncestorsFromMap` / `getDescendantsFromMap`
 * instead of the raw edge list when you expect to traverse many
 * nodes from the same graph (the retícula DAG hover path is the
 * canonical example).
 */
export function buildAdjacency(edges: Edge[]): ParentMap {
	const children: AdjacencyMap = new Map();
	const parents: Map<string, string[]> = new Map();
	for (const { from, to } of edges) {
		const ch = children.get(from);
		if (ch) ch.push(to);
		else children.set(from, [to]);
		const pa = parents.get(to);
		if (pa) pa.push(from);
		else parents.set(to, [from]);
	}
	return { children, parents };
}

// ---------- Traversal ----------

/**
 * Returns the transitive set of ancestor ids of `targetId` (all `from` nodes
 * that can reach `targetId` through any number of edges), excluding
 * `targetId` itself.
 *
 * The returned set is empty when the target has no incoming edges.
 */
export function getAncestors(targetId: string, edges: Edge[]): Set<string> {
	const ancestors = new Set<string>();
	function traverse(currentId: string): void {
		const directParents = edges.filter((e) => e.to === currentId).map((e) => e.from);
		for (const parentId of directParents) {
			// Self-exclusion: a cyclic input would otherwise land
			// `targetId` in its own ancestor set via the visited-
			// pre-add path. The contract is "excluding `targetId`
			// itself" in all cases.
			if (parentId === targetId) continue;
			if (!ancestors.has(parentId)) {
				ancestors.add(parentId);
				traverse(parentId);
			}
		}
	}
	traverse(targetId);
	return ancestors;
}

/**
 * Returns the transitive set of descendant ids of `targetId` (all `to` nodes
 * reachable from `targetId` through any number of edges), excluding
 * `targetId` itself.
 *
 * The returned set is empty when the target has no outgoing edges.
 */
export function getDescendants(targetId: string, edges: Edge[]): Set<string> {
	const descendants = new Set<string>();
	function traverse(currentId: string): void {
		const directChildren = edges.filter((e) => e.from === currentId).map((e) => e.to);
		for (const childId of directChildren) {
			if (childId === targetId) continue;
			if (!descendants.has(childId)) {
				descendants.add(childId);
				traverse(childId);
			}
		}
	}
	traverse(targetId);
	return descendants;
}

/**
 * Same traversal as `getAncestors` but takes a pre-built
 * `{ children, parents }` adjacency map instead of the raw `Edge[]`.
 * Use this when you expect to traverse many nodes from the same
 * graph in one render cycle (Phase 3 Tarea 3.4 retícula hover).
 */
export function getAncestorsFromMap(targetId: string, map: ParentMap): Set<string> {
	const ancestors = new Set<string>();
	function traverse(currentId: string): void {
		const directParents = map.parents.get(currentId);
		if (!directParents) return;
		for (const parentId of directParents) {
			if (parentId === targetId) continue;
			if (!ancestors.has(parentId)) {
				ancestors.add(parentId);
				traverse(parentId);
			}
		}
	}
	traverse(targetId);
	return ancestors;
}

/**
 * Same traversal as `getDescendants` but takes a pre-built
 * `{ children, parents }` adjacency map instead of the raw `Edge[]`.
 */
export function getDescendantsFromMap(targetId: string, map: ParentMap): Set<string> {
	const descendants = new Set<string>();
	function traverse(currentId: string): void {
		const directChildren = map.children.get(currentId);
		if (!directChildren) return;
		for (const childId of directChildren) {
			if (childId === targetId) continue;
			if (!descendants.has(childId)) {
				descendants.add(childId);
				traverse(childId);
			}
		}
	}
	traverse(targetId);
	return descendants;
}

// ---------- Chains ----------

/**
 * The seriation chains of a graph: one connected group of subjects per
 * entry, each listed prerequisite-first.
 *
 * A subject touched by no edge is in no chain. "No verified edge" is what
 * INDEPENDENT and UNKNOWN both look like from the edge list alone, so the
 * chain decomposition cannot tell them apart — only `describeSeriation`,
 * which is given the stored tri-state, can.
 */
export interface ChainDecomposition {
	/** One entry per connected group, prerequisite-first. */
	chains: string[][];
	/** Subject id -> index into `chains`. Nodes without an edge are absent. */
	chainIndexBySubject: Map<string, number>;
}

/**
 * Splits an edge list into chains in O(V+E).
 *
 * A chain is a connected group, not a path, so a subject that is both a
 * prerequisite and a dependent of others stays in a single chain — that is
 * the general case; the verified ISIC-2010-224 graph happens to decompose
 * into seven simple paths.
 *
 * Within a chain the subjects are ordered prerequisite-first by a post-order
 * DFS whose result is reversed: for every edge `p -> c` the walk finishes
 * `c` before `p`, so `p` lands first. The `visited` set is marked before
 * recursing, so a cyclic input terminates with every subject emitted
 * exactly once (same cycle tolerance as the traversals above).
 *
 * Called once per render by the retícula DAG when it needs to know which
 * chain a hovered subject belongs to.
 */
export function decomposeChains(edges: Edge[]): ChainDecomposition {
	const { children, parents } = buildAdjacency(edges);
	const chains: string[][] = [];
	const chainIndexBySubject = new Map<string, number>();

	// First-appearance node order over the edge list. The walks below are
	// deterministic, so the same edge list always yields the same chains
	// in the same order (SSR / CSR parity for the retícula).
	const nodes = new Set<string>();
	for (const { from, to } of edges) {
		nodes.add(from);
		nodes.add(to);
	}

	const assigned = new Set<string>();
	for (const root of nodes) {
		if (assigned.has(root)) continue;
		const component: string[] = [];
		// Undirected flood fill: walk children and parents alike, because a
		// chain is defined by connectivity, not by direction.
		const collect = (id: string): void => {
			if (assigned.has(id)) return;
			assigned.add(id);
			component.push(id);
			for (const next of children.get(id) ?? []) collect(next);
			for (const next of parents.get(id) ?? []) collect(next);
		};
		collect(root);

		const visited = new Set<string>();
		const postOrder: string[] = [];
		const postVisit = (id: string): void => {
			if (visited.has(id)) return;
			visited.add(id);
			for (const child of children.get(id) ?? []) postVisit(child);
			postOrder.push(id);
		};
		// Seeding the walk with every member of the component covers the
		// branches that no single root reaches by following children only.
		for (const id of component) postVisit(id);

		const index = chains.length;
		chains.push(postOrder.reverse());
		for (const id of component) chainIndexBySubject.set(id, index);
	}
	return { chains, chainIndexBySubject };
}

// ---------- Seriation ----------

/**
 * What the retícula may honestly say about one subject's seriation. The
 * union is discriminated on `state`, so the three states cannot collapse
 * into one another: reading `chain` first requires narrowing to
 * SERIALIZED, and an UNKNOWN subject is never handed a chain.
 *
 * The literal states mirror `SUBJECT_SERIATION_STATES` in
 * `#lib/server/db/schema` (imported as a type only — this module runs in
 * the browser and must not drag drizzle-orm into the bundle).
 */
export type SeriationInfo =
	| { state: "SERIALIZED"; chain: { index: number; subjects: string[]; position: number } | null }
	| { state: "INDEPENDENT" }
	| { state: "UNKNOWN" };

/**
 * Describes one subject's seriation against a chain decomposition.
 *
 * `UNKNOWN` is returned verbatim: it means "not established from a source",
 * not "not serialized", so this never invents a chain for it and never
 * reports it as INDEPENDENT. `chain` is null only for a subject that claims
 * SERIALIZED but that the edge list does not place in a chain — a data
 * defect the UI should surface rather than hide.
 *
 * Called per subject by the retícula when it decides what to render.
 */
export function describeSeriation(
	subjectId: string,
	state: SubjectSeriationState,
	decomposition: ChainDecomposition,
): SeriationInfo {
	if (state === "SERIALIZED") {
		const index = decomposition.chainIndexBySubject.get(subjectId);
		if (index === undefined) return { state: "SERIALIZED", chain: null };
		const subjects = decomposition.chains[index];
		const position = subjects.indexOf(subjectId);
		if (position < 0) return { state: "SERIALIZED", chain: null };
		// `subjects` is copied so a caller cannot reorder the shared chain array.
		return { state: "SERIALIZED", chain: { index, subjects: [...subjects], position } };
	}
	if (state === "INDEPENDENT") return { state: "INDEPENDENT" };
	return { state: "UNKNOWN" };
}

// ---------- Credit thresholds ----------

export interface CreditThresholds {
	canStartSocialService: boolean;
	canStartResidency: boolean;
	canTakeTallerInv1: boolean;
}

/**
 * Returns whether a student with the given number of approved credits can
 * start the named academic procedure. Thresholds are computed as fixed
 * percentages of the ISIC-2010-224 plan total of 260 credits:
 *
 *   Taller de Investigación I  >= 50%  (130 credits)
 *   Servicio Social            >= 70%  (182 credits)
 *   Residencia Profesional     >= 80%  (208 credits)
 *
 * Pure function: no side effects, safe to call from form loaders and
 * Vitest without setup.
 */
export function evaluateCreditThresholds(approvedCredits: number): CreditThresholds {
	return {
		canStartSocialService: approvedCredits >= 182,
		canStartResidency: approvedCredits >= 208,
		canTakeTallerInv1: approvedCredits >= 130,
	};
}
