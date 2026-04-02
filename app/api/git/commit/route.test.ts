import { beforeEach, describe, expect, it, vi } from "vitest";

const githubMocks = vi.hoisted(() => ({
  getFileMock: vi.fn(),
  commitFileMock: vi.fn(),
}));

vi.mock("../../../../src/lib/github", () => ({
  getFile: githubMocks.getFileMock,
  commitFile: githubMocks.commitFileMock,
}));

import { parsePromptConfig, serializePromptConfig } from "../../../../src/lib/config";
import { POST } from "./route";

describe("POST /api/git/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the existing config, merges request values, and commits the YAML", async () => {
    const existingConfig = {
      system_prompt: "You are helpful",
      temperature: 0.2,
      top_p: 0.9,
      top_k: 40,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 25,
    };

    githubMocks.getFileMock.mockResolvedValueOnce({
      content: serializePromptConfig(existingConfig),
      sha: "abc123",
    });
    githubMocks.commitFileMock.mockResolvedValueOnce({ commit: { sha: "commit-sha" } });

    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: "main",
          prompt: "Updated prompt",
          params: { temperature: 0.7, top_p: 0.8 },
          message: "Update prompt config",
        }),
      }),
    );

    const payload = await response.json();

    expect(githubMocks.getFileMock).toHaveBeenCalledWith("apps/trustops/prompt-config/configmap.yaml", "main");
    expect(githubMocks.commitFileMock).toHaveBeenCalledWith(
      "apps/trustops/prompt-config/configmap.yaml",
      expect.any(String),
      "Update prompt config",
      "main",
      "abc123",
    );
    expect(parsePromptConfig(githubMocks.commitFileMock.mock.calls[0]?.[1] ?? "")).toEqual({
      system_prompt: "Updated prompt",
      temperature: 0.7,
      top_p: 0.8,
      top_k: 40,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 25,
      prompt_version: "v1.0.0",
    });
    expect(response.status).toBe(201);
    expect(payload).toEqual({ sha: "commit-sha", branch: "main" });
  });

  it("returns validation errors for missing fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "main" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(githubMocks.getFileMock).not.toHaveBeenCalled();
    expect(githubMocks.commitFileMock).not.toHaveBeenCalled();
  });

  it("returns validation errors for wrong field types", async () => {
    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: 123, prompt: "x", params: { temperature: "hot" } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(githubMocks.getFileMock).not.toHaveBeenCalled();
    expect(githubMocks.commitFileMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the config file is missing", async () => {
    const error = Object.assign(new Error("Not Found"), { status: 404 });
    githubMocks.getFileMock.mockRejectedValueOnce(error);

    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "main", prompt: "Updated prompt", params: {} }),
      }),
    );

    expect(response.status).toBe(404);
    expect(githubMocks.commitFileMock).not.toHaveBeenCalled();
  });

  it("returns 502 for GitHub errors", async () => {
    githubMocks.getFileMock.mockRejectedValueOnce(new Error("Bad gateway"));

    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "main", prompt: "Updated prompt", params: {} }),
      }),
    );

    expect(response.status).toBe(502);
    expect(githubMocks.commitFileMock).not.toHaveBeenCalled();
  });

  it("serializes the merged config to YAML", async () => {
    const existingConfig = {
      system_prompt: "Old prompt",
      temperature: 0.1,
      top_p: 0.95,
      top_k: 10,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 5,
    };

    githubMocks.getFileMock.mockResolvedValueOnce({
      content: serializePromptConfig(existingConfig),
      sha: "sha-1",
    });
    githubMocks.commitFileMock.mockResolvedValueOnce(undefined);

    await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: "main",
          prompt: "New prompt",
          params: { top_k: 99 },
        }),
      }),
    );

    const serialized = githubMocks.commitFileMock.mock.calls[0]?.[1] as string;

    expect(parsePromptConfig(serialized)).toEqual({
      system_prompt: "New prompt",
      temperature: 0.1,
      top_p: 0.95,
      top_k: 99,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 5,
      prompt_version: "v1.0.0",
    });
  });

  it("returns 400 for invalid branch name 'feature/test'", async () => {
    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: "feature/test",
          prompt: "Updated prompt",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(githubMocks.getFileMock).not.toHaveBeenCalled();
    expect(githubMocks.commitFileMock).not.toHaveBeenCalled();
  });

  it("passes validation for 'prompt-config/experiment'", async () => {
    const existingConfig = {
      system_prompt: "You are helpful",
      temperature: 0.2,
      top_p: 0.9,
      top_k: 40,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 25,
    };

    githubMocks.getFileMock.mockResolvedValueOnce({
      content: serializePromptConfig(existingConfig),
      sha: "abc123",
    });
    githubMocks.commitFileMock.mockResolvedValueOnce({ commit: { sha: "commit-sha" } });

    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: "prompt-config/experiment",
          prompt: "Updated prompt",
          params: { temperature: 0.7 },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(githubMocks.getFileMock).toHaveBeenCalledWith(
      "apps/trustops/prompt-config/configmap.yaml",
      "prompt-config/experiment",
    );
  });

  it("passes validation for 'main' (regression guard)", async () => {
    const existingConfig = {
      system_prompt: "You are helpful",
      temperature: 0.2,
      top_p: 0.9,
      top_k: 40,
      prompt_v1: "alpha",
      prompt_v2: "beta",
      canary_weight: 25,
    };

    githubMocks.getFileMock.mockResolvedValueOnce({
      content: serializePromptConfig(existingConfig),
      sha: "abc123",
    });
    githubMocks.commitFileMock.mockResolvedValueOnce({ commit: { sha: "commit-sha" } });

    const response = await POST(
      new Request("http://localhost/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: "main",
          prompt: "Updated prompt",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(githubMocks.getFileMock).toHaveBeenCalledWith(
      "apps/trustops/prompt-config/configmap.yaml",
      "main",
    );
  });
});
