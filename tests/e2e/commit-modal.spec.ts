import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
})

test("commit modal opens, commits, triggers CI, and shows metrics", async ({ page }) => {
  let commitCalls = 0
  let triggerCalls = 0
  let logCalls = 0
  let metricsCalls = 0

  await page.route("**/api/git/commit", async (route) => {
    commitCalls += 1
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ sha: "abc123", branch: "main" }),
    })
  })

  await page.route("**/api/jenkins/trigger", async (route) => {
    triggerCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ buildNumber: 42, status: "running" }),
    })
  })

  await page.route("**/api/jenkins/logs**", async (route) => {
    logCalls += 1
    const status = logCalls < 3 ? "BUILDING" : "SUCCESS"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ logs: `line ${logCalls}\n`, status, buildNumber: 42 }),
    })
  })

  await page.route("**/api/metrics**", async (route) => {
    metricsCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ faithfulness: 0.88, relevance: 0.91, commitId: "abc1234" }),
    })
  })

  await page.goto("http://localhost:3000")
  await page.getByTestId("prompt-textarea").fill("Updated prompt for commit")

  await page.getByTestId("commit-run-ci-button").click()

  await expect(page.getByTestId("commit-modal")).toBeVisible()
  await expect(page.getByTestId("modal-overlay")).toBeVisible()
  await expect(page.getByTestId("warning-message")).toHaveText(
    "This will commit to GitHub and trigger CI pipeline"
  )
  await expect(page.getByTestId("commit-details")).toContainText("Branch")
  await expect(page.getByTestId("commit-details")).toContainText("main")
  await expect(page.getByTestId("commit-details")).toContainText("Commit message")
  await expect(page.getByTestId("commit-details")).toContainText("feat: update prompt configuration")
  await expect(page.getByTestId("commit-details")).toContainText("Commit & Run CI")

  await page.getByTestId("confirm-action-button").click()
  await expect.poll(() => commitCalls).toBe(1)
  await expect.poll(() => triggerCalls).toBe(1)
  await expect(page.getByTestId("commit-modal")).toHaveCount(0)
  await expect(page.getByTestId("tab-ci-logs")).toHaveAttribute("data-state", "active")

  await expect(page.getByTestId("status-badge")).toContainText("Success", { timeout: 7000 })
  await expect.poll(() => metricsCalls).toBeGreaterThan(0)
  await expect(page.getByTestId("faithfulness-score")).toHaveText("Faithfulness 0.88")
  await expect(page.getByTestId("relevance-score")).toHaveText("Relevance 0.91")
  await expect(page.getByTestId("commit-id")).toHaveText("abc1234")
})

test("commit modal shows branch selector with store's selectedBranch as default", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await expect(page.getByTestId("commit-dialog")).toBeVisible()
  await expect(page.getByTestId("commit-branch-select")).toBeVisible()
  await expect(page.getByTestId("commit-details")).toContainText("main")
})

test("user can select different branch in commit modal", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({
      json: { branches: [{ name: "main", sha: "sha1" }, { name: "prompt-config/other", sha: "sha2" }] },
    })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await expect(page.getByTestId("commit-dialog")).toBeVisible()
  await page.getByTestId("commit-branch-select").click()
  await page.getByText("prompt-config/other").click()

  await expect(page.getByTestId("commit-details")).toContainText("prompt-config/other")
})

test("create new branch option shows name input with prefix", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await expect(page.getByTestId("commit-dialog")).toBeVisible()
  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()

  await expect(page.getByTestId("new-branch-suffix")).toBeVisible()
  await expect(page.getByTestId("commit-details")).toContainText("prompt-config/")
  await expect(page.getByTestId("commit-details")).toContainText("Based on: main")
})

test("empty branch name shows validation error", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("confirm-action-button").click()

  await expect(page.getByTestId("commit-details")).toContainText("Branch suffix cannot be empty")
  await expect(page.getByTestId("commit-dialog")).toBeVisible()
})

test("branch name with spaces shows validation error", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("new-branch-suffix").fill("hello world")
  await page.getByTestId("confirm-action-button").click()

  await expect(page.getByTestId("commit-details")).toContainText("spaces")
  await expect(page.getByTestId("commit-dialog")).toBeVisible()
})

test("successful new branch creation and commit flow", async ({ page }) => {
  let branchCreateCalls = 0
  let commitCalls = 0

  await page.route("**/api/git/branches**", async (route) => {
    if (route.request().method() === "POST") {
      branchCreateCalls += 1
      await route.fulfill({ status: 201, json: { name: "prompt-config/experiment", sha: "new-sha" } })
    } else {
      await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
    }
  })

  await page.route("**/api/git/commit", async (route) => {
    commitCalls += 1
    await route.fulfill({ status: 201, json: { sha: "commit-sha", branch: "prompt-config/experiment" } })
  })

  await page.route("**/api/jenkins/trigger", async (route) => {
    await route.fulfill({ status: 200, json: { buildNumber: 42, status: "running" } })
  })

  await page.route("**/api/jenkins/logs**", async (route) => {
    await route.fulfill({ status: 200, json: { logs: "", status: "SUCCESS", buildNumber: 42 } })
  })

  await page.route("**/api/metrics**", async (route) => {
    await route.fulfill({ status: 200, json: { faithfulness: 0.88, relevance: 0.91, commitId: "abc1234" } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("new-branch-suffix").fill("experiment")
  await page.getByTestId("confirm-action-button").click()

  await expect.poll(() => branchCreateCalls).toBe(1)
  await expect.poll(() => commitCalls).toBe(1)
  await expect(page.getByTestId("commit-dialog")).toHaveCount(0)
})

test("branch list refreshes after new branch creation", async ({ page }) => {
  let getBranchesCalls = 0
  const initialBranches = [{ name: "main", sha: "sha" }]
  const updatedBranches = [{ name: "main", sha: "sha" }, { name: "prompt-config/new-branch", sha: "new-sha" }]

  await page.route("**/api/git/branches**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { name: "prompt-config/new-branch", sha: "new-sha" } })
    } else {
      getBranchesCalls += 1
      // First call returns initial, subsequent calls return updated list (simulates invalidation)
      const branches = getBranchesCalls <= 1 ? initialBranches : updatedBranches
      await route.fulfill({ json: { branches } })
    }
  })

  await page.route("**/api/git/commit", async (route) => {
    await route.fulfill({ status: 201, json: { sha: "commit-sha", branch: "prompt-config/new-branch" } })
  })

  await page.route("**/api/jenkins/trigger", async (route) => {
    await route.fulfill({ status: 200, json: { buildNumber: 42, status: "running" } })
  })

  await page.route("**/api/jenkins/logs**", async (route) => {
    await route.fulfill({ status: 200, json: { logs: "", status: "SUCCESS", buildNumber: 42 } })
  })

  await page.route("**/api/metrics**", async (route) => {
    await route.fulfill({ status: 200, json: { faithfulness: 0.88, relevance: 0.91, commitId: "abc1234" } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("new-branch-suffix").fill("new-branch")
  await page.getByTestId("confirm-action-button").click()

  // After commit, the branch list should be refreshed (invalidated + refetched)
  await expect(page.getByTestId("commit-dialog")).toHaveCount(0)
  await expect.poll(() => getBranchesCalls).toBeGreaterThanOrEqual(2)
})

test("duplicate branch name shows error in modal", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 400, json: { error: "Branch already exists" } })
    } else {
      await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
    }
  })

  await page.route("**/api/git/commit", async (route) => {
    await route.fulfill({ status: 201, json: { sha: "commit-sha", branch: "main" } })
  })

  await page.route("**/api/jenkins/trigger", async (route) => {
    await route.fulfill({ status: 200, json: { buildNumber: 42, status: "running" } })
  })

  await page.route("**/api/jenkins/logs**", async (route) => {
    await route.fulfill({ status: 200, json: { logs: "", status: "SUCCESS", buildNumber: 42 } })
  })

  await page.route("**/api/metrics**", async (route) => {
    await route.fulfill({ status: 200, json: { faithfulness: 0.88, relevance: 0.91, commitId: "abc1234" } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("new-branch-suffix").fill("duplicate")
  await page.getByTestId("confirm-action-button").click()

  await expect(page.getByTestId("commit-dialog")).toBeVisible()
  await expect(page.getByTestId("commit-dialog")).toContainText("Branch already exists")
})

test("switching back to existing branch clears new branch input", async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({ json: { branches: [{ name: "main", sha: "sha" }] } })
  })

  await page.goto("/")
  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.getByTestId("commit-run-ci-button").click()

  await page.getByTestId("commit-branch-select").click()
  await page.getByText("+ Create new branch").click()
  await page.getByTestId("new-branch-suffix").fill("test-branch")

  await page.getByTestId("commit-branch-select").click()
  await page.locator("[role='option']", { hasText: "main" }).click()

  await expect(page.getByTestId("new-branch-suffix")).toHaveCount(0)
})
