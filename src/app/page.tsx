"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { ToolUIPart, DynamicToolUIPart } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import { getThreadMessages, saveThreadTitle } from "@/app/actions";
import { WorkflowSidebar } from "@/components/workflow-sidebar";
import {
  BusinessForm,
  buildReportPrompt,
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
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";

// ── Helpers ────────────────────────────────────────────────────────────────

function getTextFromParts(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function isReportRequest(msg: UIMessage): boolean {
  return msg.role === "user" && getTextFromParts(msg).startsWith("[GENERATE_REPORT_REQUEST]");
}

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function isWorkflowPart(part: { type: string }): boolean {
  return part.type === "data-workflow" || part.type === "data-tool-workflow";
}

type WorkflowStep = { name: string; status: string };
type WorkflowData = { name: string; status: string; steps: Record<string, WorkflowStep> };

function WorkflowSteps({ data, isStreaming }: { data: WorkflowData; isStreaming: boolean }) {
  const steps = Object.values(data.steps);
  const timesRef = useRef<Record<string, { start: number; end?: number }>>({});
  const [, setTick] = useState(0);

  // Record step start/end times
  for (const s of steps) {
    const t = timesRef.current[s.name];
    if (s.status === "running" && !t) {
      timesRef.current[s.name] = { start: Date.now() };
    } else if ((s.status === "success" || s.status === "failed") && t && !t.end) {
      timesRef.current[s.name] = { ...t, end: Date.now() };
    }
  }

  // Tick every 500ms while a step is running so elapsed time updates live
  const hasRunning = steps.some((s) => s.status === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [hasRunning]);

  if (steps.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {data.name}
        </span>
        {isStreaming && <Loader2 className="size-3.5 animate-spin text-muted-foreground/50" />}
      </div>
      <div className="space-y-2.5">
        {steps.map((s) => {
          const t = timesRef.current[s.name];
          const elapsed = t ? ((t.end ?? Date.now()) - t.start) / 1000 : null;
          return (
            <div key={s.name} className="flex items-center gap-3 text-sm">
              <AnimatePresence mode="wait" initial={false}>
                {s.status === "success" ? (
                  <motion.span key="ok" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="shrink-0 text-emerald-500">✓</motion.span>
                ) : s.status === "failed" ? (
                  <motion.span key="err" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="shrink-0 text-red-500">✗</motion.span>
                ) : s.status === "running" ? (
                  <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="shrink-0">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </motion.span>
                ) : (
                  <motion.span key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block size-4 shrink-0 rounded-full border border-muted-foreground/25" />
                )}
              </AnimatePresence>
              <span className={
                s.status === "running" ? "font-medium text-foreground" :
                s.status === "success" ? "text-foreground/70" : "text-muted-foreground"
              }>
                {s.name}
              </span>
              {elapsed !== null && (
                <span className="ml-auto tabular-nums text-xs text-muted-foreground/50">
                  {elapsed.toFixed(1)}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chat panel (used inside ReportSession) ────────────────────────────────

function ChatPanel({
  messages,
  status,
  businessName,
  onSend,
  onStop,
}: {
  messages: UIMessage[];
  status: string;
  businessName: string;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const [input, setInput] = useState("");

  const displayMessages = messages.filter((m) => !isReportRequest(m));
  const hasRequestInFlight = messages.some(isReportRequest);
  const hasReport = displayMessages.some((m) => m.role === "assistant");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto max-w-3xl px-6 py-6 gap-6">
          {/* Generating banner while report is being created */}
          <AnimatePresence>
            {hasRequestInFlight && (
              <motion.div
                key="generating-banner"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-xl border bg-muted/40 px-5 py-4 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <Shimmer>{`جارٍ إنشاء تقرير تحليل الأعمال لـ ${businessName} — قد تستغرق العملية بضع دقائق…`}</Shimmer>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Message from={msg.role} dir="rtl">
                  {/* Tool calls (assistant only) */}
                  {msg.role === "assistant" &&
                    msg.parts
                      .filter((p) => isToolPart(p) || isWorkflowPart(p))
                      .map((part, i) => {
                        if (isWorkflowPart(part)) {
                          const wp = part as unknown as { type: string; data: WorkflowData };
                          return <WorkflowSteps key={i} data={wp.data} isStreaming={isGenerating} />;
                        }
                        const isDynamic = part.type === "dynamic-tool";
                        const tp = part as unknown as ToolUIPart;
                        const dp = part as unknown as DynamicToolUIPart;
                        return (
                          <Tool key={i}>
                            {isDynamic ? (
                              <ToolHeader
                                type="dynamic-tool"
                                state={dp.state}
                                toolName={dp.toolName ?? ""}
                              />
                            ) : (
                              <ToolHeader
                                type={tp.type}
                                state={tp.state}
                              />
                            )}
                            <ToolContent>
                              <ToolInput input={isDynamic ? dp.input : tp.input} />
                              <ToolOutput
                                output={isDynamic ? dp.output : tp.output}
                                errorText={isDynamic ? dp.errorText : tp.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      })}

                  {/* Text content */}
                  <MessageContent>
                    {msg.role === "assistant" ? (
                      <MessageResponse>{getTextFromParts(msg)}</MessageResponse>
                    ) : (
                      <p className="text-sm">{getTextFromParts(msg)}</p>
                    )}
                  </MessageContent>
                </Message>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Thinking indicator — stream active but no visible response yet */}
          <AnimatePresence>
            {isGenerating && !hasRequestInFlight && displayMessages.at(-1)?.role === "user" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                <span>جارٍ المعالجة…</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Follow-up suggestions after first report */}
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

      {/* Input bar */}
      <div className="border-t bg-background px-6 py-4">
        <div className="mx-auto max-w-3xl">
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
                placeholder="اسأل سؤالاً عن التقرير..."
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
      </div>
    </div>
  );
}

// ── Report session (keyed so it remounts cleanly on "New Report") ─────────

function ReportSession({
  onGeneratingChange,
  onHasReportChange,
}: {
  onGeneratingChange: (v: boolean) => void;
  onHasReportChange: (v: boolean) => void;
}) {
  const [threadId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const stored = localStorage.getItem("cbo-thread-id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("cbo-thread-id", id);
    return id;
  });

  const [phase, setPhase] = useState<"form" | "chat">(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("cbo-phase") as "form" | "chat") ?? "form"
      : "form"
  );

  const [businessName, setBusinessName] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("cbo-business-name") ?? ""
      : ""
  );

  const [loadingHistory, setLoadingHistory] = useState(
    typeof window !== "undefined" && localStorage.getItem("cbo-phase") === "chat"
  );

  useEffect(() => {
    localStorage.setItem("cbo-phase", phase);
  }, [phase]);

  useEffect(() => {
    localStorage.setItem("cbo-business-name", businessName);
  }, [businessName]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { threadId, resourceId: "user" } }),
    [threadId]
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onData: (chunk) => console.log("[stream:data]", chunk),
    onError: (err) => console.error("[stream:error]", err),
  });

  // Load thread history from LibSQL on mount when resuming a session
  useEffect(() => {
    if (localStorage.getItem("cbo-phase") !== "chat") return;
    getThreadMessages(threadId)
      .then((msgs) => {
        setMessages(msgs as UIMessage[]);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGenerating = status === "submitted" || status === "streaming";
  const hasReport = messages.some((m) => m.role === "assistant");

  const prevGenerating = useRef(isGenerating);
  const prevHasReport = useRef(hasReport);
  useEffect(() => {
    if (prevGenerating.current !== isGenerating) { prevGenerating.current = isGenerating; onGeneratingChange(isGenerating); }
    if (prevHasReport.current !== hasReport) { prevHasReport.current = hasReport; onHasReportChange(hasReport); }
  });

  const handleFormSubmit = useCallback(
    async (data: FinancialFormData) => {
      setBusinessName(data.businessName);
      setPhase("chat");
      saveThreadTitle(threadId, data.businessName).catch(console.error);
      await sendMessage({ text: buildReportPrompt(data) });
    },
    [sendMessage, threadId]
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

  return (
    <AnimatePresence mode="wait">
      {phase === "form" ? (
        <motion.div
          key="form"
          className="flex w-full flex-1 items-start justify-center overflow-y-auto px-8 py-12"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <BusinessForm onSubmit={handleFormSubmit} isSubmitting={isGenerating} />
        </motion.div>
      ) : (
        <motion.div
          key="chat"
          className="flex w-full flex-1 flex-col overflow-hidden"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChatPanel
            messages={messages}
            status={status}
            businessName={businessName}
            onSend={handleSend}
            onStop={stop}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [sessionKey, setSessionKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  const handleNewReport = useCallback(() => {
    ["cbo-thread-id", "cbo-phase", "cbo-business-name"].forEach((k) =>
      localStorage.removeItem(k)
    );
    setIsGenerating(false);
    setHasReport(false);
    setSessionKey((k) => k + 1);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    localStorage.setItem("cbo-thread-id", id);
    localStorage.setItem("cbo-phase", "chat");
    localStorage.removeItem("cbo-business-name");
    setIsGenerating(false);
    setHasReport(false);
    setSessionKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkflowSidebar
        isGenerating={isGenerating}
        hasReport={hasReport}
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
