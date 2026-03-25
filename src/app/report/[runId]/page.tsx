"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ReportSession, CboLoader } from "@/components/report-session";

function DashboardContent() {
  const params = useParams();
  const urlRunId = params?.runId as string | undefined;
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

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-background">
          <CboLoader />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
