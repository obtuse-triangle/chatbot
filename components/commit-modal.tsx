"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useStore } from "@/lib/prompt-store"

export function CommitModal() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const {
    commitModalOpen,
    commitDetails,
    confirmAction,
    setCommitModalOpen,
    resetCommitModal,
  } = useStore(
    (state) => ({
      commitModalOpen: state.commitModalOpen,
      commitDetails: state.commitDetails,
      confirmAction: state.confirmAction,
      setCommitModalOpen: state.setCommitModalOpen,
      resetCommitModal: state.resetCommitModal,
    })
  )

  const handleClose = () => {
    if (isSubmitting) {
      return
    }

    resetCommitModal()
    setErrorMessage(null)
    setIsSubmitting(false)
  }

  const handleConfirm = async () => {
    if (!confirmAction) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await confirmAction()
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
              <p className="text-muted-foreground">{commitDetails?.branchName ?? "main"}</p>
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
