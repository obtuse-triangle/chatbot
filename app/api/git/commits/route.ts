import { NextResponse } from "next/server";
import { z } from "zod";

import { listBranches, listCommits } from "../../../../src/lib/github";
import type { GitHubBranch } from "../../../../src/lib/github";

const commitsRouteSchema = z.object({
  branch: z.string().min(1),
  path: z.string().optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parsed = commitsRouteSchema.safeParse({
      branch: url.searchParams.get("branch"),
      path: url.searchParams.get("path") || "apps/trustops/prompt-config/configmap.yaml",
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request query", issues: parsed.error.flatten() }, { status: 400 });
    }

    const branches: GitHubBranch[] = await listBranches();
    const branch = branches.find((item) => item.name === parsed.data.branch);

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const commits = await listCommits(branch.sha, 30, parsed.data.path);

    return NextResponse.json({
      commits,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load commits" }, { status: 500 });
  }
}
