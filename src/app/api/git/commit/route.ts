import { NextResponse } from "next/server";
import { z } from "zod";

import { parsePromptConfig, serializePromptConfig } from "../../../../lib/config";
import { commitFile, getFile } from "../../../../lib/github";

const commitRouteSchema = z.object({
  branch: z.string().min(1),
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

const configPath = "apps/trustops/prompt-config.yaml";

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
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = commitRouteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", issues: parsed.error.flatten() }, { status: 400 });
    }

    const file = await getFile(configPath, parsed.data.branch);
    const currentConfig = parsePromptConfig(file.content);
    const updatedConfig = {
      ...currentConfig,
      system_prompt: parsed.data.prompt,
      temperature: parsed.data.params.temperature ?? currentConfig.temperature,
      top_p: parsed.data.params.top_p ?? currentConfig.top_p,
      top_k: parsed.data.params.top_k ?? currentConfig.top_k,
    };

    const yaml = serializePromptConfig(updatedConfig);
    const message = parsed.data.message ?? "feat(api): update prompt config";

    const commit = await commitFile(configPath, yaml, message, parsed.data.branch, file.sha);

    return NextResponse.json({ sha: commit.commit.sha, branch: parsed.data.branch }, { status: 201 });
  } catch (error) {
    const status = getErrorStatus(error);

    if (status === 404) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Failed to commit config";

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
