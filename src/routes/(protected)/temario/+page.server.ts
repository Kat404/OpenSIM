/**
 * OpenSIM — Temario loader (T9.12).
 *
 * The first real consumer of `subject_units`. The table is written by the
 * seed from `/calificaciones-curso`, the ONLY source that publishes a
 * syllabus — and that endpoint exposes just the subjects of the ACTIVE
 * period. So the table is honest about what exists and silent about the
 * rest, and the silence is a property of the source, not of the plan.
 *
 * Operator decision, 2026-10-13: explicit coverage. The page states how
 * many subjects have a published syllabus and how many do not, and names
 * the cause. A subject the portal never published must read differently
 * from one whose syllabus is empty — they are different facts and
 * collapsing them into "sin temario" would blame the institution for a
 * limitation of the portal.
 *
 * Coverage is counted from the rows, never hard-coded: a subject counts
 * as covered only when it has at least one unit.
 */

import { env as workerEnv } from "cloudflare:workers";
import { asc } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import { subjects, subjectUnits } from "#lib/server/db/schema";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

interface Subtopic {
	index: string;
	title: string;
	evalFrom: string | null;
	evalTo: string | null;
}

interface Unit {
	unitNumber: number;
	title: string;
	subtopics: Subtopic[];
	evalFrom: string | null;
	evalTo: string | null;
	instruments: string[];
	criteria: string[];
}

interface SubjectWithTemario {
	canonicalId: string;
	code: string;
	name: string;
	units: Unit[];
}

const EMPTY: { subjects: SubjectWithTemario[]; coverage: { withTemario: number; total: number } } =
	{
		subjects: [],
		coverage: { withTemario: 0, total: 0 },
	};

/**
 * A stored column that cannot be read must not take the page down: the
 * unit still has a title, and an empty list is the truthful rendering of
 * a list this row does not establish.
 */
function parseJson<T>(raw: string | null, fallback: T): T {
	if (raw === null) return fallback;
	try {
		const parsed = JSON.parse(raw);
		return (Array.isArray(parsed) ? parsed : fallback) as T;
	} catch {
		return fallback;
	}
}

function toSubtopic(raw: Record<string, unknown>): Subtopic {
	return {
		index: typeof raw.index === "string" ? raw.index : "",
		title: typeof raw.title === "string" ? raw.title : "",
		evalFrom: typeof raw.evalFrom === "string" ? raw.evalFrom : null,
		evalTo: typeof raw.evalTo === "string" ? raw.evalTo : null,
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	if (!u) return EMPTY;
	if (!env.DB) return EMPTY;

	const db = getDb(env.DB);

	const [subjectRows, unitRows] = await Promise.all([
		db
			.select({ canonicalId: subjects.canonicalId, code: subjects.code, name: subjects.name })
			.from(subjects)
			.orderBy(asc(subjects.code)),
		db
			.select({
				subjectCanonicalId: subjectUnits.subjectCanonicalId,
				unitNumber: subjectUnits.unitNumber,
				title: subjectUnits.title,
				subtopicsJson: subjectUnits.subtopicsJson,
				evalFrom: subjectUnits.evalFrom,
				evalTo: subjectUnits.evalTo,
				instruments: subjectUnits.instruments,
				criteria: subjectUnits.criteria,
			})
			.from(subjectUnits)
			.orderBy(asc(subjectUnits.subjectCanonicalId), asc(subjectUnits.unitNumber)),
	]);

	const unitsBySubject = new Map<string, Unit[]>();
	for (const row of unitRows) {
		const unit: Unit = {
			unitNumber: row.unitNumber,
			title: row.title,
			subtopics: parseJson<Record<string, unknown>[]>(row.subtopicsJson, []).map(toSubtopic),
			evalFrom: row.evalFrom,
			evalTo: row.evalTo,
			instruments: parseJson<string[]>(row.instruments, []),
			criteria: parseJson<string[]>(row.criteria, []),
		};
		const bucket = unitsBySubject.get(row.subjectCanonicalId);
		if (bucket) bucket.push(unit);
		else unitsBySubject.set(row.subjectCanonicalId, [unit]);
	}

	const result: SubjectWithTemario[] = subjectRows.map((s) => ({
		canonicalId: s.canonicalId,
		code: s.code,
		name: s.name,
		units: unitsBySubject.get(s.canonicalId) ?? [],
	}));

	return {
		subjects: result,
		coverage: {
			withTemario: result.filter((s) => s.units.length > 0).length,
			total: result.length,
		},
	};
};
