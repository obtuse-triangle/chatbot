import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("./env", () => ({
  env: {
    LLM_ENDPOINT: "https://trustops-back.example.com",
  },
}));

vi.stubGlobal("fetch", fetchMock);

import { streamChat } from "./llm";
import type { ChatMessage } from "../types";

describe("llm service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts chat messages and preview config to the backend", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("data: ok\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const messages: ChatMessage[] = [{ role: "user", content: "hello" }];

    await streamChat(messages, {
      system_prompt: "You are a pirate",
      temperature: 0.3,
      top_p: 0.9,
      top_k: 40,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://trustops-back.example.com/preview",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        }),
        body: JSON.stringify({
          messages,
          system_prompt: "You are a pirate",
          temperature: 0.3,
          top_p: 0.9,
          top_k: 40,
        }),
      }),
    );
  });

  it("returns the backend SSE response unchanged", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("data: chunk-one\n\ndata: chunk-two\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const response = await streamChat([{ role: "user", content: "hello" }]);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe("data: chunk-one\n\ndata: chunk-two\n\n");
  });

  it("surfaces backend errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

    await expect(streamChat([{ role: "user", content: "hello" }])).rejects.toThrow(
      "LLM preview request failed with status 400",
    );
  });
});
