import { beforeEach, describe, expect, it, vi } from "vitest"

const { listBranchesMock } = vi.hoisted(() => ({
  listBranchesMock: vi.fn(),
}))

vi.mock("../../../../src/lib/github", () => ({
  listBranches: listBranchesMock,
}))

import { GET } from "./route"

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
