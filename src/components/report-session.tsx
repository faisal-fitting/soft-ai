"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

import { getWorkflowRun, getCollectedData, saveThreadTitle } from "@/app/actions";

// ── Branded loader ─────────────────────────────────────────────────────────────
export function CboLoader() {
  return (
    <div className="flex flex-1 h-full items-center justify-center flex-col gap-4 bg-background">
      <div className="relative size-12">
        {/* Pulsing outer ring */}
        <motion.div
          className="absolute inset-0 rounded-sm border-2 border-primary/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Inner square — CBO logo mark language */}
        <div className="absolute inset-2 rounded-[2px] bg-primary/15 border border-primary/30" />
        {/* Rotating arc */}
        <motion.div
          className="absolute inset-0 rounded-sm border-2 border-transparent border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <p className="text-xs text-muted-foreground tracking-[0.25em] uppercase font-medium">CBO</p>
    </div>
  );
}
import { useReportStore } from "@/store/report-store";
import { BusinessSidebar } from "@/components/business-sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ReportView } from "@/components/report-view";
import { GenerationProgress } from "@/components/generation-progress";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ReportManifest, CollectedData, StepProgress } from "@/lib/types";
import type { FinancialFormData } from "@/components/business-form";

interface Props {
  sessionKey: number;
  urlRunId?: string | null;
}

export function ReportSession({ sessionKey, urlRunId }: Props) {
  const router = useRouter();
  const store = useReportStore();
  const businessName = store.businessName;

  const [manifest, setManifest] = useState<ReportManifest | null>(null);
  const [collectedData, setCollectedData] = useState<CollectedData | null>(null);
  // Accumulate all progress events so the GenerationProgress component can build
  // a full picture of every phase — not just the latest event.
  const [progressHistory, setProgressHistory] = useState<StepProgress[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isObservingRunning, setIsObservingRunning] = useState(false);
  const hasStartedObserving = useRef(false);

  const pendingFormData = useRef<FinancialFormData | null>(null);
  const pendingThreadId = useRef<string | null>(null);
  const firstReveal = useRef(false);
  const [showRevealFlash, setShowRevealFlash] = useState(false);

  // ── Workflow transport ──────────────────────────────────────────────────────
  const workflowTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/report/stream",
        prepareSendMessagesRequest: () => ({
          body: { 
            inputData: pendingFormData.current,
            threadId: pendingThreadId.current 
          },
        }),
      }),
    []
  );

  const { sendMessage: workflowSend, status: workflowStatus } = useChat({
    transport: workflowTransport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData: (part: any) => {
      console.log("[workflow:onData]", part.type, part.data?.status ?? "");

      if (part.type === "data-step-progress") {
        setProgressHistory((prev) => [...prev, part.data as StepProgress]);
      }

      if (part.type === "data-workflow") {
        if (part.id && !store.runId) {
          store.startReport(part.id, pendingThreadId.current!, pendingFormData.current?.businessName ?? "");
          router.replace(`/report/${part.id}`, { scroll: false } as any);
        }

        if (part.data?.status === "success") {
          const manifest = part.data?.steps?.["assemble-manifest"]?.output;
          console.log("[workflow:finish] step keys:", part.data?.steps ? Object.keys(part.data.steps) : null);
          console.log("[workflow:finish] manifest keys:", manifest ? Object.keys(manifest) : "not found");

          if (manifest?.metadata && manifest?.directive && manifest?.sections) {
            console.log("[workflow:finish] manifest valid — rendering report");
            setManifest(manifest as ReportManifest);
            setProgressHistory([]);
            if (store.runId || part.id) {
              getCollectedData(store.runId || part.id).then(setCollectedData).catch(console.error);
            }
          } else {
            console.warn("[workflow:finish] manifest shape invalid", manifest);
          }
        }
      }
    },
    onFinish: ({ isError }: { isError?: boolean }) => {
      console.log("[workflow:onFinish]", { isError });
      if (isError) console.error("[workflow] stream ended with error");
      setProgressHistory([]);
    },
    onError: (err: unknown) => console.error("[workflow:error]", err),
  });

  // ── Observe transport for reconnecting to running workflow ───────────────────────
  const observeTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/report/observe",
        prepareSendMessagesRequest: () => ({
          body: { runId: urlRunId },
        }),
      }),
    [urlRunId]
  );

  const { sendMessage: observeSend, status: observeStatus } = useChat({
    transport: observeTransport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData: (part: any) => {
      console.log("[observe:onData]", part.type);
      if (part.type === "data-step-progress") {
        setProgressHistory((prev) => [...prev, part.data as StepProgress]);
      }
      if (part.type === "data-workflow" && part.data?.status === "success") {
        // Extract manifest matching getWorkflowRun logic
        const result = part.data?.result;
        const manifest = result?.metadata ? result : result?.result;
        if (manifest?.metadata && manifest?.directive && manifest?.sections) {
          setManifest(manifest as ReportManifest);
          setProgressHistory([]);
          setIsObservingRunning(false);
          hasStartedObserving.current = false;
          if (urlRunId) {
            getCollectedData(urlRunId).then(setCollectedData).catch(console.error);
          }
        }
      }
    },
    onFinish: () => {
      console.log("[observe:onFinish]");
      setIsObservingRunning(false);
      hasStartedObserving.current = false;
      
      // Workflow definitely completed - retry fetching manifest reactively
      if (urlRunId) {
        getWorkflowRun(urlRunId).then(({ manifest }) => {
          if (manifest) {
            setManifest(manifest);
            getCollectedData(urlRunId).then(setCollectedData);
          }
        });
      }
    },
    onError: (err: unknown) => {
      console.error("[observe:error]", err);
      setIsObservingRunning(false);
      hasStartedObserving.current = false;
    },
  });

  // Trigger observe when status is 'running'
  useEffect(() => {
    if (isObservingRunning && observeStatus === "ready" && urlRunId && !hasStartedObserving.current) {
      console.log("[observe] triggering for runId:", urlRunId);
      hasStartedObserving.current = true;
      observeSend({ text: "observe" });
    }
  }, [isObservingRunning, observeStatus, urlRunId, observeSend]);

  // ── Restore manifest on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!urlRunId) {
      store.reset();
      setLoadingHistory(false);
      return;
    }

    Promise.all([
      getWorkflowRun(urlRunId),
      getCollectedData(urlRunId),
    ])
      .then(([{ manifest: restoredManifest, status }, restoredCollected]) => {
        if (restoredManifest) {
          setManifest(restoredManifest);
          setCollectedData(restoredCollected);
          store.startReport(urlRunId, store.threadId ?? urlRunId, store.businessName ?? "");
        } else if (status === "running") {
          // Workflow is still running - will reconnect via observe stream
          setIsObservingRunning(true);
          console.log("[ReportSession] workflow running, will observe");
        } else {
          // Workflow completed but state not persisted yet - trigger observe to get result
          setIsObservingRunning(true);
          console.log("[ReportSession] status:", status, "- triggering observe");
        }
        setLoadingHistory(false);
      })
      .catch((err: unknown) => {
        console.error("[ReportSession] restore failed:", err);
        setRestoreError(urlRunId);
        setLoadingHistory(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workflowRunning = workflowStatus === "submitted" || workflowStatus === "streaming" || isObservingRunning;
  const hasReport = !!manifest;
  const showProgress = workflowRunning || progressHistory.length > 0;

  // Don't show error while workflow is still running - it might complete successfully
  const showError = restoreError && !workflowRunning;

  // Detect first-time manifest reveal for cinematic flash
  useEffect(() => {
    if (manifest && !firstReveal.current) {
      firstReveal.current = true;
      setShowRevealFlash(true);
      const t = setTimeout(() => setShowRevealFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [manifest]);

  if (loadingHistory) {
    return <CboLoader />;
  }

  if (showError) {
    return (
      <motion.div
        className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center"
        dir="rtl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <motion.div
          className="flex size-14 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20"
          animate={{ boxShadow: ["0 0 0px rgba(239,68,68,0)", "0 0 18px rgba(239,68,68,0.25)", "0 0 0px rgba(239,68,68,0)"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <XCircle className="size-7 text-red-500" />
        </motion.div>
        <h2 className="text-lg font-bold">لم يتم العثور على التقرير</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          لا يوجد تقرير بالمعرّف{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{restoreError}</code>
        </p>
        <Button
          className="mt-2"
          onClick={() => {
            setRestoreError(null);
            store.reset();
            router.replace("/");
          }}
        >
          إنشاء تقرير جديد
        </Button>
      </motion.div>
    );
  }

  const handleFormSubmit = async (data: FinancialFormData) => {
    const newThreadId = crypto.randomUUID();
    pendingFormData.current = data;
    pendingThreadId.current = newThreadId;
    store.setFormStep(0); // Reset form step
    store.startReport("", newThreadId, data.businessName);
    saveThreadTitle(newThreadId, data.businessName).catch(console.error);
    
    // Trigger workflow with empty text, the transport handles the payload
    await workflowSend({ text: "generate" });
  };

  // Dashboard mode - with sidebars
  return (
    <SidebarProvider
      defaultOpen={hasReport}
      style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      className="min-h-0 overflow-hidden"
    >
      <BusinessSidebar manifest={manifest} isGenerating={workflowRunning} collectedData={collectedData} />

      <SidebarInset className="relative overflow-hidden">
        {/* Cinematic reveal flash — fires once when report first appears */}
        <AnimatePresence>
          {showRevealFlash && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(to bottom, rgba(3,75,255,0.1) 0%, transparent 60%)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0, times: [0, 0.2, 1], ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showProgress ? (
            <motion.div
              key={`progress-${sessionKey}`}
              className="flex flex-1 overflow-hidden"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <GenerationProgress
                businessName={businessName ?? ""}
                progressHistory={progressHistory}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`report-${sessionKey}`}
              className="flex flex-1 overflow-hidden"
              initial={{ opacity: 0, scale: 0.98, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <ReportView
                manifest={manifest ?? undefined}
                collectedData={collectedData ?? undefined}
                isGenerating={false}
                businessName={businessName ?? ""}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarInset>

      {hasReport && <ChatSidebar businessName={businessName} />}
    </SidebarProvider>
  );
}
