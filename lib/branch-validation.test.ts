import { describe, expect, it } from "vitest";
import { isValidBranchName, validateBranchSuffix } from "./branch-validation";

describe("isValidBranchName", () => {
  it("returns true for 'main'", () => {
    expect(isValidBranchName("main")).toBe(true);
  });

  it("returns true for 'prompt-config/experiment'", () => {
    expect(isValidBranchName("prompt-config/experiment")).toBe(true);
  });

  it("returns true for 'prompt-config/' with valid suffix 'a'", () => {
    expect(isValidBranchName("prompt-config/a")).toBe(true);
  });

  it("returns true for 'prompt-config/' with complex suffix", () => {
    expect(isValidBranchName("prompt-config/feature.test_v1")).toBe(true);
  });

  it("returns false for 'feature/test'", () => {
    expect(isValidBranchName("feature/test")).toBe(false);
  });

  it("returns false for 'feature-branch'", () => {
    expect(isValidBranchName("feature-branch")).toBe(false);
  });

  it("returns false for 'prompt-config/' (empty suffix)", () => {
    expect(isValidBranchName("prompt-config/")).toBe(false);
  });

  it("returns false for 'prompt-config' (no trailing slash)", () => {
    expect(isValidBranchName("prompt-config")).toBe(false);
  });

  it("returns false for 'prompt-config ' (space in suffix)", () => {
    expect(isValidBranchName("prompt-config/has space")).toBe(false);
  });

  it("returns false for 'prompt-config/-invalid' (starts with hyphen)", () => {
    expect(isValidBranchName("prompt-config/-invalid")).toBe(false);
  });

  it("returns false for 'prompt-config/invalid-' (ends with hyphen)", () => {
    expect(isValidBranchName("prompt-config/invalid-")).toBe(false);
  });
});

describe("validateBranchSuffix", () => {
  it("returns valid for simple alphanumeric suffix", () => {
    expect(validateBranchSuffix("experiment")).toEqual({ valid: true, error: null });
  });

  it("returns valid for suffix with dots", () => {
    expect(validateBranchSuffix("feature.test.v1")).toEqual({ valid: true, error: null });
  });

  it("returns valid for suffix with underscores", () => {
    expect(validateBranchSuffix("feature_test_v1")).toEqual({ valid: true, error: null });
  });

  it("returns valid for suffix with hyphens", () => {
    expect(validateBranchSuffix("feature-test-v1")).toEqual({ valid: true, error: null });
  });

  it("returns valid for suffix with slashes", () => {
    expect(validateBranchSuffix("feature/test/v1")).toEqual({ valid: true, error: null });
  });

  it("returns valid for single character suffix", () => {
    expect(validateBranchSuffix("a")).toEqual({ valid: true, error: null });
  });

  it("returns valid for two character suffix 'a1'", () => {
    expect(validateBranchSuffix("a1")).toEqual({ valid: true, error: null });
  });

  it("returns invalid for empty suffix", () => {
    expect(validateBranchSuffix("")).toEqual({ valid: false, error: "Branch suffix cannot be empty" });
  });

  it("returns invalid for suffix with spaces", () => {
    expect(validateBranchSuffix("has space")).toEqual({ valid: false, error: "Branch suffix cannot contain spaces" });
  });

  it("returns invalid for suffix starting with hyphen", () => {
    expect(validateBranchSuffix("-invalid")).toEqual({ valid: false, error: "Branch suffix must start and end with alphanumeric characters, and contain only alphanumeric characters, dots, slashes, underscores, or hyphens" });
  });

  it("returns invalid for suffix ending with hyphen", () => {
    expect(validateBranchSuffix("invalid-")).toEqual({ valid: false, error: "Branch suffix must start and end with alphanumeric characters, and contain only alphanumeric characters, dots, slashes, underscores, or hyphens" });
  });

  it("returns invalid for suffix starting with special character", () => {
    expect(validateBranchSuffix("_invalid")).toEqual({ valid: false, error: "Branch suffix must start and end with alphanumeric characters, and contain only alphanumeric characters, dots, slashes, underscores, or hyphens" });
  });

  it("returns invalid for suffix with more than 230 characters", () => {
    const longSuffix = "a".repeat(231);
    expect(validateBranchSuffix(longSuffix)).toEqual({
      valid: false,
      error: "Branch suffix must be at most 230 characters",
    });
  });

  it("returns valid for suffix with exactly 230 characters", () => {
    const maxSuffix = "a".repeat(230);
    expect(validateBranchSuffix(maxSuffix)).toEqual({ valid: true, error: null });
  });
});