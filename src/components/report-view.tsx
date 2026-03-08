"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  MapPin,
  BarChart3,
  ShoppingBag,
  Users,
  Loader2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Activity,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ReportData, ParsedReport, ProgressiveSections } from "@/app/page";
import { Streamdown } from "streamdown";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: decimals });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function sar(n: number): string {
  return `${fmt(Math.round(n))} ر.س`;
}

// ── Step navigation ───────────────────────────────────────────────────────────

const NAV_STEPS = [
  { id: "header",           label: "نظرة عامة",      icon: BarChart3 },
  { id: "health-score",     label: "صحة العمل",       icon: Activity },
  { id: "financials",       label: "الوضع المالي",    icon: TrendingUp },
  { id: "digital-presence", label: "الحضور الرقمي",   icon: Star },
  { id: "benchmarks",       label: "مقارنة السوق",    icon: Users },
  { id: "assessment",       label: "التقييم",          icon: Lightbulb },
  { id: "action-plan",      label: "خطة العمل",       icon: Zap },
] as const;

type NavStepId = (typeof NAV_STEPS)[number]["id"];

function StepNav({
  activeId,
  availableIds,
  onStepClick,
}: {
  activeId: NavStepId | null;
  availableIds: Set<string>;
  onStepClick: (id: string) => void;
}) {
  return (
    <nav
      className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none">
        {NAV_STEPS.map((step) => {
          const available = availableIds.has(step.id);
          const active = activeId === step.id;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => available && onStepClick(step.id)}
              disabled={!available}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : available
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "cursor-default text-muted-foreground/30"
              )}
            >
              <Icon className="size-3" />
              {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Narrative markdown block ──────────────────────────────────────────────────

function NarrativeBlock({ markdown }: { markdown: string }) {
  if (!markdown) return null;
  return (
    <div
      className="prose prose-sm dark:prose-invert mt-4 max-w-none text-right leading-relaxed"
      dir="rtl"
    >
      <Streamdown>{markdown}</Streamdown>
    </div>
  );
}

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  icon,
  children,
  isLoading,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-10 scroll-mt-14"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary/70">{icon}</span>
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {children}
    </motion.section>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  highlight?: "good" | "bad" | "neutral";
}) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        highlight === "good" &&
          "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-950/20",
        highlight === "bad" &&
          "border-red-200 bg-red-50/40 dark:border-red-800/40 dark:bg-red-950/20"
      )}
    >
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          highlight === "good" && "text-emerald-600 dark:text-emerald-400",
          highlight === "bad" && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </p>
      {sub && (
        <div className="mt-1 flex items-center gap-1">
          {trend && (
            <Icon
              className={cn(
                "size-3",
                trend === "up"
                  ? "text-emerald-500"
                  : trend === "down"
                  ? "text-red-500"
                  : "text-muted-foreground"
              )}
            />
          )}
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      )}
    </div>
  );
}

// ── Menu category badge ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  star: {
    label: "نجم ⭐",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  plowhorse: {
    label: "ثور 🐂",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  puzzle: {
    label: "لغز ❓",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  dog: {
    label: "كلب 🐕",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  },
};

function CategoryBadge({ cat }: { cat: string }) {
  const c = CATEGORY_LABELS[cat] ?? { label: cat, color: "" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        c.color
      )}
    >
      {c.label}
    </span>
  );
}

// ── Header Section ────────────────────────────────────────────────────────────

function HeaderSection({
  reportData,
  narrative,
}: {
  reportData: ReportData | null;
  narrative?: string;
}) {
  return (
    <Section id="header" title="نظرة عامة" icon={<BarChart3 className="size-5" />}>
      {reportData && (
        <div className="rounded-xl border bg-card p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 text-muted-foreground">اسم المنشأة</td>
                <td className="py-2 font-medium text-foreground">{reportData.businessName}</td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">نوع النشاط</td>
                <td className="py-2 text-foreground">
                  {reportData.businessType === "cafe"
                    ? "مقهى"
                    : reportData.businessType === "restaurant"
                    ? "مطعم"
                    : reportData.businessType === "cloud_kitchen"
                    ? "مطبخ سحابي"
                    : reportData.businessType === "fine_dining"
                    ? "مطعم فاخر"
                    : reportData.businessType}
                </td>
              </tr>
              {reportData.placeDetails?.formattedAddress && (
                <tr>
                  <td className="py-2 text-muted-foreground">العنوان</td>
                  <td className="py-2 text-foreground">
                    {reportData.placeDetails.formattedAddress}
                  </td>
                </tr>
              )}
              {reportData.placeDetails?.rating != null && (
                <tr>
                  <td className="py-2 text-muted-foreground">تقييم Google</td>
                  <td className="py-2">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="size-3.5 fill-current" />
                      <span className="font-medium text-foreground">
                        {reportData.placeDetails.rating.toFixed(1)}
                      </span>
                      {reportData.placeDetails.userRatingsTotal != null && (
                        <span className="text-xs text-muted-foreground">
                          ({fmt(reportData.placeDetails.userRatingsTotal)} تقييم)
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {narrative && <NarrativeBlock markdown={narrative} />}
    </Section>
  );
}

// ── Health Score Section ──────────────────────────────────────────────────────

function HealthScoreSection({
  reportData,
  narrative,
}: {
  reportData: ReportData | null;
  narrative?: string;
}) {
  // Derive a 0-100 health score from available KPIs
  const score = reportData
    ? (() => {
        let s = 50;
        // Net margin: good >10%, neutral 0-10%, bad <0
        if (reportData.netMargin > 0.1) s += 15;
        else if (reportData.netMargin > 0) s += 5;
        else s -= 15;
        // Above break-even
        if (reportData.isAboveBreakEven) s += 15;
        else s -= 10;
        // Contribution margin
        if (reportData.contributionMarginRatio > 0.4) s += 10;
        else if (reportData.contributionMarginRatio > 0.25) s += 5;
        // Google rating
        if ((reportData.placeDetails?.rating ?? 0) >= 4.5) s += 10;
        else if ((reportData.placeDetails?.rating ?? 0) >= 4.0) s += 5;
        return Math.min(100, Math.max(0, s));
      })()
    : null;

  const scoreColor =
    score == null
      ? "text-muted-foreground"
      : score >= 70
      ? "text-emerald-500"
      : score >= 45
      ? "text-amber-500"
      : "text-red-500";

  const scoreLabel =
    score == null
      ? "—"
      : score >= 70
      ? "ممتاز"
      : score >= 55
      ? "جيد"
      : score >= 40
      ? "متوسط"
      : "يحتاج تحسين";

  return (
    <Section id="health-score" title="صحة العمل" icon={<Activity className="size-5" />}>
      {score != null && (
        <div className="mb-4 flex items-center gap-6 rounded-xl border bg-card p-5">
          {/* Score circle */}
          <div className="relative flex size-24 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/30"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 276.5} 276.5`}
                className={scoreColor}
              />
            </svg>
            <div className="text-center">
              <p className={cn("text-2xl font-bold tabular-nums leading-none", scoreColor)}>
                {score}
              </p>
              <p className="text-[10px] text-muted-foreground">/ 100</p>
            </div>
          </div>
          {/* Summary */}
          <div>
            <p className={cn("text-xl font-bold", scoreColor)}>{scoreLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {reportData!.isAboveBreakEven
                ? "المنشأة تجاوزت نقطة التعادل"
                : "المنشأة لم تصل إلى نقطة التعادل"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
              <span>هامش الربح الصافي: <strong className="text-foreground">{pct(reportData!.netMargin)}</strong></span>
              <span>هامش المساهمة: <strong className="text-foreground">{pct(reportData!.contributionMarginRatio)}</strong></span>
            </div>
          </div>
        </div>
      )}
      {narrative && <NarrativeBlock markdown={narrative} />}
    </Section>
  );
}

// ── Financial Section ─────────────────────────────────────────────────────────

function FinancialSection({
  reportData,
  narrative,
}: {
  reportData: ReportData | null;
  narrative?: string;
}) {
  if (!reportData && !narrative) return null;

  return (
    <Section id="financials" title="الوضع المالي" icon={<TrendingUp className="size-5" />}>
      {reportData && (
        <>
          {/* KPI row */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="صافي الإيراد" value={sar(reportData.netRevenue)} trend="neutral" />
            <KpiCard
              label="هامش المساهمة"
              value={pct(reportData.contributionMarginRatio)}
              trend={reportData.contributionMarginRatio > 0.3 ? "up" : "down"}
              highlight={reportData.contributionMarginRatio > 0.3 ? "good" : "bad"}
            />
            <KpiCard
              label="صافي الربح"
              value={sar(reportData.netProfit)}
              sub={pct(reportData.netMargin) + " من الإيراد"}
              trend={reportData.netProfit > 0 ? "up" : "down"}
              highlight={
                reportData.netMargin > 0.1
                  ? "good"
                  : reportData.netMargin < 0
                  ? "bad"
                  : "neutral"
              }
            />
            <KpiCard
              label={reportData.isAboveBreakEven ? "فائض عن التعادل" : "عجز عن التعادل"}
              value={sar(Math.abs(reportData.breakEvenGap))}
              sub={reportData.isAboveBreakEven ? "فوق نقطة التعادل" : "دون نقطة التعادل"}
              trend={reportData.isAboveBreakEven ? "up" : "down"}
              highlight={reportData.isAboveBreakEven ? "good" : "bad"}
            />
          </div>

          {/* Cost breakdown */}
          <div className="mb-4 rounded-xl border bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              هيكل التكاليف
            </p>
            <div className="space-y-2.5">
              {[
                {
                  label: "التكاليف المتغيرة",
                  value: reportData.variableCosts,
                  share: reportData.variableCosts / reportData.totalCosts,
                },
                {
                  label: "التكاليف الثابتة",
                  value: reportData.fixedCosts,
                  share: reportData.fixedCosts / reportData.totalCosts,
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-foreground/70">{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {sar(row.value)}{" "}
                      <span className="text-muted-foreground/50">({pct(row.share)})</span>
                    </span>
                  </div>
                  <Progress value={row.share * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Products table */}
          <ProductTable data={reportData} />
        </>
      )}
      {narrative && <NarrativeBlock markdown={narrative} />}
    </Section>
  );
}

// ── Product Table (embedded in Financial section) ─────────────────────────────

type SortKey = "revenueRank" | "marginRank" | "revenueShare";

function ProductTable({ data }: { data: ReportData }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenueRank");
  const [filterCat, setFilterCat] = useState<string>("all");
  const categories = ["all", "star", "plowhorse", "puzzle", "dog"];

  const sorted = [...data.items]
    .filter((it) => filterCat === "all" || it.menuCategory === filterCat)
    .sort((a, b) => a[sortKey] - b[sortKey])
    .slice(0, 20);

  if (data.items.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingBag className="size-4 text-primary/70" />
        <p className="text-sm font-semibold text-foreground">تحليل المنتجات</p>
      </div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                filterCat === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat === "all" ? "الكل" : CATEGORY_LABELS[cat]?.label ?? cat}
            </button>
          ))}
        </div>
        <div className="mr-auto flex gap-1 text-[11px]">
          {(["revenueRank", "marginRank", "revenueShare"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                sortKey === k
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {k === "revenueRank" ? "الإيراد" : k === "marginRank" ? "الهامش" : "الحصة"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">المنتج</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">الإيراد</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">الحصة</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">الهامش/وحدة</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">التصنيف</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={item.name}
                className={cn(
                  "border-b last:border-0 transition-colors hover:bg-muted/20",
                  item.isBelowCost && "bg-red-50/30 dark:bg-red-950/10"
                )}
              >
                <td className="px-3 py-2 tabular-nums text-muted-foreground/50">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground">
                  {item.name}
                  {item.isBelowCost && (
                    <span className="mr-1 text-[10px] text-red-500">⚠</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {sar(item.totalRevenue)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Progress value={item.revenueShare * 100} className="h-1 w-12" />
                    <span className="tabular-nums text-muted-foreground">
                      {pct(item.revenueShare)}
                    </span>
                  </div>
                </td>
                <td
                  className={cn(
                    "px-3 py-2 tabular-nums",
                    item.contributionMarginPerUnit > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {sar(item.contributionMarginPerUnit)}
                </td>
                <td className="px-3 py-2">
                  <CategoryBadge cat={item.menuCategory} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length > 20 && (
        <p className="mt-2 text-center text-xs text-muted-foreground/50">
          يُعرض أول 20 منتج من {data.items.length}
        </p>
      )}
    </div>
  );
}

// ── Digital Presence Section ──────────────────────────────────────────────────

function DigitalPresenceSection({
  reportData,
  narrative,
}: {
  reportData: ReportData | null;
  narrative?: string;
}) {
  if (!reportData && !narrative) return null;

  const placeInfo = reportData?.reviews?.place_info;
  const reviews = reportData?.reviews?.reviews ?? [];

  // Star distribution
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating ?? 0) === star).length,
  }));
  const maxCount = Math.max(...dist.map((d) => d.count), 1);

  return (
    <Section id="digital-presence" title="الحضور الرقمي" icon={<Star className="size-5" />}>
      {reportData && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          {/* Overall rating */}
          {placeInfo && (
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                التقييم الإجمالي
              </p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-amber-500">
                  {(placeInfo.rating ?? 0).toFixed(1)}
                </span>
                <div className="mb-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          "size-4",
                          s <= Math.round(placeInfo.rating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmt(placeInfo.reviews ?? 0)} تقييم
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Star distribution */}
          {reviews.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                توزيع النجوم
              </p>
              <div className="space-y-1.5">
                {dist.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-4 text-right text-xs text-muted-foreground">{star}</span>
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-amber-400 transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 text-xs tabular-nums text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sample reviews */}
      {reviews.length > 0 && (
        <div className="mb-4 space-y-2">
          {reviews.slice(0, 4).map((r, i) => (
            <div key={i} className="rounded-lg border bg-card p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-foreground/80">{r.user?.name ?? "—"}</span>
                {r.rating != null && (
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star className="size-3 fill-current" />
                    <span className="text-foreground">{r.rating}</span>
                  </span>
                )}
              </div>
              <p className="line-clamp-2 leading-relaxed text-muted-foreground">{r.snippet}</p>
            </div>
          ))}
        </div>
      )}

      {narrative && <NarrativeBlock markdown={narrative} />}
    </Section>
  );
}

// ── Benchmarks (Competitors) Section ─────────────────────────────────────────

function BenchmarksSection({
  reportData,
  narrative,
}: {
  reportData: ReportData | null;
  narrative?: string;
}) {
  if (!reportData && !narrative) return null;

  const competitors = reportData
    ? [...reportData.nearbyCompetitors]
        .sort((a, b) => {
          const scoreA = (a.rating ?? 0) * Math.log((a.userRatingCount ?? 0) + 1);
          const scoreB = (b.rating ?? 0) * Math.log((b.userRatingCount ?? 0) + 1);
          return scoreB - scoreA;
        })
        .slice(0, 10)
    : [];

  const maxScore =
    competitors.length > 0
      ? (competitors[0]!.rating ?? 0) * Math.log((competitors[0]!.userRatingCount ?? 0) + 1)
      : 0;

  return (
    <Section id="benchmarks" title="مقارنة السوق" icon={<Users className="size-5" />}>
      {competitors.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">المنشأة</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">التقييم</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">المراجعات</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">قوة السمعة</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => {
                const name =
                  typeof c.displayName === "string"
                    ? c.displayName
                    : c.displayName?.text ?? "—";
                const score = (c.rating ?? 0) * Math.log((c.userRatingCount ?? 0) + 1);
                const barPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                return (
                  <tr key={c.id ?? i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground/50">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 shrink-0 text-muted-foreground/40" />
                        <span className="font-medium text-foreground">{name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {c.rating != null && (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="size-3 fill-current" />
                          <span className="tabular-nums text-foreground">
                            {c.rating.toFixed(1)}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {c.userRatingCount != null ? fmt(c.userRatingCount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary/60 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums text-muted-foreground/50">
                          {score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {narrative && <NarrativeBlock markdown={narrative} />}
    </Section>
  );
}

// ── Assessment Section ────────────────────────────────────────────────────────

function AssessmentSection({ narrative }: { narrative?: string }) {
  if (!narrative) return null;
  return (
    <Section id="assessment" title="التقييم الشامل" icon={<Lightbulb className="size-5" />}>
      <NarrativeBlock markdown={narrative} />
    </Section>
  );
}

// ── Action Plan Section ───────────────────────────────────────────────────────

type TacticalMove = {
  action: string;
  impact: string;
  deadline: string;
};

function ActionPlanSection({ 
  section 
}: { 
  section?: {
    title: string;
    conclusion: { text: string; severity: string };
    narrative: string;
    tacticalMoves?: TacticalMove[];
  }
}) {
  if (!section) return null;

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'high': return 'تأثير عالي';
      case 'medium': return 'تأثير متوسط';
      case 'low': return 'تأثير منخفض';
      default: return impact;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40';
      case 'warning': return 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40';
      case 'success': return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40';
      default: return 'bg-muted';
    }
  };

  const getTimelineCategory = (deadline: string) => {
    const d = deadline.toLowerCase();
    if (d.includes('1 week') || d.includes('أسبوع') || d.includes('فوري') || d.includes('3 days') || d.includes('يوم')) {
      return 'immediate';
    } else if (d.includes('2 week') || d.includes('شهر') || d.includes('month')) {
      return 'short';
    }
    return 'medium';
  };

  const moves = section.tacticalMoves || [];
  const immediate = moves.filter(m => getTimelineCategory(m.deadline) === 'immediate');
  const shortTerm = moves.filter(m => getTimelineCategory(m.deadline) === 'short');
  const mediumTerm = moves.filter(m => getTimelineCategory(m.deadline) === 'medium');

  return (
    <Section id="action-plan" title={section.title || "خطة العمل"} icon={<Zap className="size-5" />}>
      {/* Conclusion Alert */}
      {section.conclusion && (
        <div className={`rounded-lg p-4 mb-6 border ${getSeverityBg(section.conclusion.severity)}`}>
          <p className="text-sm">{section.conclusion.text}</p>
        </div>
      )}

      {/* Timeline View */}
      <div className="space-y-6">
        {immediate.length > 0 && (
          <TimelinePhase title="فوري (أسبوع 1)" moves={immediate} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} />
        )}
        {shortTerm.length > 0 && (
          <TimelinePhase title="قصير المدى (أسابيع 2-4)" moves={shortTerm} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} />
        )}
        {mediumTerm.length > 0 && (
          <TimelinePhase title="متوسط المدى (شهر 2-3)" moves={mediumTerm} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} />
        )}
      </div>

      {/* Narrative */}
      {section.narrative && <NarrativeBlock markdown={section.narrative} />}
    </Section>
  );
}

function TimelinePhase({ 
  title, 
  moves, 
  getImpactColor,
  getImpactLabel
}: { 
  title: string, 
  moves: TacticalMove[],
  getImpactColor: (impact: string) => string,
  getImpactLabel: (impact: string) => string
}) {
  return (
    <div className="border-r-2 border-primary/30 pr-4 space-y-3">
      <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">{title}</h4>
      {moves.map((move, i) => (
        <div key={i} className="flex items-start gap-3 bg-card p-3 rounded-lg border">
          <div className={`size-2 rounded-full mt-2 shrink-0 ${getImpactColor(move.impact)}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">{move.action}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getImpactLabel(move.impact)} • {move.deadline}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Generating placeholder ────────────────────────────────────────────────────

function GeneratingPlaceholder({ businessName }: { businessName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-foreground">جارٍ تحليل {businessName}</h2>
      <p className="text-sm text-muted-foreground">يتم جمع البيانات وتحليلها…</p>
    </div>
  );
}

// ── Full markdown fallback (collapsible) ──────────────────────────────────────

function MarkdownFallback({
  markdown,
  isGenerating,
  forceExpanded = false,
}: {
  markdown: string | null;
  isGenerating: boolean;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(forceExpanded);
  if (!markdown && !isGenerating) return null;

  return (
    <Section id="full-report" title="التقرير الكامل" icon={<BarChart3 className="size-5" />}>
      <div className="rounded-xl border bg-card">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>{expanded ? "إخفاء التقرير" : "عرض التقرير النصي الكامل"}</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t px-4 py-4">
                {isGenerating && !markdown && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>جارٍ إنشاء التقرير…</span>
                  </div>
                )}
                {markdown && (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-right"
                    dir="rtl"
                  >
                    <Streamdown>{markdown}</Streamdown>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}

// ── Report View (main export) ─────────────────────────────────────────────────

export function ReportView({
  reportData,
  progressiveSections,
  parsedReport,
  reportMarkdown,
  isGenerating,
  businessName,
  manifest,
}: {
  reportData: ReportData | null;
  progressiveSections: ProgressiveSections;
  parsedReport: ParsedReport;
  reportMarkdown: string | null;
  isGenerating: boolean;
  businessName: string;
  manifest?: {
    metadata: { businessName: string; businessType: string; generatedAt: string; healthScore: number };
    directive: { theme: string; northStarMetric: { name: string; value: number; target: number; rationale: string }; focusAreas: { financial: string; digital: string; market: string }; overallStatus: string };
    sections: Array<{ id: string; title: string; conclusion: { text: string; severity: string }; visuals: any[]; narrative: string; tacticalMoves?: Array<{ action: string; impact: string; deadline: string }> }>;
  };
}) {
  const { sections } = parsedReport;

  // Merge: prefer parsed sections (from compose-report); fall back to progressive sections
  const financialsNarrative =
    sections["financials"] ?? progressiveSections.financialsSection;
  const digitalNarrative =
    sections["digital-presence"] ?? progressiveSections.digitalPresenceSection;
  const benchmarksNarrative =
    sections["benchmarks"] ?? progressiveSections.benchmarksSection;

  // A section is "available" if it has structured data OR narrative text
  const availableIds = new Set<string>();
  if (reportData || sections["header"]) availableIds.add("header");
  if (reportData || sections["health-score"]) availableIds.add("health-score");
  if (reportData || financialsNarrative) availableIds.add("financials");
  if (reportData || digitalNarrative) availableIds.add("digital-presence");
  if (reportData || benchmarksNarrative) availableIds.add("benchmarks");
  if (sections["assessment"]) availableIds.add("assessment");
  if (sections["action-plan"]) availableIds.add("action-plan");

  const hasAnyContent = availableIds.size > 0 || !!reportMarkdown || isGenerating;

  // Intersection observer for active nav step
  const [activeId, setActiveId] = useState<NavStepId | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    const ids = NAV_STEPS.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id as NavStepId);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [availableIds.size]); // re-run when new sections appear

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Show placeholder if nothing to show yet
  if (!hasAnyContent) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">لا يوجد تقرير بعد</p>
      </div>
    );
  }

  // Pure generating state — no data of any kind yet
  if (!reportData && !reportMarkdown && isGenerating && availableIds.size === 0) {
    return <GeneratingPlaceholder businessName={businessName} />;
  }

  // Reload case: have markdown but no parsed sections — render it directly, skip nav bar
  if (reportMarkdown && availableIds.size === 0 && !isGenerating) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8" dir="rtl">
          <div className="prose prose-sm dark:prose-invert max-w-none text-right leading-relaxed">
            <Streamdown>{reportMarkdown}</Streamdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Step navigation bar */}
      {availableIds.size > 0 && (
        <StepNav
          activeId={activeId}
          availableIds={availableIds}
          onStepClick={scrollToSection}
        />
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8" dir="rtl">
          <AnimatePresence mode="popLayout">
            {/* Header section */}
            {(reportData || sections["header"]) && (
              <HeaderSection
                key="header"
                reportData={reportData}
                narrative={sections["header"]}
              />
            )}

            {/* Health score */}
            {(reportData || sections["health-score"]) && (
              <HealthScoreSection
                key="health-score"
                reportData={reportData}
                narrative={sections["health-score"]}
              />
            )}

            {/* Financials (includes product table) */}
            {(reportData || financialsNarrative) && (
              <FinancialSection
                key="financials"
                reportData={reportData}
                narrative={financialsNarrative}
              />
            )}

            {/* Digital presence (reviews + social) */}
            {(reportData || digitalNarrative) && (
              <DigitalPresenceSection
                key="digital-presence"
                reportData={reportData}
                narrative={digitalNarrative}
              />
            )}

            {/* Market benchmarks (competitors) */}
            {(reportData || benchmarksNarrative) && (
              <BenchmarksSection
                key="benchmarks"
                reportData={reportData}
                narrative={benchmarksNarrative}
              />
            )}

            {/* Assessment */}
            {sections["assessment"] && (
              <AssessmentSection key="assessment" narrative={sections["assessment"]} />
            )}

            {/* Action plan */}
            {manifest?.sections.find(s => s.id === 'action-plan') && (
              <ActionPlanSection 
                key="action-plan" 
                section={manifest.sections.find(s => s.id === 'action-plan')} 
              />
            )}
          </AnimatePresence>

          {/* Generating spinner at bottom when still loading and we have partial data */}
          {isGenerating && availableIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              <span>جارٍ إكمال التحليل…</span>
            </motion.div>
          )}

          {/* Full markdown fallback — shown expanded when no parsed sections available (e.g. on reload) */}
          {Object.keys(sections).length === 0 && reportMarkdown && (
            <MarkdownFallback markdown={reportMarkdown} isGenerating={false} forceExpanded />
          )}
        </div>
      </div>
    </div>
  );
}
