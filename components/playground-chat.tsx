"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DefaultChatTransport } from "ai"
import { useChat } from "@ai-sdk/react"
import { AlertTriangle, ArrowDown, Send, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/prompt-store"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: string
  content?: string
  parts?: Array<{ type: string; text?: string }>
}

function extractContent(message: ChatMessage): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content
  }

  return (message.parts ?? [])
    .map((part) => (part.type === "text" ? part.text ?? "" : ""))
    .join("")
    .trim()
}

export function PlaygroundChat() {
  const { prompt, temperature, topP, topK } = useStore((state) => ({
    prompt: state.prompt,
    temperature: state.temperature,
    topP: state.topP,
    topK: state.topK,
  }))
  const [input, setInput] = useState("")
  const [requestError, setRequestError] = useState<string | null>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef(prompt)
  const temperatureRef = useRef(temperature)
  const topPRef = useRef(topP)
  const topKRef = useRef(topK)

  promptRef.current = prompt
  temperatureRef.current = temperature
  topPRef.current = topP
  topKRef.current = topK

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
            body: {
              messages: messages.map((message) => ({
                role: message.role,
                content: extractContent(message as ChatMessage),
              })),
              config: {
                system_prompt: promptRef.current.trim() || undefined,
                temperature: temperatureRef.current,
                top_p: topPRef.current,
                top_k: topKRef.current,
              },
            },
          }),
      }),
    [],
  )

  const { messages, sendMessage, stop, status, error } = useChat({
    transport,
    onError: (caughtError) => {
      setRequestError(caughtError.message || "Failed to stream playground response")
    },
  })

  const isLoading = status === "streaming"
  const messageCount = messages.length
  const errorMessage = requestError ?? error?.message ?? null

  useEffect(() => {
    if (messageCount === 0 && !isLoading) {
      return
    }

    const viewport = scrollViewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [messageCount, isLoading])

  const submitMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const text = input.trim()

    if (!text) {
      return
    }

    setRequestError(null)
    sendMessage({ text })
    setInput("")
  }

  const scrollToBottom = () => {
    const viewport = scrollViewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    })
  }

  return (
    <Card className="flex h-full min-h-0 flex-col border-border/60 bg-card/45 shadow-[var(--shadow-float)]">
      <CardHeader className="space-y-4 border-b border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Playground chat</CardTitle>
            <CardDescription>
              Stream responses through the same preview route used by the control tower.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" data-testid="chat-config-temperature">
              temp {temperature}
            </Badge>
            <Badge variant="outline" data-testid="chat-config-top-p">
              top_p {topP}
            </Badge>
            <Badge variant="outline" data-testid="chat-config-top-k">
              top_k {topK}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span data-testid="chat-config-system-prompt">
            {prompt.trim() ? "System prompt loaded from the left panel" : "No system prompt saved yet"}
          </span>
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-primary" data-testid="chat-streaming-indicator">
              <Spinner className="size-3" />
              Streaming response
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div
          ref={scrollViewportRef}
          className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/35 p-4"
          data-testid="chat-scroll-area"
        >
          <div className="space-y-3" data-testid="chat-message-list">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
                Send a message to start the streamed playground preview.
              </div>
            ) : (
              messages.map((message, index) => {
                const typedMessage = message as ChatMessage
                const content = extractContent(typedMessage)
                const isUser = typedMessage.role === "user"
                const isAssistant = typedMessage.role === "assistant"

                return (
                  <div
                    key={typedMessage.id ?? `${typedMessage.role}-${index}`}
                    className={cn(
                      "flex message-fade-in",
                      isUser ? "justify-end" : "justify-start",
                    )}
                    data-testid={isAssistant ? "chat-response" : "chat-message"}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6",
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/60 bg-card text-card-foreground",
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] opacity-70">
                        <span>{typedMessage.role}</span>
                        {isAssistant && isLoading && !content ? (
                          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                            <Spinner className="size-3" />
                            streaming
                          </span>
                        ) : null}
                      </div>

                      <p className={cn("whitespace-pre-wrap", !content && isAssistant && "text-muted-foreground")}>
                        {content || (isAssistant ? "Waiting for streamed output…" : "")}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" type="button" onClick={scrollToBottom} data-testid="scroll-to-bottom">
            <ArrowDown className="size-4" />
            Scroll to bottom
          </Button>

          <Button variant="outline" size="sm" type="button" onClick={stop} data-testid="stop-button">
            <Square className="size-4" />
            Stop
          </Button>
        </div>

        {errorMessage ? (
          <div
            className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            data-testid="chat-error"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <Separator />

        <form className="space-y-3" onSubmit={submitMessage}>
          <Textarea
            autoComplete="off"
            className="min-h-24 bg-background/50"
            data-testid="chat-input"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask the playground something..."
            value={input}
          />

          <div className="flex items-center justify-end gap-2">
            <Button data-testid="send-button" disabled={isLoading || !input.trim()} type="submit">
              <Send className="size-4" />
              Run Playground
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
