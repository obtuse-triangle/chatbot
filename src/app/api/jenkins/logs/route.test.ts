import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBuildLogsMock: vi.fn(),
  getBuildStatusMock: vi.fn(),
}));

vi.mock("../../../../lib/env", () => ({
  env: {
    JENKINS_JOB: "trustops/build",
  },
}));

vi.mock("../../../../lib/jenkins", () => ({
  getBuildLogs: mocks.getBuildLogsMock,
  getBuildStatus: mocks.getBuildStatusMock,
}));

import { GET } from "./route";

describe("jenkins logs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns build logs for the requested build number", async () => {
    mocks.getBuildLogsMock.mockResolvedValueOnce("line 1\nline 2\n");
    mocks.getBuildStatusMock.mockResolvedValueOnce({ number: 42, status: "SUCCESS", logs: "" });

    const response = await GET(new Request("http://localhost/api/jenkins/logs?buildNumber=42"));

    expect(mocks.getBuildLogsMock).toHaveBeenCalledWith("trustops/build", 42);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      logs: "line 1\nline 2\n",
      status: "SUCCESS",
      buildNumber: 42,
    });
  });

  it("returns only the incremental log chunk after the offset", async () => {
    mocks.getBuildLogsMock.mockResolvedValueOnce("line 1\nline 2\nline 3\n");
    mocks.getBuildStatusMock.mockResolvedValueOnce({ number: 42, status: "BUILDING", logs: "" });

    const response = await GET(
      new Request("http://localhost/api/jenkins/logs?buildNumber=42&offset=14"),
    );

    expect(mocks.getBuildLogsMock).toHaveBeenCalledWith("trustops/build", 42);
    await expect(response.json()).resolves.toEqual({
      logs: "line 3\n",
      status: "BUILDING",
      buildNumber: 42,
    });
  });

  it("returns 404 when Jenkins reports a missing build", async () => {
    mocks.getBuildLogsMock.mockRejectedValueOnce(new Error("Jenkins request failed with status 404"));
    mocks.getBuildStatusMock.mockResolvedValueOnce({ number: 99, status: "SUCCESS", logs: "" });

    const response = await GET(new Request("http://localhost/api/jenkins/logs?buildNumber=99"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "build not found" });
  });

  it("returns 500 for other Jenkins failures", async () => {
    mocks.getBuildLogsMock.mockRejectedValueOnce(new Error("Jenkins request failed with status 503"));
    mocks.getBuildStatusMock.mockResolvedValueOnce({ number: 99, status: "SUCCESS", logs: "" });

    const response = await GET(new Request("http://localhost/api/jenkins/logs?buildNumber=99"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "jenkins error" });
  });

  it("requires a build number", async () => {
    const response = await GET(new Request("http://localhost/api/jenkins/logs"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "buildNumber is required" });
  });
});
