import type { Page } from "@playwright/test"

import { expect, test } from "@playwright/test"

async function dragSliderToValue(page: Page, testId: string, value: number, min: number, max: number) {
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })

  await page.route("**/api/chat**", async (route) => {
    await route.fulfill({
      body:
        'data: {"type":"start","messageId":"msg-test"}\n\n' +
        'data: {"type":"text-start","id":"text-1"}\n\n' +
        'data: {"type":"text-delta","id":"text-1","delta":"Hello from the mocked playground stream"}\n\n' +
        'data: {"type":"text-delta","id":"text-1","delta":" and this should stop"}\n\n' +
        'data: {"type":"text-end","id":"text-1"}\n\n' +
        'data: {"type":"finish"}\n\n' +
        'data: [DONE]\n\n',
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    })
  })

  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    const encoder = new TextEncoder()
    type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

    ;(window as typeof window & {
      __playgroundChatMock?: { aborted: boolean; sentChunks: string[] }
    }).__playgroundChatMock = {
      aborted: false,
      sentChunks: [],
    }

    const mockFetch: FetchMock = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString()

      if (!url.includes("/api/chat")) {
        return originalFetch(input, init)
      }

      return originalFetch(input, init).then(async (response) => {
        const payload = await response.text()
      const chunks = Array.from(payload.matchAll(/"delta":"([^"]+)"/g), (match) => match[1])
      const mock = (window as typeof window & {
        __playgroundChatMock?: { aborted: boolean; sentChunks: string[] }
      }).__playgroundChatMock

      let closed = false
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const wait = (delay: number) => new Promise((resolve) => window.setTimeout(resolve, delay))

          const emit = async () => {
            controller.enqueue(encoder.encode('data: {"type":"start","messageId":"msg-test"}\n\n'))
            controller.enqueue(encoder.encode('data: {"type":"text-start","id":"text-1"}\n\n'))

            for (const chunk of chunks) {
              if (closed) {
                return
              }

              mock?.sentChunks.push(chunk)
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"text-delta","id":"text-1","delta":${JSON.stringify(chunk)}}\n\n`
                )
              )
              await wait(600)
            }

            if (!closed) {
              controller.enqueue(encoder.encode('data: {"type":"text-end","id":"text-1"}\n\n'))
              controller.enqueue(encoder.encode('data: {"type":"finish"}\n\n'))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            }
          }

          init?.signal?.addEventListener("abort", () => {
            closed = true
            if (mock) {
              mock.aborted = true
            }

            try {
              controller.error(new DOMException("Aborted", "AbortError"))
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                return
              }
            }
          })

          emit().catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") {
              return
            }

            throw error
          })
        },
      })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "x-vercel-ai-ui-message-stream": "v1",
          },
        })
      })
    }

    window.fetch = mockFetch as typeof window.fetch
  })
})

test("plays the full playground flow with streamed chat", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("config-panel")).toBeVisible()
  await expect(page.getByTestId("viewer-panel")).toBeVisible()
  await expect(page.getByTestId("tab-playground")).toBeVisible()
  await expect(page.getByTestId("tab-ci-logs")).toBeVisible()

  const prompt = "Build a resilient playground assistant."

  await page.getByTestId("prompt-textarea").fill(prompt)
  await expect(page.getByTestId("prompt-character-count")).toHaveText(`${prompt.length} characters`)

  await dragSliderToValue(page, "temperature-slider", 0.5, 0, 1)
  await expect(page.getByTestId("temperature-value")).toHaveText("0.5")

  await page.getByTestId("tab-playground").click()
  await expect(page.getByTestId("chat-input")).toBeVisible()

  await page.getByTestId("chat-input").fill("Show me the streamed playground output")
  await page.getByTestId("send-button").click()

  const response = page.getByTestId("chat-response").last()
  await expect(response).toContainText("Hello from the mocked playground stream")

  await page.getByTestId("stop-button").click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const mock = (window as typeof window & {
          __playgroundChatMock?: { aborted: boolean }
        }).__playgroundChatMock

        return mock?.aborted ?? false
      })
    )
    .toBe(true)

  await expect(response).not.toContainText("and this should stop", { timeout: 2500 })
})
