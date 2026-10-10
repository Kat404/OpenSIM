import { describe, expect, it } from "vitest";
import { foldText, matchesText } from "#lib/utils/text-match";

describe("foldText", () => {
	it("strips accents and lower-cases", () => {
		expect(foldText("Álgebra Lineal")).toBe("algebra lineal");
		expect(foldText("CÁLCULO DIFERENCIAL")).toBe("calculo diferencial");
	});

	it("handles the enye, which NFD splits into n plus a tilde", () => {
		expect(foldText("Cañón")).toBe("canon");
		expect(foldText("NIÑO")).toBe("nino");
	});

	it("leaves text with no diacritics alone", () => {
		expect(foldText("Programacion")).toBe("programacion");
	});
});

describe("matchesText", () => {
	it("matches an unaccented query against accented text", () => {
		// The bug this fixes: a TecNM Morelia student types "algebra" and the
		// catalogue holds "Álgebra Lineal", so `toLowerCase().includes()`
		// found nothing.
		expect(matchesText("Álgebra Lineal", "algebra")).toBe(true);
		expect(matchesText("Cálculo Diferencial", "calculo")).toBe(true);
		expect(matchesText("Fundamentos de Bases de Datos", "bases de datos")).toBe(true);
	});

	it("still matches when the query carries the accent", () => {
		expect(matchesText("Álgebra Lineal", "álgebra")).toBe(true);
	});

	it("is case-insensitive in both directions", () => {
		expect(matchesText("PROGRAMACIÓN ORIENTADA A OBJETOS", "programacion")).toBe(true);
		expect(matchesText("programación", "PROGRAMACIÓN")).toBe(true);
	});

	it("matches across a joined haystack, as the simulator builds one", () => {
		expect(matchesText("AEF-1041 Matemáticas Discretas", "matematicas discretas")).toBe(true);
	});

	it("returns false when the text genuinely differs", () => {
		expect(matchesText("Álgebra Lineal", "probabilidad")).toBe(false);
	});

	it("matches everything on an empty or whitespace-only query", () => {
		// A cleared search box must not hide the catalogue.
		expect(matchesText("Álgebra Lineal", "")).toBe(true);
		expect(matchesText("Álgebra Lineal", "   ")).toBe(true);
	});
});
