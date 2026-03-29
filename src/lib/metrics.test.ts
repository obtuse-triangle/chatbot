import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMetrics, parseEvaluatorLogs } from "./metrics";

describe("metrics service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      faithfulness: 0,
      relevance: 0,
      commitId: "abc123",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  it("parses the standard evaluator log format", () => {
    const logs = [
      "[evaluator] starting evaluation",
      "Faithfulness: 0.87",
      "Relevance: 0.92",
    ].join("\n");

    expect(parseEvaluatorLogs(logs)).toEqual({
      faithfulness: 0.87,
      relevance: 0.92,
      commit_id: "",
    });
  });

  it("extracts scores from alternate separators and repeated lines", () => {
    const logs = [
      "Faithfulness = 0.41",
      "Relevance score: 0.67",
      "Faithfulness: 0.88",
      "Relevance: 0.95/1.0",
    ].join("\n");

    expect(parseEvaluatorLogs(logs)).toEqual({
      faithfulness: 0.88,
      relevance: 0.95,
      commit_id: "",
    });
  });

  it("returns zeroes when scores are missing or malformed", () => {
    expect(parseEvaluatorLogs("no metrics here")).toEqual({
      faithfulness: 0,
      relevance: 0,
      commit_id: "",
    });

    expect(
      parseEvaluatorLogs([
        "Faithfulness: not-a-number",
        "Relevance: ???",
      ].join("\n")),
    ).toEqual({
      faithfulness: 0,
      relevance: 0,
      commit_id: "",
    });
  });

  it("returns a commit-scoped placeholder metric object", async () => {
    await expect(getMetrics("abc123")).resolves.toEqual({
      faithfulness: 0,
      relevance: 0,
      commit_id: "abc123",
    });
  });
});
