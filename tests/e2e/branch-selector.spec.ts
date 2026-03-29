import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.route("**/api/git/branches**", async (route) => {
    await route.fulfill({
      json: {
        branches: [
          { name: "main", sha: "main-sha" },
          { name: "feature/demo", sha: "feature-sha" },
        ],
      },
    })
  })

  await page.route("**/api/git/commits**", async (route) => {
    await route.fulfill({
      json: {
        commits: [
          { sha: "abc1234aaa", message: "Initial", author: "Alice", date: "2026-03-29T10:00:00Z" },
          { sha: "def5678bbb", message: "Updated config", author: "Bob", date: "2026-03-29T11:00:00Z" },
        ],
      },
    })
  })

  await page.route("**/api/git/file**", async (route) => {
    await route.fulfill({
      json: {
        content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: trustops-prompt-config
data:
  system_prompt: Updated config
  temperature: 0.6
  top_p: 0.8
  top_k: 35
  prompt_v1.txt: hello
  prompt_v2.txt: world
  canary_weight: 10
`,
        sha: "commit-sha",
      },
    })
  })
})

test("branch dropdown, commit list, modal, and load update editor", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("branch-dropdown")).toBeVisible()
  await page.getByTestId("branch-dropdown").click()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await expect(page.getByTestId("commit-list")).toBeVisible()
  await expect(page.getByTestId("commit-item")).toHaveCount(2)
  await expect(page.getByTestId("load-button")).toHaveCount(2)

  await page.getByTestId("load-button").nth(1).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByTestId("unsaved-warning")).toBeVisible()

  await page.getByRole("button", { name: "Load def5678" }).click()

  await expect(page.getByTestId("prompt-textarea")).toHaveValue("Updated config")
  await expect(page.getByTestId("current-temperature")).toHaveText("Temperature: 0.6")
  await expect(page.getByTestId("current-top-p")).toHaveText("Top P: 0.8")
  await expect(page.getByTestId("current-top-k")).toHaveText("Top K: 35")
})
