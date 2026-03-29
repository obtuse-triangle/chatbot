import { PromptEditor } from "@/components/prompt-editor";
import { TabViewer } from "@/components/tab-viewer";
import { BranchSelector } from "@/components/branch-selector";

export default function Page() {
  return (
    <main className="flex min-h-dvh bg-background text-foreground">
      <aside
        className="w-80 shrink-0 border-r border-border/60 bg-card/35"
        data-testid="config-panel"
      >
        <div className="flex h-dvh flex-col">
          <div className="border-b border-border/60 px-6 py-5">
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

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              <BranchSelector />
              <PromptEditor />
            </div>
          </div>
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-1 flex-col"
        data-testid="viewer-panel"
      >
        <TabViewer />
      </section>
    </main>
  );
}
