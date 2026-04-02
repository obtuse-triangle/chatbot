import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import React from "react"

import { useStore } from "./prompt-store"

const createWrapper = () => {
  const queryClient = new QueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useStore selectedBranch", () => {
  it("returns selectedBranch === 'main' by default", () => {
    const { result } = renderHook(() => useStore((s) => s.selectedBranch), {
      wrapper: createWrapper(),
    })
    expect(result.current).toBe("main")
  })

  it("setSelectedBranch('prompt-config/test') updates selectedBranch", async () => {
    const { result } = renderHook(
      () => useStore((s) => ({ selectedBranch: s.selectedBranch, setSelectedBranch: s.setSelectedBranch })),
      { wrapper: createWrapper() }
    )

    expect(result.current.selectedBranch).toBe("main")

    result.current.setSelectedBranch("prompt-config/test")

    await waitFor(() => {
      expect(result.current.selectedBranch).toBe("prompt-config/test")
    })
  })
})