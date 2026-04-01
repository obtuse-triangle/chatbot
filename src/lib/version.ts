/**
 * Parse a semantic version string (e.g., "v1.0.0") into components.
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) };
}

/**
 * Generate the next semantic version.
 * - If no current version, returns "v1.0.0"
 * - Otherwise increments the patch number
 */
export function generateNextVersion(currentVersion?: string): string {
  if (!currentVersion) return "v1.0.0";
  const parsed = parseVersion(currentVersion);
  if (!parsed) return "v1.0.0";
  return `v${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}
