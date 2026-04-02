import { beforeEach, describe, expect, it, vi } from "vitest"

const { listBranchesMock, createBranchMock } = vi.hoisted(() => ({
  listBranchesMock: vi.fn(),
  createBranchMock: vi.fn(),
}))

vi.mock("../../../../src/lib/github", () => ({
  listBranches: listBranchesMock,
  createBranch: createBranchMock,
}))

import { GET, POST } from "./route"

describe("GET /api/git/branches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns branches", async () => {
    listBranchesMock.mockResolvedValueOnce([
      { name: "main", sha: "main-sha" },
      { name: "feature", sha: "feature-sha" },
    ])

    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      branches: [
        { name: "main", sha: "main-sha" },
        { name: "feature", sha: "feature-sha" },
      ],
    })
  })
})

describe("POST /api/git/branches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid branch name 'feature/test'", async () => {
    const response = await POST(
      new Request("http://localhost/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "feature/test", base: "main" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(createBranchMock).not.toHaveBeenCalled()
  })

  it("passes validation for 'prompt-config/experiment'", async () => {
    createBranchMock.mockResolvedValueOnce({ name: "prompt-config/experiment", sha: "new-sha" })

    const response = await POST(
      new Request("http://localhost/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "prompt-config/experiment", base: "main" }),
      }),
    )

    expect(response.status).toBe(201)
    expect(createBranchMock).toHaveBeenCalledWith("prompt-config/experiment", "main")
  })

  it("passes validation for 'main'", async () => {
    createBranchMock.mockResolvedValueOnce({ name: "main", sha: "main-sha" })

    const response = await POST(
      new Request("http://localhost/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "main", base: "main" }),
      }),
    )

    expect(response.status).toBe(201)
    expect(createBranchMock).toHaveBeenCalledWith("main", "main")
  })

  it("returns 400 for 'prompt-config/' with empty suffix", async () => {
    const response = await POST(
      new Request("http://localhost/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "prompt-config/", base: "main" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(createBranchMock).not.toHaveBeenCalled()
  })
})
