import { expect, test } from "@playwright/test";

async function dragSliderToValue(
  page: import("@playwright/test").Page,
  testId: string,
  value: number,
  min: number,
  max: number,
) {
  const slider = page.getByTestId(testId);
  await expect(slider).toBeVisible();
  await slider.evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });

  const geometry = await slider.evaluate((element) => {
    const thumb = element.querySelector('[data-slot="slider-thumb"]') as HTMLElement | null;
    const rootRect = element.getBoundingClientRect();
    const thumbRect = thumb?.getBoundingClientRect() ?? null;

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
    };
  });

  if (!geometry.thumbRect) {
    throw new Error(`Unable to locate slider geometry for ${testId}`);
  }

  const targetX = geometry.rootRect.x + ((value - min) / (max - min)) * geometry.rootRect.width;
  const targetY = geometry.thumbRect.y + geometry.thumbRect.height / 2;
  const startX = geometry.thumbRect.x + geometry.thumbRect.width / 2;
  const startY = targetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.mouse.up();
}

test("plays streamed playground chat and forwards config", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    const encoder = new TextEncoder();
    (window as typeof window & {
      __chatRequests?: Array<{ messages: unknown[]; config: Record<string, unknown> }>;
    }).__chatRequests = [];

    const mockFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();

      if (!url.includes("/api/chat")) {
        return originalFetch(input, init);
      }

      const rawBody = typeof init?.body === "string" ? init.body : "{}";
      const parsedBody = JSON.parse(rawBody) as {
        messages?: unknown[];
        config?: Record<string, unknown>;
      };

      (window as typeof window & {
        __chatRequests?: Array<{ messages: unknown[]; config: Record<string, unknown> }>;
      }).__chatRequests?.push({
        messages: parsedBody.messages ?? [],
        config: parsedBody.config ?? {},
      });

      const chunks = [
        'data: {"type":"start","messageId":"msg-test"}\n\n',
        'data: {"type":"text-start","id":"text-1"}\n\n',
        'data: {"type":"text-delta","id":"text-1","delta":"Hello from playground"}\n\n',
        'data: {"type":"text-delta","id":"text-1","delta":" and streaming"}\n\n',
        'data: {"type":"text-end","id":"text-1"}\n\n',
        'data: {"type":"finish"}\n\n',
        'data: [DONE]\n\n',
      ];

      let closed = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const finish = async () => {
            for (const chunk of chunks) {
              if (closed) {
                return;
              }

              controller.enqueue(encoder.encode(chunk));
              await new Promise((resolve) => window.setTimeout(resolve, 400));
            }

            if (!closed) {
              controller.close();
            }
          };

          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              closed = true;
              try {
                controller.error(new DOMException("Aborted", "AbortError"));
              } catch {
                return;
              }
            });
          }

          finish().catch(() => {
            closed = true;
          });
        },
      });

      return Promise.resolve(new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      }));
    };

    window.fetch = mockFetch as unknown as typeof window.fetch;
  });

  await page.goto("/");

  await page.getByTestId("prompt-textarea").fill("You are a focused playground assistant.");
  await dragSliderToValue(page, "temperature-slider", 0.5, 0, 1);
  await dragSliderToValue(page, "top-p-slider", 0.8, 0, 1);
  await dragSliderToValue(page, "top-k-slider", 50, 1, 100);
  await expect(page.getByTestId("chat-config-system-prompt")).toContainText("loaded from the left panel");
  await expect(page.getByTestId("chat-config-temperature")).toContainText("temp 0.5");

  await expect(page.getByTestId("tab-playground")).toBeVisible();
  await page.getByTestId("tab-playground").click();

  await expect(page.getByTestId("chat-input")).toBeVisible();
  await expect(page.getByTestId("send-button")).toContainText("Run Playground");

  await page.getByTestId("chat-input").fill("Hello from playground");
  await page.getByTestId("send-button").click();

  const response = page.getByTestId("chat-response").last();
  await expect(response).toContainText("Hello from playground");

  await page.getByTestId("stop-button").click();
  await page.waitForTimeout(150);

  await expect(response).not.toContainText("and streaming");

  await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="chat-scroll-area"]') as HTMLElement | null;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = 0;
  });

  await page.getByTestId("scroll-to-bottom").click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const viewport = document.querySelector('[data-testid="chat-scroll-area"]') as HTMLElement | null;

        if (!viewport) {
          return 0;
        }

        return viewport.scrollTop + viewport.clientHeight;
      }),
    )
    .toBeGreaterThan(0);

  const requests = await page.evaluate(() => {
    return (window as typeof window & {
      __chatRequests?: Array<{ messages: unknown[]; config: Record<string, unknown> }>;
    }).__chatRequests ?? [];
  });

  expect(requests).toHaveLength(1);
  expect(requests[0].messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "Hello from playground" }),
    ]),
  );
  expect(requests[0].config).toMatchObject({
    system_prompt: "You are a focused playground assistant.",
    temperature: 0.5,
    top_p: 0.8,
    top_k: 50,
  });
});
