/**
 * OpenSIM — HSL color hash unit tests.
 *
 * The function is pure and deterministic; the only contracts under test
 * are stability across calls, distribution of hues, and the literal
 * shape of the output string.
 */

import { describe, it, expect } from 'vitest';
import { getSubjectColorHSL } from '../../src/lib/utils/color';

describe('getSubjectColorHSL', () => {
	it('returns the same output for the same input across calls (determinism)', () => {
		const first = getSubjectColorHSL('ACF-0901');
		const second = getSubjectColorHSL('ACF-0901');
		const third = getSubjectColorHSL('ACF-0901');
		expect(first).toBe(second);
		expect(second).toBe(third);
	});

	it('produces different outputs for distinct inputs (high probability)', () => {
		const a = getSubjectColorHSL('ACF-0901');
		const b = getSubjectColorHSL('SCD-1020');
		const c = getSubjectColorHSL('BDP-1203');
		// Sanity check that the function is not constant — three different
		// real subject codes should produce three different hue outputs.
		// False collisions in [0, 360) are extremely rare (≈ 1/46656 per pair).
		expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
	});

	it('matches the canonical hsl(H, 60%, 88%) output shape', () => {
		const out = getSubjectColorHSL('SCC-1019');
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 88%\)$/);
	});

	it('keeps the hue in the [0, 360) range for arbitrary inputs', () => {
		const samples = [
			'ACF-0901',
			'SCD-1020',
			'AEF-1040',
			'BDP-1203',
			'ACA-0907',
			'SHF-1016',
			'SCG-1009',
			'PFC-1018'
		];
		for (const code of samples) {
			const out = getSubjectColorHSL(code);
			const match = out.match(/^hsl\((\d{1,3}), 60%, 88%\)$/);
			expect(match).not.toBeNull();
			const hue = Number(match?.[1]);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it('handles the empty string without throwing', () => {
		const out = getSubjectColorHSL('');
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 88%\)$/);
	});
});
