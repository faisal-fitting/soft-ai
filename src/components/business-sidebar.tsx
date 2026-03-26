"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Star, Phone, Globe, Clock, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import type { ReportManifest, CollectedData } from "@/lib/types";
import { MessageResponse } from "./ai-elements/message";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  EXCEPTIONAL: {
    label: "استثنائي",
    cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    glow: "0 0 14px rgba(16,185,129,0.45)",
    arc: "#10b981",
    arcBg: "rgba(16,185,129,0.12)",
  },
  HEALTHY: {
    label: "صحي",
    cls: "border-blue-500/40 text-blue-400 bg-blue-500/10",
    glow: "0 0 14px rgba(46,91,255,0.45)",
    arc: "#2E5BFF",
    arcBg: "rgba(46,91,255,0.12)",
  },
  WARNING: {
    label: "تحذير",
    cls: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    glow: "0 0 14px rgba(245,158,11,0.45)",
    arc: "#f59e0b",
    arcBg: "rgba(245,158,11,0.12)",
  },
  CRITICAL: {
    label: "حرج",
    cls: "border-red-500/40 text-red-400 bg-red-500/10",
    glow: "0 0 14px rgba(239,68,68,0.45)",
    arc: "#ef4444",
    arcBg: "rgba(239,68,68,0.12)",
  },
} as const;

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE:           "مجاني",
  PRICE_LEVEL_INEXPENSIVE:    "＄ اقتصادي",
  PRICE_LEVEL_MODERATE:       "＄＄ متوسط",
  PRICE_LEVEL_EXPENSIVE:      "＄＄＄ غالي",
  PRICE_LEVEL_VERY_EXPENSIVE: "＄＄＄＄ فاخر",
};

// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000): number {
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
      setCurrent(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

// ── Health Score Arc ───────────────────────────────────────────────────────────

function HealthArc({ score, arcColor }: { score: number; arcColor: string }) {
  const animated = useCountUp(score, 1100);
  const cx = 54, cy = 54, r = 44;
  const clampedPct = Math.max(0, Math.min(score, 100)) / 100;
  // 225° arc (from bottom-left to bottom-right, clockwise)
  const startAngle = 225 * (Math.PI / 180);
  const sweepAngle = 270 * (Math.PI / 180);
  const endAngle = startAngle + sweepAngle * clampedPct;

  function polarToCart(angle: number) {
    return {
      x: cx + r * Math.cos(angle - Math.PI / 2),
      y: cy + r * Math.sin(angle - Math.PI / 2),
    };
  }

  const bgStart = polarToCart(startAngle - Math.PI / 2);
  const bgEnd = polarToCart(startAngle - Math.PI / 2 + sweepAngle);
  const fgEnd = polarToCart(endAngle - Math.PI / 2);

  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;
  const fgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${clampedPct > 0.5 ? 1 : 0} 1 ${fgEnd.x} ${fgEnd.y}`;

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative">
        <svg width="108" height="108" viewBox="0 0 108 108">
          {/* Bg track */}
          <path
            d={bgPath}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Animated foreground arc */}
          <motion.path
            d={fgPath}
            fill="none"
            stroke={arcColor}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
            style={{ filter: `drop-shadow(0 0 6px ${arcColor}88)` }}
          />
          {/* Score number */}
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="26"
            fontWeight="800"
            fontFamily="ui-monospace, monospace"
          >
            {animated}
          </text>
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="10"
            fontWeight="500"
          >
            /100
          </text>
        </svg>
      </div>
      <p className="text-xs text-muted-foreground tracking-widest uppercase">درجة الأداء</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  manifest: ReportManifest | null;
  isGenerating: boolean;
  collectedData: CollectedData | null;
}

export function BusinessSidebar({ manifest, isGenerating, collectedData }: Props) {
  const meta = manifest?.metadata;
  const directive = manifest?.directive;
  const status = directive?.overallStatus;
  const statusCfg = status ? STATUS_CFG[status] : null;
  const pd = collectedData?.placeDetails;

  const [hoursOpen, setHoursOpen] = useState(false);

  return (
    <Sidebar
      side="left"
      dir="rtl"
      collapsible="none"
      className="border-l border-white/6 bg-[#050505]"
    >
      <SidebarHeader className="border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="CBO.AI"
            className="h-18 w-auto mx-auto"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isGenerating && !meta && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="space-y-3 px-1 py-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                {/* Arc skeleton */}
                <Skeleton className="mx-auto h-24 w-24 rounded-full" />
                <Skeleton className="h-4 w-20 mx-auto" />
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Business Profile ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {meta && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <SidebarGroup className="pb-0">
                {/* Photo */}
                {meta.photoUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-3 overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={meta.photoUrl}
                      alt={meta.displayName ?? meta.businessName}
                      className="h-36 w-full object-cover"
                    />
                  </motion.div>
                )}

                <motion.div
                  className="space-y-1 px-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  {/* Name */}
                  <h2 className="text-sm font-bold leading-snug text-foreground">
                    {meta.displayName ?? meta.businessName}
                  </h2>

                  {/* Address */}
                  {meta.address && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 size-3 shrink-0" />
                      <span className="line-clamp-2 leading-relaxed">{meta.address}</span>
                    </div>
                  )}

                  {/* Rating */}
                  {(meta.rating != null || meta.reviewCount != null) && (
                    <div className="flex items-center gap-2 text-xs">
                      {meta.rating != null && (
                        <span className="flex items-center gap-1 font-semibold text-amber-400">
                          <Star className="size-3 fill-amber-400" />
                          {meta.rating.toFixed(1)}
                        </span>
                      )}
                      {meta.reviewCount != null && (
                        <span className="text-muted-foreground">
                          ({meta.reviewCount.toLocaleString()} تقييم)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Place details */}
                  {pd && (
                    <div className="pt-1 space-y-1">
                      {pd.phone && (
                        <a
                          href={`tel:${pd.phone}`}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone className="size-3 shrink-0" />
                          <span dir="ltr">{pd.phone}</span>
                        </a>
                      )}
                      {pd.website && (
                        <a
                          href={pd.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Globe className="size-3 shrink-0" />
                          <span className="line-clamp-1 break-all">
                            {pd.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </span>
                        </a>
                      )}
                      {pd.priceLevel && (
                        <p className="text-xs text-muted-foreground">
                          {PRICE_LABELS[pd.priceLevel] ?? pd.priceLevel}
                        </p>
                      )}
                      {pd.openingHours && pd.openingHours.length > 0 && (
                        <div>
                          <button
                            onClick={() => setHoursOpen((v) => !v)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Clock className="size-3 shrink-0" />
                            <span>أوقات العمل</span>
                            {hoursOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          </button>
                          <AnimatePresence>
                            {hoursOpen && (
                              <motion.ul
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="mt-1 space-y-0.5 pr-5 overflow-hidden"
                              >
                                {pd.openingHours.map((day, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">
                                    {day}
                                  </li>
                                ))}
                              </motion.ul>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* ── Health Score Arc (hero element) ───────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm"
                  style={{
                    boxShadow: statusCfg
                      ? `inset 0 0 40px ${statusCfg.arcBg}`
                      : undefined,
                  }}
                >
                  <HealthArc
                    score={meta.healthScore}
                    arcColor={statusCfg?.arc ?? "#2E5BFF"}
                  />
                  {statusCfg && (
                    <div className="pb-3 flex justify-center">
                      <Badge
                        className={`border text-xs font-semibold ${statusCfg.cls}`}
                        style={{ boxShadow: statusCfg.glow }}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>
                  )}
                </motion.div>

                {/* ── North Star Metric ──────────────────────────────────────── */}
                {directive?.northStarMetric && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-3"
                  >
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      المؤشر الأساسي
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-snug mb-1">
                      {directive.northStarMetric.name}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black tabular-nums text-foreground">
                        {directive.northStarMetric.value.toLocaleString("ar-SA")}
                        {directive.northStarMetric.unit && (
                          <span className="text-sm font-normal text-muted-foreground ml-0.5">{directive.northStarMetric.unit}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        → {directive.northStarMetric.target.toLocaleString("ar-SA")}
                        {directive.northStarMetric.unit && (
                          <span className="ml-0.5">{directive.northStarMetric.unit}</span>
                        )}
                      </span>
                    </div>
                  </motion.div>
                )}
              </SidebarGroup>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Focus Areas ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {directive?.focusAreas && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
                  محاور التركيز
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="space-y-2 px-1">
                    {[
                      { label: "الوضع المالي",  value: directive.focusAreas.financial, delay: 0.15 },
                      { label: "التواجد الرقمي", value: directive.focusAreas.digital,   delay: 0.22 },
                      { label: "السوق والمنافسة",  value: directive.focusAreas.market,    delay: 0.29 },
                    ].map((area) => (
                      <motion.div
                        key={area.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: area.delay }}
                        className="rounded-xl border border-white/6 bg-white/3 backdrop-blur-sm p-3"
                      >
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                          {area.label}
                        </p>
                        <div className="text-xs text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold">
                          <MessageResponse>{area.value}</MessageResponse>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Focus area skeletons while generating */}
        {isGenerating && !directive?.focusAreas && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
              محاور التركيز
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-2 px-1">
                {["المالي", "الرقمي", "السوق"].map((label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                      {label}
                    </p>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Empty state */}
        {!meta && !isGenerating && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-1 py-8 text-center">
                <motion.div
                  animate={{ opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <TrendingUp className="mx-auto mb-3 size-8 text-primary" />
                </motion.div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  أدخل بيانات عملك
                  <br />
                  لبدء التحليل
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
