import { describe, it, expect } from "vitest";
import { validateComment, validateReview } from "@/lib/social";

describe("social validation", () => {
  it("rejects ratings outside 1-5", () => {
    expect(validateReview(0, "")).not.toBeNull();
    expect(validateReview(6, "")).not.toBeNull();
    expect(validateReview(5, "great")).toBeNull();
  });
  it("rejects empty and too-long comments", () => {
    expect(validateComment("   ")).not.toBeNull();
    expect(validateComment("x".repeat(2001))).not.toBeNull();
    expect(validateComment("nice chapter")).toBeNull();
  });
});
