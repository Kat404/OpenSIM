/**
 * OpenSIM — HSL color hash unit tests (theme-aware).
 *
 * The function is pure and deterministic; contracts under test are
 * stability across calls, distribution of hues, the literal shape of
 * the output string in both themes, and the WCAG-AA-tuned lightness
 * selection (88% light, 28% dark) per audit H1.
 */

import { describe, it, expect } from 'vitest';
import { getSubjectColor, hashHue } from '../../src/lib/utils/color';

describe('hashHue', () => {
	it('returns the same hue for the same input across calls (determinism)', () => {
		const a = hashHue('ACF-0901');
		const b = hashHue('ACF-0901');
		const c = hashHue('ACF-0901');
		expect(a).toBe(b);
		expect(b).toBe(c);
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
			const hue = hashHue(code);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it('handles the empty string without throwing', () => {
		const hue = hashHue('');
		expect(Number.isFinite(hue)).toBe(true);
		expect(hue).toBeGreaterThanOrEqual(0);
		expect(hue).toBeLessThan(360);
	});
});

describe('getSubjectColor — light theme', () => {
	it('returns the same output for the same input across calls (determinism)', () => {
		const a = getSubjectColor('ACF-0901', 'light');
		const b = getSubjectColor('ACF-0901', 'light');
		const c = getSubjectColor('ACF-0901', 'light');
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it('matches the canonical hsl(H, 60%, 88%) output shape', () => {
		const out = getSubjectColor('SCC-1019', 'light');
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 88%\)$/);
	});

	it('selects lightness 88% for the WCAG-AA pastels on light surfaces', () => {
		// Dark fg-primary (#0b0f17) on the saturated pastel must stay
		// above 4.5:1; 88% L is the tuned value, do not regress it.
		expect(getSubjectColor('ACF-0901', 'light')).toMatch(/88%/);
	});

	it('produces different outputs for distinct inputs (high probability)', () => {
		const a = getSubjectColor('ACF-0901', 'light');
		const b = getSubjectColor('SCD-1020', 'light');
		const c = getSubjectColor('BDP-1203', 'light');
		expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
	});
});

describe('getSubjectColor — dark theme', () => {
	it('matches the inverted hsl(H, 60%, 28%) output shape', () => {
		const out = getSubjectColor('SCC-1019', 'dark');
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 28%\)$/);
	});

	it('selects lightness 28% for the WCAG-AA dark inversions', () => {
		// Light fg-primary (#f7f8fa) on the saturated bg must stay
		// above 4.5:1; 28% L is the tuned value, do not regress it.
		expect(getSubjectColor('ACF-0901', 'dark')).toMatch(/28%/);
	});

	it('keeps the same hue across themes (only lightness differs)', () => {
		const light = getSubjectColor('SCD-1020', 'light');
		const dark = getSubjectColor('SCD-1020', 'dark');
		const lightHue = Number(light.match(/^hsl\((\d+),/)?.[1]);
		const darkHue = Number(dark.match(/^hsl\((\d+),/)?.[1]);
		expect(lightHue).toBe(darkHue);
	});

	it('keeps the hue in the [0, 360) range for arbitrary inputs in dark', () => {
		const samples = ['ACF-0901', 'SCD-1020', 'AEF-1040', 'BDP-1203'];
		for (const code of samples) {
			const out = getSubjectColor(code, 'dark');
			const match = out.match(/^hsl\((\d{1,3}), 60%, 28%\)$/);
			expect(match).not.toBeNull();
			const hue = Number(match?.[1]);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it('handles the empty string without throwing', () => {
		expect(getSubjectColor('', 'dark')).toMatch(/^hsl\(\d{1,3}, 60%, 28%\)$/);
	});
});
