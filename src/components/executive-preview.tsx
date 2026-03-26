"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  Target,
  BarChart3,
  Sparkles,
  FileText,
  Cpu,

  Lightbulb,
  ArrowRight
} from "lucide-react";

type Phase = "collect" | "analyze" | "results";

const PHASE_DURATION = 3500;

export function ExecutivePreview() {
  const [phase, setPhase] = useState<Phase>("collect");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setPhase((prev) => {
        if (prev === "collect") return "analyze";
        if (prev === "analyze") return "results";
        return "collect";
      });
    }, PHASE_DURATION);

    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden bg-card"
      dir="rtl"
    >
      {/* ── Subtle Ambient Texture ────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, oklch(0.6 0.22 265) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, oklch(0.6 0.22 265) 0%, transparent 70%)' }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ── Content Layer ────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col h-full p-8">

        {/* Logo - Staggered Entrance */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src="/logo.png"
            alt="CBO.AI"
            className="h-24 w-auto"
          />
        </motion.div>

        {/* Main Headline - Staggered Entrance */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl font-bold text-foreground leading-tight mb-3">
            ذكاء أعمال فوري
            <br />
            <span className="text-primary">
              لمشروعك
            </span>
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            حوّل بياناتك المالية إلى خطط عمل دقيقة وتوصيات تسعير مدعومة بالذكاء الاصطناعي في ثوانٍ.
          </p>
        </motion.div>

        {/* ── Hero Card with Intelligence Loop ─────────────────────────── */}
        <motion.div
          className="relative mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative bg-background/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 overflow-hidden min-h-[180px]">
            {/* ── Value Pillars with Micro-interactions ────────────────────────────────────── */}
            <div className="flex flex-col gap-3 flex-1  mb-4">
              <motion.div
                className="flex items-start gap-4 p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-colors group cursor-pointer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <BarChart3 className="size-5 text-primary" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="text-foreground font-medium text-sm mb-1">تحليل مالي متقدم</h3>
                  <p className="text-muted-foreground text-xs">هيكل التكاليف، هوامش الربح، ونسب الكفاءة التشغيلية</p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-start gap-4 p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-colors group cursor-pointer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Target className="size-5 text-primary" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="text-foreground font-medium text-sm mb-1">هندسة قائمة الطعام</h3>
                  <p className="text-muted-foreground text-xs">تحليل المنتجات الأكثر ربحية وتوصيات التسعير المثلى</p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-start gap-4 p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-colors group cursor-pointer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Lightbulb className="size-5 text-primary" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="text-foreground font-medium text-sm mb-1">خطط عمل تنفيذية</h3>
                  <p className="text-muted-foreground text-xs">توصيات قابلة للتنفيذ لزيادة الأرباح وتقليل الهدر</p>
                </div>
              </motion.div>
            </div>
            {/* Phase Indicator */}
            <div className="flex items-center gap-2 mb-4">
              <motion.div
                className="h-1 flex-1 rounded-full bg-primary/20 overflow-hidden"
                initial={false}
              >
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{
                    scaleX: phase === "collect" ? 0.33 : phase === "analyze" ? 0.66 : 1,
                    originX: 0
                  }}
                  transition={{ duration: 0.5 }}
                />
              </motion.div>
            </div>


            {/* Animated Content */}
            <AnimatePresence mode="wait">

              {/* PHASE 1: COLLECT */}
              {phase === "collect" && (
                <motion.div
                  key="collect"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="size-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-medium text-sm">جمع البيانات</h3>
                      <p className="text-muted-foreground text-xs">جلب البيانات المالية...</p>
                    </div>
                  </div>

                  {/* Skeleton Data Rows */}
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="h-8 rounded-lg bg-muted/50 flex items-center px-3"
                        initial={{ width: "0%", opacity: 0 }}
                        animate={{ width: i === 1 ? "90%" : i === 2 ? "70%" : "80%", opacity: 1 }}
                        transition={{ duration: 0.5, delay: i * 0.15 }}
                      >
                        <motion.div
                          className="h-2 rounded-full bg-primary/30"
                          animate={{ width: ["20%", "40%", "20%"] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* PHASE 2: ANALYZE */}
              {phase === "analyze" && (
                <motion.div
                  key="analyze"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center justify-center py-4"
                >
                  <div className="relative mb-4">
                    {/* Concentric Rings */}
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full border-2 border-primary/20"
                        animate={{ scale: [1, 1.5 + i * 0.3], opacity: [0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        style={{
                          width: 60 + i * 20,
                          height: 60 + i * 20,
                          left: '50%',
                          top: '50%',
                          marginLeft: -(30 + i * 10),
                          marginTop: -(30 + i * 10)
                        }}
                      />
                    ))}
                    <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center relative z-10">
                    
                        
                        <Sparkles className="size-8 text-primary animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-foreground font-medium text-sm">التحليل الذكي</h3>
                  <p className="text-muted-foreground text-xs">معالجة وتحليل الأرقام...</p>
                </motion.div>
              )}

              {/* PHASE 3: RESULTS */}
              {phase === "results" && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-success/20 flex items-center justify-center">
                      <TrendingUp className="size-5 text-success" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-medium text-sm">النتائج والتوصيات</h3>
                      <p className="text-muted-foreground text-xs">استخراج خطط العمل...</p>
                    </div>
                  </div>

                  {/* Animated Chart */}
                  <div className="flex items-end gap-1 h-16">
                    {[35, 45, 30, 55, 70, 60, 80, 65, 90, 75, 85, 95].map((height, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400"
                        initial={{ height: '0%' }}
                        animate={{ height: `${height}%` }}
                        transition={{
                          duration: 0.8,
                          delay: i * 0.05,
                          ease: [0.16, 1, 0.3, 1]
                        }}
                      />
                    ))}
                  </div>

                  {/* Key Metric */}
                  <motion.div
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <span className="text-muted-foreground text-xs">صافي الربح المتوقع</span>
                    <motion.span
                      className="text-xl font-bold text-success font-mono"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                    >
                      +24%
                    </motion.span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
