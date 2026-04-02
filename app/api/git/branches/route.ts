import { NextResponse } from "next/server"
import { z } from "zod"

import { isValidBranchName } from "../../../../lib/branch-validation"
import { createBranch, listBranches } from "../../../../src/lib/github"

export async function GET(): Promise<Response> {
  try {
    const branches = await listBranches()

    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ error: "Failed to load branches" }, { status: 500 })
  }
}

const createBranchSchema = z.object({
  name: z.string().min(1).refine(isValidBranchName, {
    message: "Branch name must be 'main' or start with 'prompt-config/'",
  }),
  base: z.string().min(1),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = createBranchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", issues: parsed.error.flatten() }, { status: 400 })
    }

    const branch = await createBranch(parsed.data.name, parsed.data.base)

    return NextResponse.json({ branch }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
  }
}
