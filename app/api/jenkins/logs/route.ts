import { NextResponse } from "next/server";

import { env } from "../../../../src/lib/env";
import { getBuildLogs, getBuildStatus } from "../../../../src/lib/jenkins";

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveStatus(error: unknown): number {
  if (error instanceof Error) {
    const match = error.message.match(/status\s+(\d{3})/i);

    if (match) {
      const status = Number.parseInt(match[1], 10);
      if (status === 404) {
        return 404;
      }
    }
  }

  return 500;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const buildNumber = parsePositiveInteger(url.searchParams.get("buildNumber"));

  if (buildNumber === null) {
    return NextResponse.json({ error: "buildNumber is required" }, { status: 400 });
  }

  const offset = parsePositiveInteger(url.searchParams.get("offset")) ?? 0;

  try {
    const [logs, build] = await Promise.all([
      getBuildLogs(env.JENKINS_JOB, buildNumber),
      getBuildStatus(env.JENKINS_JOB, buildNumber),
    ]);

    return NextResponse.json({
      logs: logs.slice(offset),
      status: build.status,
      buildNumber,
    });
  } catch (error) {
    const status = resolveStatus(error);
    return NextResponse.json(
      { error: status === 404 ? "build not found" : "jenkins error" },
      { status },
    );
  }
}
