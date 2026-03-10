"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, XCircle } from "lucide-react";

import { getThreadMessages, getWorkflowRun, saveThreadTitle } from "@/app/actions";
import { useReportStore } from "@/store/report-store";
import { BusinessSidebar } from "@/components/business-sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ReportView } from "@/components/report-view";
import { BusinessForm, type FinancialFormData } from "@/components/business-form";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ReportManifest, StepProgress } from "@/lib/types";

interface Props {
  sessionKey: number;
  urlRunId?: string | null;
}

export function ReportSession({ sessionKey, urlRunId }: Props) {
  const router = useRouter();
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
  const [restoreError, setRestoreError] = useState<string | null>(null);

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
      if (part.type === "data-step-progress") {
        setWorkflowProgress(part.data as StepProgress);
      }
      if (part.type === "data-workflow") {
        if (part.id && !store.runId) {
          store.startReport(part.id, pendingThreadId.current, pendingFormData.current?.businessName ?? "");
          router.replace(`/?run=${part.id}`, { scroll: false } as any);
        }
        const output = part.data?.output;
        if (output && part.data?.status === "success") {
          const candidate = output.metadata ? output : output.result;
          if (candidate?.metadata && candidate?.directive && candidate?.sections) {
            setManifest(candidate as ReportManifest);
            setWorkflowProgress(null);
          }
        }
      }
    },
    onFinish: ({ isError }: { isError?: boolean }) => {
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
  // Priority: urlRunId > store.runId > nothing (show form)
  useEffect(() => {
    const { runId: storedRunId, threadId: storedThreadId } = useReportStore.getState();
    const resolvedRunId = urlRunId || storedRunId;

    // No run to restore — show the form
    if (!resolvedRunId) {
      setLoadingHistory(false);
      return;
    }

    Promise.all([
      getWorkflowRun(resolvedRunId),
      storedThreadId ? getThreadMessages(storedThreadId) : Promise.resolve([]),
    ])
      .then(([restoredManifest, msgs]) => {
        if (restoredManifest) {
          setManifest(restoredManifest);
          if (!store.phase || store.phase === "form") {
            store.startReport(resolvedRunId, storedThreadId ?? threadId, store.businessName ?? "");
          }
        } else if (urlRunId) {
          // URL had a runId but nothing was found
          setRestoreError(urlRunId);
        }
        if (msgs.length > 0) setMessages(msgs as UIMessage[]);
        setLoadingHistory(false);
      })
      .catch((err: unknown) => {
        console.error("[ReportSession] restore failed:", err);
        if (urlRunId) setRestoreError(urlRunId);
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

  // showProgress is true from the moment the workflow starts (workflowRunning)
  // until the manifest arrives — prevents flashing "no report yet" on first load.
  const showProgress = (workflowRunning || !!workflowProgress) && !manifest;

  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (restoreError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center" dir="rtl">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20">
          <XCircle className="size-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold">لم يتم العثور على التقرير</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          لا يوجد تقرير بالمعرّف{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{restoreError}</code>
        </p>
        <button
          onClick={() => {
            setRestoreError(null);
            store.reset();
            router.replace("/");
          }}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          إنشاء تقرير جديد
        </button>
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
              <BusinessForm onSubmit={handleFormSubmit} isSubmitting={workflowRunning} />
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
