import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidBranchName } from "../../../../lib/branch-validation";
import { parsePromptConfig, serializePromptConfig } from "../../../../src/lib/config";
import { commitFile, getFile } from "../../../../src/lib/github";
import { generateNextVersion } from "../../../../src/lib/version";

const commitRouteSchema = z.object({
  branch: z.string().min(1).refine(isValidBranchName, {
    message: "Branch name must be 'main' or start with 'prompt-config/'",
  }),
  prompt: z.string().min(1),
  params: z
    .object({
      temperature: z.coerce.number().optional(),
      top_p: z.coerce.number().optional(),
      top_k: z.coerce.number().optional(),
    })
    .default({}),
  message: z.string().min(1).optional(),
});

const configPath = "apps/trustops/prompt-config/configmap.yaml";

function getErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return 500;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const parsed = commitRouteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { branch } = parsed.data;

  try {
    const file = await getFile(configPath, branch);
    const currentConfig = parsePromptConfig(file.content);
    const currentVersion = currentConfig.prompt_version;
    const nextVersion = generateNextVersion(currentVersion);
    const updatedConfig = {
      ...currentConfig,
      system_prompt: parsed.data.prompt,
      temperature: parsed.data.params.temperature ?? currentConfig.temperature,
      top_p: parsed.data.params.top_p ?? currentConfig.top_p,
      top_k: parsed.data.params.top_k ?? currentConfig.top_k,
      prompt_version: nextVersion,
    };

    const yaml = serializePromptConfig(updatedConfig);
    const message = parsed.data.message ?? `feat: update prompt config to ${nextVersion}`;

    const commit = await commitFile(configPath, yaml, message, branch, file.sha);

    return NextResponse.json({ sha: commit.commit.sha, branch }, { status: 201 });
  } catch (error) {
    const status = getErrorStatus(error);

    if (status === 404) {
      const message = error instanceof Error ? error.message : "Config not found";
      return NextResponse.json({ error: `Failed to fetch config from GitHub: ${message}`, configPath, branch }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Failed to commit config";

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
