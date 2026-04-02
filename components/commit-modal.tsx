"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { validateBranchSuffix } from "@/lib/branch-validation"
import { useStore } from "@/lib/prompt-store"
import { useQuery } from "@tanstack/react-query"

export function CommitModal() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const {
    commitModalOpen,
    commitDetails,
    confirmAction,
    setCommitModalOpen,
    resetCommitModal,
    selectedBranch,
  } = useStore(
    (state) => ({
      commitModalOpen: state.commitModalOpen,
      commitDetails: state.commitDetails,
      confirmAction: state.confirmAction,
      setCommitModalOpen: state.setCommitModalOpen,
      resetCommitModal: state.resetCommitModal,
      selectedBranch: state.selectedBranch,
    })
  )

  const [targetBranch, setTargetBranch] = useState(selectedBranch)
  const [isNewBranch, setIsNewBranch] = useState(false)
  const [newBranchSuffix, setNewBranchSuffix] = useState("")
  const [branchError, setBranchError] = useState<string | null>(null)

  const branchesQuery = useQuery({
    queryKey: ["git-branches"],
    queryFn: () => fetch("/api/git/branches").then(r => r.json() as Promise<{ branches: Array<{ name: string }> }>),
  })
  const branches = branchesQuery.data?.branches ?? []

  useEffect(() => {
    setTargetBranch(selectedBranch)
    setIsNewBranch(false)
    setNewBranchSuffix("")
    setBranchError(null)
  }, [selectedBranch, commitModalOpen])

  function handleBranchChange(value: string) {
    if (value === "__create_new__") {
      setIsNewBranch(true)
      setNewBranchSuffix("")
      setBranchError(null)
    } else {
      setIsNewBranch(false)
      setNewBranchSuffix("")
      setBranchError(null)
      setTargetBranch(value)
    }
  }

  const finalBranch = isNewBranch ? `prompt-config/${newBranchSuffix}` : targetBranch

  const handleClose = () => {
    if (isSubmitting) {
      return
    }

    resetCommitModal()
    setErrorMessage(null)
    setIsSubmitting(false)
    setIsNewBranch(false)
    setNewBranchSuffix("")
    setBranchError(null)
  }

  const handleConfirm = async () => {
    if (!confirmAction) {
      return
    }

    if (isNewBranch) {
      const validation = validateBranchSuffix(newBranchSuffix)
      if (!validation.valid) {
        setBranchError(validation.error)
        return
      }
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await confirmAction(finalBranch)
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete commit"

      if (message.toLowerCase().includes("trigger ci pipeline")) {
        handleClose()
        return
      }

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={commitModalOpen} onOpenChange={(open) => (open ? setCommitModalOpen(true) : handleClose())}>
      <DialogContent data-testid="commit-dialog" overlayTestId="modal-overlay">
        <div data-testid="commit-modal">
          <DialogHeader>
            <DialogTitle>Confirm commit</DialogTitle>
            <DialogDescription data-testid="warning-message">
              This will commit to GitHub and trigger CI pipeline
            </DialogDescription>
          </DialogHeader>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div data-testid="commit-details" className="space-y-3 py-3 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Branch</p>
              <Select value={isNewBranch ? "__create_new__" : targetBranch} onValueChange={handleBranchChange}>
                <SelectTrigger className="w-full" data-testid="commit-branch-select">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                  <SelectItem value="__create_new__">+ Create new branch</SelectItem>
                </SelectContent>
              </Select>
              {isNewBranch ? (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/35 p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">prompt-config/</span>
                    <Input
                      data-testid="new-branch-suffix"
                      placeholder="branch-name"
                      value={newBranchSuffix}
                      onChange={(e) => { setNewBranchSuffix(e.target.value); setBranchError(null) }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleConfirm() }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Based on: {targetBranch}</p>
                  {branchError ? <p className="text-sm text-destructive">{branchError}</p> : null}
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="font-medium">Commit message</p>
              <p className="text-muted-foreground">{commitDetails?.commitMessage ?? "feat: update prompt configuration"}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Action</p>
              <p className="text-muted-foreground">{commitDetails?.actionLabel ?? "Commit & Run CI"}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Changes summary</p>
              <p className="text-muted-foreground">{commitDetails?.changesSummary ?? "Prompt text and generation parameters will be committed together."}</p>
              <p className="text-muted-foreground">Prompt updated: {commitDetails?.prompt ?? ""}</p>
              <p className="text-muted-foreground">
                Params: temperature {commitDetails?.params.temperature ?? 0.7}, top_p {commitDetails?.params.topP ?? 1}, top_k {commitDetails?.params.topK ?? 40}
              </p>
            </div>
          </div>

            <DialogFooter>
              <Button data-testid="cancel-action-button" disabled={isSubmitting} onClick={handleClose} variant="outline">
                Cancel
              </Button>
              <Button data-testid="confirm-action-button" disabled={isSubmitting} onClick={handleConfirm}>
                {isSubmitting ? "Committing..." : "Commit & Run CI"}
              </Button>
            </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
