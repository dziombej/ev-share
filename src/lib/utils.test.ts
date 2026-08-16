import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("lets a later conflicting class win over an earlier one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
