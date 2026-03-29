import { expect, test } from "@playwright/test";

test("renders the two-panel layout in dark mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByTestId("config-panel")).toBeVisible();
  await expect(page.getByTestId("viewer-panel")).toBeVisible();
  await expect(page.getByTestId("tab-playground")).toBeVisible();
  await expect(page.getByTestId("tab-ci-logs")).toBeVisible();
});
