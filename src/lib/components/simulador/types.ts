/**
 * OpenSIM — Shared types for the Reinscripción simulator.
 *
 * The page loader (`/reinscripcion/+page.server.ts`) emits these
 * shapes so the simulator component can render the catalog without
 * touching Drizzle. The component (`EnrollmentSimulator.svelte`)
 * imports them from here rather than reaching into the route's
 * `+page.server` module, which SvelteKit does not publish outside
 * the route subtree.
 */

export interface OfferGroup {
	groupId: string;
	subjectCanonicalId: string;
	subjectCode: string;
	subjectName: string;
	/** `null` when the curricular area is not classified — which is every
	 * subject in v1, since no source establishes the classification (H4). */
	area: string | null;
	credits: number;
	hasLab: boolean;
	teacherName: string;
	alreadyEnrolled: boolean;
}

export interface OfferBlock {
	id: number;
	groupId: string;
	day: string;
	startTime: string;
	endTime: string;
	classroom: string;
}
