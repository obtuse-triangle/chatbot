import { expect, test } from "@playwright/test"

test("metrics stay hidden until CI success and then display scores", async ({ page }) => {
  let requestCount = 0

  await page.route("**/api/jenkins/logs**", async (route) => {
    requestCount += 1

    const body =
      requestCount < 4
        ? { logs: "building\n", status: "BUILDING", buildNumber: 42 }
        : { logs: "done\n", status: "SUCCESS", buildNumber: 42 }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  })

  await page.goto("http://localhost:3000")

  const ciTab = page.getByTestId("tab-ci-logs")
  const metricsContainer = page.getByTestId("metrics-container")

  await ciTab.click()
  await expect(metricsContainer).toHaveCSS("display", "none")
  await expect(metricsContainer).toHaveCSS("display", "block", { timeout: 7000 })
  await expect(page.getByTestId("faithfulness-score")).toHaveText("Faithfulness 0.00")
  await expect(page.getByTestId("relevance-score")).toHaveText("Relevance 0.00")
  await expect(page.getByTestId("commit-id")).toHaveText("abc1234")
  await expect(page.getByTestId("commit-id")).toHaveText(/^.{7}$/)
})
