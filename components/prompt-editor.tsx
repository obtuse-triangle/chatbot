"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { CommitModal } from "@/components/commit-modal"
import { ParamSliders } from "@/components/param-sliders"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PROMPT_STORAGE_KEY, usePromptHydration, useStore } from "@/lib/prompt-store"

const DEFAULT_COMMIT_MESSAGE = "feat: update prompt configuration"

export function PromptEditor() {
  const [hydrated, setHydrated] = useState(false)
  const hydratePrompt = usePromptHydration()
  const queryClient = useQueryClient()
  const {
    prompt,
    setPrompt,
    temperature,
    topP,
    topK,
    setCommitDetails,
    setConfirmAction,
    setCommitModalOpen,
    setActiveTab,
    setCiPipelineState,
    selectedBranch,
  } = useStore(
    (state) => ({
      prompt: state.prompt,
      setPrompt: state.setPrompt,
      temperature: state.temperature,
      topP: state.topP,
      topK: state.topK,
      setCommitDetails: state.setCommitDetails,
      setConfirmAction: state.setConfirmAction,
      setCommitModalOpen: state.setCommitModalOpen,
      setActiveTab: state.setActiveTab,
      setCiPipelineState: state.setCiPipelineState,
      selectedBranch: state.selectedBranch,
    })
  )

  useEffect(() => {
    setHydrated(true)
    hydratePrompt()
  }, [hydratePrompt])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(PROMPT_STORAGE_KEY, prompt)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hydrated, prompt])

  const hasChanges = hydrated && (prompt.trim().length > 0 || temperature !== 0.7 || topP !== 1 || topK !== 40)

  const handleCommit = () => {
    if (!hasChanges) {
      return
    }

    setCommitDetails({
      branchName: selectedBranch,
      commitMessage: DEFAULT_COMMIT_MESSAGE,
      actionLabel: "Commit & Run CI",
      changesSummary: "Prompt text and generation parameters will be committed together.",
      prompt,
      params: {
        temperature,
        topP,
        topK,
      },
    })
    setConfirmAction(async (branch: string) => {
      setCiPipelineState({ phase: "committing", buildNumber: null, error: null })

      // If the branch name is different from selectedBranch, we need to create it first
      if (branch !== selectedBranch) {
        const createResponse = await fetch("/api/git/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: branch, base: selectedBranch }),
        })
        if (!createResponse.ok) {
          const errBody = await createResponse.json().catch(() => ({ error: "Failed to create branch" }))
          throw new Error(
            typeof errBody === "object" && errBody !== null && "error" in errBody
              ? String((errBody as { error: string }).error)
              : "Failed to create branch"
          )
        }
        // Invalidate branches query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["git-branches"] })
      }

      const commitResponse = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          prompt,
          params: {
            temperature,
            top_p: topP,
            top_k: topK,
          },
          message: DEFAULT_COMMIT_MESSAGE,
        }),
      })

      if (!commitResponse.ok) {
        setCiPipelineState({ phase: "failure", error: "Failed to commit prompt changes" })
        throw new Error("Failed to commit prompt changes")
      }

      setCiPipelineState({ phase: "triggering", error: null })

      const triggerResponse = await fetch("/api/jenkins/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      })

      if (!triggerResponse.ok) {
        setCiPipelineState({ phase: "failure", error: "Failed to trigger CI pipeline" })
        setActiveTab("ci-logs")
        throw new Error("Failed to trigger CI pipeline")
      }

      const triggerPayload = (await triggerResponse.json()) as { buildNumber?: number | null }
      const buildNumber = triggerPayload.buildNumber ?? null

      if (buildNumber === null) {
        setCiPipelineState({ phase: "failure", error: "CI trigger did not return a build number" })
        throw new Error("CI trigger did not return a build number")
      }

      setCiPipelineState({ phase: "running", buildNumber, error: null })
      setActiveTab("ci-logs")
    })
    setCommitModalOpen(true)
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="space-y-1">
        <h2 className="text-base font-medium tracking-tight">System prompt</h2>
        <p className="text-sm text-muted-foreground">Save your prompt locally while you iterate.</p>
      </div>

      <ParamSliders />

      <Textarea
        data-testid="prompt-textarea"
        placeholder="Write the system prompt for this run..."
        className="min-h-56 flex-1 bg-background/40"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />

      <Button data-testid="commit-run-ci-button" disabled={!hasChanges} onClick={handleCommit}>
        Commit & Run CI
      </Button>

      <p data-testid="prompt-character-count" className="text-xs text-muted-foreground">
        {prompt.length} characters
      </p>

      <CommitModal />
    </section>
  )
}
