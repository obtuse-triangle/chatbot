import "server-only";

import { env } from "./env";
import type { JenkinsBuild } from "../types";

const MIN_POLL_INTERVAL_MS = 2000;

function resolveJobName(job: string): string {
  return job.trim() || env.JENKINS_JOB;
}

function normalizeJenkinsUrl(path: string): string {
  return `${env.JENKINS_URL.replace(/\/$/, "")}${path}`;
}

function encodeJobPath(job: string): string {
  return resolveJobName(job)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/job/");
}

function buildUrl(job: string, suffix = ""): string {
  const jobPath = encodeJobPath(job);
  return normalizeJenkinsUrl(`/job/${jobPath}${suffix}`);
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(`:${env.JENKINS_TOKEN}`).toString("base64")}`,
  };
}

async function jenkinsRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Jenkins request failed with status ${response.status}`);
  }

  return response;
}

export async function triggerBuild(job: string, params: Record<string, string>): Promise<{ location: string | null }> {
  const searchParams = new URLSearchParams(params);
  const url = `${buildUrl(job, "/buildWithParameters")}?${searchParams.toString()}`;
  const response = await jenkinsRequest(url, { method: "POST" });

  return {
    location: response.headers.get("Location"),
  };
}

export async function getBuildStatus(job: string, buildNumber: number): Promise<JenkinsBuild> {
  const response = await jenkinsRequest(buildUrl(job, `/${buildNumber}/api/json`));
  const data = (await response.json()) as { number?: number; building?: boolean; result?: string };

  return {
    number: data.number ?? buildNumber,
    status: data.building ? "BUILDING" : data.result ?? "UNKNOWN",
    logs: "",
  };
}

export async function getBuildLogs(job: string, buildNumber: number): Promise<string> {
  const response = await jenkinsRequest(buildUrl(job, `/${buildNumber}/consoleText`));
  return await response.text();
}

export async function pollBuildLogs(
  job: string,
  buildNumber: number,
  callback: (log: string) => void,
  intervalMs = MIN_POLL_INTERVAL_MS,
): Promise<void> {
  const pollInterval = Math.max(intervalMs, MIN_POLL_INTERVAL_MS);
  let previousLog = "";

  while (true) {
    const currentLog = await getBuildLogs(job, buildNumber);

    if (currentLog !== previousLog) {
      callback(currentLog.slice(previousLog.length));
      previousLog = currentLog;
    }

    const { status } = await getBuildStatus(job, buildNumber);
    if (status !== "BUILDING") {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, pollInterval);
    });
  }
}
