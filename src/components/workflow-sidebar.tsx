"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Loader2, PlusCircle, XCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listUserThreads } from "@/app/actions";

const STEPS = [
  { id: 0, label: "البيانات المالية", sublabel: "حساب نقطة التعادل والهوامش" },
  { id: 1, label: "بيانات Google Maps", sublabel: "تفاصيل المشروع والتقييمات" },
  { id: 2, label: "تحليل المنافسين", sublabel: "أقرب 3 منافسين من حيث التقييم" },
  { id: 3, label: "وسائل التواصل الاجتماعي", sublabel: "Instagram & TikTok" },
  { id: 4, label: "إنشاء التقرير", sublabel: "التقرير الشامل بالذكاء الاصطناعي" },
];

type StepState = "pending" | "active" | "done" | "error";

interface WorkflowStep {
  status: string;
  [key: string]: unknown;
}

interface Thread {
  id: string;
  title: string;
  updatedAt: Date;
}

interface Props {
  isGenerating: boolean;
  hasReport: boolean;
  onNewReport: () => void;
  onSelectThread: (id: string) => void;
  sessionKey: number;
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `منذ ${days} أيام`;
  return new Date(date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function deriveStepState(
  stepData: WorkflowStep | undefined,
  isGenerating: boolean,
  hasReport: boolean
): StepState {
  if (stepData) {
    if (stepData.status === "running") return "active";
    if (stepData.status === "success") return "done";
    if (stepData.status === "failed") return "error";
  }
  if (!isGenerating && hasReport) return "done";
  return "pending";
}

export function WorkflowSidebar({
  isGenerating,
  hasReport,
  onNewReport,
  onSelectThread,
  sessionKey,
}: Props) {
  const workflowSteps: WorkflowStep[] = [];
  const [threads, setThreads] = useState<Thread[]>([]);
  const activeThreadId = typeof window !== "undefined"
    ? localStorage.getItem("cbo-thread-id")
    : null;

  useEffect(() => {
    listUserThreads()
      .then((ts) => setThreads(ts as Thread[]))
      .catch(console.error);
  }, [sessionKey]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="px-4 py-5 border-b">
        <div className="mb-4 space-y-0.5">
          <h1 className="text-sm font-semibold tracking-wide text-foreground">F&B Intelligence</h1>
          <p className="text-xs text-muted-foreground">تحليل الأعمال بالذكاء الاصطناعي</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onNewReport}
          disabled={isGenerating}
        >
          <PlusCircle className="size-3.5" />
          تقرير جديد
        </Button>
      </div>

      {/* Workflow steps */}
      <div className="px-4 py-4 border-b">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          مراحل التحليل
        </p>
        <div className="flex flex-col gap-3">
          {STEPS.map((step) => {
            const state = deriveStepState(workflowSteps[step.id], isGenerating, hasReport);
            return (
              <motion.div key={step.id} className="flex items-start gap-3" initial={false}>
                <div className="mt-0.5 shrink-0">
                  <AnimatePresence mode="wait" initial={false}>
                    {state === "done" ? (
                      <motion.div key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      </motion.div>
                    ) : state === "error" ? (
                      <motion.div key="error" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                        <XCircle className="size-4 text-red-500" />
                      </motion.div>
                    ) : state === "active" ? (
                      <motion.div key="active" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <Loader2 className="size-4 animate-spin text-primary" />
                      </motion.div>
                    ) : (
                      <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Circle className="size-4 text-muted-foreground/40" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-xs font-medium leading-tight transition-colors duration-300",
                    state === "done" && "text-emerald-600 dark:text-emerald-400",
                    state === "error" && "text-red-600 dark:text-red-400",
                    state === "active" && "text-foreground",
                    state === "pending" && "text-muted-foreground/60"
                  )}>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/50">
                    {step.sublabel}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex flex-1 flex-col overflow-hidden px-4 py-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          التقارير السابقة
        </p>
        <div className="flex flex-col gap-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground/50">لا توجد تقارير سابقة</p>
            )}
            {threads.map((t) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => onSelectThread(t.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60",
                  t.id === activeThreadId && "bg-muted"
                )}
              >
                <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-tight text-foreground">
                    {t.title || "تقرير بدون عنوان"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                    {relativeTime(t.updatedAt)}
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
