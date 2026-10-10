/**
 * OpenSIM — the protected route that used to 500.
 *
 * T9.4 loaded the 468-row offering catalogue into `course_groups` and the
 * loader passed all 475 group ids to one `inArray`, past D1's
 * 100-bound-parameter ceiling. This test restores the demo student's session
 * and opens the page, so the ceiling is exercised again on every run.
 */
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("reinscripcion loads its offering catalogue", { session: "alumno" }, async ({
	app,
	screen,
	browser,
}) => {
	await app.open("/reinscripcion");

	await expect(browser).toHaveURL("/reinscripcion");
	// The simulator form is the page. The catalogue is what populates it, so
	// an empty grid means the loader silently stopped finding groups.
	await expect(screen.getByRole("button", "Inscribir y firmar")).toBeVisible();
	// And the honest note about the missing catalogue timetable must show:
	// its absence would mean we went back to implying there are no conflicts.
	await expect(
		screen.getByText(
			"El SIM no publica horarios para los grupos de la oferta, por lo que no se pueden detectar traslapes entre las materias que elijas.",
		),
	).toBeVisible();
});
