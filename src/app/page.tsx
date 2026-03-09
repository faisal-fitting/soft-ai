"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ReportSession } from "@/components/report-session";

export default function Home() {
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
          <ReportSession sessionKey={sessionKey} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
