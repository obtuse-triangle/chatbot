import { expect, test } from "@playwright/test";

test("renders tabs and switches tab content", async ({ page }) => {
  await page.goto("/");

  const playgroundTab = page.getByTestId("tab-playground");
  const ciLogsTab = page.getByTestId("tab-ci-logs");
  const playgroundContent = page.getByTestId("tab-content-playground");
  const ciLogsContent = page.getByTestId("tab-content-ci-logs");

  await expect(playgroundTab).toBeVisible();
  await expect(ciLogsTab).toBeVisible();
  await expect(playgroundContent).toBeVisible();
  await expect(ciLogsContent).not.toBeVisible();

  await ciLogsTab.click();
  await expect(ciLogsContent).toBeVisible();
  await expect(playgroundContent).not.toBeVisible();

  await playgroundTab.click();
  await expect(playgroundContent).toBeVisible();
  await expect(ciLogsContent).not.toBeVisible();
});
