import type { Page } from "@playwright/test"

import { expect, test } from "@playwright/test"

async function dragSliderToValue(
  page: Page,
  testId: string,
  value: number,
  min: number,
  max: number
) {
  const slider = page.getByTestId(testId)
  await expect(slider).toBeVisible()
  await slider.evaluate((element) => {
    element.scrollIntoView({ block: "center" })
  })

  const geometry = await slider.evaluate((element) => {
    const thumb = element.querySelector('[data-slot="slider-thumb"]') as HTMLElement | null
    const rootRect = element.getBoundingClientRect()
    const thumbRect = thumb?.getBoundingClientRect() ?? null

    return {
      rootRect: {
        x: rootRect.x,
        y: rootRect.y,
        width: rootRect.width,
        height: rootRect.height,
      },
      thumbRect: thumbRect
        ? {
            x: thumbRect.x,
            y: thumbRect.y,
            width: thumbRect.width,
            height: thumbRect.height,
          }
        : null,
    }
  })

  if (!geometry.thumbRect) {
    throw new Error(`Unable to locate slider geometry for ${testId}`)
  }

  const targetX = geometry.rootRect.x + ((value - min) / (max - min)) * geometry.rootRect.width
  const targetY = geometry.thumbRect.y + geometry.thumbRect.height / 2
  const startX = geometry.thumbRect.x + geometry.thumbRect.width / 2
  const startY = targetY

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps: 12 })
  await page.mouse.up()
}

test("renders parameter sliders with defaults", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("temperature-slider")).toBeVisible()
  await expect(page.getByTestId("top-p-slider")).toBeVisible()
  await expect(page.getByTestId("top-k-slider")).toBeVisible()

  await expect(page.getByTestId("temperature-value")).toHaveText("0.7")
  await expect(page.getByTestId("top-p-value")).toHaveText("0.9")
  await expect(page.getByTestId("top-k-value")).toHaveText("40")
})

test("updates slider values on drag end", async ({ page }) => {
  await page.goto("/")

  await dragSliderToValue(page, "temperature-slider", 0.5, 0, 1)
  await expect(page.getByTestId("temperature-value")).toHaveText("0.5")

  await dragSliderToValue(page, "top-p-slider", 0.8, 0, 1)
  await expect(page.getByTestId("top-p-value")).toHaveText("0.8")

  await dragSliderToValue(page, "top-k-slider", 50, 1, 100)
  await expect(page.getByTestId("top-k-value")).toHaveText("50")
})
