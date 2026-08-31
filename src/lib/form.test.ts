import { describe, expect, it } from "vitest";
import { formText } from "@/lib/form";

// Guards the narrowing that FormData's own type forces on every caller:
// `.get()` returns `string | File | null`, so stringifying it blindly yields
// "[object File]" for a file input and "null" for an absent field — both of
// which would sail past a `.trim()`-based required check as if the user had
// typed something.
describe("formText", () => {
  it("returns the value of a text field", () => {
    const data = new FormData();
    data.set("latitude", "52.2297");

    expect(formText(data, "latitude")).toBe("52.2297");
  });

  it("returns an empty string for a field that is absent", () => {
    expect(formText(new FormData(), "latitude")).toBe("");
  });

  it("returns an empty string for a non-text entry rather than stringifying it", () => {
    const data = new FormData();
    data.set("latitude", new File(["52.2297"], "coords.txt", { type: "text/plain" }));

    expect(formText(data, "latitude")).toBe("");
  });

  it("preserves whitespace so callers own their own trimming rules", () => {
    const data = new FormData();
    data.set("latitude", "  52.2297  ");

    expect(formText(data, "latitude")).toBe("  52.2297  ");
  });
});
