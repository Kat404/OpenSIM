/**
 * OpenSIM — Trámites page loader (Phase 4 Tarea 4.2).
 *
 * Computes the unlock state of the three academic procedures:
 *   - Servicio Social       (>= 182 CR, 70% of 260)
 *   - Residencia Profesional (>= 208 CR, 80% of 260)
 *   - Titulación            (>= 260 CR + Servicio Social done)
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
 * See: odd/tasks/opensim.md Tarea 4.2.
 */

import { eq } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db';
import { studentProgress, studentProfiles } from '#lib/server/db/schema';
import { evaluateCreditThresholds } from '#lib/utils/dag';
import type { ProcedureStatus } from '#lib/components/tramites/types';

const env = workerEnv as OpenSimWorkerEnv;

const TOTAL_CREDITS = 260;
const SOCIAL_SERVICE_CANONICAL_ID = 'servicio-social';

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;

	if (!env.DB) {
		// Without DB we cannot evaluate thresholds; surface a
		// neutral "0 / 260" view so the page still renders. The
		// stepper shows all procedures as locked with the
		// "no DB" reason; production never hits this branch.
		const stub = (id: ProcedureStatus['id'], label: string, description: string, creditsRequired: number): ProcedureStatus => ({
			id,
			label,
			description,
			creditsRequired,
			creditsHave: 0,
			creditsRemaining: creditsRequired,
			percentage: 0,
			unlocked: false,
			blockedReason: 'Servicio no disponible'
		});
		return {
			approvedCredits: 0,
			totalCredits: TOTAL_CREDITS,
			socialServiceDone: false,
			procedures: [
				stub('servicio-social', 'Servicio Social', '500 horas de práctica profesional en dependencias públicas o privadas.', 182),
				stub('residencia', 'Residencia Profesional', 'Proyecto terminal con duración de 4 a 6 meses en una organización.', 208),
				stub('titulacion', 'Titulación', 'Acto protocolario para obtener el título de Ingeniero en Sistemas.', 260)
			]
		};
	}

	const db = getDb(env.DB);

	const [profileRows, progressRows] = await Promise.all([
		db
			.select({
				approvedCredits: studentProfiles.approvedCredits,
				completedCredits: studentProfiles.completedCredits,
				advancePercentage: studentProfiles.advancePercentage
			})
			.from(studentProfiles)
			.where(eq(studentProfiles.controlNumber, u.controlNumber))
			.limit(1),
		db
			.select({ subjectCanonicalId: studentProgress.subjectCanonicalId, status: studentProgress.status })
			.from(studentProgress)
			.where(eq(studentProgress.studentControlNumber, u.controlNumber))
	]);

	const profile = profileRows[0];
	const approvedCredits = profile?.approvedCredits ?? u.approvedCredits;
	const socialServiceDone = progressRows.some(
		(r) => r.subjectCanonicalId === SOCIAL_SERVICE_CANONICAL_ID && r.status === 'APPROVED'
	);

	const thresholds = evaluateCreditThresholds(approvedCredits);

	const social: ProcedureStatus = {
		id: 'servicio-social',
		label: 'Servicio Social',
		description: '500 horas de práctica profesional en dependencias públicas o privadas.',
		creditsRequired: 182,
		creditsHave: approvedCredits,
		creditsRemaining: Math.max(0, 182 - approvedCredits),
		percentage: Math.min(100, (approvedCredits / 182) * 100),
		unlocked: thresholds.canStartSocialService,
		blockedReason: thresholds.canStartSocialService
			? null
			: `Necesitas ${182 - approvedCredits} créditos más (tienes ${approvedCredits} de ${TOTAL_CREDITS})`
	};
	const residencia: ProcedureStatus = {
		id: 'residencia',
		label: 'Residencia Profesional',
		description: 'Proyecto terminal con duración de 4 a 6 meses en una organización.',
		creditsRequired: 208,
		creditsHave: approvedCredits,
		creditsRemaining: Math.max(0, 208 - approvedCredits),
		percentage: Math.min(100, (approvedCredits / 208) * 100),
		unlocked: thresholds.canStartResidency,
		blockedReason: thresholds.canStartResidency
			? null
			: `Necesitas ${208 - approvedCredits} créditos más (tienes ${approvedCredits} de ${TOTAL_CREDITS})`
	};
	const titulacion: ProcedureStatus = {
		id: 'titulacion',
		label: 'Titulación',
		description: 'Acto protocolario para obtener el título de Ingeniero en Sistemas Computacionales.',
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
					: 'Debes completar el Servicio Social antes de titularte'
	};

	return {
		approvedCredits,
		totalCredits: TOTAL_CREDITS,
		socialServiceDone,
		procedures: [social, residencia, titulacion]
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
	default: async ({ request }) => {
		const form = await request.formData();
		const procedure = String(form.get('procedure') ?? '');
		if (
			procedure !== 'servicio-social' &&
			procedure !== 'residencia' &&
			procedure !== 'titulacion'
		) {
			return fail(400, { error: 'Trámite no reconocido.', procedure });
		}
		return fail(202, {
			notice: 'Trámite en desarrollo',
			procedure
		});
	}
};
