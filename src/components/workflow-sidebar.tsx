"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlusCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listUserThreads } from "@/app/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Thread {
  id: string;
  title: string;
  updatedAt: Date;
}

interface Props {
  onNewReport: () => void;
  onSelectThread: (id: string) => void;
  sessionKey: number;
  isGenerating?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function WorkflowSidebar({
  onNewReport,
  onSelectThread,
  sessionKey,
  isGenerating,
}: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const activeThreadId =
    typeof window !== "undefined" ? localStorage.getItem("cbo-thread-id") : null;

  useEffect(() => {
    listUserThreads()
      .then((ts) => setThreads(ts as Thread[]))
      .catch(console.error);
  }, [sessionKey]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l bg-muted/30">
      {/* Header */}
      <div className="border-b px-4 py-5">
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
