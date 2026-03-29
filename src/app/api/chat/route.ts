import { NextResponse } from "next/server";
import { z } from "zod";

import { streamChat } from "../../../lib/llm";
import { chatMessageSchema } from "../../../schemas";

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

export async function POST(request: Request): Promise<Response> {
  try {
    const body = chatRouteSchema.parse(await request.json());
    return await streamChat(body.messages, body.config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", issues: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to stream chat" }, { status: 500 });
  }
}
