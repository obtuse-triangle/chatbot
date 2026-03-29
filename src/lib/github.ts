import "server-only";

import { Octokit } from "octokit";

import { env } from "./env";

const octokit = new Octokit({
  auth: env.GITHUB_PAT,
  userAgent: "trustOpsFront",
});

const owner = env.GITHUB_OWNER;
const repo = env.GITHUB_REPO;

export type GitHubFile = {
  content: string;
  sha: string;
};

export type GitHubBranch = {
  name: string;
  sha: string;
};

export type GitHubCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export async function getFile(path: string, branch: string): Promise<GitHubFile> {
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    throw new Error(`Expected a file at ${path}`);
  }

  const encodedContent = response.data.content ?? "";
  const content = Buffer.from(encodedContent.replace(/\n/g, ""), "base64").toString("utf8");

  return {
    content,
    sha: response.data.sha,
  };
}

export async function createBranch(name: string, base: string): Promise<GitHubBranch> {
  const { data: baseBranch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: base,
  });

  const reference = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${name}`,
    sha: baseBranch.commit.sha,
  });

  return {
    name: reference.data.ref.replace("refs/heads/", ""),
    sha: reference.data.object.sha,
  };
}

export async function commitFile(
  path: string,
  content: string,
  message: string,
  branch: string,
  sha: string,
): Promise<{ commit: { sha: string } }> {
  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
    sha,
  });

  return {
    commit: {
      sha: data.commit?.sha ?? sha,
    },
  };
}

export async function listBranches(): Promise<GitHubBranch[]> {
  const { data } = await octokit.rest.repos.listBranches({
    owner,
    repo,
  });

  return data.map((branch) => ({
    name: branch.name,
    sha: branch.commit.sha,
  }));
}

export async function listCommits(branch: string, limit = 30): Promise<GitHubCommit[]> {
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: branch,
    per_page: limit,
  });

  return data.slice(0, limit).map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name ?? commit.commit.committer?.name ?? "",
    date: commit.commit.author?.date ?? commit.commit.committer?.date ?? "",
  }));
}
