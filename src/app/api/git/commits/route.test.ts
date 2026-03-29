import { beforeEach, describe, expect, it, vi } from "vitest";

const { listBranchesMock, listCommitsMock } = vi.hoisted(() => ({
  listBranchesMock: vi.fn(),
  listCommitsMock: vi.fn(),
}));

vi.mock("../../../../lib/env", () => ({
  env: {
    GITHUB_PAT: "ghp_test",
    GITHUB_OWNER: "trustops",
    GITHUB_REPO: "prompt-config",
  },
}));

vi.mock("../../../../lib/github", () => ({
  listBranches: listBranchesMock,
  listCommits: listCommitsMock,
}));

import { GET } from "./route";

describe("GET /api/git/commits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns commit history for the requested branch", async () => {
    listBranchesMock.mockResolvedValueOnce([{ name: "main", sha: "main-sha" }]);
    listCommitsMock.mockResolvedValueOnce([
      {
        sha: "abc123",
        message: "Initial commit",
        author: "Alice",
        date: "2026-03-29T10:00:00Z",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/git/commits?branch=main"));
    const payload = await response.json();

    expect(listBranchesMock).toHaveBeenCalledTimes(1);
    expect(listCommitsMock).toHaveBeenCalledWith("main-sha", 30);
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      commits: [
        {
          sha: "abc123",
          message: "Initial commit",
          author: "Alice",
          date: "2026-03-29T10:00:00Z",
        },
      ],
    });
  });

  it("returns a validation error when branch is missing", async () => {
    const response = await GET(new Request("http://localhost/api/git/commits"));

    expect(response.status).toBe(400);
    expect(listBranchesMock).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown branch", async () => {
    listBranchesMock.mockResolvedValueOnce([{ name: "main", sha: "main-sha" }]);

    const response = await GET(new Request("http://localhost/api/git/commits?branch=feature"));

    expect(response.status).toBe(404);
    expect(listCommitsMock).not.toHaveBeenCalled();
  });
});
