/**
 * OpenSIM — DAG traversal helpers.
 *
 * Pure, side-effect-free functions over an array of directed edges.
 * Used by the curriculum retícula (Phase 3 Tarea 3.4) to compute the
 * prerequisite fan-in/fan-out of a subject node and to decide whether
 * a student can start procedures (social service, residency) based on
 * approved credits.
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
