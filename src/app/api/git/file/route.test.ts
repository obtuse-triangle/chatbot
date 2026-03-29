import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFileMock } = vi.hoisted(() => ({
  getFileMock: vi.fn(),
}));

vi.mock("../../../../lib/github", () => ({
  getFile: getFileMock,
}));

import { GET } from "./route";

describe("GET /api/git/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content for the requested ref and path", async () => {
    getFileMock.mockResolvedValueOnce({
      content: "hello world",
      sha: "abc123",
    });

    const response = await GET(new Request("http://localhost/api/git/file?ref=main&path=config.yaml"));
    const payload = await response.json();

    expect(getFileMock).toHaveBeenCalledWith("config.yaml", "main");
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      content: "hello world",
      sha: "abc123",
    });
  });

  it("returns validation errors for missing query parameters", async () => {
    const response = await GET(new Request("http://localhost/api/git/file?ref=main"));

    expect(response.status).toBe(400);
    expect(getFileMock).not.toHaveBeenCalled();
  });
});
