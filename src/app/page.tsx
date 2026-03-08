"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import { getThreadMessages, getWorkflowRun, saveThreadTitle } from "@/app/actions";
import { useReportStore } from "@/store/report-store";
import { WorkflowSidebar } from "@/components/workflow-sidebar";
import { ReportView } from "@/components/report-view";
import {
  BusinessForm,
  type FinancialFormData,
} from "@/components/business-form";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepProgress = {
  step: string;
  status: 'running' | 'complete';
  message: string;
};

export type ReportManifest = {
  metadata: {
    businessName: string;
    businessType: string;
    generatedAt: string;
    healthScore: number;
  };
  directive: {
    theme: string;
    northStarMetric: { name: string; value: number; target: number; rationale: string };
    focusAreas: { financial: string; digital: string; market: string };
    overallStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'EXCEPTIONAL';
  };
  sections: Array<{
    id: string;
    title: string;
    conclusion: { text: string; severity: 'success' | 'warning' | 'critical' };
    visuals: Array<{
      type: 'bar-chart' | 'line-chart' | 'pie-chart' | 'metric-grid' | 'table' | 'radar-chart';
      title: string;
      description: string;
      data: Array<{ label: string; value: number; comparisonValue?: number; category?: string }>;
      config?: Record<string, string | number | boolean>;
    }>;
    narrative: string;
    tacticalMoves?: Array<{ action: string; impact: 'high' | 'medium' | 'low'; deadline: string }>;
  }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTextFromParts(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p: { type: "text"; text: string }) => p.text)
    .join("");
}

function isReportRequest(msg: UIMessage): boolean {
  return msg.role === "user" && getTextFromParts(msg).startsWith("[GENERATE_REPORT_REQUEST]");
}

// ── Chat Sidebar ───────────────────────────────────────────────────────────────

function ChatSidebar({
  messages,
  status,
  businessName,
  hasReport,
  onSend,
  onStop,
}: {
  messages: UIMessage[];
  status: string;
  businessName: string | null;
  hasReport: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const [input, setInput] = useState("");
  const displayMessages = messages.filter((m) => !isReportRequest(m));

  if (!hasReport && !isGenerating) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-background">
      <div className="border-b px-4 py-3">
        <p className="text-right text-xs font-semibold text-muted-foreground">محلل الأعمال</p>
        {businessName && (
          <p className="mt-0.5 text-sm font-medium text-foreground">{businessName}</p>
        )}
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="px-3 py-3 gap-4">
          <AnimatePresence>
            {isGenerating && displayMessages.at(-1)?.role === "user" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2 className="size-3 animate-spin" />
                <span>جارٍ المعالجة…</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => {
              const text = getTextFromParts(msg);
              if (!text) return null;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Message from={msg.role} dir="rtl">
                    <MessageContent>
                      {msg.role === "assistant" ? (
                        <MessageResponse>{text}</MessageResponse>
                      ) : (
                        <p className="text-sm">{text}</p>
                      )}
                    </MessageContent>
                  </Message>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!isGenerating && hasReport && (
            <Suggestions>
              <Suggestion suggestion="ما هي أهم التوصيات؟" onClick={onSend} />
              <Suggestion suggestion="تحليل المنافسين بالتفصيل" onClick={onSend} />
              <Suggestion suggestion="كيف أحسن هامش الربح؟" onClick={onSend} />
            </Suggestions>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background px-3 py-3">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim() || isGenerating) return;
            onSend(text);
            setInput("");
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="اسأل سؤالاً…"
              disabled={isGenerating}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span />
            <PromptInputSubmit
              status={status as "ready" | "submitted" | "streaming" | "error"}
              onStop={onStop}
              disabled={!input.trim() && !isGenerating}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
}

// ── Report Session ─────────────────────────────────────────────────────────────

function ReportSession({
  onGeneratingChange,
  onHasReportChange,
}: {
  onGeneratingChange: (v: boolean) => void;
  onHasReportChange: (v: boolean) => void;
}) {
  const store = useReportStore();

  const phase = store.phase;
  const businessName = store.businessName;

  const [threadId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    return store.threadId ?? crypto.randomUUID();
  });

  const [manifest, setManifest] = useState<ReportManifest | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<StepProgress | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(phase === "chat");

  // Holds the form data between submit and the useChat send
  const pendingFormData = useRef<FinancialFormData | null>(null);
  const pendingThreadId = useRef<string>(threadId);

  // ── Workflow transport (drives the report generation) ──────────────────────
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

  const {
    sendMessage: workflowSend,
    status: workflowStatus,
  } = useChat({
    transport: workflowTransport,
    onData: (part) => {
      if (part.type === "data-step-progress") {
        setWorkflowProgress((part as { type: string; data: StepProgress }).data);
      }
      if (part.type === "data-workflow") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wf = part as any;
        console.log("[workflow:data-workflow] status:", wf.data?.status, "output keys:", Object.keys(wf.data?.output ?? {}));

        // Capture runId from first data-workflow part
        if (wf.id && !store.runId) {
          store.startReport(wf.id, pendingThreadId.current, pendingFormData.current?.businessName ?? "");
        }

        // Extract manifest from final workflow-finish event
        const output = wf.data?.output;
        if (output && wf.data?.status === "success") {
          // output could be the manifest directly OR nested inside output.result
          const candidate = output.metadata ? output : output.result;
          if (candidate?.metadata && candidate?.directive && candidate?.sections) {
            setManifest(candidate as ReportManifest);
            setWorkflowProgress(null);
            // Working memory is updated during workflow execution - see main-workflow.ts
          } else {
            console.warn("[workflow:data-workflow] output present but missing manifest fields. output:", JSON.stringify(output).slice(0, 300));
          }
        }
      }
    },
    onFinish: ({ isError }) => {
      if (isError) console.error("[workflow] stream ended with error");
      setWorkflowProgress(null);
    },
    onError: (err) => console.error("[workflow:error]", err),
  });

  // ── Chat transport (drives Q&A after the report is ready) ─────────────────
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
    onError: (err) => console.error("[chat:error]", err),
  });

  // ── On mount in chat phase: restore manifest + chat history ───────────────
  useEffect(() => {
    if (phase !== "chat") {
      console.log("[restore] phase is", phase, "- skipping");
      setLoadingHistory(false);
      return;
    }

    const storeState = useReportStore.getState();
    console.log("[restore] store state:", storeState);
    const runId = storeState.runId || 'd0547ff0-4522-4309-8485-ed283492d58b';
    const storedThreadId = storeState.threadId;

    Promise.all([
      runId ? getWorkflowRun(runId) : Promise.resolve(null),
      storedThreadId ? getThreadMessages(storedThreadId) : Promise.resolve([]),
    ])
      .then(([restoredManifest, msgs]) => {
        if (restoredManifest) setManifest(restoredManifest);
        if (msgs.length > 0) setMessages(msgs as UIMessage[]);
        setLoadingHistory(false);
      })
      .catch((err) => {
        console.error("[ReportSession] restore failed:", err);
        setLoadingHistory(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workflowRunning =
    workflowStatus === "submitted" || workflowStatus === "streaming";
  const isGenerating = workflowRunning || status === "submitted" || status === "streaming";
  const hasReport = !!manifest || messages.some((m) => m.role === "assistant");

  // Propagate changes up
  const prevGenerating = useRef(isGenerating);
  const prevHasReport = useRef(hasReport);
  useEffect(() => {
    if (prevGenerating.current !== isGenerating) {
      prevGenerating.current = isGenerating;
      onGeneratingChange(isGenerating);
    }
    if (prevHasReport.current !== hasReport) {
      prevHasReport.current = hasReport;
      onHasReportChange(hasReport);
    }
  }, [isGenerating, hasReport, onGeneratingChange, onHasReportChange]);

  const handleFormSubmit = useCallback(
    async (data: FinancialFormData) => {
      const newThreadId = crypto.randomUUID();
      pendingFormData.current = data;
      pendingThreadId.current = newThreadId;

      store.startReport("", newThreadId, data.businessName);
      saveThreadTitle(newThreadId, data.businessName).catch(console.error);

      // Trigger the workflow via useChat — prepareSendMessagesRequest injects inputData
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

  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showProgress = !!workflowProgress && !manifest;

  return (
    <div className="flex flex-1 overflow-hidden flex-row-reverse">
      <AnimatePresence mode="wait">
        {phase === "form" ? (
          <motion.div
            key="form"
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
            key="report"
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
                <h2 className="mb-2 text-xl font-bold text-foreground">
                  جاري تحليل {businessName}
                </h2>
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

      <AnimatePresence>
        {phase === "chat" && (
          <motion.div
            key="chat-sidebar"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex shrink-0"
          >
            <ChatSidebar
              messages={messages}
              status={status}
              businessName={businessName}
              hasReport={hasReport}
              onSend={handleSend}
              onStop={stop}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [sessionKey, setSessionKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const store = useReportStore();

  const handleNewReport = useCallback(() => {
    store.reset();
    setIsGenerating(false);
    setHasReport(false);
    setSessionKey((k) => k + 1);
  }, [store]);

  const handleSelectThread = useCallback((threadId: string) => {
    store.selectThread(threadId);
    setIsGenerating(false);
    setHasReport(false);
    setSessionKey((k) => k + 1);
  }, [store]);

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-row-reverse">
      <WorkflowSidebar
        isGenerating={isGenerating}
        onNewReport={handleNewReport}
        onSelectThread={handleSelectThread}
        sessionKey={sessionKey}
      />
      <main className="relative flex flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={sessionKey}
            className="flex w-full flex-1 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ReportSession
              onGeneratingChange={setIsGenerating}
              onHasReportChange={setHasReport}
            />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
