"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, XIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { MetricsDisplay } from "@/components/metrics-display"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/prompt-store"

const CI_LOGS_QUERY_KEY = ["ci-logs", "terminal"] as const
const POLL_INTERVAL_MS = 2000
const DEFAULT_BUILD_NUMBER = 42

type CiLogStatus = "running" | "success" | "failure"

type CiLogsState = {
  logs: string
  status: CiLogStatus
  buildNumber: number | null
}

type CiLogsStore = CiLogsState & {
  setLogs: (logs: string) => void
  appendLogs: (logs: string) => void
  setStatus: (status: CiLogStatus) => void
  setBuildNumber: (buildNumber: number | null) => void
}

type CiLogsResponse = {
  logs: string
  status: string
  buildNumber: number
}

const INITIAL_STATE: CiLogsState = {
  logs: "",
  status: "running",
  buildNumber: null,
}

function readInitialState(): CiLogsState {
  return INITIAL_STATE
}

function normalizeStatus(status: string): CiLogStatus {
  switch (status.toUpperCase()) {
    case "BUILDING":
    case "RUNNING":
    case "QUEUED":
      return "running"
    case "SUCCESS":
      return "success"
    default:
      return "failure"
  }
}

function useCiLogsStore<T>(selector: (state: CiLogsStore) => T): T {
  const queryClient = useQueryClient()
  const { data: state = INITIAL_STATE } = useQuery({
    queryKey: CI_LOGS_QUERY_KEY,
    queryFn: async () => readInitialState(),
    initialData: readInitialState(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const setLogs = useCallback((logs: string) => {
    queryClient.setQueryData<CiLogsState>(CI_LOGS_QUERY_KEY, (current) => ({
      ...(current ?? readInitialState()),
      logs,
    }))
  }, [queryClient])

  const appendLogs = useCallback((logs: string) => {
    if (!logs) {
      return
    }

    queryClient.setQueryData<CiLogsState>(CI_LOGS_QUERY_KEY, (current) => ({
      ...(current ?? readInitialState()),
      logs: `${(current ?? readInitialState()).logs}${logs}`,
    }))
  }, [queryClient])

  const setStatus = useCallback((status: CiLogStatus) => {
    queryClient.setQueryData<CiLogsState>(CI_LOGS_QUERY_KEY, (current) => ({
      ...(current ?? readInitialState()),
      status,
    }))
  }, [queryClient])

  const setBuildNumber = useCallback((buildNumber: number | null) => {
    queryClient.setQueryData<CiLogsState>(CI_LOGS_QUERY_KEY, (current) => ({
      ...(current ?? readInitialState()),
      buildNumber,
    }))
  }, [queryClient])

  return selector({
    ...state,
    setLogs,
    appendLogs,
    setStatus,
    setBuildNumber,
  })
}

function statusCopy(status: CiLogStatus): string {
  switch (status) {
    case "running":
      return "Running"
    case "success":
      return "Success"
    case "failure":
      return "Failure"
    default:
      return "Running"
  }
}

function StatusBadge({ status }: { status: CiLogStatus }) {
  return (
    <Badge
      data-testid="status-badge"
      className={cn(
        "gap-1.5 border",
        status === "running" && "border-border bg-muted text-muted-foreground",
        status === "success" && "border-success/30 bg-success/10 text-success",
        status === "failure" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
      variant="outline"
    >
      {status === "running" ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex size-3 items-center justify-center">
            <span className="size-2 rounded-full bg-current/60" />
            <Spinner className="absolute size-3" />
          </span>
          {statusCopy(status)}
        </span>
      ) : status === "success" ? (
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="size-3.5" />
          {statusCopy(status)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <XIcon className="size-3.5" />
          {statusCopy(status)}
        </span>
      )}
    </Badge>
  )
}

export function CiLogsTerminal() {
  const searchParams = useSearchParams()
  const { buildNumber, phase, error } = useStore((state) => ({
    buildNumber: state.ciPipeline.buildNumber,
    phase: state.ciPipeline.phase,
    error: state.ciPipeline.error,
  }))
  const fallbackBuildNumber = Number.parseInt(searchParams.get("buildNumber") ?? String(DEFAULT_BUILD_NUMBER), 10)
  const resolvedBuildNumber = buildNumber ?? (Number.isFinite(fallbackBuildNumber) ? fallbackBuildNumber : DEFAULT_BUILD_NUMBER)

  const { logs, status, setBuildNumber, setLogs, setStatus, appendLogs } = useCiLogsStore(
    (state) => ({
      logs: state.logs,
      status: state.status,
      setBuildNumber: state.setBuildNumber,
      setLogs: state.setLogs,
      setStatus: state.setStatus,
      appendLogs: state.appendLogs,
    }),
  )

  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (phase === "idle" && buildNumber === null && !searchParams.get("buildNumber")) {
      return
    }

    setBuildNumber(resolvedBuildNumber)
    setLogs("")
    setStatus("running")
  }, [buildNumber, phase, resolvedBuildNumber, searchParams, setBuildNumber, setLogs, setStatus])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined
    let offset = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/jenkins/logs?buildNumber=${resolvedBuildNumber}&offset=${offset}`)

        if (!response.ok) {
          throw new Error(`Polling failed with status ${response.status}`)
        }

        const data = (await response.json()) as CiLogsResponse

        if (cancelled) {
          return
        }

        if (data.logs) {
          appendLogs(data.logs)
          offset += data.logs.length
        }

        const nextStatus = normalizeStatus(data.status)
        setStatus(nextStatus)

        if (nextStatus !== "running") {
          return
        }

        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) {
          setStatus("failure")
        }
      }
    }

    if (buildNumber !== null || searchParams.get("buildNumber")) {
      poll().catch(() => {
        if (!cancelled) {
          setStatus("failure")
        }
      })
    }

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [appendLogs, buildNumber, resolvedBuildNumber, searchParams, setStatus])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [])

  const lines = logs
    ? logs.split(/\r?\n/).filter((line, index, array) => index < array.length - 1 || line.length > 0)
    : []
  const buildStatus = status === "success" ? "SUCCESS" : "BUILDING"

  return (
    <section
      className="flex h-[30rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/65 font-mono shadow-[var(--shadow-card)]"
      data-testid="ci-logs-terminal"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Jenkins console</p>
          <Badge data-testid="build-number" variant="outline">
            Build #{resolvedBuildNumber}
          </Badge>
        </div>
        <StatusBadge status={status} />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0 px-4 py-4 text-[13px] leading-6 text-foreground/90">
          {lines.length > 0 ? (
            lines.map((line, index) => (
              <div data-testid="log-line" key={`${index}-${line}`}>
                {line.length > 0 ? line : "\u00a0"}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">Waiting for Jenkins log output…</div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 px-4 py-4">
        <MetricsDisplay buildStatus={buildStatus} buildNumber={resolvedBuildNumber} enabled={status === "success"} />
        {error ? <p data-testid="ci-error" className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  )
}
