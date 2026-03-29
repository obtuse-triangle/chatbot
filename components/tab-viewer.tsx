"use client";

import { CiLogsTerminal } from "@/components/ci-logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaygroundChat } from "@/components/playground-chat";
import { useStore } from "@/lib/prompt-store";

export function TabViewer() {
  const { activeTab, setActiveTab } = useStore((state) => ({
    activeTab: state.activeTab,
    setActiveTab: state.setActiveTab,
  }));

  return (
    <Tabs
      className="flex min-h-dvh flex-1 flex-col"
      onValueChange={(value: string) => setActiveTab(value === "ci-logs" ? "ci-logs" : "playground")}
      value={activeTab}
    >
      <div className="border-b border-border/60 px-6 py-4">
        <TabsList className="w-full justify-start" variant="line">
          <TabsTrigger data-testid="tab-playground" value="playground">
            Playground
          </TabsTrigger>
          <TabsTrigger data-testid="tab-ci-logs" value="ci-logs">
            CI Pipeline
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-4">
        <TabsContent className="h-full" data-testid="tab-content-playground" value="playground">
          <PlaygroundChat />
        </TabsContent>

        <TabsContent className="h-full min-h-0" data-testid="tab-content-ci-logs" value="ci-logs">
          <CiLogsTerminal />
        </TabsContent>
      </div>
    </Tabs>
  );
}
