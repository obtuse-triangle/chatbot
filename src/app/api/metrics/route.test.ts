import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBuildLogsMock, getMetricsMock } = vi.hoisted(() => ({
  getBuildLogsMock: vi.fn(),
  getMetricsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("../../../lib/env", () => ({
  env: {
    JENKINS_JOB: "trustops/build",
  },
}));

vi.mock("../../../lib/jenkins", () => ({
  getBuildLogs: getBuildLogsMock,
}));

vi.mock("../../../lib/metrics", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/metrics")>("../../../lib/metrics");

  return {
    ...actual,
    getMetrics: getMetricsMock,
  };
});

import { GET } from "./route";

describe("GET /api/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed metrics from build logs", async () => {
    getBuildLogsMock.mockResolvedValueOnce([
      "[evaluator] running",
      "Commit ID: abc1234",
      "Faithfulness: 0.81",
      "Relevance: 0.93",
    ].join("\n"));

    const response = await GET(new Request("http://localhost/api/metrics?buildNumber=42"));

    expect(getBuildLogsMock).toHaveBeenCalledWith("trustops/build", 42);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      faithfulness: 0.81,
      relevance: 0.93,
      commitId: "abc1234",
    });
  });

  it("returns metrics for a commit id", async () => {
    getMetricsMock.mockResolvedValueOnce({
      faithfulness: 0.77,
      relevance: 0.66,
      commit_id: "commit-789",
    });

    const response = await GET(new Request("http://localhost/api/metrics?commitId=commit-789"));

    expect(getMetricsMock).toHaveBeenCalledWith("commit-789");
    await expect(response.json()).resolves.toEqual({
      faithfulness: 0.77,
      relevance: 0.66,
      commitId: "commit-789",
    });
  });

  it("returns 400 when both params are missing", async () => {
    const response = await GET(new Request("http://localhost/api/metrics"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "provide exactly one of buildNumber or commitId",
    });
  });

  it("returns 400 when both params are provided", async () => {
    const response = await GET(
      new Request("http://localhost/api/metrics?buildNumber=42&commitId=abc123"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "provide exactly one of buildNumber or commitId",
    });
  });

  it("returns 404 when build logs are missing scores", async () => {
    getBuildLogsMock.mockResolvedValueOnce("[evaluator] no scores here");

    const response = await GET(new Request("http://localhost/api/metrics?buildNumber=99"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "metrics not found" });
  });

  it("returns 404 when Jenkins cannot find the build", async () => {
    getBuildLogsMock.mockRejectedValueOnce(new Error("Jenkins request failed with status 404"));

    const response = await GET(new Request("http://localhost/api/metrics?buildNumber=99"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "metrics not found" });
  });

  it("returns 404 when commit metrics are not found", async () => {
    getMetricsMock.mockRejectedValueOnce(new Error("metrics request failed with status 404"));

    const response = await GET(new Request("http://localhost/api/metrics?commitId=missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "metrics not found" });
  });

  it("returns 400 for malformed build numbers", async () => {
    const response = await GET(new Request("http://localhost/api/metrics?buildNumber=abc"));

    expect(response.status).toBe(400);
  });
});
