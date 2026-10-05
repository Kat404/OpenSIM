/**
 * OpenSIM — Avatar a11y & status-label unit tests.
 *
 * Contracts under test (U3 Phase A, see odd/tasks/phase-6-ui-polish.md):
 *   1. STATUS_LABEL_ES maps each AvatarStatus to its Spanish label and back.
 *   2. composeAltText() composes the parent role="img" accessible name from
 *      (name, status, alt) in the documented precedence order.
 *   3. The status-dot element in the .svelte source carries NO aria-label
 *      attribute — it is decorative and the live region's accessible name
 *      lives on the parent role="img" (a leaf role).
 *
 * The dot assertion is a static source check rather than a DOM render test
 * because @testing-library/svelte is not in the dependency tree. The
 * contract is structural (a forbidden attribute on a specific element),
 * not behavioural, so a regex over the source is the right primitive.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATUS_LABEL_ES, composeAltText, type AvatarStatus } from './Avatar.svelte';

const ALL_STATUSES: AvatarStatus[] = ['online', 'offline', 'busy', 'away'];

// Read the .svelte source once and share it across the structural test
// blocks. The dot assertions and the ring contract both probe the raw
// markup / CSS text, so centralising the read keeps the regex patterns
// and the SOURCE symbol the single source of truth. CSS comments are
// stripped up-front so static-regex assertions don't match the prose
// inside /* ... */ blocks (the ring-contract test would otherwise
// match the literal "border:" inside its own "not border:" comment).
const sourcePath = fileURLToPath(new URL('./Avatar.svelte', import.meta.url));
const SOURCE = readFileSync(sourcePath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('STATUS_LABEL_ES', () => {
	it('maps every status to a non-empty Spanish label', () => {
		for (const status of ALL_STATUSES) {
			const label = STATUS_LABEL_ES[status];
			expect(label).toBeTypeOf('string');
			expect(label.length).toBeGreaterThan(0);
		}
	});

	it('round-trips every status to its expected Spanish phrase', () => {
		expect(STATUS_LABEL_ES.online).toBe('en línea');
		expect(STATUS_LABEL_ES.offline).toBe('desconectado');
		expect(STATUS_LABEL_ES.busy).toBe('ocupado');
		expect(STATUS_LABEL_ES.away).toBe('ausente');
	});

	it('is the inverse of a status-keyed lookup (no duplicates, no missing)', () => {
		const seen = new Set<string>();
		for (const status of ALL_STATUSES) {
			const label = STATUS_LABEL_ES[status];
			expect(seen.has(label)).toBe(false);
			seen.add(label);
		}
		expect(seen.size).toBe(ALL_STATUSES.length);
	});

	it('never returns an empty string or an English token for a known status', () => {
		for (const status of ALL_STATUSES) {
			const label = STATUS_LABEL_ES[status];
			expect(label).not.toBe('');
			expect(label).not.toBe(status); // 'online' would mean we forgot to localize
		}
	});
});

describe('composeAltText', () => {
	describe('with name AND status (Phase A target: "Ada Lovelace, en línea")', () => {
		it('returns "<name>, <status label>" for online', () => {
			expect(composeAltText('Ada Lovelace', 'online')).toBe('Ada Lovelace, en línea');
		});
		it('returns "<name>, <status label>" for offline', () => {
			expect(composeAltText('Ada Lovelace', 'offline')).toBe('Ada Lovelace, desconectado');
		});
		it('returns "<name>, <status label>" for busy', () => {
			expect(composeAltText('Alan Turing', 'busy')).toBe('Alan Turing, ocupado');
		});
		it('returns "<name>, <status label>" for away', () => {
			expect(composeAltText('Alan Turing', 'away')).toBe('Alan Turing, ausente');
		});
	});

	describe('with name only (no status)', () => {
		it('returns the legacy "Avatar de <name>" form so existing call-sites are stable', () => {
			expect(composeAltText('Ada Lovelace', undefined)).toBe('Avatar de Ada Lovelace');
		});
	});

	describe('with no name and no status', () => {
		it('falls back to the generic "Avatar"', () => {
			expect(composeAltText('', undefined)).toBe('Avatar');
		});
	});

	describe('with explicit alt override', () => {
		it('returns the caller-provided alt verbatim, ignoring name and status', () => {
			expect(composeAltText('Ada Lovelace', 'online', 'Custom name')).toBe('Custom name');
		});
		it('returns the caller-provided alt even when no name is given', () => {
			expect(composeAltText('', 'busy', 'Custom')).toBe('Custom');
		});
	});
});

describe('Avatar.svelte template (structural — Phase A a11y contract)', () => {
	// The dot lives inside the .svelte template, not in script. Find the
	// <span … class="avatar__status …"> opening tag and assert it carries
	// no aria-* attribute. This is the actual axe finding being closed:
	// aria-prohibited-attr on .avatar__status--{online,busy}.
	const dotOpenTag = SOURCE.match(/<span[^>]*class="avatar__status[^"]*"[^>]*>/);
	if (!dotOpenTag) throw new Error('Avatar.svelte: cannot locate the status dot <span>');

	const dotTag = dotOpenTag[0];

	it('does not put aria-label on the status dot (decorative — axe aria-prohibited-attr)', () => {
		expect(dotTag).not.toMatch(/aria-label/);
	});

	it('does not put any aria-* attribute on the status dot (decorative leaf)', () => {
		// The parent role="img" is a leaf role, so any aria-* on the dot
		// is meaningless at best and prohibited at worst. Keep the dot
		// a plain visual element.
		expect(dotTag).not.toMatch(/\saria-[\w-]+=/);
	});

	it('still renders the dot conditionally (i.e. we did not delete the markup)', () => {
		expect(SOURCE).toMatch(/\{#if\s+status\}[\s\S]*?\{\/if\}/);
	});

	it('exposes status to the script via the typed AvatarStatus alias (not the raw string)', () => {
		// Defends against a future refactor that drops the type and turns
		// status back into an unconstrained string.
		expect(SOURCE).toMatch(/status\??:\s*AvatarStatus/);
	});
});

describe('Avatar.svelte ring contract (U3 follow-up C1)', () => {
	// Defends the box-shadow switch (C1): with global box-sizing: border-box
	// (tokens.css:299-303) a 2px solid border on .avatar__status eats the
	// 25% fill at xs (6px → 4px fill) and sm (8px → 4px fill). The
	// contract is: paint the halo via spread, not via a border.
	it('avatar__status block paints outward via box-shadow (no border)', () => {
		const statusBlock = SOURCE.match(/\.avatar__status\s*\{[^}]*\}/)?.[0] ?? '';
		expect(statusBlock).toMatch(/box-shadow:\s*0 0 0 2px var\(--avatar-ring\)/);
		// 'none' is fine; a 2px solid border would re-introduce the bug.
		expect(statusBlock).not.toMatch(/border:\s*[^n]/);
	});
});
