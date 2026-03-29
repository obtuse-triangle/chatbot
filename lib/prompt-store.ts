"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

export const PROMPT_STORAGE_KEY = "trustops-system-prompt"
const PROMPT_QUERY_KEY = ["prompt-editor", "system-prompt"] as const
const PARAMS_QUERY_KEY = ["prompt-editor", "generation-params"] as const
const COMMIT_MODAL_QUERY_KEY = ["commit-modal"] as const
const ACTIVE_TAB_QUERY_KEY = ["app", "active-tab"] as const
const CI_PIPELINE_QUERY_KEY = ["ci-pipeline"] as const

export type PromptParameters = {
  temperature: number
  topP: number
  topK: number
}

export type CommitDetails = {
  branchName: string
  commitMessage: string
  actionLabel: string
  changesSummary: string
  prompt: string
  params: PromptParameters
}

type CommitModalState = {
  open: boolean
  commitDetails: CommitDetails | null
  confirmAction: (() => Promise<void> | void) | null
}

export type ActiveTab = "playground" | "ci-logs"

export type CiPipelinePhase = "idle" | "committing" | "triggering" | "running" | "success" | "failure"

export type CiPipelineState = {
  phase: CiPipelinePhase
  buildNumber: number | null
  error: string | null
}

function readStoredPrompt() {
  if (typeof window === "undefined") {
    return ""
  }

  return window.localStorage.getItem(PROMPT_STORAGE_KEY) ?? ""
}

type PromptStoreState = {
  prompt: string
  systemPrompt: string
  setPrompt: (prompt: string) => void
  setSystemPrompt: (prompt: string) => void
  temperature: number
  topP: number
  topK: number
  setTemperature: (temperature: number) => void
  setTopP: (topP: number) => void
  setTopK: (topK: number) => void
  commitModalOpen: boolean
  commitDetails: CommitDetails | null
  confirmAction: (() => Promise<void> | void) | null
  setCommitModalOpen: (open: boolean) => void
  setCommitDetails: (details: CommitDetails | null) => void
  setConfirmAction: (action: (() => Promise<void> | void) | null) => void
  resetCommitModal: () => void
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  ciPipeline: CiPipelineState
  setCiPipelineState: (patch: Partial<CiPipelineState>) => void
  resetCiPipeline: () => void
}

export function useStore<T>(selector: (state: PromptStoreState) => T): T {
  const queryClient = useQueryClient()
  const { data: prompt = "" } = useQuery({
    queryKey: PROMPT_QUERY_KEY,
    queryFn: async () => readStoredPrompt(),
    initialData: "",
    staleTime: Number.POSITIVE_INFINITY,
  })
  const { data: params = { temperature: 0.7, topP: 0.9, topK: 40 } } = useQuery({
    queryKey: PARAMS_QUERY_KEY,
    queryFn: async () => ({ temperature: 0.7, topP: 0.9, topK: 40 }),
    initialData: { temperature: 0.7, topP: 0.9, topK: 40 },
    staleTime: Number.POSITIVE_INFINITY,
  })
  const { data: commitModal = { open: false, commitDetails: null, confirmAction: null } } = useQuery({
    queryKey: COMMIT_MODAL_QUERY_KEY,
    queryFn: async () => ({ open: false, commitDetails: null, confirmAction: null } satisfies CommitModalState),
    initialData: { open: false, commitDetails: null, confirmAction: null } satisfies CommitModalState,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const { data: activeTab = "playground" } = useQuery({
    queryKey: ACTIVE_TAB_QUERY_KEY,
    queryFn: async () => "playground" as ActiveTab,
    initialData: "playground" as ActiveTab,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const { data: ciPipeline = { phase: "idle", buildNumber: null, error: null } } = useQuery({
    queryKey: CI_PIPELINE_QUERY_KEY,
    queryFn: async () => ({ phase: "idle", buildNumber: null, error: null } satisfies CiPipelineState),
    initialData: { phase: "idle", buildNumber: null, error: null } satisfies CiPipelineState,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const setPrompt = useCallback(
    (nextPrompt: string) => {
      queryClient.setQueryData(PROMPT_QUERY_KEY, nextPrompt)
    },
    [queryClient]
  )

  const setTemperature = useCallback(
    (nextTemperature: number) => {
      queryClient.setQueryData(PARAMS_QUERY_KEY, (current: PromptParameters | undefined) => ({
        temperature: nextTemperature,
        topP: current?.topP ?? 0.9,
        topK: current?.topK ?? 40,
      }))
    },
    [queryClient]
  )

  const setTopP = useCallback(
    (nextTopP: number) => {
      queryClient.setQueryData(PARAMS_QUERY_KEY, (current: PromptParameters | undefined) => ({
        temperature: current?.temperature ?? 0.7,
        topP: nextTopP,
        topK: current?.topK ?? 40,
      }))
    },
    [queryClient]
  )

  const setTopK = useCallback(
    (nextTopK: number) => {
      queryClient.setQueryData(PARAMS_QUERY_KEY, (current: PromptParameters | undefined) => ({
        temperature: current?.temperature ?? 0.7,
        topP: current?.topP ?? 0.9,
        topK: nextTopK,
      }))
    },
    [queryClient]
  )

  const setCommitModalOpen = useCallback(
    (open: boolean) => {
      queryClient.setQueryData(COMMIT_MODAL_QUERY_KEY, (current: CommitModalState | undefined) => ({
        open,
        commitDetails: current?.commitDetails ?? null,
        confirmAction: current?.confirmAction ?? null,
      }))
    },
    [queryClient]
  )

  const setCommitDetails = useCallback(
    (details: CommitDetails | null) => {
      queryClient.setQueryData(COMMIT_MODAL_QUERY_KEY, (current: CommitModalState | undefined) => ({
        open: current?.open ?? false,
        commitDetails: details,
        confirmAction: current?.confirmAction ?? null,
      }))
    },
    [queryClient]
  )

  const setConfirmAction = useCallback(
    (action: (() => Promise<void> | void) | null) => {
      queryClient.setQueryData(COMMIT_MODAL_QUERY_KEY, (current: CommitModalState | undefined) => ({
        open: current?.open ?? false,
        commitDetails: current?.commitDetails ?? null,
        confirmAction: action,
      }))
    },
    [queryClient]
  )

  const resetCommitModal = useCallback(() => {
    queryClient.setQueryData(COMMIT_MODAL_QUERY_KEY, {
      open: false,
      commitDetails: null,
      confirmAction: null,
    } satisfies CommitModalState)
  }, [queryClient])

  const setActiveTab = useCallback(
    (tab: ActiveTab) => {
      queryClient.setQueryData(ACTIVE_TAB_QUERY_KEY, tab)
    },
    [queryClient]
  )

  const setCiPipelineState = useCallback(
    (patch: Partial<CiPipelineState>) => {
      queryClient.setQueryData(CI_PIPELINE_QUERY_KEY, (current: CiPipelineState | undefined) => ({
        phase: patch.phase ?? current?.phase ?? "idle",
        buildNumber: "buildNumber" in patch ? patch.buildNumber ?? null : current?.buildNumber ?? null,
        error: "error" in patch ? patch.error ?? null : current?.error ?? null,
      }))
    },
    [queryClient]
  )

  const resetCiPipeline = useCallback(() => {
    queryClient.setQueryData(CI_PIPELINE_QUERY_KEY, {
      phase: "idle",
      buildNumber: null,
      error: null,
    } satisfies CiPipelineState)
  }, [queryClient])

  return selector({
    prompt,
    systemPrompt: prompt,
    setPrompt,
    setSystemPrompt: setPrompt,
    temperature: params.temperature,
    topP: params.topP,
    topK: params.topK,
    setTemperature,
    setTopP,
    setTopK,
    commitModalOpen: commitModal.open,
    commitDetails: commitModal.commitDetails,
    confirmAction: commitModal.confirmAction,
    setCommitModalOpen,
    setCommitDetails,
    setConfirmAction,
    resetCommitModal,
    activeTab,
    setActiveTab,
    ciPipeline,
    setCiPipelineState,
    resetCiPipeline,
  })
}

export function usePromptHydration() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.setQueryData(PROMPT_QUERY_KEY, readStoredPrompt())
  }, [queryClient])
}
