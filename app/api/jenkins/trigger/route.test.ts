import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerBuildMock: vi.fn(),
  envMock: { JENKINS_JOB: "default-job" },
}));

vi.mock("../../../../src/lib/jenkins", () => ({
  triggerBuild: mocks.triggerBuildMock,
}));

vi.mock("../../../../src/lib/env", () => ({
  env: mocks.envMock,
}));

import { POST } from "./route";

describe("POST /api/jenkins/trigger", () => {
  beforeEach(() => {
    mocks.triggerBuildMock.mockReset();
  });

  it("triggers a build with the provided job and branch", async () => {
    mocks.triggerBuildMock.mockResolvedValue({ location: "https://jenkins.example/job/demo/42/" });

    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: "main", job: "demo" }),
      }),
    );

    expect(mocks.triggerBuildMock).toHaveBeenCalledWith("demo", { branch: "main" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ buildNumber: 42, status: "running" });
  });

  it("uses the default Jenkins job when job is omitted", async () => {
    mocks.triggerBuildMock.mockResolvedValue({ location: "https://jenkins.example/queue/item/123/" });

    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: "feature/test" }),
      }),
    );

    expect(mocks.triggerBuildMock).toHaveBeenCalledWith("default-job", { branch: "feature/test" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ buildNumber: 123, status: "running" });
  });

  it("rejects missing branch", async () => {
    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
    expect(mocks.triggerBuildMock).not.toHaveBeenCalled();
  });

  it("rejects wrong branch type", async () => {
    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: 123 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
    expect(mocks.triggerBuildMock).not.toHaveBeenCalled();
  });

  it("rejects wrong job type", async () => {
    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: "main", job: 123 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
    expect(mocks.triggerBuildMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Jenkins is unreachable", async () => {
    mocks.triggerBuildMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: "main" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Jenkins unreachable" });
  });

  it("returns 502 for Jenkins errors", async () => {
    mocks.triggerBuildMock.mockRejectedValue(new Error("Jenkins request failed with status 500"));

    const response = await POST(
      new Request("http://localhost/api/jenkins/trigger", {
        method: "POST",
        body: JSON.stringify({ branch: "main" }),
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Jenkins error" });
  });
});
