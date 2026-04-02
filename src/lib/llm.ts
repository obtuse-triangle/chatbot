import "server-only";

import { env } from "./env";
import type { ChatMessage, PromptConfig } from "../types";

export type StreamChatConfig = Pick<
  PromptConfig,
  "system_prompt" | "temperature" | "top_p" | "top_k"
>;

function buildPreviewUrl(): string {
  return new URL("/preview", env.LLM_ENDPOINT).toString();
}

export async function streamChat(messages: ChatMessage[], config: Partial<StreamChatConfig> = {}): Promise<Response> {
  const response = await fetch(buildPreviewUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      messages,
      stream: true,
      ...config,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM preview request failed with status ${response.status}`);
  }

  return response;
}
