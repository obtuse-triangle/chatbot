"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PromptEditor } from "@/components/prompt-editor";
import { TabViewer } from "@/components/tab-viewer";
import { BranchSelector } from "@/components/branch-selector";

const DEFAULT_SIDEBAR_WIDTH = 370;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;

export default function Page() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isResizing = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX)
      );
      setSidebarWidth(newWidth);
    },
    []
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isResizing.current) return;
    isResizing.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside
        className="shrink-0 border-r border-border/60 bg-card/35"
        style={{ width: sidebarWidth }}
        data-testid="config-panel"
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-border/60 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              TrustOps Control Tower
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Prompt editor
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Draft and save the system prompt locally.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              <BranchSelector />
              <PromptEditor />
            </div>
          </div>
        </div>
      </aside>

      <div
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-border/60 active:bg-border"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={sidebarWidth}
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
      />

      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="viewer-panel"
      >
        <TabViewer />
      </section>
    </main>
  );
}
