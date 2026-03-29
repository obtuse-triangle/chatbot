import { expect, test } from "@playwright/test"

test("textarea renders with placeholder", async ({ page }) => {
  await page.goto("http://localhost:3000")

  await expect(page.getByTestId("prompt-textarea")).toHaveAttribute(
    "placeholder",
    "Write the system prompt for this run..."
  )
  await expect(page.getByTestId("prompt-character-count")).toHaveText(
    "0 characters"
  )
})

test("character count updates on input", async ({ page }) => {
  await page.goto("http://localhost:3000")

  await page.getByTestId("prompt-textarea").fill("Test prompt")

  await expect(page.getByTestId("prompt-character-count")).toHaveText(
    "11 characters"
  )
})

test("prompt saves to localStorage with debounce and restores on reload", async ({ page }) => {
  await page.goto("http://localhost:3000")

  await page.getByTestId("prompt-textarea").fill("Test prompt")
  await page.waitForTimeout(650)

  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem("trustops-system-prompt")))
    .toBe("Test prompt")

  await page.reload()

  await expect(page.getByTestId("prompt-textarea")).toHaveValue("Test prompt")
})
