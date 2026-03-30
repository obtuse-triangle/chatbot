import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(),
}));

vi.mock("../../../src/lib/llm", () => ({
  streamChat: streamChatMock,
}));

import { POST } from "./route";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls streamChat with validated messages and config", async () => {
    streamChatMock.mockResolvedValueOnce(
      new Response("data: hello\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        config: {
          system_prompt: "You are helpful",
          temperature: 0.2,
          top_p: 0.9,
          top_k: 40,
        },
      }),
    });

    const response = await POST(request);

    expect(streamChatMock).toHaveBeenCalledWith(
      [{ role: "user", content: "hello" }],
      {
        system_prompt: "You are helpful",
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
      },
    );
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe("data: hello\n\n");
  });

  it("returns validation errors for missing fields", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: {} }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid request body");
    expect(streamChatMock).not.toHaveBeenCalled();
  });

  it("returns validation errors for wrong types", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        config: { temperature: "hot" },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(streamChatMock).not.toHaveBeenCalled();
  });

  it("returns the SSE stream from the service", async () => {
    streamChatMock.mockResolvedValueOnce(
      new Response("data: chunk-one\n\ndata: chunk-two\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      }),
    );

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe("data: chunk-one\n\ndata: chunk-two\n\n");
  });
});
