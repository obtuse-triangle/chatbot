import { NextResponse } from "next/server";
import { z } from "zod";

import { streamChat } from "../../../src/lib/llm";
import { chatMessageSchema } from "../../../src/schemas";

const chatRouteSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  config: z
    .object({
      system_prompt: z.string().min(1).optional(),
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      top_k: z.number().optional(),
    })
    .default({}),
});

function extractContentFromChunk(chunk: string): { content: string; reasoningContent: string } {
  const lines = chunk.split("\n");
  let content = "";
  let reasoningContent = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ")) {
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (delta) {
          if (delta.reasoning_content) {
            reasoningContent += delta.reasoning_content;
          }
          if (delta.content) {
            content += delta.content;
          }
        }
      } catch {
        /* noop */
      }
    }
  }

  return { content, reasoningContent };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = chatRouteSchema.parse(await request.json());
    const upstreamResponse = await streamChat(body.messages, body.config);

    let accumulatedReasoning = "";
    let hasSentReasoningStart = false;

    const transformStream = new TransformStream({
      transform(chunk: Uint8Array, controller) {
        const text = new TextDecoder().decode(chunk);
        const { content, reasoningContent } = extractContentFromChunk(text);

        if (reasoningContent) {
          if (!hasSentReasoningStart) {
            controller.enqueue(new TextEncoder().encode("lh"));
            hasSentReasoningStart = true;
          }
          accumulatedReasoning += reasoningContent;
          controller.enqueue(new TextEncoder().encode(reasoningContent));
        }

        if (content) {
          if (hasSentReasoningStart) {
            controller.enqueue(new TextEncoder().encode("            "));
            hasSentReasoningStart = false;
          }
          controller.enqueue(new TextEncoder().encode(content));
        }
      },
      flush(controller) {
        if (hasSentReasoningStart) {
          controller.enqueue(new TextEncoder().encode("            "));
        }
      },
    });

    return new Response(upstreamResponse.body?.pipeThrough(transformStream), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", issues: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to stream chat" }, { status: 500 });
  }
}
