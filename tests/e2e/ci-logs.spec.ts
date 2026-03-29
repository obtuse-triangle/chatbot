import { expect, test } from "@playwright/test"

test.describe("CI logs terminal", () => {
  test("renders, auto-scrolls, and updates status badges", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 })
    const requestCounts = new Map<number, number>()

    await page.route("**/api/git/branches", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          branches: [{ name: "main", sha: "abc1234" }],
        },
      })
    })

    await page.route("**/api/git/commits?branch=main", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          commits: [
            {
              sha: "abc1234",
              message: "feat: stabilize ci logs",
              author: "Test Bot",
              date: "2026-03-29T00:00:00Z",
            },
          ],
        },
      })
    })

    await page.route("**/api/git/file**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          content: [
            "system_prompt: test prompt",
            "temperature: 0.7",
            "top_p: 0.9",
            "top_k: 40",
            "prompt_v1: prompt v1",
            "prompt_v2: prompt v2",
            "canary_weight: 0",
          ].join("\n"),
        },
      })
    })

    await page.route("**/api/jenkins/logs**", async (route) => {
      const url = new URL(route.request().url())
      const buildNumber = Number.parseInt(url.searchParams.get("buildNumber") ?? "42", 10)
      const count = requestCounts.get(buildNumber) ?? 0

      const payloads: Record<number, Array<{ logs: string; status: string }>> = {
        42: [
          {
            logs:
              Array.from({ length: 100 }, (_, index) => `build 42 line ${index + 1}`).join("\n") +
              "\n",
            status: "BUILDING",
          },
          {
            logs:
              Array.from({ length: 100 }, (_, index) => `build 42 line ${index + 1}`).join("\n") +
              "\n",
            status: "BUILDING",
          },
          {
            logs:
              Array.from({ length: 101 }, (_, index) => `build 42 line ${index + 1}`).join("\n") +
              "\n",
            status: "SUCCESS",
          },
        ],
        99: [
          {
            logs:
              Array.from({ length: 100 }, (_, index) => `build 99 line ${index + 1}`).join("\n") +
              "\n",
            status: "BUILDING",
          },
          {
            logs:
              Array.from({ length: 100 }, (_, index) => `build 99 line ${index + 1}`).join("\n") +
              "\n",
            status: "BUILDING",
          },
          {
            logs:
              Array.from({ length: 101 }, (_, index) => `build 99 line ${index + 1}`).join("\n") +
              "\n",
            status: "FAILURE",
          },
        ],
      }

      const payload = payloads[buildNumber][Math.min(count, payloads[buildNumber].length - 1)]
      requestCounts.set(buildNumber, count + 1)

      await new Promise((resolve) => {
        setTimeout(resolve, count < 2 ? 150 : 2500)
      })

      await route.fulfill({
        contentType: "application/json",
        json: { ...payload, buildNumber },
      })
    })

    await page.goto("http://localhost:3000/?buildNumber=42")
    await page.waitForTimeout(500)
    const ciTab = page.getByTestId("tab-ci-logs")
    await expect(ciTab).toBeVisible()
    await ciTab.click()

    const terminal = page.getByTestId("ci-logs-terminal")
    await expect(terminal).toBeVisible({ timeout: 10000 })

    const fontFamily = await terminal.evaluate((element) => getComputedStyle(element).fontFamily)
    expect(fontFamily.toLowerCase()).toContain("mono")

    await expect(page.getByTestId("build-number")).toContainText("Build #42")
    await expect(page.getByTestId("status-badge")).toContainText("Running", { timeout: 1000 })
    await expect(page.getByTestId("log-line")).toHaveCount(100)

    const viewport = terminal.locator('[data-slot="scroll-area-viewport"]')
    await expect.poll(async () => viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    await expect(page.getByTestId("log-line").last()).toBeVisible()

    await expect(page.getByTestId("status-badge")).toContainText("Success", { timeout: 5000 })
    await expect(page.getByTestId("status-badge")).toHaveClass(/text-success/)

    await page.goto("http://localhost:3000/?buildNumber=99")
    await page.waitForTimeout(500)
    await page.getByTestId("tab-ci-logs").click()

    await expect(page.getByTestId("status-badge")).toContainText("Running")
    await expect(page.getByTestId("status-badge")).toHaveClass(/text-muted-foreground/)

    await expect.poll(async () => viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    await expect(page.getByTestId("status-badge")).toContainText("Failure", { timeout: 5000 })
    await expect(page.getByTestId("status-badge")).toHaveClass(/text-destructive/)
  })
})
