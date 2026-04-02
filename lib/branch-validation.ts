const BRANCH_PREFIX = "prompt-config/";
const MAX_SUFFIX_LENGTH = 230;
const SUFFIX_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9./_-]*[a-zA-Z0-9])?$/;

export function isValidBranchName(name: string): boolean {
  if (name === "main") {
    return true;
  }

  if (!name.startsWith(BRANCH_PREFIX)) {
    return false;
  }

  const suffix = name.slice(BRANCH_PREFIX.length);
  const suffixValidation = validateBranchSuffix(suffix);

  return suffixValidation.valid;
}

export function validateBranchSuffix(
  suffix: string,
): { valid: boolean; error: string | null } {
  if (suffix.length === 0) {
    return { valid: false, error: "Branch suffix cannot be empty" };
  }

  if (suffix.length > MAX_SUFFIX_LENGTH) {
    return {
      valid: false,
      error: `Branch suffix must be at most ${MAX_SUFFIX_LENGTH} characters`,
    };
  }

  if (suffix.includes(" ")) {
    return { valid: false, error: "Branch suffix cannot contain spaces" };
  }

  if (!SUFFIX_REGEX.test(suffix)) {
    return {
      valid: false,
      error:
        "Branch suffix must start and end with alphanumeric characters, and contain only alphanumeric characters, dots, slashes, underscores, or hyphens",
    };
  }

  return { valid: true, error: null };
}