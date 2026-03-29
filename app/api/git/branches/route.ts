import { NextResponse } from "next/server"

import { listBranches } from "../../../../src/lib/github"

export async function GET(): Promise<Response> {
  try {
    const branches = await listBranches()

    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ error: "Failed to load branches" }, { status: 500 })
  }
}
