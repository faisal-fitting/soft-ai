"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import { getThreadMessages, getWorkflowRun, saveThreadTitle } from "@/app/actions";
import { useReportStore } from "@/store/report-store";
import { BusinessSidebar } from "@/components/business-sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ReportView } from "@/components/report-view";
import { BusinessForm, type FinancialFormData } from "@/components/business-form";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ReportManifest, StepProgress } from "@/lib/types";

// Hardcoded fallback run for debugging — remove when no longer needed
const DEBUG_RUN_ID = "d0547ff0-4522-4309-8485-ed283492d58b";

interface Props {
  sessionKey: number;
}

export function ReportSession({ sessionKey }: Props) {
  const store = useReportStore();
  const phase = store.phase;
  const businessName = store.businessName;

  const [threadId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    return store.threadId ?? crypto.randomUUID();
  });

  const [manifest, setManifest] = useState<ReportManifest | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<StepProgress | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const pendingFormData = useRef<FinancialFormData | null>(null);
  const pendingThreadId = useRef<string>(threadId);

  // ── Workflow transport ─────────────────────────────────────────────────────
  const workflowTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/report/stream",
        prepareSendMessagesRequest: () => ({
          body: { inputData: pendingFormData.current },
        }),
      }),
    []
  );

  const { sendMessage: workflowSend, status: workflowStatus } = useChat({
    transport: workflowTransport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData: (part: any) => {
      console.log("[onData] type:", part.type, "| id:", part.id, "| dataKeys:", Object.keys(part.data ?? {}));

      if (part.type === "data-step-progress") {
        setWorkflowProgress(part.data as StepProgress);
      }
      if (part.type === "data-workflow") {
        console.log("[onData:workflow] status:", part.data?.status, "| hasOutput:", !!part.data?.output, "| outputKeys:", Object.keys(part.data?.output ?? {}));
        if (part.id && !store.runId) {
          store.startReport(part.id, pendingThreadId.current, pendingFormData.current?.businessName ?? "");
        }
        const output = part.data?.output;
        if (output && part.data?.status === "success") {
          const candidate = output.metadata ? output : output.result;
          console.log("[onData:workflow] candidate keys:", Object.keys(candidate ?? {}), "| hasMetadata:", !!candidate?.metadata, "| hasDirective:", !!candidate?.directive, "| hasSections:", !!candidate?.sections);
          if (candidate?.metadata && candidate?.directive && candidate?.sections) {
            console.log("[onData:workflow] setting manifest ✓");
            setManifest(candidate as ReportManifest);
            setWorkflowProgress(null);
          }
        }
      }
    },
    onFinish: ({ isError }: { isError?: boolean }) => {
      console.log("[workflow:onFinish] isError:", isError, "| hasManifest:", !!manifest);
      if (isError) console.error("[workflow] stream ended with error");
      setWorkflowProgress(null);
    },
    onError: (err: unknown) => console.error("[workflow:error]", err),
  });

  // ── Chat transport ─────────────────────────────────────────────────────────
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId, resourceId: "user" },
      }),
    [threadId]
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: chatTransport,
    onError: (err: unknown) => console.error("[chat:error]", err),
  });

  // ── Restore manifest + chat history on mount ───────────────────────────────
  // Always attempts restore using store runId, falling back to DEBUG_RUN_ID.
  // If a manifest is found the phase is already "chat" (set by startReport),
  // so the report view renders directly without going through the form.
  useEffect(() => {
    const { runId, threadId: storedThreadId } = useReportStore.getState();
    const resolvedRunId = runId || DEBUG_RUN_ID;
    console.log("[restore] resolvedRunId:", resolvedRunId, "| storedThreadId:", storedThreadId, "| storePhase:", store.phase);

    Promise.all([
      getWorkflowRun(resolvedRunId),
      storedThreadId ? getThreadMessages(storedThreadId) : Promise.resolve([]),
    ])
      .then(([restoredManifest, msgs]) => {
        console.log("[restore] restoredManifest:", !!restoredManifest, "| msgs:", msgs.length, "| phase:", store.phase);
        if (restoredManifest) {
          console.log("[restore] setting manifest from restore ✓ keys:", Object.keys(restoredManifest));
          setManifest(restoredManifest);
          // Ensure store is in chat phase so the report view shows
          if (!store.phase || store.phase === "form") {
            store.startReport(resolvedRunId, storedThreadId ?? threadId, store.businessName ?? "");
          }
        }
        if (msgs.length > 0) setMessages(msgs as UIMessage[]);
        setLoadingHistory(false);
      })
      .catch((err: unknown) => {
        console.error("[ReportSession] restore failed:", err);
        setLoadingHistory(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workflowRunning = workflowStatus === "submitted" || workflowStatus === "streaming";
  const isGenerating = workflowRunning || status === "submitted" || status === "streaming";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasReport = !!manifest || messages.some((m: any) => m.role === "assistant");

  const handleFormSubmit = useCallback(
    async (data: FinancialFormData) => {
      const newThreadId = crypto.randomUUID();
      pendingFormData.current = data;
      pendingThreadId.current = newThreadId;
      store.startReport("", newThreadId, data.businessName);
      saveThreadTitle(newThreadId, data.businessName).catch(console.error);
      await workflowSend({ text: "" });
    },
    [store, workflowSend]
  );

  const handleSend = useCallback(
    async (text: string) => {
      await sendMessage({ text });
    },
    [sendMessage]
  );

  const showProgress = !!workflowProgress && !manifest;

  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // Single SidebarProvider wrapping both sidebars + SidebarInset (sidebar-15 pattern).
    // BusinessSidebar (left/start in RTL) → SidebarInset (main content) → ChatSidebar (right/end in RTL).
    // Both sidebars are collapsible="none" (persistent, no collapse) so they stay inline.
    // --sidebar-width here is for BusinessSidebar; ChatSidebar overrides to 20rem via its own style.
    <SidebarProvider
      defaultOpen={hasReport}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      className="min-h-0 overflow-hidden"
    >
      {/* Business profile sidebar — start side (left in RTL) */}
      <BusinessSidebar
        manifest={manifest}
        isGenerating={isGenerating}
        onNewReport={() => {
          store.reset();
          setManifest(null);
        }}
      />

      {/* Main content area — constrained between the two sidebars */}
      <SidebarInset className="overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === "form" ? (
            <motion.div
              key={`form-${sessionKey}`}
              className="flex flex-1 items-start justify-center overflow-y-auto px-8 py-12"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <BusinessForm onSubmit={handleFormSubmit} isSubmitting={showProgress} />
            </motion.div>
          ) : (
            <motion.div
              key={`report-${sessionKey}`}
              className="flex flex-1 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {showProgress ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8">
                  <div className="mb-6 flex size-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold">جاري تحليل {businessName}</h2>
                  <p className="text-sm text-muted-foreground">{workflowProgress?.message}</p>
                </div>
              ) : (
                <ReportView
                  manifest={manifest ?? undefined}
                  isGenerating={showProgress}
                  businessName={businessName ?? ""}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarInset>

      {/* Chat sidebar — end side (right in RTL) */}
      <ChatSidebar
        messages={messages}
        status={status}
        businessName={businessName}
        hasReport={hasReport}
        onSend={handleSend}
        onStop={stop}
      />
    </SidebarProvider>
  );
}
