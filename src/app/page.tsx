"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import { getThreadMessages, saveThreadTitle } from "@/app/actions";
import { WorkflowSidebar } from "@/components/workflow-sidebar";
import { ReportView } from "@/components/report-view";
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
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkflowStep = { name: string; status: string; output?: unknown };
type WorkflowData = { name: string; status: string; steps: Record<string, WorkflowStep> };

/** Structured data from the workflow's compose-report step output */
export type ReportData = {
  businessName: string;
  businessType: string;
  netRevenue: number;
  variableCosts: number;
  fixedCosts: number;
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  contributionMarginRatio: number;
  breakEvenRevenue: number;
  breakEvenGap: number;
  isAboveBreakEven: boolean;
  rawMaterials?: number;
  packaging?: number;
  items: Array<{
    name: string;
    sellingPrice: number;
    soldUnits: number;
    totalRevenue: number;
    revenueShare: number;
    contributionMarginPerUnit: number;
    variableCostPerUnit: number;
    fixedCostAllocationPerUnit: number;
    fullCostPerUnit: number;
    isBelowCost: boolean;
    menuCategory: "star" | "plowhorse" | "puzzle" | "dog";
    marginRank: number;
    revenueRank: number;
  }>;
  placeDetails: {
    rating?: number;
    userRatingsTotal?: number;
    displayName?: { text?: string };
    formattedAddress?: string;
    regularOpeningHours?: unknown;
    reviews?: unknown[];
    priceLevel?: string;
  };
  nearbyCompetitors: Array<{
    id?: string;
    displayName?: { text?: string } | string;
    rating?: number;
    userRatingCount?: number;
    formattedAddress?: string;
  }>;
  reviews?: {
    place_info?: { title?: string; rating?: number; reviews?: number };
    reviews?: Array<{ rating?: number; snippet?: string; user?: { name?: string } }>;
  };
  sentimentAnalysis?: string;
  socialAudit?: string;
  competitorAnalyses?: unknown[];
  instagramUser?: string;
  tiktokUser?: string;
};

/** Parsed report sections from the markdown output */
export type ReportMeta = {
  businessName?: string;
  businessType?: string;
  healthScore?: number;
  isAboveBreakEven?: boolean;
  netMargin?: number;
  grossMargin?: number;
  googleRating?: number;
  googleRatingCount?: number;
  instagramEngagement?: number;
  tiktokEngagement?: number;
};

export type ParsedReport = {
  meta: ReportMeta | null;
  sections: Record<string, string>;
};

/** Progressive section strings captured from writer steps before compose-report */
export type ProgressiveSections = {
  financialsSection?: string;
  digitalPresenceSection?: string;
  benchmarksSection?: string;
};

// ── parseReport ───────────────────────────────────────────────────────────────

/**
 * Parse the report markdown string into:
 * - meta: structured JSON from <!-- REPORT_META { ... } -->
 * - sections: map of section id → content string
 *
 * Section markers: <!-- SECTION: id --> ... <!-- END: id -->
 */
export function parseReport(markdown: string | null): ParsedReport {
  if (!markdown) return { meta: null, sections: {} };

  // Extract REPORT_META
  let meta: ReportMeta | null = null;
  const metaMatch = markdown.match(/<!--\s*REPORT_META\s*(\{[\s\S]*?\})\s*-->/);
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1]) as ReportMeta;
    } catch {
      // ignore parse errors
    }
  }

  // Extract sections
  const sections: Record<string, string> = {};
  const sectionRe = /<!--\s*SECTION:\s*(\S+)\s*-->([\s\S]*?)<!--\s*END:\s*\1\s*-->/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(markdown)) !== null) {
    sections[m[1]] = m[2].trim();
  }

  return { meta, sections };
}

// ── Mapping: raw step ID → summarized bucket key ──────────────────────────────

const STEP_BUCKET: Record<string, string> = {
  "collect-financials":         "financials",
  "fetch-place-details":        "financials",
  "write-financials":           "products",
  "fetch-target-reviews":       "reviews",
  "fetch-reviews":              "reviews",
  "run-semantic-analysis":      "reviews",
  "merge-external-data":        "reviews",
  "fetch-social-media":         "social",
  "skip-social-media":          "social",
  "capture-input":              "social",
  "normalize-social-data":      "social",
  "run-social-audit":           "social",
  "merge-social-analysis":      "social",
  "social-and-analysis-path":   "social",
  "write-digital-presence":     "social",
  "fetch-nearby-competitors":   "competitors",
  "select-top-competitors":     "competitors",
  "process-competitor":         "competitors",
  "analyze-competitor-reviews": "competitors",
  "competitor-pipeline":        "competitors",
  "write-market-benchmarks":    "competitors",
  "merge-all":                  "action-plan",
  "merge-sections":             "action-plan",
  "compose-report":             "action-plan",
};

// Step IDs whose output we want to capture
const CAPTURE_OUTPUT: Record<string, string> = {
  "fetch-target-reviews":     "reviews",
  "fetch-social-media":       "social",
  "fetch-nearby-competitors": "competitors",
  "compose-report":           "action-plan",
  // Writer steps for progressive section rendering
  "write-financials":         "write-financials",
  "write-digital-presence":   "write-digital-presence",
  "write-market-benchmarks":  "write-market-benchmarks",
};

/** Walk all workflow parts in all messages and derive report data + progressive sections */
function deriveSteps(messages: UIMessage[]): {
  reportData: ReportData | null;
  progressiveSections: ProgressiveSections;
} {
  let reportData: ReportData | null = null;
  const progressiveSections: ProgressiveSections = {};

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type !== "data-workflow" && part.type !== "data-tool-workflow") continue;
      const wp = part as unknown as { data: WorkflowData };
      const steps = wp.data?.steps ?? {};
      for (const [id, step] of Object.entries(steps)) {
        if (!(id in CAPTURE_OUTPUT)) continue;

        // Extract structured report data from compose-report output
        if (id === "compose-report" && step.status === "success" && step.output) {
          const o = step.output as { report?: string; data?: ReportData };
          if (o.data && !reportData) reportData = o.data;
        }

        // Capture progressive section strings from writer steps
        if (id === "write-financials" && step.status === "success" && step.output) {
          const o = step.output as { financialsSection?: string };
          if (o.financialsSection && !progressiveSections.financialsSection) {
            progressiveSections.financialsSection = o.financialsSection;
          }
        }
        if (id === "write-digital-presence" && step.status === "success" && step.output) {
          const o = step.output as { digitalPresenceSection?: string };
          if (o.digitalPresenceSection && !progressiveSections.digitalPresenceSection) {
            progressiveSections.digitalPresenceSection = o.digitalPresenceSection;
          }
        }
        if (id === "write-market-benchmarks" && step.status === "success" && step.output) {
          const o = step.output as { benchmarksSection?: string };
          if (o.benchmarksSection && !progressiveSections.benchmarksSection) {
            progressiveSections.benchmarksSection = o.benchmarksSection;
          }
        }
      }
    }
  }

  return { reportData, progressiveSections };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTextFromParts(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function isReportRequest(msg: UIMessage): boolean {
  return msg.role === "user" && getTextFromParts(msg).startsWith("[GENERATE_REPORT_REQUEST]");
}

// ── Chat Sidebar (left column in RTL) ─────────────────────────────────────────

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
  businessName: string;
  hasReport: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const [input, setInput] = useState("");

  // Only show text parts; skip report request messages
  const displayMessages = messages.filter((m) => !isReportRequest(m));

  // Only show sidebar if there's a report in progress or done
  if (!hasReport && !isGenerating) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground text-right">محلل الأعمال</p>
        {businessName && (
          <p className="mt-0.5 text-sm font-medium text-foreground">{businessName}</p>
        )}
      </div>

      {/* Messages */}
      <Conversation className="flex-1">
        <ConversationContent className="px-3 py-3 gap-4">
          {/* Thinking indicator */}
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

          {/* Messages — text only, no tool/workflow parts */}
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

          {/* Follow-up suggestions */}
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

      {/* Input */}
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

// ── Report session ─────────────────────────────────────────────────────────────

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
    onError: (err) => console.error("[stream:error]", err),
  });

  // Load thread history from LibSQL on mount when resuming a session
  useEffect(() => {
    if (localStorage.getItem("cbo-phase") !== "chat") return;
    getThreadMessages(threadId)
      .then((msgs) => {
        console.log(`[ReportSession] loaded ${msgs.length} messages for thread ${threadId}`);
        setMessages(msgs as UIMessage[]);
        setLoadingHistory(false);
      })
      .catch((err) => {
        console.error(`[ReportSession] failed to load messages for thread ${threadId}:`, err);
        setLoadingHistory(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGenerating = status === "submitted" || status === "streaming";
  const hasReport = messages.some((m) => m.role === "assistant");

  // Derive report data and progressive sections from workflow parts
  const derived = useMemo(() => deriveSteps(messages), [messages]);

  // Propagate state changes up — use refs to avoid triggering re-renders on every render
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

  // Derive the report markdown — scan ALL assistant messages for text content
  // (on reload, the workflow result lands in a separate assistant message with no text parts,
  //  and the actual report text is in a subsequent assistant message)
  const reportMarkdown =
    messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) => {
        const t = getTextFromParts(m);
        return t.length > 200 ? [t] : [];
      })[0] ?? null;

  const parsedReport = parseReport(reportMarkdown);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Center: form (pre-report) or structured report view (post-report) */}
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
            <BusinessForm onSubmit={handleFormSubmit} isSubmitting={isGenerating} />
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
            <ReportView
              reportData={derived.reportData}
              progressiveSections={derived.progressiveSections}
              parsedReport={parsedReport}
              reportMarkdown={reportMarkdown}
              isGenerating={isGenerating}
              businessName={businessName}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left sidebar: chat (only visible once report has started) */}
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
    // RTL: flex row is right-to-left. DOM order = right → left visually.
    // 1st child (WorkflowSidebar) → right column
    // 2nd child (main/ReportSession) → center + left columns
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Right sidebar: thread list (first in DOM = right in RTL) */}
      <WorkflowSidebar
        isGenerating={isGenerating}
        onNewReport={handleNewReport}
        onSelectThread={handleSelectThread}
        sessionKey={sessionKey}
      />

      {/* Center + left: report view + chat sidebar */}
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
