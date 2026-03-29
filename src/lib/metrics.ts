import type { Metrics } from "../types";

const METRIC_DEFAULTS: Metrics = {
  faithfulness: 0,
  relevance: 0,
  commit_id: "",
};

function extractScore(logs: string, label: "Faithfulness" | "Relevance"): number {
  const pattern = new RegExp(`${label}[^0-9+-]*([+-]?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)`, "gi");
  let match: RegExpExecArray | null = null;

  for (let current = pattern.exec(logs); current !== null; current = pattern.exec(logs)) {
    match = current;
  }

  if (!match) {
    return 0;
  }

  const score = Number.parseFloat(match[1]);
  return Number.isFinite(score) ? score : 0;
}

export function parseEvaluatorLogs(logs: string): Metrics {
  return {
    faithfulness: extractScore(logs, "Faithfulness"),
    relevance: extractScore(logs, "Relevance"),
    commit_id: METRIC_DEFAULTS.commit_id,
  };
}

export async function getMetrics(buildNumber: string): Promise<Metrics> {
  if (typeof window === "undefined") {
    return {
      faithfulness: METRIC_DEFAULTS.faithfulness,
      relevance: METRIC_DEFAULTS.relevance,
      commit_id: buildNumber,
    }
  }

  const origin = window.location.origin === "null" ? "http://localhost:3000" : window.location.origin
  const response = await fetch(new URL(`/api/metrics?buildNumber=${encodeURIComponent(buildNumber)}`, origin))

  if (!response.ok) {
    return {
      faithfulness: METRIC_DEFAULTS.faithfulness,
      relevance: METRIC_DEFAULTS.relevance,
      commit_id: "",
    }
  }

  const data = (await response.json()) as { faithfulness: number; relevance: number; commitId: string }

  return {
    faithfulness: data.faithfulness,
    relevance: data.relevance,
    commit_id: data.commitId,
  }
}
