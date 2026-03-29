import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("./env", () => ({
  env: {
    JENKINS_URL: "https://jenkins.example.com",
    JENKINS_TOKEN: "jenkins-token",
    JENKINS_JOB: "trustops/build",
  },
}));

vi.stubGlobal("fetch", fetchMock);

import { getBuildLogs, getBuildStatus, pollBuildLogs, triggerBuild } from "./jenkins";

describe("jenkins service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers a parameterized build with auth headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 201,
        headers: { Location: "https://jenkins.example.com/queue/item/123/" },
      }),
    );

    await expect(triggerBuild("trustops/build", { branch: "main", dryRun: "false" })).resolves.toEqual({
      location: "https://jenkins.example.com/queue/item/123/",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://jenkins.example.com/job/trustops/job/build/buildWithParameters?branch=main&dryRun=false",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic "+Buffer.from(":jenkins-token").toString("base64"),
        }),
      }),
    );
  });

  it("reads build status from the Jenkins API", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ number: 42, building: false, result: "SUCCESS" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getBuildStatus("trustops/build", 42)).resolves.toEqual({
      number: 42,
      status: "SUCCESS",
      logs: "",
    });
  });

  it("reads console logs", async () => {
    fetchMock.mockResolvedValueOnce(new Response("line 1\nline 2\n", { status: 200 }));

    await expect(getBuildLogs("trustops/build", 42)).resolves.toBe("line 1\nline 2\n");
  });

  it("polls only at the minimum interval and streams appended logs", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("start\n", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ number: 7, building: true, result: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("start\nmore\n", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ number: 7, building: false, result: "SUCCESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const logs: string[] = [];

    await pollBuildLogs("trustops/build", 7, (log) => logs.push(log), 1000);

    expect(logs).toEqual(["start\n", "more\n"]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    setTimeoutSpy.mockRestore();
  });

  it("surfaces Jenkins errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    await expect(getBuildLogs("trustops/build", 42)).rejects.toThrow("Jenkins request failed with status 401");
  });
});
