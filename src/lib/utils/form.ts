/**
 * OpenSIM — reading a text field out of a FormData.
 *
 * `FormData.get` returns `FormDataEntryValue | null`, and a
 * `FormDataEntryValue` can be a `File`. `String(file)` is
 * `"[object File]"`: a text field that received a file part would
 * become a string that no credential matches, but the value that
 * reaches the validator is not the one the student typed.
 *
 * These helpers return the string, or "" when the field is missing or
 * is not a string. They are the whole of the fix: the callers used to
 * stringify whatever came back.
 */

/** The field's value as a string, or "" if it is missing or a file. */
export function formString(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** Every value of a repeated field, as strings, files dropped. */
export function formStrings(form: FormData, name: string): string[] {
	return form.getAll(name).filter((value): value is string => typeof value === "string");
}
