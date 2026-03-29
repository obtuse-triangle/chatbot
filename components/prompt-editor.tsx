"use client"

import { useEffect, useState } from "react"

import { CommitModal } from "@/components/commit-modal"
import { ParamSliders } from "@/components/param-sliders"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PROMPT_STORAGE_KEY, usePromptHydration, useStore } from "@/lib/prompt-store"

const DEFAULT_BRANCH = "main"
const DEFAULT_COMMIT_MESSAGE = "feat: update prompt configuration"

export function PromptEditor() {
  const [hydrated, setHydrated] = useState(false)
  const hydratePrompt = usePromptHydration()
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
      branchName: DEFAULT_BRANCH,
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
    setConfirmAction(async () => {
      setCiPipelineState({ phase: "committing", buildNumber: null, error: null })
      const commitResponse = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: DEFAULT_BRANCH,
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

      const commitPayload = (await commitResponse.json()) as { branch?: string }

      setCiPipelineState({ phase: "triggering", error: null })

      const triggerResponse = await fetch("/api/jenkins/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: commitPayload.branch ?? DEFAULT_BRANCH }),
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
