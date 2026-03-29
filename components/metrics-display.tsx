"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metrics } from "@/src/types"

type MetricsApiResponse = {
  faithfulness: number
  relevance: number
  commitId: string
}

type MetricsDisplayProps = {
  buildStatus: "BUILDING" | "SUCCESS"
  buildNumber?: number
  commitId?: string
  enabled?: boolean
}

const METRICS_QUERY_KEY = (buildNumber: number) => ["metrics-display", buildNumber] as const

function useMetrics(buildNumber: number, enabled: boolean) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: METRICS_QUERY_KEY(buildNumber),
    queryFn: async () => {
      const response = await fetch(`/api/metrics?buildNumber=${buildNumber}`)

      if (!response.ok) {
        throw new Error(`Failed to load metrics: ${response.status}`)
      }

      const data = (await response.json()) as MetricsApiResponse

      return {
        faithfulness: data.faithfulness,
        relevance: data.relevance,
        commit_id: data.commitId,
      } satisfies Metrics
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    if (query.data) {
      queryClient.setQueryData(METRICS_QUERY_KEY(buildNumber), query.data)
    }
  }, [buildNumber, query.data, queryClient])

  return {
    metrics: query.data ?? (queryClient.getQueryData<Metrics>(METRICS_QUERY_KEY(buildNumber)) ?? null),
    dataUpdatedAt: query.dataUpdatedAt,
  }
}

export function MetricsDisplay({ buildStatus, buildNumber, commitId, enabled = true }: MetricsDisplayProps) {
  const resolvedBuildNumber = buildNumber ?? Number(commitId ?? 0)
  const { metrics, dataUpdatedAt } = useMetrics(resolvedBuildNumber, enabled && buildStatus === "SUCCESS")

  if (!metrics) {
    return <section data-testid="metrics-container" style={{ display: "none" }} />
  }

  return (
    <section data-testid="metrics-container" style={{ display: "block" }}>
      <Card data-testid="metrics-display" className="border-border/60 bg-card/45">
        <CardHeader>
          <CardTitle>Metrics snapshot</CardTitle>
          <CardDescription>
            Faithfulness and relevance from the latest successful Jenkins run.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge data-testid="faithfulness-score" variant="secondary">
              Faithfulness {metrics.faithfulness.toFixed(2)}
            </Badge>
            <Badge data-testid="relevance-score" variant="secondary">
              Relevance {metrics.relevance.toFixed(2)}
            </Badge>
          </div>

          <div className="grid gap-1 text-sm text-muted-foreground">
            <p>
              Commit ID{" "}
              <span data-testid="commit-id" className="font-medium text-foreground">
                {(metrics.commit_id ?? "").slice(-7)}
              </span>
            </p>
            <p>
              Timestamp{" "}
              <time
                data-testid="timestamp"
                dateTime={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : ""}
                className="font-medium text-foreground"
              >
                {dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : ""}
              </time>
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
