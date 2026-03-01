"use client";

import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Loader2, PlusCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface Props {
  isGenerating: boolean;
  hasReport: boolean;
  onNewReport: () => void;
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
}: Props) {
  const workflowSteps: WorkflowStep[] = [];
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/30 px-4 py-6">
      {/* Header */}
      <div className="mb-6 space-y-1">
        <h1 className="text-sm font-semibold tracking-wide text-foreground">
          F&B Intelligence
        </h1>
        <p className="text-xs text-muted-foreground">
          تحليل الأعمال بالذكاء الاصطناعي
        </p>
      </div>

      {/* New Report Button */}
      <Button
        variant="outline"
        size="sm"
        className="mb-6 w-full justify-start gap-2 text-xs"
        onClick={onNewReport}
        disabled={isGenerating}
      >
        <PlusCircle className="size-3.5" />
        تقرير جديد
      </Button>

      {/* Divider label */}
      <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        مراحل التحليل
      </p>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const state = deriveStepState(
            workflowSteps[step.id],
            isGenerating,
            hasReport
          );
          return (
            <motion.div
              key={step.id}
              className="flex items-start gap-3"
              initial={false}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                <AnimatePresence mode="wait" initial={false}>
                  {state === "done" ? (
                    <motion.div
                      key="done"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    </motion.div>
                  ) : state === "error" ? (
                    <motion.div
                      key="error"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <XCircle className="size-4 text-red-500" />
                    </motion.div>
                  ) : state === "active" ? (
                    <motion.div
                      key="active"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Loader2 className="size-4 animate-spin text-primary" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pending"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Circle className="size-4 text-muted-foreground/40" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Labels */}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium leading-tight transition-colors duration-300",
                    state === "done" && "text-emerald-600 dark:text-emerald-400",
                    state === "error" && "text-red-600 dark:text-red-400",
                    state === "active" && "text-foreground",
                    state === "pending" && "text-muted-foreground/60"
                  )}
                >
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
    </aside>
  );
}
