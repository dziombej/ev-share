/**
 * Reads a text field out of a submitted form.
 *
 * `FormData.get()` is typed `string | File | null`, so passing its result
 * through `String()` quietly produces "[object File]" or "null" — values that
 * pass a required-field check while carrying nothing the user typed. Narrowing
 * to an actual string, with "" standing for both absent and non-text, keeps
 * every caller's validation honest.
 *
 * Whitespace is preserved: trimming is a per-field rule the caller owns.
 */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}
