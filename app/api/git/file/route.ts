import { NextResponse } from "next/server"
import { z } from "zod"

import { getFile } from "../../../../src/lib/github"

const fileRouteSchema = z.object({
  ref: z.string().min(1),
  path: z.string().min(1),
})

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const parsed = fileRouteSchema.safeParse({
      ref: url.searchParams.get("ref"),
      path: url.searchParams.get("path"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request query", issues: parsed.error.flatten() }, { status: 400 })
    }

    const file = await getFile(parsed.data.path, parsed.data.ref)

    return NextResponse.json({
      content: file.content,
      sha: file.sha,
    })
  } catch {
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 })
  }
}
