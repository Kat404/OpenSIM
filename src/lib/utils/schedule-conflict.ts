/**
 * OpenSIM — Pure schedule-conflict detection.
 *
 * Used by the Reinscripción simulator (Phase 4 Tarea 4.1) to answer
 * "does this candidate group's schedule overlap with anything the
 * student is already taking in this period?" The function is a pure
 * `(candidateBlocks, existingBlocks) -> Set<blockId>` so it can be
 * unit-tested without touching D1.
 *
 * Conflict rule:
 *   Two blocks conflict when they share a day-letter AND their
 *   `[startTime, endTime)` intervals overlap. Touching intervals
 *   (one ends exactly when the other starts) do NOT conflict — that
 *   is how TecNM defines a "back-to-back" class.
 *
 * Time parsing:
 *   Inputs use the canonical 24h "HH:MM" form. We split on ":" and
 *   convert to minutes since midnight so a string-compare cannot
 *   silently accept a malformed time like "9:00" vs "09:00".
 *
 * See: odd/tasks/opensim.md Tarea 4.1; spec rule: "for each
 * candidate group, fetch its schedule blocks; compare against all
 * already-enrolled blocks; if any overlap (same day, time
 * intersection), mark as conflict."
 */

export interface ConflictBlock {
	/** Stable id used as the key in the returned set; e.g. block row id or groupId. */
	id: string | number;
	day: string;
	startTime: string;
	endTime: string;
}

/** Parsed (day, startMin, endMin) tuple for fast overlap checks. */
interface ParsedBlock {
	id: string | number;
	day: string;
	startMin: number;
	endMin: number;
}

function parseBlock(b: ConflictBlock): ParsedBlock | null {
	const start = parseHHMM(b.startTime);
	const end = parseHHMM(b.endTime);
	if (start === null || end === null) return null;
	// Drop malformed blocks (end <= start) — they cannot conflict with
	// anything because they have no valid time range.
	if (end <= start) return null;
	return {
		id: b.id,
		day: normalizeDay(b.day),
		startMin: start,
		endMin: end
	};
}

function parseHHMM(s: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(s);
	if (!m) return null;
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
	return hh * 60 + mm;
}

function normalizeDay(d: string): string {
	return d.trim().toUpperCase();
}

/**
 * Returns the subset of `candidate` block-ids that conflict with
 * `existing` (same day, time overlap). A block id appears in the
 * result set once regardless of how many `existing` blocks it
 * overlaps with — the simulator only needs to know "is this group
 * blocked?", not "how many other classes is it blocked by?".
 */
export function findConflicts<T extends ConflictBlock>(
	candidate: readonly T[],
	existing: readonly ConflictBlock[]
): Set<string | number> {
	const parsedExisting = existing
		.map(parseBlock)
		.filter((b): b is ParsedBlock => b !== null);
	const conflicts = new Set<string | number>();
	for (const c of candidate) {
		const pc = parseBlock(c);
		if (!pc) continue;
		for (const pe of parsedExisting) {
			if (pc.day !== pe.day) continue;
			// Half-open interval overlap: `[pc.start, pc.end)` and
			// `[pe.start, pe.end)` intersect iff pc.start < pe.end
			// AND pe.start < pc.end. Touching intervals (one ends
			// when the other starts) do NOT conflict.
			if (pc.startMin < pe.endMin && pe.startMin < pc.endMin) {
				conflicts.add(pc.id);
				break;
			}
		}
	}
	return conflicts;
}

/**
 * Convenience helper that returns a copy of `candidate` with a
 * `hasConflict: boolean` flag attached. Useful for the simulator's
 * table row model.
 */
export function annotateConflicts<T extends ConflictBlock>(
	candidate: readonly T[],
	existing: readonly ConflictBlock[]
): Array<T & { hasConflict: boolean }> {
	const conflicts = findConflicts(candidate, existing);
	return candidate.map((c) => ({ ...c, hasConflict: conflicts.has(c.id) }));
}
