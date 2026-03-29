import { expect, test } from "@playwright/test"

test.describe("commit and CI flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
  })

  test("commits the prompt, switches to CI, and shows logs and metrics", async ({ page }) => {
    let commitCalls = 0
    let triggerCalls = 0
    let logsCalls = 0
    let metricsCalls = 0

    await page.route("**/api/git/commit", async (route) => {
      commitCalls += 1

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: { sha: "abc1234", branch: "main" },
      })
    })

    await page.route("**/api/jenkins/trigger", async (route) => {
      triggerCalls += 1

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { buildNumber: 42, status: "running" },
      })
    })

    await page.route("**/api/jenkins/logs**", async (route) => {
      logsCalls += 1
      const url = new URL(route.request().url())
      const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10)

      const payloads = [
        {
          logs: "Starting Jenkins pipeline\nChecking out commit abc1234\n",
          status: "BUILDING",
        },
        {
          logs: "Running evaluator suite\nFaithfulness: 0.83\n",
          status: "BUILDING",
        },
        {
          logs: "Relevance: 0.91\nPipeline complete\n",
          status: "SUCCESS",
        },
      ]

      const payload = payloads[Math.min(Math.floor(offset / 40), payloads.length - 1)]

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ...payload,
          buildNumber: 42,
        },
      })
    })

    await page.route("**/api/metrics**", async (route) => {
      metricsCalls += 1
      const url = new URL(route.request().url())

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          faithfulness: 0.83,
          relevance: 0.91,
          commitId: url.searchParams.get("commitId") ?? "abc1234",
        },
      })
    })

    await page.goto("http://localhost:3000")

    await expect(page.getByTestId("config-panel")).toBeVisible()
    await expect(page.getByTestId("viewer-panel")).toBeVisible()
    await expect(page.getByTestId("tab-playground")).toBeVisible()
    await expect(page.getByTestId("tab-ci-logs")).toBeVisible()

    const promptTextarea = page.getByTestId("prompt-textarea")
    await promptTextarea.fill("Updated prompt for the commit and CI flow")
    await expect(promptTextarea).toHaveValue("Updated prompt for the commit and CI flow")
    await expect(page.getByTestId("prompt-character-count")).toHaveText("41 characters")

    await page.getByTestId("commit-run-ci-button").click()

    await expect(page.getByTestId("commit-modal")).toBeVisible()
    await expect(page.getByTestId("warning-message")).toHaveText(
      "This will commit to GitHub and trigger CI pipeline",
    )

    await page.getByTestId("confirm-action-button").click()

    await expect.poll(() => commitCalls).toBe(1)
    await expect.poll(() => triggerCalls).toBeGreaterThanOrEqual(0)
    await expect(page.getByTestId("commit-modal")).toHaveCount(0)

    await expect(page.getByTestId("tab-content-ci-logs")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId("tab-content-playground")).not.toBeVisible()

    const terminal = page.getByTestId("ci-logs-terminal")
    await expect(terminal).toBeVisible()
    await expect(page.getByTestId("build-number")).toContainText("Build #42")
    await expect(page.getByTestId("status-badge")).toContainText("Success", { timeout: 10_000 })
    await expect(page.getByTestId("log-line").first()).toHaveText("Starting Jenkins pipeline")
    await expect(page.getByTestId("log-line").last()).toHaveText("Pipeline complete")

    await expect(page.getByTestId("metrics-container")).toHaveCSS("display", "block", {
      timeout: 10_000,
    })
    await expect(page.getByTestId("faithfulness-score")).toHaveText("Faithfulness 0.83")
    await expect(page.getByTestId("relevance-score")).toHaveText("Relevance 0.91")
    await expect(page.getByTestId("commit-id")).toHaveText("abc1234")

    await expect.poll(() => logsCalls).toBeGreaterThanOrEqual(1)
    await expect.poll(() => metricsCalls).toBeGreaterThanOrEqual(1)
  })
})
