"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Star,
  TrendingUp,
  MessageSquare,
  Instagram,
  BarChart3,
  Compass,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  StepProgress,
  ProgressPreviewFinancials,
  ProgressPreviewLocation,
  ProgressPreviewReviews,
  ProgressPreviewSocial,
  ProgressPreviewAnalysis,
  ProgressPreviewStrategy,
  ProgressPreviewExperts,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

// Design system semantic color tokens
const SENTIMENT_TOKENS = {
  positive: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  negative: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/30" },
  neutral: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
};

const STATUS_TOKENS = {
  EXCEPTIONAL: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-600", label: "ممتاز" },
  HEALTHY: { bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-600", label: "صحي" },
  WARNING: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-600", label: "تحذير" },
  CRITICAL: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-600", label: "حرج" },
};

const EXPERT_TOKENS = {
  financial: { color: "text-emerald-600", accent: "border-emerald-500/30" },
  digital: { color: "text-blue-600", accent: "border-blue-500/30" },
  market: { color: "text-purple-600", accent: "border-purple-500/30" },
};

interface PhaseDefinition {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  steps: string[];
}

const PHASES: PhaseDefinition[] = [
  { id: 1, label: "حساب المؤشرات المالية", shortLabel: "المالية", icon: <TrendingUp className="size-4" />, steps: ["collect-financials"] },
  { id: 2, label: "جمع بيانات الموقع", shortLabel: "الموقع", icon: <MapPin className="size-4" />, steps: ["place-details", "competitors"] },
  { id: 3, label: "جمع التقييمات", shortLabel: "التقييمات", icon: <MessageSquare className="size-4" />, steps: ["reviews", "competitor-reviews"] },
  { id: 4, label: "تحليل وسائل التواصل", shortLabel: "التواصل", icon: <Instagram className="size-4" />, steps: ["social"] },
  { id: 5, label: "التحليل الذكي", shortLabel: "التحليل", icon: <BarChart3 className="size-4" />, steps: ["semantic-analysis", "social-audit"] },
  { id: 6, label: "بناء الاستراتيجية", shortLabel: "الاستراتيجية", icon: <Compass className="size-4" />, steps: ["directive"] },
  { id: 7, label: "إعداد تقارير الخبراء", shortLabel: "الخبراء", icon: <Layers className="size-4" />, steps: ["financials", "digital", "market"] },
  { id: 8, label: "تجميع التقرير النهائي", shortLabel: "التجميع", icon: <Sparkles className="size-4" />, steps: ["action-plan"] },
];

type PhaseStatus = "pending" | "running" | "complete";

interface PhaseState {
  status: PhaseStatus;
  message: string;
  preview?: Record<string, unknown>;
  expertsCompleted?: Array<"financial" | "digital" | "market">;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function derivePhaseStates(history: StepProgress[]): Record<number, PhaseState> {
  const states: Record<number, PhaseState> = {};
  for (const event of history) {
    const phase = event.phase;
    if (!phase) continue;
    if (event.status === "running") {
      if (!states[phase] || states[phase].status === "pending") {
        states[phase] = { status: "running", message: event.message };
      }
    } else if (event.status === "complete") {
      if (phase === 7) {
        const incoming = (event.preview as ProgressPreviewExperts | undefined)?.completed ?? [];
        const existing = states[phase]?.expertsCompleted ?? [];
        const merged = Array.from(new Set([...existing, ...incoming])) as Array<"financial" | "digital" | "market">;
        const allDone = merged.length >= 3;
        states[phase] = {
          status: allDone ? "complete" : "running",
          message: allDone ? "تم إعداد جميع تقارير الخبراء" : event.message,
          preview: event.preview,
          expertsCompleted: merged,
        };
      } else {
        states[phase] = { status: "complete", message: event.message, preview: event.preview as Record<string, unknown> | undefined };
      }
    }
  }
  return states;
}

function currentActivePhase(states: Record<number, PhaseState>): number {
  let active = 1;
  for (let i = 1; i <= 8; i++) {
    const s = states[i]?.status;
    if (s === "running" || s === "complete") active = i;
  }
  return active;
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased * 10) / 10);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return current;
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} style={{ width: size, height: size }} className={s <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"} aria-label={`${s} من 5`} />
      ))}
    </span>
  );
}

function AnimatedKpiValue({ rawValue, format }: { rawValue: number; format: "currency" | "percent" }) {
  const animated = useCountUp(rawValue, 900);
  if (format === "percent") return <>{animated.toFixed(1)}</>;
  return <>{Math.round(animated).toLocaleString("ar-SA")}</>;
}

function FinancialsPreview({ preview }: { preview: ProgressPreviewFinancials }) {
  const kpis = [
    { label: "صافي الإيرادات", rawValue: preview.netRevenue, unit: "ر.س", format: "currency" as const },
    { label: "هامش الربح", rawValue: preview.grossMargin, unit: "%", format: "percent" as const },
    { label: "نقطة التعادل", rawValue: preview.breakEvenRevenue, unit: "ر.س", format: "currency" as const },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3, ease: "easeOut" }}
          className="bg-muted/30 rounded-lg p-3 text-center border border-border/50"
        >
          <p className="text-muted-foreground text-xs mb-1">{kpi.label}</p>
          <p className="font-bold text-lg tabular-nums"><AnimatedKpiValue rawValue={kpi.rawValue} format={kpi.format} /></p>
          <p className="text-muted-foreground text-xs">{kpi.unit}</p>
        </motion.div>
      ))}
    </div>
  );
}

function LocationPreview({ preview }: { preview: ProgressPreviewLocation }) {
  return (
    <div className="space-y-3">
      {preview.staticMapUrl && (
        <div className="relative rounded-xl overflow-hidden h-32 border">
          <img src={preview.staticMapUrl} alt="خريطة الموقع" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            {preview.address && <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm">{preview.address}</span>}
            {preview.rating && <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1"><Star className="size-3 fill-yellow-400 text-yellow-400" />{preview.rating}</span>}
          </div>
        </div>
      )}
      {(preview.competitors?.length ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground"><MapPin className="size-4 inline ml-1" />{preview.competitors!.length} منافس ضمن {(preview.radius / 1000).toFixed(1)} كم</p>
      )}
    </div>
  );
}

function ReviewsPreview({ preview }: { preview: ProgressPreviewReviews }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{preview.totalCount} تقييم</p>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {preview.samples.slice(0, 3).map((sample, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.25, ease: "easeOut" }}
            className="bg-muted/30 rounded-lg p-2 border border-border/50 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{sample.authorName}</span>
              <StarRating rating={sample.rating} size={10} />
            </div>
            {sample.snippet && <p className="text-muted-foreground line-clamp-1">{sample.snippet}</p>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SocialPreview({ preview }: { preview: ProgressPreviewSocial }) {
  const platforms = [
    preview.instagram && { platform: "instagram" as const, ...preview.instagram },
    preview.tiktok && { platform: "tiktok" as const, ...preview.tiktok },
  ].filter(Boolean);
  if (!platforms.length) return <p className="text-sm text-muted-foreground">لا توجد حسابات</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {platforms.map((p: any, i) => (
        <motion.div
          key={p.platform}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3, ease: "easeOut" }}
          className="bg-muted/30 rounded-lg p-3 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`size-6 rounded flex items-center justify-center text-white text-xs ${p.platform === "instagram" ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-black"}`}>
              {p.platform === "instagram" ? "📸" : "🎵"}
            </div>
            <span className="font-medium text-sm">@{p.username}</span>
          </div>
          <div className="flex gap-3 text-xs">
            {p.followers != null && <div><span className="font-bold">{p.followers.toLocaleString("ar-SA")}</span><span className="text-muted-foreground"> متابع</span></div>}
            {p.engagementRate != null && <div><span className="font-bold">{p.engagementRate.toFixed(1)}%</span><span className="text-muted-foreground"> تفاعل</span></div>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function getSentimentClasses(sentiment: string) {
  return SENTIMENT_TOKENS[sentiment as keyof typeof SENTIMENT_TOKENS] ?? SENTIMENT_TOKENS.neutral;
}

const SENTIMENT_LABELS: Record<string, string> = { positive: "إيجابي", negative: "سلبي", neutral: "محايد" };

function SentimentGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = score >= 70 ? "var(--chart-2)" : score >= 40 ? "var(--chart-4)" : "var(--chart-1)";
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-14">
        <svg className="size-14 -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <motion.path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${clamped}, 100` }} transition={{ duration: 1, ease: "easeOut" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-sm">{clamped}</span>
      </div>
      <div>
        <p className="font-medium text-sm">مستوى الرضا</p>
        <p className="text-xs text-muted-foreground">من 100</p>
      </div>
    </div>
  );
}

function AnalysisPreview({ preview }: { preview: ProgressPreviewAnalysis }) {
  return (
    <div className="space-y-3">
      <SentimentGauge score={preview.sentimentScore} />
      {preview.topThemes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {preview.topThemes.map((theme, i) => {
            const sc = getSentimentClasses(theme.sentiment);
            return <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>{theme.topic}</span>;
          })}
        </div>
      )}
    </div>
  );
}

const FOCUS_LABELS: Record<string, string> = { financial: "المالية", digital: "الرقمي", market: "السوق" };

function StrategyPreview({ preview }: { preview: ProgressPreviewStrategy }) {
  const status = STATUS_TOKENS[preview.overallStatus as keyof typeof STATUS_TOKENS] ?? STATUS_TOKENS.WARNING;
  const focusEntries = Object.entries(preview.focusAreas);
  return (
    <div className="space-y-3">
      <motion.div 
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border/50"
      >
        <div>
          <p className="text-xs text-muted-foreground">المقياس الأساسي</p>
          <p className="font-bold">{preview.northStarName}</p>
          <p className="text-xs text-muted-foreground">{preview.northStarValue} → {preview.northStarTarget}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
      </motion.div>
      <div className="grid grid-cols-3 gap-2">
        {focusEntries.map(([key, value], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: "easeOut" }}
            className="bg-muted/20 rounded-lg p-2 text-center border border-border/30"
          >
            <p className="text-xs text-muted-foreground">{FOCUS_LABELS[key] ?? key}</p>
            <p className="text-xs font-medium leading-tight">{value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const EXPERT_CARDS = [
  { key: "financial" as const, label: "المالية", icon: "📊" },
  { key: "digital" as const, label: "الرقمي", icon: "📱" },
  { key: "market" as const, label: "السوق", icon: "🗺️" },
];

function ExpertsPreview({ completed }: { completed: Array<"financial" | "digital" | "market"> }) {
  const doneSet = new Set(completed);
  return (
    <div className="grid grid-cols-3 gap-2">
      {EXPERT_CARDS.map((card, i) => {
        const done = doneSet.has(card.key);
        const token = EXPERT_TOKENS[card.key];
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.3, ease: "easeOut" }}
            className={`rounded-lg p-3 text-center border ${done ? `bg-card ${token.accent}` : "bg-muted/30 border-border/50"}`}
          >
            <span className="text-xl mb-1 block">{card.icon}</span>
            <p className={`text-xs font-medium ${done ? token.color : "text-muted-foreground"}`}>{card.label}</p>
            {done && <CheckCircle2 className="size-4 mx-auto mt-1 text-emerald-500" />}
          </motion.div>
        );
      })}
    </div>
  );
}

function AssemblyPreview() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <motion.div className="relative size-16 flex items-center justify-center" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-primary" />
        <Sparkles className="size-6 text-primary" />
      </motion.div>
      <p className="text-sm text-muted-foreground text-center">جاري تجميع تقريرك...</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface GenerationProgressProps {
  businessName: string;
  progressHistory: StepProgress[];
}

export function GenerationProgress({ businessName, progressHistory }: GenerationProgressProps) {
  const phaseStates = derivePhaseStates(progressHistory);
  const activePhase = currentActivePhase(phaseStates);
  const completedCount = Object.values(phaseStates).filter(s => s.status === "complete").length;
  const progressPct = (completedCount / 8) * 100;
  const isAllComplete = completedCount === 8;

  const activeState = phaseStates[activePhase];
  const activePreview = activeState?.preview;
  
  // Get merged location data
  const locationEvents = progressHistory.filter(e => e.phase === 2 && e.status === "complete");
  let mergedLocationPreview: ProgressPreviewLocation | null = null;
  if (locationEvents.length > 0 && activePhase === 2) {
    mergedLocationPreview = Object.assign({}, ...locationEvents.map(e => e.preview)) as unknown as ProgressPreviewLocation;
  }

  // Time estimate (rough calculation based on completed phases)
  const remainingPhases = 8 - completedCount;
  const estimatedTime = remainingPhases > 0 ? Math.max(10, remainingPhases * 15) : 0;

  const renderActivePreview = () => {
    if (!activeState || activeState.status === "pending") return null;
    switch (activePhase) {
      case 1: return activePreview ? <FinancialsPreview preview={activePreview as ProgressPreviewFinancials} /> : null;
      case 2: return mergedLocationPreview ? <LocationPreview preview={mergedLocationPreview} /> : null;
      case 3: return activePreview ? <ReviewsPreview preview={activePreview as ProgressPreviewReviews} /> : null;
      case 4: return activePreview ? <SocialPreview preview={activePreview as ProgressPreviewSocial} /> : null;
      case 5: return activePreview ? <AnalysisPreview preview={activePreview as ProgressPreviewAnalysis} /> : null;
      case 6: return activePreview ? <StrategyPreview preview={activePreview as ProgressPreviewStrategy} /> : null;
      case 7: return <ExpertsPreview completed={activeState?.expertsCompleted ?? []} />;
      case 8: return <AssemblyPreview />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background" dir="rtl">
      <style>{`
        @keyframes cbo-glow { 0%, 100% { box-shadow: 0 0 8px -2px color-mix(in srgb, var(--primary) 30%, transparent); } 50% { box-shadow: 0 0 20px -2px color-mix(in srgb, var(--primary) 60%, transparent); } }
        @keyframes cbo-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        @keyframes cbo-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { 
          .cbo-spin { animation: none !important; }
          * { 
            animation-duration: 0.01ms !important; 
            animation-iteration-count: 1 !important; 
            transition-duration: 0.01ms !important; 
          }
        }
      `}</style>

      {/* Timeline Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Business name & progress */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-xl">{businessName}</h2>
              <p className="text-sm text-muted-foreground">
                {isAllComplete ? "اكتمل التقرير" : `المرحلة ${activePhase} من 8${estimatedTime > 0 ? ` · ~${estimatedTime} ثانية` : ''}`}
              </p>
            </div>
            <div className="text-left">
              <span className={`text-3xl font-bold tabular-nums ${isAllComplete ? "text-emerald-500" : ""}`}>{completedCount}</span>
              <span className="text-muted-foreground">/8</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>

          {/* Timeline */}
          <div className="flex items-center justify-between gap-1">
            {PHASES.map((phase, idx) => {
              const state = phaseStates[phase.id];
              const status = state?.status ?? "pending";
              const isActive = phase.id === activePhase;
              const isComplete = status === "complete";
              const isRunning = status === "running";

              return (
                <motion.button
                  key={phase.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${isActive ? "bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <div className={`relative size-8 rounded-full flex items-center justify-center transition-all ${
                    isComplete ? "bg-emerald-500/20 text-emerald-500" :
                    isRunning ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground/50"
                  }`}>
                    {isComplete ? <CheckCircle2 className="size-5" /> :
                     isRunning ? <Loader2 className="cbo-spin size-5 animate-spin" /> :
                     <span className="text-xs font-medium">{phase.id}</span>}
                    {isRunning && <span className="absolute inset-0 rounded-full animate-ping bg-primary/30 opacity-50" />}
                    {isActive && !isRunning && (
                      <motion.span 
                        className="absolute inset-0 rounded-full border-2 border-primary/50"
                        animate={{ boxShadow: ["0 0 4px var(--primary)", "0 0 12px var(--primary)", "0 0 4px var(--primary)"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] truncate max-w-full ${isActive ? "text-primary font-medium" : isComplete ? "text-emerald-600" : "text-muted-foreground/60"}`}>
                    {phase.shortLabel}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Phase Detail Panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {isAllComplete ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="rounded-2xl border bg-gradient-to-br from-card to-muted/50 p-8 text-center"
              >
                <motion.div 
                  className="size-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center" 
                  animate={{ scale: [1, 1.1, 1] }} 
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <CheckCircle2 className="size-10 text-emerald-500" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2">تم إنشاء تقريرك بنجاح 🎉</h3>
                <p className="text-muted-foreground">ستجد خيارات التقرير في الأسفل</p>
              </motion.div>
            ) : activeState ? (
              <motion.div
                key={activePhase}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden"
                style={{ boxShadow: "0 0 40px -10px var(--primary)" }}
              >
                {/* Active Phase Header */}
                <motion.div 
                  className="px-6 py-4 border-b bg-muted/20 flex items-center gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <motion.div 
                    className={`size-10 rounded-full flex items-center justify-center ${
                      activeState.status === "complete" ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/20 text-primary"
                    }`}
                    animate={activeState.status === "complete" ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {activeState.status === "complete" ? <CheckCircle2 className="size-5" /> : <Loader2 className="cbo-spin size-5 animate-spin" />}
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="font-bold">{PHASES[activePhase - 1].label}</h3>
                    {activeState.message && <p className="text-sm text-muted-foreground">{activeState.message}</p>}
                  </div>
                </motion.div>

                {/* Preview Content */}
                <div className="p-6">
                  {renderActivePreview()}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preparing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border bg-muted/20 p-8 text-center"
              >
                <Loader2 className="size-8 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-muted-foreground">جاري إعداد تقرير عملك...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Previous phases summary */}
          {completedCount > 0 && !isAllComplete && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">المراحل المكتملة ({completedCount})</h4>
              <div className="flex flex-wrap gap-2">
                {PHASES.slice(0, completedCount).map((phase) => (
                  <div key={phase.id} className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full text-xs">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    <span>{phase.shortLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}