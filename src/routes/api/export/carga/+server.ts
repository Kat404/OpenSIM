/**
 * OpenSIM — Carga Académica PDF export endpoint.
 *
 * POST /api/export/carga
 *   Generates a vectorial PDF of the current student's enrolled
 *   schedule and streams it back as `application/pdf`.
 *
 * Performance budget (CF-4 + spec §12):
 *   pdf-lib is ~120 KB gzipped. A static import in any client-
 *   reachable code path would push the initial JS bundle over
 *   the 100 KB budget. The endpoint is server-only and pdf-lib
 *   is loaded with `await import(...)` so the cost is paid on
 *   demand by the student who clicks the button, not by every
 *   page load.
 *
 * Auth:
 *   The endpoint reads `locals.user`; the (protected) layout's
 *   middleware does NOT run for `/api/*` routes, so we re-check
 *   here. A missing user returns 401 without loading pdf-lib.
 *
 * See: odd/tasks/opensim.md Tarea 4.3; CF-4 (perf budgets).
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../../cloudflare-workers';
import { getDb } from '#lib/server/db';
import {
	courseGroups,
	courseScheduleBlocks,
	studentProfiles,
	studentProgress,
	subjects
} from '#lib/server/db/schema';
import { getCurrentPeriod } from '#lib/server/enrollment';

const env = workerEnv as OpenSimWorkerEnv;

export const POST: RequestHandler = async ({ locals }) => {
	// Auth gate. The (protected) layout middleware only applies to
	// pages, not /api routes, so we re-check here.
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}
	if (!env.DB) {
		return new Response('Database not available', { status: 503 });
	}

	// DYNAMIC import: pdf-lib is heavy (~120 KB gz). Loaded only
	// on demand by the student who clicks "Descargar PDF".
	const { generateCargaPdf } = await import('#lib/server/pdf/carga');

	const db = getDb(env.DB);
	const u = locals.user;

	// 1. Period (single round-trip, the helper handles the
	//    `status = 'ENROLLED'` filter so future-period LOCKED rows
	//    do not leak into "current").
	const period = await getCurrentPeriod(db, u.controlNumber);
	if (!period) {
		return new Response('No hay periodo activo para exportar.', { status: 400 });
	}

	// 2. Profile (PII-trim: only the four columns the PDF header
	//    needs; CURP / birthState stay server-side, audit NEW-1).
	const profileRows = await db
		.select({
			controlNumber: studentProfiles.controlNumber,
			fullName: studentProfiles.fullName,
			careerCode: studentProfiles.careerCode,
			currentSemester: studentProfiles.currentSemester
		})
		.from(studentProfiles)
		.where(eq(studentProfiles.controlNumber, u.controlNumber))
		.limit(1);
	const profile = profileRows[0];
	if (!profile) {
		return new Response('Student profile not found', { status: 404 });
	}

	// 3. Enrolled subjects for the period.
	const enrolledRows = await db
		.select({ subjectCanonicalId: courseGroups.subjectCanonicalId })
		.from(studentProgress)
		.innerJoin(
			courseGroups,
			and(eq(courseGroups.subjectCanonicalId, studentProgress.subjectCanonicalId))
		)
		.where(
			and(
				eq(studentProgress.studentControlNumber, u.controlNumber),
				eq(studentProgress.status, 'ENROLLED'),
				eq(studentProgress.period, period)
			)
		);
	const enrolledCanonicalIds = Array.from(
		new Set(enrolledRows.map((r) => r.subjectCanonicalId))
	);
	if (enrolledCanonicalIds.length === 0) {
		return new Response('No tienes materias inscritas en este periodo.', { status: 400 });
	}

	// 4. Groups, schedule blocks, and subject catalog run in
	//    parallel. Three queries over indexed columns (groupId,
	//    canonicalId) means a bounded number of round-trips; the
	//    dependency `blocks ← groups` is resolved at the JS layer
	//    once the groups come back, so the inArray filter for
	//    `course_schedule_blocks.groupId` is small and index-
	//    backed.
	const [groups, subjectRows] = await Promise.all([
		db.select().from(courseGroups).where(inArray(courseGroups.subjectCanonicalId, enrolledCanonicalIds)),
		db
			.select({ canonicalId: subjects.canonicalId, code: subjects.code, name: subjects.name })
			.from(subjects)
			.where(inArray(subjects.canonicalId, enrolledCanonicalIds))
	]);
	const realGroupIds = Array.from(new Set(groups.map((g) => g.id)));
	const realBlocks = realGroupIds.length
		? await db
				.select({
					id: courseScheduleBlocks.id,
					groupId: courseScheduleBlocks.groupId,
					day: courseScheduleBlocks.day,
					startTime: courseScheduleBlocks.startTime,
					endTime: courseScheduleBlocks.endTime,
					classroom: courseScheduleBlocks.classroom
				})
				.from(courseScheduleBlocks)
				.where(inArray(courseScheduleBlocks.groupId, realGroupIds))
		: [];

	const subjectMap = new Map(subjectRows.map((s) => [s.canonicalId, { code: s.code, name: s.name }]));

	// 5. Generate the PDF
	const pdfBytes = await generateCargaPdf({
		profile: {
			controlNumber: profile.controlNumber,
			fullName: profile.fullName,
			careerCode: profile.careerCode,
			currentSemester: profile.currentSemester
		},
		period,
		groups,
		blocks: realBlocks,
		subjects: subjectMap
	});

	// Wrap the Uint8Array in a Blob so the Response constructor
	// accepts it under TypeScript's strict `BodyInit` check
	// (`Uint8Array<ArrayBufferLike>` is *runtime*-compatible with
	// the Workers fetch body, but the type system does not know
	// that). The Blob carries the right Content-Type and streams
	// without copying.
	const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
	return new Response(pdfBlob, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="carga-academica-${profile.controlNumber}.pdf"`,
			'Cache-Control': 'no-store'
		}
	});
};
