export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-6 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center rounded-3xl border border-border/60 bg-card/40 p-8 shadow-[var(--shadow-float)]">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Chat scaffold
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            TrustOps Playground
          </h1>
          <p className="text-sm text-muted-foreground">
            Streaming hooks and UI slots are ready for trustOpsBack wiring.
          </p>
        </div>
      </section>
    </main>
  );
}
