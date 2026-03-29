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
