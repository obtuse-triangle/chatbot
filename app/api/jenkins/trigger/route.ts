import { z } from "zod";

import { env } from "../../../../src/lib/env";
import { triggerBuild } from "../../../../src/lib/jenkins";

const triggerSchema = z.object({
  branch: z.string().min(1),
  job: z.string().optional(),
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function parseBuildNumber(location: string | null): number | null {
  if (!location) {
    return null;
  }

  const match = location.match(/\/(\d+)\/?(?:\?|$)/);
  return match ? Number(match[1]) : null;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const parsed = triggerSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const result = await triggerBuild(parsed.data.job?.trim() || env.JENKINS_JOB, {
      branch: parsed.data.branch,
    });
    const buildNumber = parseBuildNumber(result.location);

    return jsonResponse(
      {
        buildNumber,
        status: buildNumber ? "running" : "queued",
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.toLowerCase().includes("fetch") || message.toLowerCase().includes("unreachable") ? 500 : 502;

    return jsonResponse(
      { error: status === 500 ? "Jenkins unreachable" : "Jenkins error" },
      { status },
    );
  }
}
