import { NextResponse } from "next/server";

import { env } from "../../../src/lib/env";
import { getBuildLogs } from "../../../src/lib/jenkins";
import { getMetrics, parseEvaluatorLogs } from "../../../src/lib/metrics";

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
      return Number.parseInt(match[1], 10);
    }
  }

  return 500;
}

function extractCommitId(logs: string): string {
  const patterns = [
    /commit(?:[_\s-]*id)?\s*[:=]\s*([a-f0-9]{7,40})/i,
    /git[_\s-]*commit\s*[:=]\s*([a-f0-9]{7,40})/i,
    /\bcommit\s+([a-f0-9]{7,40})\b/i,
  ];

  for (const pattern of patterns) {
    const match = logs.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return "";
}

function hasNumericScore(logs: string, label: "Faithfulness" | "Relevance"): boolean {
  return new RegExp(`${label}[^0-9+-]*[+-]?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?`, "i").test(logs);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const buildNumber = parsePositiveInteger(url.searchParams.get("buildNumber"));
  const commitId = url.searchParams.get("commitId")?.trim() ?? "";

  if ((buildNumber === null && !commitId) || (buildNumber !== null && commitId)) {
    return NextResponse.json(
      { error: "provide exactly one of buildNumber or commitId" },
      { status: 400 },
    );
  }

  try {
    if (buildNumber !== null) {
      const logs = await getBuildLogs(env.JENKINS_JOB, buildNumber);
      const metrics = parseEvaluatorLogs(logs);

      if (!hasNumericScore(logs, "Faithfulness") || !hasNumericScore(logs, "Relevance")) {
        return NextResponse.json({ error: "metrics not found" }, { status: 404 });
      }

      return NextResponse.json({
        faithfulness: metrics.faithfulness,
        relevance: metrics.relevance,
        commitId: extractCommitId(logs),
      });
    }

    const metrics = await getMetrics(commitId);

    return NextResponse.json({
      faithfulness: metrics.faithfulness,
      relevance: metrics.relevance,
      commitId: metrics.commit_id,
    });
  } catch (error) {
    const status = resolveStatus(error);

    return NextResponse.json(
      { error: status === 404 ? "metrics not found" : "metrics error" },
      { status: status === 404 ? 404 : 500 },
    );
  }
}
