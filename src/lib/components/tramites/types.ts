/**
 * OpenSIM — Shared types for the Trámites page.
 *
 * The page loader (`/tramites/+page.server.ts`) emits the
 * `ProcedureStatus` shape so the ProcedureStepper component can
 * render the locked/unlocked state without re-implementing the
 * thresholds.
 */

export interface ProcedureStatus {
	id: 'servicio-social' | 'residencia' | 'titulacion';
	label: string;
	description: string;
	creditsRequired: number;
	creditsHave: number;
	creditsRemaining: number;
	percentage: number;
	unlocked: boolean;
	blockedReason: string | null;
}
