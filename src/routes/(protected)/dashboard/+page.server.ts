/**
 * OpenSIM — Dashboard placeholder loader.
 *
 * The (protected) layout's load function has already run by the time
 * we get here, so `locals.user` is guaranteed to be set (or the user
 * would have been redirected to /login). We re-emit the profile
 * fields the placeholder page renders.
 *
 * Phase 3 (Tarea 3.2) replaces this with KPI cards, today's classes,
 * pending procedures, and quick links.
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// `locals.user` is non-null here — the (protected) layout's load
	// function would have redirected otherwise.
	const u = locals.user!;
	return {
		fullName: u.fullName,
		controlNumber: u.controlNumber,
		currentSemester: u.currentSemester,
		certifiedAverage: u.certifiedAverage,
		completedCredits: u.completedCredits,
		remainingCredits: u.remainingCredits,
		advancePercentage: u.advancePercentage,
		status: u.status
	};
};
