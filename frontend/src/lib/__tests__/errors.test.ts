import { describe, expect, it } from "vitest";

import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("returns the message for an Error instance", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the fallback for an Error instance with an empty message", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });

  it("returns the fallback for non-Error values", () => {
    expect(getErrorMessage("nope", "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: "not an error" }, "fallback")).toBe("fallback");
  });
});
