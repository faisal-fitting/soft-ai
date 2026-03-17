"use client";

import { useEffect, useRef } from "react";
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

interface PhaseDefinition {
  id: number;
  label: string;
  icon: React.ReactNode;
  steps: string[]; // backend step IDs that belong to this phase
}

const PHASES: PhaseDefinition[] = [
  { id: 1, label: "حساب المؤشرات المالية",    icon: <TrendingUp className="size-4" />,    steps: ["collect-financials"] },
  { id: 2, label: "جمع بيانات الموقع",        icon: <MapPin className="size-4" />,         steps: ["place-details", "competitors"] },
  { id: 3, label: "جمع التقييمات",             icon: <MessageSquare className="size-4" />,  steps: ["reviews", "competitor-reviews"] },
  { id: 4, label: "تحليل وسائل التواصل",      icon: <Instagram className="size-4" />,      steps: ["social"] },
  { id: 5, label: "التحليل الذكي",             icon: <BarChart3 className="size-4" />,      steps: ["semantic-analysis", "social-audit"] },
  { id: 6, label: "بناء الاستراتيجية",         icon: <Compass className="size-4" />,        steps: ["directive"] },
  { id: 7, label: "إعداد تقارير الخبراء",     icon: <Layers className="size-4" />,         steps: ["financials", "digital", "market"] },
  { id: 8, label: "تجميع التقرير النهائي",    icon: <Sparkles className="size-4" />,       steps: ["action-plan"] },
];

type PhaseStatus = "pending" | "running" | "complete";

interface PhaseState {
  status: PhaseStatus;
  message: string;
  preview?: Record<string, unknown>;
  // For phase 7: track each expert individually
  expertsCompleted?: Array<"financial" | "digital" | "market">;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function derivePhaseStates(history: StepProgress[]): Record<number, PhaseState> {
  const states: Record<number, PhaseState> = {};

  for (const event of history) {
    const phase = event.phase;
    if (!phase) continue;

    const current = states[phase];

    if (event.status === "running") {
      if (!current || current.status === "pending") {
        states[phase] = { status: "running", message: event.message };
      }
    } else if (event.status === "complete") {
      // For phase 7, merge completed experts across events
      if (phase === 7) {
        const incoming = (event.preview as ProgressPreviewExperts | undefined)?.completed ?? [];
        const existing = current?.expertsCompleted ?? [];
        const merged = Array.from(new Set([...existing, ...incoming])) as Array<"financial" | "digital" | "market">;
        const allDone = merged.length >= 3;
        states[phase] = {
          status: allDone ? "complete" : "running",
          message: allDone ? "تم إعداد جميع تقارير الخبراء" : event.message,
          preview: event.preview,
          expertsCompleted: merged,
        };
      } else {
        states[phase] = {
          status: "complete",
          message: event.message,
          preview: event.preview as Record<string, unknown> | undefined,
        };
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

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          style={{ width: size, height: size }}
          className={s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
        />
      ))}
    </span>
  );
}

// ── Phase 1: Financials Preview ───────────────────────────────────────────────

function FinancialsPreview({ preview }: { preview: ProgressPreviewFinancials }) {
  const kpis = [
    { label: "صافي الإيرادات", value: preview.netRevenue.toLocaleString("ar-SA"), unit: "ر.س" },
    { label: "هامش الربح الإجمالي", value: preview.grossMargin.toFixed(1), unit: "%" },
    { label: "نقطة التعادل", value: preview.breakEvenRevenue.toLocaleString("ar-SA"), unit: "ر.س" },
  ];

  return (
    <motion.div
      className="grid grid-cols-3 gap-3 mt-3"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {kpis.map((kpi) => (
        <motion.div
          key={kpi.label}
          variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          className="rounded-xl border bg-card px-3 py-3 text-center"
        >
          <p className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{kpi.label}</p>
          <p className="font-bold text-lg leading-none">{kpi.value}</p>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "11px" }}>{kpi.unit}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Phase 2: Location Preview ─────────────────────────────────────────────────

function LocationPreview({ preview }: { preview: ProgressPreviewLocation }) {
  return (
    <motion.div
      className="mt-3 space-y-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {preview.staticMapUrl && (
        <div className="relative rounded-xl overflow-hidden border" style={{ height: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.staticMapUrl}
            alt="خريطة الموقع"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
            {preview.address && (
              <span className="bg-black/60 text-white rounded-md px-2 py-0.5 backdrop-blur-sm" style={{ fontSize: "11px" }}>
                {preview.address}
              </span>
            )}
            {preview.rating && (
              <span className="bg-black/60 text-white rounded-md px-2 py-0.5 backdrop-blur-sm flex items-center gap-1" style={{ fontSize: "11px" }}>
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {preview.rating}
              </span>
            )}
          </div>
        </div>
      )}
      {(preview.competitors?.length ?? 0) > 0 && (
        <motion.div
          className="flex items-center gap-2 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <MapPin className="size-3.5 shrink-0" />
          <span style={{ fontSize: "12px" }}>
            تم رصد <span className="font-semibold text-foreground">{preview.competitors!.length}</span> منافس في نطاق {(preview.radius / 1000).toFixed(1)} كم
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Phase 3: Reviews Preview ──────────────────────────────────────────────────

function ReviewsPreview({ preview }: { preview: ProgressPreviewReviews }) {
  return (
    <motion.div
      className="mt-3 space-y-2"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.p
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="text-muted-foreground"
        style={{ fontSize: "12px" }}
      >
        تم جلب <span className="font-semibold text-foreground">{preview.totalCount}</span> تقييم
      </motion.p>
      {preview.samples.slice(0, 3).map((sample, i) => (
        <motion.div
          key={i}
          variants={{ hidden: { opacity: 0, x: 12 }, visible: { opacity: 1, x: 0 } }}
          className="rounded-xl border bg-card px-3 py-2.5 flex flex-col gap-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sample.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sample.profilePhoto} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold" style={{ fontSize: "10px" }}>
                  {sample.authorName.charAt(0)}
                </div>
              )}
              <span className="font-medium" style={{ fontSize: "12px" }}>{sample.authorName}</span>
            </div>
            <StarRating rating={sample.rating} size={11} />
          </div>
          {sample.snippet && (
            <p className="text-muted-foreground leading-relaxed line-clamp-2" style={{ fontSize: "11px" }}>
              {sample.snippet}
            </p>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Phase 4: Social Preview ───────────────────────────────────────────────────

function SocialPreview({ preview }: { preview: ProgressPreviewSocial }) {
  const platforms = [
    preview.instagram && { platform: "instagram" as const, ...preview.instagram },
    preview.tiktok && { platform: "tiktok" as const, ...preview.tiktok },
  ].filter(Boolean) as Array<{ platform: "instagram" | "tiktok"; username: string; followers?: number; engagementRate?: number }>;

  if (!platforms.length) {
    return (
      <motion.p
        className="mt-3 text-muted-foreground"
        style={{ fontSize: "12px" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        لا توجد حسابات تواصل اجتماعي مرتبطة
      </motion.p>
    );
  }

  return (
    <motion.div
      className="mt-3 grid grid-cols-2 gap-3"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {platforms.map((p) => (
        <motion.div
          key={p.platform}
          variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
          className="rounded-xl border bg-card px-3 py-3 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-2">
            <div className={`size-7 rounded-lg flex items-center justify-center text-white ${p.platform === "instagram" ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-black"}`}>
              {p.platform === "instagram" ? (
                <Instagram className="size-4" />
              ) : (
                <span className="font-bold" style={{ fontSize: "10px" }}>Insta</span>
              )}
            </div>
            <span className="font-medium" style={{ fontSize: "12px" }}>@{p.username}</span>
          </div>
          <div className="flex gap-3">
            {p.followers != null && (
              <div>
                <p className="font-bold" style={{ fontSize: "13px" }}>{p.followers.toLocaleString("ar-SA")}</p>
                <p className="text-muted-foreground" style={{ fontSize: "10px" }}>متابع</p>
              </div>
            )}
            {p.engagementRate != null && (
              <div>
                <p className="font-bold" style={{ fontSize: "13px" }}>{p.engagementRate.toFixed(1)}%</p>
                <p className="text-muted-foreground" style={{ fontSize: "10px" }}>تفاعل</p>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Phase 5: Analysis Preview ─────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  negative: "bg-red-500/15 text-red-700 border-red-200",
  neutral:  "bg-blue-500/15 text-blue-700 border-blue-200",
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "إيجابي",
  negative: "سلبي",
  neutral: "محايد",
};

function SentimentArc({ score }: { score: number }) {
  // score 0-100 → arc from left to right (180° arc)
  const clamped = Math.max(0, Math.min(100, score));
  const pct = clamped / 100;
  const angle = pct * 180; // 0° = full left, 180° = full right
  const color = score >= 70 ? "var(--chart-2)" : score >= 40 ? "var(--chart-4)" : "var(--chart-1)";

  // SVG arc parameters
  const cx = 60, cy = 60, r = 48;
  const startX = cx - r, startY = cy;
  const endX = cx + Math.cos((Math.PI - (angle * Math.PI / 180))) * r;
  const endY = cy - Math.sin((Math.PI - (angle * Math.PI / 180))) * r;
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <motion.path
          d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
        {/* Score label */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground font-bold" fontSize="22">{clamped}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">/100</text>
      </svg>
      <p className="text-muted-foreground mt-1" style={{ fontSize: "11px" }}>مستوى الرضا العام</p>
    </div>
  );
}

function AnalysisPreview({ preview }: { preview: ProgressPreviewAnalysis }) {
  return (
    <motion.div
      className="mt-3 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <SentimentArc score={preview.sentimentScore} />
      {preview.topThemes.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-1.5"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {preview.topThemes.map((theme, i) => (
            <motion.span
              key={i}
              variants={{ hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1 } }}
              className={`rounded-full border px-2.5 py-0.5 ${SENTIMENT_COLORS[theme.sentiment] ?? SENTIMENT_COLORS.neutral}`}
              style={{ fontSize: "11px" }}
            >
              {theme.topic} · {SENTIMENT_LABELS[theme.sentiment] ?? theme.sentiment}
            </motion.span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Phase 6: Strategy Preview ─────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  EXCEPTIONAL: { bg: "bg-emerald-500/15 border-emerald-300", text: "text-emerald-700", label: "ممتاز" },
  HEALTHY:     { bg: "bg-blue-500/15 border-blue-300",       text: "text-blue-700",    label: "صحي" },
  WARNING:     { bg: "bg-amber-500/15 border-amber-300",     text: "text-amber-700",   label: "تحذير" },
  CRITICAL:    { bg: "bg-red-500/15 border-red-300",         text: "text-red-700",     label: "حرج" },
};

const FOCUS_LABELS: Record<string, string> = {
  financial: "المالية",
  digital: "الرقمي",
  market: "السوق",
};

function StrategyPreview({ preview }: { preview: ProgressPreviewStrategy }) {
  const statusStyle = STATUS_STYLES[preview.overallStatus] ?? STATUS_STYLES.WARNING;

  return (
    <motion.div
      className="mt-3 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground mb-0.5" style={{ fontSize: "11px" }}>المقياس الأساسي</p>
          <p className="font-bold">{preview.northStarName}</p>
          <p className="text-muted-foreground" style={{ fontSize: "11px" }}>
            الحالي: {preview.northStarValue} → الهدف: {preview.northStarTarget}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-semibold ${statusStyle.bg} ${statusStyle.text}`} style={{ fontSize: "12px" }}>
          {statusStyle.label}
        </span>
      </div>
      <motion.div
        className="flex gap-2 flex-wrap"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {Object.entries(preview.focusAreas).map(([key, value]) => (
          <motion.div
            key={key}
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            className="rounded-lg border bg-muted/40 px-3 py-2 flex-1"
          >
            <p className="text-muted-foreground" style={{ fontSize: "10px" }}>{FOCUS_LABELS[key] ?? key}</p>
            <p className="font-medium leading-snug mt-0.5" style={{ fontSize: "11px" }}>{value}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── Phase 7: Experts Preview ──────────────────────────────────────────────────

const EXPERT_CARDS = [
  { key: "financial" as const, label: "المالية",    icon: <TrendingUp className="size-4" />,    color: "text-emerald-600" },
  { key: "digital" as const,   label: "الرقمي",     icon: <Instagram className="size-4" />,      color: "text-blue-600" },
  { key: "market" as const,    label: "السوق",      icon: <MapPin className="size-4" />,          color: "text-purple-600" },
];

function ExpertsPreview({ completed }: { completed: Array<"financial" | "digital" | "market"> }) {
  const completedSet = new Set(completed);
  return (
    <motion.div
      className="mt-3 grid grid-cols-3 gap-2"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {EXPERT_CARDS.map((card) => {
        const done = completedSet.has(card.key);
        return (
          <motion.div
            key={card.key}
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            className={`rounded-xl border px-3 py-3 flex flex-col items-center gap-2 transition-colors ${done ? "bg-card border-emerald-300" : "bg-muted/40"}`}
          >
            <div className={done ? "text-emerald-600" : "text-muted-foreground"}>
              {done ? <CheckCircle2 className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
            </div>
            <div className={`${card.color} opacity-70`}>{card.icon}</div>
            <p className="font-medium text-center" style={{ fontSize: "11px" }}>{card.label}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ── Phase 8: Assembly Preview ─────────────────────────────────────────────────

function AssemblyPreview() {
  return (
    <motion.div
      className="mt-3 flex flex-col items-center gap-3 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="relative size-12 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-primary" />
        <Sparkles className="size-5 text-primary" />
      </motion.div>
      <p className="text-muted-foreground text-center" style={{ fontSize: "12px" }}>
        يتم الآن دمج جميع التحليلات وبناء التقرير النهائي...
      </p>
    </motion.div>
  );
}

// ── Phase Card ────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  state,
  isActive,
}: {
  phase: PhaseDefinition;
  state: PhaseState | undefined;
  isActive: boolean;
}) {
  const status = state?.status ?? "pending";
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const preview = state?.preview;

  function renderPreview() {
    if (!preview || status !== "complete") return null;

    switch (phase.id) {
      case 1:
        return <FinancialsPreview preview={preview as unknown as ProgressPreviewFinancials} />;
      case 2: {
        // Merge location + competitors previews from the accumulated state
        const loc = preview as unknown as ProgressPreviewLocation;
        if (!loc.lat) return null;
        return <LocationPreview preview={loc} />;
      }
      case 3:
        return (preview as unknown as ProgressPreviewReviews).totalCount != null
          ? <ReviewsPreview preview={preview as unknown as ProgressPreviewReviews} />
          : null;
      case 4:
        return <SocialPreview preview={preview as unknown as ProgressPreviewSocial} />;
      case 5:
        return (preview as unknown as ProgressPreviewAnalysis).sentimentScore != null
          ? <AnalysisPreview preview={preview as unknown as ProgressPreviewAnalysis} />
          : null;
      case 6:
        return (preview as unknown as ProgressPreviewStrategy).northStarName
          ? <StrategyPreview preview={preview as unknown as ProgressPreviewStrategy} />
          : null;
      case 7:
        return <ExpertsPreview completed={state?.expertsCompleted ?? []} />;
      case 8:
        return null; // assembly handled in the running state below
      default:
        return null;
    }
  }

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-2xl border transition-colors overflow-hidden ${
        status === "complete"
          ? "bg-card border-border"
          : status === "running"
          ? "bg-card border-primary/40 shadow-sm"
          : "bg-muted/20 border-border/50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <div className={`shrink-0 ${status === "complete" ? "text-emerald-500" : status === "running" ? "text-primary" : "text-muted-foreground/40"}`}>
          {status === "complete" ? (
            <CheckCircle2 className="size-5" />
          ) : status === "running" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="size-5" />
            </motion.div>
          ) : (
            <Circle className="size-5" />
          )}
        </div>

        {/* Phase icon + label */}
        <div className={`flex items-center gap-2 flex-1 ${status === "pending" ? "opacity-40" : ""}`}>
          <span className={status === "running" ? "text-primary" : status === "complete" ? "text-foreground" : "text-muted-foreground"}>
            {phase.icon}
          </span>
          <span className={`font-medium ${status === "pending" ? "text-muted-foreground" : "text-foreground"}`} style={{ fontSize: "14px" }}>
            {phase.label}
          </span>
        </div>

        {/* Phase number badge */}
        <span className="text-muted-foreground/50 font-mono shrink-0" style={{ fontSize: "11px" }}>
          {phase.id}/8
        </span>
      </div>

      {/* Status message when running */}
      {status === "running" && state?.message && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 pb-2 text-muted-foreground"
          style={{ fontSize: "12px" }}
        >
          {state.message}
        </motion.p>
      )}

      {/* Preview content when complete */}
      <AnimatePresence>
        {status === "complete" && preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4"
          >
            {renderPreview()}
          </motion.div>
        )}
        {status === "running" && phase.id === 8 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4"
          >
            <AssemblyPreview />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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

  // Merge location + competitors preview data across events
  const mergedPhaseStates = { ...phaseStates };
  const locationEvents = progressHistory.filter(e => e.phase === 2 && e.status === "complete");
  if (locationEvents.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const e of locationEvents) {
      if (e.preview) Object.assign(merged, e.preview);
    }
    if (Object.keys(merged).length > 0) {
      mergedPhaseStates[2] = { ...mergedPhaseStates[2], preview: merged };
    }
  }

  // Count how many phases have started (running or complete)
  const startedCount = Object.values(phaseStates).filter(s => s.status !== "pending").length;
  const completedCount = Object.values(phaseStates).filter(s => s.status === "complete").length;
  const progressPct = (completedCount / 8) * 100;

  // Only show phases that have been started (or the first pending one after active)
  const visiblePhases = PHASES.filter(p => {
    const state = phaseStates[p.id]?.status;
    return state === "running" || state === "complete" || p.id === activePhase + 1;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden" dir="rtl">
      {/* ── Top header ── */}
      <div className="px-6 pt-6 pb-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg leading-none">{businessName}</h2>
              <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
                {startedCount === 0 ? "جاري التحضير..." : `المرحلة ${activePhase} من 8`}
              </p>
            </div>
            <div className="text-left rtl:text-right">
              <span className="font-bold text-2xl tabular-nums">{completedCount}</span>
              <span className="text-muted-foreground">/8</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* ── Phase list ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-3">
          <AnimatePresence initial={false}>
            {visiblePhases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                state={mergedPhaseStates[phase.id]}
                isActive={phase.id === activePhase}
              />
            ))}
          </AnimatePresence>

          {/* Bottom padding for scroll */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
