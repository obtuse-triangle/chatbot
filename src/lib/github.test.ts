import { beforeEach, describe, expect, it, vi } from "vitest";

const octokitMock = vi.hoisted(() => ({
  rest: {
    repos: {
      getContent: vi.fn(),
      getBranch: vi.fn(),
      createOrUpdateFileContents: vi.fn(),
      listBranches: vi.fn(),
    },
    git: {
      createRef: vi.fn(),
    },
  },
}));

vi.mock("./env", () => ({
  env: {
    GITHUB_PAT: "ghp_test",
    GITHUB_OWNER: "trustops",
    GITHUB_REPO: "prompt-config",
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("octokit", () => ({
  Octokit: vi.fn(function Octokit() {
    return octokitMock;
  }),
}));

import { createBranch, commitFile, getFile, listBranches } from "./github";

describe("github service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets a file with content and sha", async () => {
    octokitMock.rest.repos.getContent.mockResolvedValue({
      data: {
        type: "file",
        sha: "abc123",
        content: Buffer.from("hello world", "utf8").toString("base64"),
      },
    });

    await expect(getFile("config.yaml", "main")).resolves.toEqual({
      content: "hello world",
      sha: "abc123",
    });
  });

  it("throws when getFile receives a directory response", async () => {
    octokitMock.rest.repos.getContent.mockResolvedValue({
      data: [{ name: "nested" }],
    });

    await expect(getFile("configs", "main")).rejects.toThrow("Expected a file at configs");
  });

  it("creates a branch from the base branch sha", async () => {
    octokitMock.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: "base-sha" } },
    });
    octokitMock.rest.git.createRef.mockResolvedValue({
      data: {
        ref: "refs/heads/feature/new-branch",
        object: { sha: "base-sha" },
      },
    });

    await expect(createBranch("feature/new-branch", "main")).resolves.toEqual({
      name: "feature/new-branch",
      sha: "base-sha",
    });
  });

  it("commits a file to the requested branch", async () => {
    octokitMock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });

    await expect(
      commitFile("config.yaml", "new content", "update config", "feature/new-branch", "abc123"),
    ).resolves.toEqual({ commit: { sha: "commit-sha" } });

    expect(octokitMock.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: "trustops",
      repo: "prompt-config",
      path: "config.yaml",
      message: "update config",
      content: Buffer.from("new content", "utf8").toString("base64"),
      branch: "feature/new-branch",
      sha: "abc123",
    });
  });

  it("lists branches with sha values", async () => {
    octokitMock.rest.repos.listBranches.mockResolvedValue({
      data: [
        { name: "main", commit: { sha: "main-sha" } },
        { name: "feature", commit: { sha: "feature-sha" } },
      ],
    });

    await expect(listBranches()).resolves.toEqual([
      { name: "main", sha: "main-sha" },
      { name: "feature", sha: "feature-sha" },
    ]);
  });

  it("surfaces GitHub errors", async () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    octokitMock.rest.repos.getContent.mockRejectedValue(error);

    await expect(getFile("config.yaml", "main")).rejects.toMatchObject({ status: 403 });
  });
});
