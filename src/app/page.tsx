"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import { saveThreadTitle } from "@/app/actions";
import { useReportStore } from "@/store/report-store";
import { BusinessForm, type FinancialFormData } from "@/components/business-form";
import { ExecutivePreview } from "@/components/executive-preview";

export default function FormPage() {
  const router = useRouter();
  const store = useReportStore();

  const pendingFormData = useRef<FinancialFormData | null>(null);
  const pendingThreadId = useRef<string | null>(null);

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
      console.log("[form:onData]", part.type, part.data?.status ?? "");

      if (part.type === "data-workflow") {
        if (part.id) {
          store.setFormData(pendingFormData.current!);
          store.startReport(part.id, pendingThreadId.current!, pendingFormData.current?.businessName ?? "");
          router.push(`/report/${part.id}`, { scroll: false } as any);
        }
      }
    },
    onError: (err: unknown) => console.error("[form:error]", err),
  });

  const workflowRunning = workflowStatus === "submitted" || workflowStatus === "streaming";

  const handleFormSubmit = useCallback(async (data: FinancialFormData) => {
    const newThreadId = crypto.randomUUID();
    pendingFormData.current = data;
    pendingThreadId.current = newThreadId;
    saveThreadTitle(newThreadId, data.businessName).catch(console.error);
    
    await workflowSend({ text: "generate" });
  }, [workflowSend, store]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="min-h-screen flex"
        dir="rtl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Left Pane - Executive Preview (second in DOM, renders on left in RTL) */}
        <div className="w-1/2 h-screen bg-card">
          <ExecutivePreview />
        </div>
        {/* Right Pane - Business Form (first in DOM, renders on right in RTL) */}
        <div className="w-1/2 h-screen overflow-y-auto flex bg-card">
          <BusinessForm onSubmit={handleFormSubmit} isSubmitting={workflowRunning} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
