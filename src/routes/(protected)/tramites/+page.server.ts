/**
 * OpenSIM — Trámites page loader (Phase 4 Tarea 4.2; T9.13).
 *
 * Computes the unlock state of the three academic procedures:
 *   - Servicio Social       (>= 182 reticular CR + >= 5 complementary CR)
 *   - Residencia Profesional (>= 208 CR, 80% of 260)
 *   - Titulación            (>= 260 CR + Servicio Social done)
 *
 * Servicio Social is gated twice (T9.13, operator decision 2026-10-10).
 * The complementary subjects carry 0 reticular credits by construction,
 * so the two counts never overlap and neither can stand in for the other.
 *
 * The credit-threshold math lives in `evaluateCreditThresholds`
 * (src/lib/utils/dag.ts) so the numbers are defined in exactly
 * one place. The page surfaces the thresholds to the Svelte
 * component so the stepper can render the locked/unlocked state
 * without re-implementing the rule.
 *
 * PII trim (audit NEW-1): only the credits needed to evaluate the
 * thresholds are pulled from the profile; CURP / birthState stay
 * server-side.
 *
 * See: odd/tasks/opensim.md Tarea 4.2; odd/tasks/phase-9-ui-integration.md
 * T9.13.
 */

import { env as workerEnv } from "cloudflare:workers";
import { type Actions, fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { ProcedureStatus } from "#lib/components/tramites/types";
import { getDb } from "#lib/server/db";
import {
	complementaryCreditActivities,
	studentProfiles,
	studentProgress,
} from "#lib/server/db/schema";
import { COMPLEMENTARY_CREDITS_REQUIRED, evaluateCreditThresholds } from "#lib/utils/dag";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

const TOTAL_CREDITS = 260;
const SOCIAL_SERVICE_CANONICAL_ID = "servicio-social";
const SOCIAL_SERVICE_RETICULAR_REQUIRED = 182;

export const load: PageServerLoad = async ({ locals }) => {
	// Explicit guard mirrors reinscripcion/+page.server.ts (audit R8-7 /
	// P0-3). The (protected) layout normally populates `locals.user`
	// before we get here; the non-null assertion is safe in production
	// but the guard turns a layout regression into a clean stub render
	// rather than a 500 on `u.approvedCredits`.
	const u = locals.user;

	if (!u) {
		return {
			approvedCredits: 0,
			complementaryCredits: 0,
			complementaryRequired: COMPLEMENTARY_CREDITS_REQUIRED,
			totalCredits: TOTAL_CREDITS,
			socialServiceDone: false,
			procedures: [
				{
					id: "servicio-social" as const,
					label: "Servicio Social",
					description: "500 horas de práctica profesional en dependencias públicas o privadas.",
					creditsRequired: SOCIAL_SERVICE_RETICULAR_REQUIRED,
					creditsHave: 0,
					creditsRemaining: SOCIAL_SERVICE_RETICULAR_REQUIRED,
					percentage: 0,
					unlocked: false,
					blockedReason: "No autenticado. Inicia sesión.",
				},
				{
					id: "residencia" as const,
					label: "Residencia Profesional",
					description: "Proyecto terminal con duración de 4 a 6 meses en una organización.",
					creditsRequired: 208,
					creditsHave: 0,
					creditsRemaining: 208,
					percentage: 0,
					unlocked: false,
					blockedReason: "No autenticado. Inicia sesión.",
				},
				{
					id: "titulacion" as const,
					label: "Titulación",
					description:
						"Acto protocolario para obtener el título de Ingeniero en Sistemas Computacionales.",
					creditsRequired: 260,
					creditsHave: 0,
					creditsRemaining: 260,
					percentage: 0,
					unlocked: false,
					blockedReason: "No autenticado. Inicia sesión.",
				},
			],
		};
	}

	if (!env.DB) {
		// Without DB we cannot evaluate thresholds; surface a
		// neutral "0 / 260" view so the page still renders. The
		// stepper shows all procedures as locked with the
		// "no DB" reason; production never hits this branch.
		const stub = (
			id: ProcedureStatus["id"],
			label: string,
			description: string,
			creditsRequired: number,
		): ProcedureStatus => ({
			id,
			label,
			description,
			creditsRequired,
			creditsHave: 0,
			creditsRemaining: creditsRequired,
			percentage: 0,
			unlocked: false,
			blockedReason: "Servicio no disponible",
		});
		return {
			approvedCredits: 0,
			complementaryCredits: 0,
			complementaryRequired: COMPLEMENTARY_CREDITS_REQUIRED,
			totalCredits: TOTAL_CREDITS,
			socialServiceDone: false,
			procedures: [
				stub(
					"servicio-social",
					"Servicio Social",
					"500 horas de práctica profesional en dependencias públicas o privadas.",
					SOCIAL_SERVICE_RETICULAR_REQUIRED,
				),
				stub(
					"residencia",
					"Residencia Profesional",
					"Proyecto terminal con duración de 4 a 6 meses en una organización.",
					208,
				),
				stub(
					"titulacion",
					"Titulación",
					"Acto protocolario para obtener el título de Ingeniero en Sistemas.",
					260,
				),
			],
		};
	}

	const db = getDb(env.DB);

	const [profileRows, progressRows, complementaryRows] = await Promise.all([
		db
			.select({
				approvedCredits: studentProfiles.approvedCredits,
				completedCredits: studentProfiles.completedCredits,
				advancePercentage: studentProfiles.advancePercentage,
			})
			.from(studentProfiles)
			.where(eq(studentProfiles.controlNumber, u.controlNumber))
			.limit(1),
		db
			.select({
				subjectCanonicalId: studentProgress.subjectCanonicalId,
				status: studentProgress.status,
			})
			.from(studentProgress)
			.where(eq(studentProgress.studentControlNumber, u.controlNumber)),
		// One row per COMPLETED complementary activity, and one activity
		// counts as one complementary credit (T9.13). The table carries no
		// credit column because the four complementary subjects are
		// 0-credit transversal modules by construction.
		db
			.select({ subjectCanonicalId: complementaryCreditActivities.subjectCanonicalId })
			.from(complementaryCreditActivities)
			.where(eq(complementaryCreditActivities.studentControlNumber, u.controlNumber)),
	]);

	const profile = profileRows[0];
	const approvedCredits = profile?.approvedCredits ?? u.approvedCredits;
	const complementaryCredits = complementaryRows.length;
	const socialServiceDone = progressRows.some(
		(r) => r.subjectCanonicalId === SOCIAL_SERVICE_CANONICAL_ID && r.status === "APPROVED",
	);

	const thresholds = evaluateCreditThresholds(approvedCredits, complementaryCredits);

	// The blocked reason names the gate that is actually unmet. Both can
	// fail at once; reticular comes first because it is the slower one.
	const socialServiceBlockReason = ((): string | null => {
		if (thresholds.canStartSocialService) return null;
		const missingReticular = SOCIAL_SERVICE_RETICULAR_REQUIRED - approvedCredits;
		if (missingReticular > 0) {
			return `Necesitas ${missingReticular} créditos reticulares más (tienes ${approvedCredits} de ${TOTAL_CREDITS})`;
		}
		const missingComplementary = COMPLEMENTARY_CREDITS_REQUIRED - complementaryCredits;
		return `Necesitas ${missingComplementary} créditos complementarios más (tienes ${complementaryCredits} de ${COMPLEMENTARY_CREDITS_REQUIRED}). Los complementarios son una puerta aparte: no sustituyen los ${SOCIAL_SERVICE_RETICULAR_REQUIRED} reticulares.`;
	})();

	const social: ProcedureStatus = {
		id: "servicio-social",
		label: "Servicio Social",
		description: "500 horas de práctica profesional en dependencias públicas o privadas.",
		creditsRequired: SOCIAL_SERVICE_RETICULAR_REQUIRED,
		creditsHave: approvedCredits,
		creditsRemaining: Math.max(0, SOCIAL_SERVICE_RETICULAR_REQUIRED - approvedCredits),
		percentage: Math.min(100, (approvedCredits / SOCIAL_SERVICE_RETICULAR_REQUIRED) * 100),
		unlocked: thresholds.canStartSocialService,
		blockedReason: socialServiceBlockReason,
	};
	const residencia: ProcedureStatus = {
		id: "residencia",
		label: "Residencia Profesional",
		description: "Proyecto terminal con duración de 4 a 6 meses en una organización.",
		creditsRequired: 208,
		creditsHave: approvedCredits,
		creditsRemaining: Math.max(0, 208 - approvedCredits),
		percentage: Math.min(100, (approvedCredits / 208) * 100),
		unlocked: thresholds.canStartResidency,
		blockedReason: thresholds.canStartResidency
			? null
			: `Necesitas ${208 - approvedCredits} créditos más (tienes ${approvedCredits} de ${TOTAL_CREDITS})`,
	};
	const titulacion: ProcedureStatus = {
		id: "titulacion",
		label: "Titulación",
		description:
			"Acto protocolario para obtener el título de Ingeniero en Sistemas Computacionales.",
		creditsRequired: 260,
		creditsHave: approvedCredits,
		creditsRemaining: Math.max(0, 260 - approvedCredits),
		percentage: Math.min(100, (approvedCredits / 260) * 100),
		unlocked: thresholds.canStartResidency && socialServiceDone,
		blockedReason:
			thresholds.canStartResidency && socialServiceDone
				? null
				: !thresholds.canStartResidency
					? `Necesitas ${208 - approvedCredits} créditos más (tienes ${approvedCredits} de ${TOTAL_CREDITS})`
					: "Debes completar el Servicio Social antes de titularte",
	};

	return {
		approvedCredits,
		complementaryCredits,
		complementaryRequired: COMPLEMENTARY_CREDITS_REQUIRED,
		totalCredits: TOTAL_CREDITS,
		socialServiceDone,
		procedures: [social, residencia, titulacion],
	};
};

export const actions: Actions = {
	/**
	 * Stub form action for Phase 4: a real submission flow is
	 * scoped for Phase 5+. The action validates the procedure id
	 * (one of the three in scope) and returns a `fail()` so the
	 * page can render a "Trámite en desarrollo" notice. The
	 * server-side check is intentional: the spec promises a
	 * form-action surface so the forms are not just decoration.
	 */
	default: async ({ request, locals }) => {
		// Explicit guard (audit R8-7 / P0-3): SvelteKit 3's action
		// lifecycle runs before any layout `load`, so the layout
		// middleware does NOT cover this action. An anonymous POST
		// would otherwise reach this body — the stub doesn't read
		// `locals.user`, but defending the surface here prevents a
		// future change from accidentally leaking data through this
		// path.
		if (!locals.user) {
			return fail(401, { error: "No autenticado. Inicia sesión." });
		}
		const form = await request.formData();
		const procedure = String(form.get("procedure") ?? "");
		if (
			procedure !== "servicio-social" &&
			procedure !== "residencia" &&
			procedure !== "titulacion"
		) {
			return fail(400, { error: "Trámite no reconocido.", procedure });
		}
		return fail(202, {
			notice: "Trámite en desarrollo",
			procedure,
		});
	},
};
