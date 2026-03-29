"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { parsePromptConfig } from "@/src/lib/config"
import type { GitHubCommit } from "@/src/lib/github"
import { useStore } from "@/lib/prompt-store"

type CommitConfig = {
  system_prompt: string
  temperature: number
  top_p: number
  top_k: number
}

type BranchPayload = {
  branches: Array<{ name: string; sha: string }>
}

type SelectedCommit = {
  commit: GitHubCommit
  config: CommitConfig
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`)
  }

  return response.json() as Promise<T>
}

function formatDate(date: string): string {
  if (!date) {
    return ""
  }

  return date.slice(0, 10)
}

async function loadCommitConfig(sha: string): Promise<CommitConfig> {
  const response = await fetch(`/api/git/file?ref=${encodeURIComponent(sha)}&path=apps/trustops/prompt-config.yaml`)

  if (!response.ok) {
    throw new Error("Failed to load commit config")
  }

  const payload = (await response.json()) as { content: string }

  return parsePromptConfig(payload.content)
}

export function BranchSelector() {
  const [hydrated, setHydrated] = useState(false)
  const {
    systemPrompt,
    setSystemPrompt,
    temperature,
    topP,
    topK,
    setTemperature,
    setTopP,
    setTopK,
  } = useStore((state) => state)
  const [branch, setBranch] = useState("")
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const branchesQuery = useQuery({
    queryKey: ["git-branches"],
    queryFn: () => fetchJson<BranchPayload>("/api/git/branches"),
  })

  const commitsQuery = useQuery({
    queryKey: ["git-commits", branch],
    queryFn: () => fetchJson<{ commits: GitHubCommit[] }>(`/api/git/commits?branch=${encodeURIComponent(branch)}`),
    enabled: branch.length > 0,
  })

  const branches = branchesQuery.data?.branches ?? []
  const commits = (commitsQuery.data?.commits ?? []).slice(0, 10)

  useEffect(() => {
    if (!branch && branches.length > 0) {
      setBranch(branches[0].name)
    }
  }, [branch, branches])

  async function handleLoadCommit(commit: GitHubCommit) {
    const config = await loadCommitConfig(commit.sha)

    const nextSelection: SelectedCommit = { commit, config }

    const action = () => {
      setSystemPrompt(config.system_prompt)
      setTemperature(config.temperature)
      setTopP(config.top_p)
      setTopK(config.top_k)
      setSelectedCommit(null)
      setDialogOpen(false)
      setPendingAction(null)
    }

    setSelectedCommit(nextSelection)
    setPendingAction(() => action)
    setDialogOpen(true)
  }

  const selectedConfig = selectedCommit?.config ?? null
  const hasUnsavedChanges = Boolean(
    selectedConfig && (
      systemPrompt !== selectedConfig.system_prompt ||
      temperature !== selectedConfig.temperature ||
      topP !== selectedConfig.top_p ||
      topK !== selectedConfig.top_k
    )
  )
  const loadButtonLabel = selectedCommit ? `Load ${selectedCommit.commit.sha.slice(0, 7)}` : "Load"

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="space-y-1">
        <h2 className="text-base font-medium tracking-tight">Branch selector</h2>
        <p className="text-sm text-muted-foreground">Choose a branch and inspect its recent commit history.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.22em] text-muted-foreground" htmlFor="branch-select">
          Branch
        </label>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger data-testid="branch-dropdown" id="branch-select" className="w-full">
            <SelectValue placeholder={branchesQuery.isLoading ? "Loading branches..." : "Select a branch"} />
          </SelectTrigger>
          <SelectContent>
            {branches.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Commit history</h3>
          <span className="text-xs text-muted-foreground">Up to 10 commits</span>
        </div>

        <div data-testid="commit-list" className="space-y-2">
          {commits.map((commit) => (
            <div
              key={commit.sha}
              data-testid="commit-item"
              className="rounded-2xl border border-border/60 bg-background/35 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {commit.sha.slice(0, 7)} · {commit.message.split("\n")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {commit.author} · {formatDate(commit.date)}
                  </p>
                </div>

                <Button data-testid="load-button" size="sm" variant="secondary" onClick={() => handleLoadCommit(commit)}>
                  Load
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/35 p-3 text-xs text-muted-foreground">
        {hydrated ? (
          <>
            <p data-testid="current-system-prompt">Prompt: {systemPrompt}</p>
            <p data-testid="current-temperature">Temperature: {temperature}</p>
            <p data-testid="current-top-p">Top P: {topP}</p>
            <p data-testid="current-top-k">Top K: {topK}</p>
          </>
        ) : (
          <p data-testid="current-system-prompt">Prompt:</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load commit</DialogTitle>
            <DialogDescription>
              {selectedCommit && hasUnsavedChanges
                ? "Unsaved editor changes will be replaced."
                : "This will replace the current editor contents."}
            </DialogDescription>
          </DialogHeader>

          {hasUnsavedChanges ? (
            <div data-testid="unsaved-warning" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
              Unsaved changes detected. Loading this commit will overwrite the editor.
            </div>
          ) : null}

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Branch:</span> {branch}
            </p>
            <p>
              <span className="font-medium">Commit:</span> {selectedCommit?.commit.message ?? ""}
            </p>
            <p>
              <span className="font-medium">Prompt:</span> {selectedCommit?.config.system_prompt ?? ""}
            </p>
            <p>
              <span className="font-medium">Params:</span>{" "}
              {selectedCommit
                ? `${selectedCommit.config.temperature} / ${selectedCommit.config.top_p} / ${selectedCommit.config.top_k}`
                : ""}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => pendingAction?.()}>
              {loadButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
