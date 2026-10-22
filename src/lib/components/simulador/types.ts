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

/**
 * The page of the offering catalogue the loader returned, plus the totals
 * the pager and the count badge need (T9.14).
 *
 * The catalogue is 475 rows, so the narrowing and the paging happen in SQL
 * and this shape is what tells the simulator how to build the next request —
 * there is no second, client-side answer to "which groups match".
 */
export interface OfferPage {
	/** The free-text needle as submitted, trimmed; `""` when the filter is clear. */
	query: string;
	credits: "" | "lt5" | "eq5";
	/** 1-based page actually served, after clamping to `pages`. */
	page: number;
	/** Pages the current filter spans; at least 1, even on an empty result. */
	pages: number;
	/** Rows matching the current filter, across every page. */
	totalCount: number;
}

export interface OfferBlock {
	id: number;
	groupId: string;
	day: string;
	startTime: string;
	endTime: string;
	classroom: string;
	/**
	 * The subject the block belongs to. Carried on the row itself because
	 * an ENROLLED block's group is not in the offer page the simulator
	 * renders, so the component cannot look it up there — without these
	 * two fields the "Carga actual" grid shows a dash instead of the
	 * subject the student is taking.
	 */
	subjectCode?: string;
	subjectName?: string;
}
