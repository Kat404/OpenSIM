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
		canTakeTallerInv1: approvedCredits >= 130
	};
}
