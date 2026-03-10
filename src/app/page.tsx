"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { ReportSession } from "@/components/report-session";

function HomeContent() {
  const searchParams = useSearchParams();
  const urlRunId = searchParams.get("run");
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={sessionKey}
          className="flex w-full flex-1 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ReportSession sessionKey={sessionKey} urlRunId={urlRunId} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
