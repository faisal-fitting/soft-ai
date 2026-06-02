"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const CompetitorMap = dynamic(
  () => import("@/components/competitor-map").then(m => m.CompetitorMap),
  { ssr: false }
);
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  DollarSign,
  Globe,
  BarChart3,
  Clock,
  Star,
  Users,
  Heart,
  Eye,
  MessageSquare,
  Instagram,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type {
  ReportManifest,
  ReportSection,
  ChartReference,
  ExpectedOutcome,
  CollectedData,
  CollectedFinancials,
  CollectedReviews,
  CollectedSocialProfile,
  CollectedSemantic,
  CollectedSocialAudit,
  CollectedCompetitor,
  CollectedCompetitorWithReviews,
  CollectedMarketData,
} from "@/lib/types";
import { MessageResponse } from "@/components/ai-elements/message";
import { DataBarChart } from "@/components/charts/bar-chart";
import { DataPieChart } from "@/components/charts/pie-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0, unit?: string): string {
  const formatted = n.toLocaleString("ar-SA", { maximumFractionDigits: decimals });
  return unit ? `${formatted} ${unit}` : formatted;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
  return n.toLocaleString("ar-SA");
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

function AnimatedNumber({ value, isPercent }: { value: number; isPercent?: boolean }) {
  const animated = useCountUp(value, 900);
  if (isPercent) return <>{animated.toFixed(1)}</>;
  return <>{Math.round(animated).toLocaleString("ar-SA")}</>;
}

// ── Tab icon map — fixed per section ID ──────────────────────────────────────

const SECTION_ICON_MAP: Record<string, { icon: LucideIcon; className: string }> = {
  financials:    { icon: DollarSign, className: "size-4 text-emerald-500" },
  digital:       { icon: Globe,      className: "size-4 text-cyan-500"    },
  market:        { icon: BarChart3,  className: "size-4 text-orange-500"  },
  "action-plan": { icon: Target,     className: "size-4 text-primary"     },
  performance:   { icon: Activity,   className: "size-4 text-muted-foreground" },
};

function TabIcon({ sectionId }: { sectionId: string }) {
  const cfg = SECTION_ICON_MAP[sectionId] ?? { icon: Activity, className: "size-4 text-muted-foreground" };
  const Icon = cfg.icon;
  return <Icon className={cfg.className} />;
}

// ── Conclusion — ambient section intro ───────────────────────────────────────

function ConclusionBadge({ conclusion }: { conclusion: ReportSection['conclusion'] }) {
  if (!conclusion) return null;
  return (
    <motion.div
      className="mb-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <MessageResponse>{conclusion.text}</MessageResponse>
    </motion.div>
  );
}

// ── Citations ─────────────────────────────────────────────────────────────────

function Citations({ citations }: { citations?: string[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <Collapsible className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronLeft className="size-3.5 transition-transform group-data-[state=open]:-rotate-90" />
        المصادر ({citations.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground border-r-2 border-white/[0.06] pr-3">
          {citations.map((cite, i) => (
            <li key={i}>
              {cite.startsWith('http') ? (
                <a href={cite} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground break-all transition-colors">
                  {cite}
                </a>
              ) : cite}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Narrative ────────────────────────────────────────────────────────────────

function NarrativeBlock({ markdown }: { markdown: string }) {
  if (!markdown) return null;
  return (
    <div className="mt-4 text-right leading-relaxed" dir="rtl">
      <MessageResponse>{markdown}</MessageResponse>
    </div>
  );
}

// ── Deterministic Chart Components ────────────────────────────────────────────

function ChartInsight({ insight }: { insight: string }) {
  return <p className="text-muted-foreground mt-3 leading-snug">{insight}</p>;
}

function RevenueVsBreakevenChart({ financials, insight }: { financials: CollectedFinancials; insight: string }) {
  const data = [
    { label: 'صافي الإيرادات', value: financials.netRevenue },
    { label: 'نقطة التعادل', value: financials.breakEvenRevenue },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">الإيرادات مقابل نقطة التعادل</CardTitle>
      </CardHeader>
      <CardContent>
        <DataBarChart data={data} unit="ر.س" />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function CostBreakdownChart({ financials, insight }: { financials: CollectedFinancials; insight: string }) {
  const COST_LABELS: Record<string, string> = {
    rawMaterials:         'المواد الخام',
    packaging:            'التغليف',
    productionStaffCosts: 'عمال الإنتاج',
    rent:                 'الإيجار',
    adminSalaries:        'رواتب الإدارة',
    adminExpenses:        'المنصرفات الإدارية',
    utilities:            'الكهرباء والماء',
    subscriptions:        'الاشتراكات',
    govFees:              'الرسوم الحكومية',
    serviceLaborCosts:    'عمال الخدمة',
    otherCosts:           'أخرى',
    advertising:          'الإعلانات',
  };
  const costFields = Object.keys(COST_LABELS) as (keyof CollectedFinancials)[];
  const data = costFields
    .map(k => ({ label: COST_LABELS[k], value: (financials[k] as number) ?? 0 }))
    .filter(d => d.value > 0);
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">تفصيل هيكل التكاليف</CardTitle>
      </CardHeader>
      <CardContent>
        <DataPieChart data={data} unit="ر.س" />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function MenuBcgChart({ items, insight }: { items: CollectedFinancials['items']; insight: string }) {
  const counts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
  for (const item of items) counts[item.menuCategory]++;
  const data = [
    { label: 'نجم ⭐', value: counts.star },
    { label: 'حصان 🐴', value: counts.plowhorse },
    { label: 'لغز ❓', value: counts.puzzle },
    { label: 'كلب 🐕', value: counts.dog },
  ].filter(d => d.value > 0);
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">توزيع هندسة القائمة (BCG)</CardTitle>
      </CardHeader>
      <CardContent>
        <DataPieChart data={data} />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function EngagementVsBenchmarkChart({ benchmarks, insight }: { benchmarks: CollectedData['socialAudit']['platformBenchmarks']; insight: string }) {
  if (benchmarks.length === 0) return null;
  const data = benchmarks.map(b => ({
    label: b.platform === 'instagram' ? 'انستقرام / Instagram' : 'تيك توك / TikTok',
    value: b.engagementRate,
    comparisonValue: b.benchmark,
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">معدل التفاعل مقابل المعيار السعودي</CardTitle>
      </CardHeader>
      <CardContent>
        <DataBarChart data={data} unit="%" valueLabel="معدلك" comparisonLabel="المعيار" />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function SentimentBreakdownChart({ themes, insight }: { themes: CollectedData['semantic']['themes']; insight: string }) {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const t of themes) counts[t.sentiment]++;
  const data = [
    { label: 'إيجابي', value: counts.positive },
    { label: 'سلبي', value: counts.negative },
    { label: 'محايد', value: counts.neutral },
  ].filter(d => d.value > 0);
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">توزيع انطباعات العملاء</CardTitle>
      </CardHeader>
      <CardContent>
        <DataPieChart data={data} />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function TopReviewTopicsChart({ topics, insight }: { topics: CollectedData['reviews']['topics']; insight: string }) {
  if (topics.length === 0) return null;
  const data = [...topics]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8)
    .map(t => ({ label: t.keyword, value: t.mentions }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">أكثر المواضيع ذكراً في التعليقات</CardTitle>
      </CardHeader>
      <CardContent>
        <DataBarChart data={data} valueLabel="عدد الذكر" />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

// ── Competitor Matrix Table ───────────────────────────────────────────────────

const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE:           'مجاني',
  PRICE_LEVEL_INEXPENSIVE:    'اقتصادي ﹩',
  PRICE_LEVEL_MODERATE:       'متوسط ﹩﹩',
  PRICE_LEVEL_EXPENSIVE:      'غالي ﹩﹩﹩',
  PRICE_LEVEL_VERY_EXPENSIVE: 'فاخر ﹩﹩﹩﹩',
};

function CompetitorMatrixTable({ competitors, manifest, insight }: { competitors: CollectedCompetitor[]; manifest?: ReportManifest; insight: string }) {
  const businessName = manifest?.metadata?.displayName ?? manifest?.metadata?.businessName ?? 'مشروعك';
  const businessRating = manifest?.metadata?.rating;
  const businessReviews = manifest?.metadata?.reviewCount;

  // Filter to direct competitors only for the matrix
  const directCompetitors = competitors.filter(c => c.competitorCategory === 'direct' || c.competitorCategory == null);

  // Build target business row
  const targetWeight = (businessReviews ?? 0) * (businessRating ?? 0);
  const competitorWeightSum = directCompetitors.reduce((sum, c) => sum + (c.reviewCount ?? 0) * (c.rating ?? 0), 0);
  const totalWeight = targetWeight + competitorWeightSum;
  const targetShare = totalWeight > 0 ? (targetWeight / totalWeight) * 100 : null;

  // All rows: target business first, then competitors sorted by localMarketShare desc
  type MatrixRow = { name: string; rating?: number; reviewCount?: number; marketShare?: number; priceLevel?: string; photoUrl?: string; isTarget: boolean };
  const rows: MatrixRow[] = [
    { name: businessName, rating: businessRating, reviewCount: businessReviews, marketShare: targetShare ?? undefined, isTarget: true },
    ...[...directCompetitors].sort((a, b) => (b.localMarketShare ?? 0) - (a.localMarketShare ?? 0)).map(c => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
      marketShare: c.localMarketShare,
      priceLevel: c.priceLevel,
      photoUrl: c.photoUrl,
      isTarget: false,
    })),
  ];

  if (rows.length <= 1 && !businessRating) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">مصفوفة المنافسين</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-12">صورة</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">التقييم</TableHead>
              <TableHead className="text-right">المراجعات</TableHead>
              <TableHead className="text-right">حصة السمعة</TableHead>
              <TableHead className="text-right">السعر</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} className={row.isTarget ? "border-r-2 border-r-primary bg-primary/[0.04]" : ""}>
                <TableCell>
                  {row.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Image src={row.photoUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-md object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted/50 flex items-center justify-center">
                      <Globe className="size-4 text-muted-foreground/50" />
                    </div>
                  )}
                </TableCell>
                <TableCell className={cn("font-medium", row.isTarget && "text-primary")}>
                  {row.name}
                  {row.isTarget && <span className="mr-1.5 text-[10px] text-primary/70 font-normal">← أنت</span>}
                </TableCell>
                <TableCell>
                  {row.rating != null ? (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      {row.rating.toFixed(1)}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.reviewCount != null ? row.reviewCount.toLocaleString('ar-SA') : '—'}
                </TableCell>
                <TableCell>
                  {row.marketShare != null ? (
                    <span className={cn(
                      "tabular-nums font-medium",
                      row.isTarget ? "text-primary" : row.marketShare > 15 ? "text-emerald-500" : row.marketShare > 8 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {row.marketShare.toFixed(1)}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {row.priceLevel ? (PRICE_LEVEL_LABELS[row.priceLevel] ?? row.priceLevel) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4 py-2.5 border-t space-y-1">
          <ChartInsight insight={insight} />
          <p className="text-[11px] text-muted-foreground/60" dir="rtl">مصفوفة المنافسين المباشرين فقط</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── ChartFromData dispatcher ──────────────────────────────────────────────────

function ChartFromData({
  chart,
  collectedData,
  manifest,
}: {
  chart: ChartReference;
  collectedData?: CollectedData;
  manifest?: ReportManifest;
}) {
  if (!collectedData) return null;
  switch (chart.dataSource) {
    case 'revenue-vs-breakeven':
      return <RevenueVsBreakevenChart financials={collectedData.financials} insight={chart.insight} />;
    case 'cost-breakdown':
      return <CostBreakdownChart financials={collectedData.financials} insight={chart.insight} />;
    case 'menu-bcg-distribution':
      return <MenuBcgChart items={collectedData.financials.items} insight={chart.insight} />;
    case 'engagement-vs-benchmark':
      return <EngagementVsBenchmarkChart benchmarks={collectedData.socialAudit.platformBenchmarks} insight={chart.insight} />;
    case 'sentiment-breakdown':
      return <SentimentBreakdownChart themes={collectedData.semantic.themes} insight={chart.insight} />;
    case 'top-review-topics':
      return <TopReviewTopicsChart topics={collectedData.reviews.topics} insight={chart.insight} />;
    case 'competitor-matrix':
      return <CompetitorMatrixTable competitors={collectedData.competitors} manifest={manifest} insight={chart.insight} />;
    default:
      return null;
  }
}

// ── Expected Outcomes (action plan KPI targets) ───────────────────────────────

function ExpectedOutcomesRow({ outcomes }: { outcomes: ExpectedOutcome[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">النتائج المتوقعة</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {outcomes.map((o, i) => {
          const isIncrease = o.target > o.current;
          const delta = o.current > 0 ? ((o.target - o.current) / o.current * 100) : 0;
          const progressPct = o.target > 0 ? Math.min((o.current / o.target) * 100, 100) : 0;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3"
            >
              <p className="text-xs text-muted-foreground leading-snug">{o.metric}</p>
              <div>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  <AnimatedNumber value={o.target} isPercent={o.unit === '%'} />
                  <span className="text-sm font-medium text-muted-foreground mr-1">{o.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  من {fmt(o.current, 1)} {o.unit}
                </p>
              </div>
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.07, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    isIncrease ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {isIncrease ? "+" : ""}{delta.toFixed(0)}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Action Plan ──────────────────────────────────────────────────────────────

const PHASE_PALETTE = [
  {
    color:      "#f43f5e",
    glow:       "rgba(244,63,94,0.18)",
    dotCls:     "bg-rose-500",
    badge:      "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    stepNum:    "bg-rose-500/10 text-rose-400",
    taskBorder: "border-r-rose-500/40",
    accentBg:   "bg-rose-500/[0.04]",
    accentBorder: "border-rose-500/20",
  },
  {
    color:      "#f59e0b",
    glow:       "rgba(245,158,11,0.18)",
    dotCls:     "bg-amber-500",
    badge:      "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    stepNum:    "bg-amber-500/10 text-amber-400",
    taskBorder: "border-r-amber-500/40",
    accentBg:   "bg-amber-500/[0.04]",
    accentBorder: "border-amber-500/20",
  },
  {
    color:      "#10b981",
    glow:       "rgba(16,185,129,0.18)",
    dotCls:     "bg-emerald-500",
    badge:      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    stepNum:    "bg-emerald-500/10 text-emerald-400",
    taskBorder: "border-r-emerald-500/40",
    accentBg:   "bg-emerald-500/[0.04]",
    accentBorder: "border-emerald-500/20",
  },
];

// ── Impact config ─────────────────────────────────────────────────────────────

const IMPACT_CFG = {
  high:   { label: "تأثير عالٍ",    cls: "bg-rose-500/10 text-rose-400 border border-rose-500/20" },
  medium: { label: "تأثير متوسط",  cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  low:    { label: "تأثير منخفض", cls: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
} as const;

// ── Quick Wins ─────────────────────────────────────────────────────────────────

function QuickWinsSection({ moves }: { moves: NonNullable<ReportSection["tacticalMoves"]> }) {
  if (moves.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="size-3.5 text-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">تحركات سريعة</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {moves.map((move, i) => {
          const cfg = IMPACT_CFG[move.impact] ?? IMPACT_CFG.medium;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 flex flex-col gap-2.5"
            >
              <p className="text-sm leading-snug">{move.action}</p>
              <div className="flex items-center justify-between gap-2 mt-auto">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.cls)}>
                  {cfg.label}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-3" />
                  {move.deadline}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Strengths & Risks ──────────────────────────────────────────────────────────

function StrengthsRisksRow({ strengths, risks }: { strengths?: string[]; risks?: string[] }) {
  if ((!strengths || strengths.length === 0) && (!risks || risks.length === 0)) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(strengths?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/70">نقاط القوة</p>
          <ul className="space-y-1.5">
            {strengths!.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-sm text-foreground/80 leading-snug">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(risks?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400/70">نقاط الضعف</p>
          <ul className="space-y-1.5">
            {risks!.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-rose-400 mt-0.5 shrink-0" />
                <span className="text-sm text-foreground/80 leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type ParsedNarrative = {
  goal: string;
  phases: Array<{ title: string; targetGoal: string; body: string }>;
};

function parseNarrative(narrative: string): ParsedNarrative {
  const lines = narrative.split('\n');
  let goal = '';
  const phases: ParsedNarrative['phases'] = [];
  let current: { title: string; targetGoal: string; bodyLines: string[] } | null = null;
  const isPhaseHeading = (t: string) => /phase|مرحلة/i.test(t);
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) phases.push({ title: current.title, targetGoal: current.targetGoal, body: current.bodyLines.join('\n').trim() });
      const title = line.replace(/^##\s+/, '').trim();
      current = (!isPhaseHeading(title) && !phases.length && !goal)
        ? { title: '', targetGoal: '', bodyLines: [] }
        : { title, targetGoal: '', bodyLines: [] };
    } else if (current) {
      if (!current.title) { goal += (goal ? '\n' : '') + line; }
      else {
        const m = line.match(/\*{0,2}(?:Target Goal|الهدف المستهدف|الهدف التشغيلي|الهدف)[:\s*]+(.*)/i);
        if (m) current.targetGoal = m[1].replace(/\*+/g, '').trim();
        else current.bodyLines.push(line);
      }
    }
  }
  if (current?.title) phases.push({ title: current.title, targetGoal: current.targetGoal, body: current.bodyLines.join('\n').trim() });
  return { goal: goal.trim(), phases: phases.filter(p => p.title && (p.body || p.targetGoal)) };
}

function ActionPlanContent({ section }: { section: ReportSection }) {
  const hasStructuredPhases = (section.phases?.length ?? 0) > 0;

  if (hasStructuredPhases) {
    return (
      <div className="space-y-6" dir="rtl">
        {section.narrative && <NarrativeBlock markdown={section.narrative} />}

        <StrengthsRisksRow strengths={section.keyStrengths} risks={section.keyRisks} />

        {(section.expectedOutcomes?.length ?? 0) > 0 && (
          <ExpectedOutcomesRow outcomes={section.expectedOutcomes!} />
        )}

        {(section.tacticalMoves?.length ?? 0) > 0 && (
          <QuickWinsSection moves={section.tacticalMoves!} />
        )}

        {/* Phase timeline */}
        <div className="space-y-0">
          {section.phases!.map((phase, phaseIdx) => {
            const pal = PHASE_PALETTE[phaseIdx % PHASE_PALETTE.length];
            const totalTasks = phase.tasks.length;
            const isLast = phaseIdx === section.phases!.length - 1;
            return (
              <motion.div
                key={phaseIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: phaseIdx * 0.1 }}
              >
                {/* Row: number circle + card */}
                <div className="flex gap-4 items-stretch">

                  {/* Left column: circle + bridge */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                    {/* Glowing phase number circle */}
                    <motion.div
                      className={cn(
                        "size-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white z-10",
                        pal.dotCls
                      )}
                      style={{ boxShadow: `0 0 12px ${pal.glow}, 0 0 24px ${pal.glow}` }}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: phaseIdx * 0.1 + 0.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {String(phaseIdx + 1).padStart(2, "0")}
                    </motion.div>

                    {/* Bridge line between phases */}
                    {!isLast && (
                      <motion.div
                        className="w-px grow mt-1"
                        style={{
                          background: `linear-gradient(to bottom, ${pal.color}, ${PHASE_PALETTE[(phaseIdx + 1) % PHASE_PALETTE.length].color})`,
                          opacity: 0.25,
                        }}
                        initial={{ scaleY: 0, originY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.5, delay: phaseIdx * 0.1 + 0.3 }}
                      />
                    )}
                  </div>

                  {/* Right column: card + bottom gap */}
                  <div className={cn("flex-1 min-w-0", !isLast && "mb-3")}>
                    <div
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden"
                      style={{ boxShadow: `0 0 0 1px ${pal.glow}` }}
                    >
                      {/* Phase header */}
                      <div className={cn("px-5 py-4 border-b border-white/[0.06]", pal.accentBg)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <h3 className="font-semibold text-foreground leading-snug">{phase.title}</h3>
                            {phase.goal && (
                              <p className="text-sm text-foreground/60 leading-relaxed">{phase.goal}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground/50 mt-0.5">{totalTasks} مهام</span>
                        </div>
                      </div>

                      {/* Tasks */}
                      <Accordion type="single" collapsible defaultValue="task-0" className="divide-y divide-white/[0.04]">
                        {phase.tasks.map((task, taskIdx) => (
                          <AccordionItem key={taskIdx} value={`task-${taskIdx}`} className="border-b-0">
                            <AccordionTrigger className={cn(
                              "w-full flex items-center justify-between gap-3 px-5 py-3.5 text-right transition-colors hover:bg-white/[0.02] hover:no-underline",
                              "border-r-2", pal.taskBorder
                            )}>
                              <span className="font-medium text-sm leading-snug flex-1 text-right">{task.title}</span>
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                                pal.badge
                              )}>
                                <Clock className="size-2.5" />
                                {task.duration}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={cn("border-r-2", pal.taskBorder)}>
                              <div className="px-5 pb-4 pt-1">
                                <p className="text-xs text-muted-foreground/60 mb-2 uppercase tracking-wider">الخطوات</p>
                                <ol className="space-y-6">
                                  {task.steps.map((step, stepIdx) => (
                                    <li key={stepIdx} className="flex items-start gap-2.5">
                                      <span className={cn(
                                        "mt-0.5 size-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                                        pal.stepNum
                                      )}>
                                        {stepIdx + 1}
                                      </span>
                                      <p className="text-sm text-muted-foreground leading-snug">{step.text}</p>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: backward-compat for old narrative-based reports
  const { goal, phases: legacyPhases } = parseNarrative(section.narrative ?? '');
  const hasLegacyPhases = legacyPhases.length >= 1;

  return (
    <div className="space-y-5" dir="rtl">
      <ConclusionBadge conclusion={section.conclusion} />

      {(section.expectedOutcomes?.length ?? 0) > 0 && (
        <ExpectedOutcomesRow outcomes={section.expectedOutcomes!} />
      )}

      {goal && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="size-4 shrink-0 text-primary" />
            <p className="font-bold">الهدف الرئيسي</p>
          </div>
          <div className="leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_strong]:font-semibold [&_p]:m-0">
            <MessageResponse>{goal}</MessageResponse>
          </div>
        </div>
      )}

      {hasLegacyPhases && (
        <div className="relative">
          <div className="absolute top-4 bottom-4 right-[11px] w-0.5 bg-border" />
          <div className="space-y-4">
            {legacyPhases.map((phase, i) => {
              const pal = PHASE_PALETTE[i % PHASE_PALETTE.length];
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: i * 0.08 }} className="relative pr-8">
                  <div className="absolute right-0 top-4 size-[22px] rounded-full border-2 border-border bg-background flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                  </div>
                  <Card className="gap-0 py-0 overflow-hidden">
                    <CardHeader className={cn("border-b pt-4 items-center", pal.headerBg)}>
                      <CardTitle className="text-sm">{phase.title}</CardTitle>
                      <Badge variant="outline" className="shrink-0">المرحلة {i + 1}</Badge>
                      {phase.targetGoal && (
                        <CardDescription className="flex items-center gap-1"><Target className="size-3 shrink-0" />{phase.targetGoal}</CardDescription>
                      )}
                    </CardHeader>
                    {phase.body && (
                      <CardContent>
                        <div className="leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_ol]:list-decimal [&_ol]:pr-4 [&_ul]:list-disc [&_ul]:pr-4 [&_li]:mt-1">
                          <MessageResponse>{phase.body}</MessageResponse>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {!hasLegacyPhases && section.narrative && (
        <NarrativeBlock markdown={section.narrative} />
      )}
    </div>
  );
}

// ── Standard Section ──────────────────────────────────────────────────────────

function SectionContent({
  section,
  collectedData,
  manifest,
}: {
  section: ReportSection;
  collectedData?: CollectedData;
  manifest?: ReportManifest;
}) {
  return (
    <div className="space-y-6">
      <ConclusionBadge conclusion={section.conclusion} />

      {(section.charts?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-4">
          {section.charts!.map((chart, i) => (
            <ChartFromData key={i} chart={chart} collectedData={collectedData} manifest={manifest} />
          ))}
        </div>
      )}

      {/* Render bullet points if available */}
      {section.bulletPoints && section.bulletPoints.length > 0 && (
        <div className="space-y-2">
          {section.bulletPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-right" dir="rtl">
              <span className="text-primary mt-0.5">•</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      )}

      {section.narrative && <NarrativeBlock markdown={section.narrative} />}

      <Citations citations={section.citations} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Collected Data Section Components ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared: Section heading ───────────────────────────────────────────────────

function DataSectionHeading({ label }: { label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 mb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-primary/10" />
      <span
        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary/70"
        style={{ boxShadow: "0 0 12px rgba(46,91,255,0.15)" }}
      >
        <span className="tracking-wide pt-1">{label}</span>
        <span className="font-black tracking-[0.18em] text-primary pt-1">CBO.AI</span>
          <img src="/logo-icon.png" alt="CBO.AI" className="size-4 object-contain" />
      
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-primary/30 to-primary/10" />
    </motion.div>
  );
}

// ── Financials: KPI Row ───────────────────────────────────────────────────────

const MENU_CATEGORY_CFG = {
  star:      { label: 'نجم',    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  plowhorse: { label: 'حصان',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  puzzle:    { label: 'لغز',    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  dog:       { label: 'كلب',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function FinancialDataSection({ financials }: { financials: CollectedFinancials }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const cogsPct = financials.netRevenue > 0 ? ((financials.rawMaterials + financials.packaging) / financials.netRevenue) * 100 : 0;
  // Fallback to adminSalaries if direct labor is 0, so labor bar isn't empty when users lump all salaries
  const laborCost = (financials.productionStaffCosts + financials.serviceLaborCosts) > 0 
    ? (financials.productionStaffCosts + financials.serviceLaborCosts) 
    : financials.adminSalaries;
  const laborPct = financials.netRevenue > 0 ? (laborCost / financials.netRevenue) * 100 : 0;
  const totalPrimePct = cogsPct + laborPct;
  
  const safeCogsPct = Math.min(cogsPct, 100);
  const safeLaborPct = Math.min(laborPct, Math.max(0, 100 - safeCogsPct));
  const safeRemainingPct = Math.max(0, 100 - (safeCogsPct + safeLaborPct));

    const kpis = [
      { label: 'صافي الإيرادات',  value: financials.netRevenue,    unit: 'ر.س', highlight: false },
      { label: 'نقطة التعادل', value: financials.breakEvenRevenue, unit: 'ر.س',   highlight: financials.breakEvenRevenue > financials.netRevenue * 1.1 }, // Highlight if break-even is significantly above revenue
      {
      label: financials.isAboveBreakEven ? 'فوق نقطة التعادل' : 'تحت نقطة التعادل',
      value: Math.abs(financials.breakEvenGap),
      unit: 'ر.س',
      highlight: !financials.isAboveBreakEven,
      positive: financials.isAboveBreakEven,
    },
      {
        label: 'الهامش الصافي',   value: financials.netMargin,   unit: '%',   highlight: financials.netMargin < 5,
      },
    ];

  const sortedItems = [...financials.items].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const currentItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const bcgCounts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
  for (const item of sortedItems) bcgCounts[item.menuCategory]++;

  return (
    <div className="space-y-5" dir="rtl">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.07, ease: "easeOut" }}
            className={cn(
              "rounded-lg border bg-background p-3 text-center",
              kpi.highlight && "border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10",
              kpi.positive && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10",
            )}
          >
            <p className="text-muted-foreground">{kpi.label}</p>
            <p className={cn(
              "text-2xl font-bold mt-1 tabular-nums",
              kpi.highlight && "text-red-600 dark:text-red-400",
              kpi.positive && "text-emerald-600 dark:text-emerald-400",
            )}>
              <AnimatedNumber value={kpi.value} isPercent={kpi.unit === '%'} /> {kpi.unit}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Prime Cost Structure */}
      <div className="rounded-lg border bg-background p-4">
        <p className="font-semibold mb-3">مؤشرات التكلفة الأولية (Prime Cost)</p>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div>
            <p className="text-muted-foreground">تكلفة المواد</p>
            <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {cogsPct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">تكلفة العمالة</p>
            <p className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {laborPct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">التكلفة الإجمالية</p>
            <p className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {totalPrimePct.toFixed(1)}%
            </p>
          </div>
        </div>
        {financials.netRevenue > 0 && (
          <div className="flex rounded-full overflow-hidden h-2">
            <motion.div
              className="bg-emerald-500"
              initial={{ width: "0%" }}
              animate={{ width: `${safeCogsPct}%` }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            />
            <motion.div
              className="bg-blue-500"
              initial={{ width: "0%" }}
              animate={{ width: `${safeLaborPct}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            />
            <motion.div
              className="bg-slate-200 dark:bg-slate-800"
              initial={{ width: "0%" }}
              animate={{ width: `${safeRemainingPct}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            />
          </div>
        )}
        <div className="flex gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><span className="size-2 rounded-full bg-emerald-500 shrink-0" />مواد (COGS)</span>
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><span className="size-2 rounded-full bg-blue-500 shrink-0" />عمالة مباشرة</span>
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><span className="size-2 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />هامش متبقي</span>
        </div>
      </div>
      
      {/* Menu engineering table */}
      {sortedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">هندسة قائمة المنتجات</CardTitle>
                <CardDescription>تصنيف BCG لـ {sortedItems.length} منتج</CardDescription>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {bcgCounts.star > 0 && <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded px-2 py-0.5 text-xs font-medium">نجم: {bcgCounts.star}</span>}
                {bcgCounts.plowhorse > 0 && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded px-2 py-0.5 text-xs font-medium">حصان: {bcgCounts.plowhorse}</span>}
                {bcgCounts.puzzle > 0 && <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded px-2 py-0.5 text-xs font-medium">لغز: {bcgCounts.puzzle}</span>}
                {bcgCounts.dog > 0 && <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded px-2 py-0.5 text-xs font-medium">كلب: {bcgCounts.dog}</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الوحدات</TableHead>
                  <TableHead className="text-right">نسبة المبيعات</TableHead>
                  <TableHead className="text-right">نسبة الإيرادات</TableHead>
                  <TableHead className="text-right">هامش/وحدة</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((item, i) => {
                  const catCfg = MENU_CATEGORY_CFG[item.menuCategory];
                  return (
                    <TableRow key={i} className={cn(item.isBelowCost && "bg-red-50/40 dark:bg-red-950/10")}>
                      <TableCell className="font-medium">
                        <span>{item.name}</span>
                        {item.isBelowCost && (
                          <span className="mr-1.5 text-red-500 text-xs">• خسارة</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{fmt(item.sellingPrice)} ر.س</TableCell>
                      <TableCell className="tabular-nums">{fmt(item.soldUnits)}</TableCell>
                      <TableCell className="tabular-nums">{item.salesShare?.toFixed(1)}%</TableCell>
                      <TableCell className="tabular-nums">{item.revenueShare?.toFixed(1)}%</TableCell>
                      <TableCell className={cn(
                        "tabular-nums",
                        item.contributionMarginPerUnit < 0 ? "text-red-500" : "text-emerald-600"
                      )}>
                        {fmt(item.contributionMarginPerUnit, 1)} ر.س
                      </TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", catCfg.className)}>
                          {catCfg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  صفحة {currentPage} من {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ChevronRight className="size-4" />
                    السابق
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                  >
                    التالي
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Digital: Social Profiles + Posts + Sentiment + Reviews ───────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3",
            i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

function SocialProfileCard({ profile }: { profile: CollectedSocialProfile }) {
  const isInstagram = profile.platform === 'instagram';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Profile picture or platform icon fallback */}
            {profile.profilePicUrl ? (
              <Image
                src={profile.profilePicUrl}
                alt={`@${profile.username}`}
                width={64}
                height={64}
                className="size-16 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div className={cn(
                "size-10 rounded-full flex items-center justify-center shrink-0",
                isInstagram ? "bg-pink-100 dark:bg-pink-950/30" : "bg-slate-100 dark:bg-slate-800"
              )}>
                {isInstagram
                  ? <Instagram className="size-5 text-pink-500" />
                  : <span className="text-sm font-bold text-slate-600 dark:text-slate-300">TT</span>
                }
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                {isInstagram
                  ? <Instagram className="size-3.5 text-pink-500" />
                  : <span className="text-xs font-bold text-slate-500 dark:text-slate-400">TT</span>
                }
                <p className="font-semibold leading-tight">@{profile.username}</p>
                <span className="text-[10px] text-muted-foreground/70 font-normal">
                  {isInstagram ? 'انستقرام / Instagram' : 'تيك توك / TikTok'}
                </span>
                {profile.isVerified && (
                  <span className="text-blue-500 text-xs">✓</span>
                )}
              </div>
              {profile.bio && (
                <p className="text-muted-foreground mt-0.5">{profile.bio}</p>
              )}
            </div>
          </div>
          {profile.profileUrl && (
            <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-muted-foreground flex items-center justify-center gap-1"><Users className="size-3" />المتابعون</p>
            <p className="font-bold tabular-nums">{profile.followers != null ? fmtK(profile.followers) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">التفاعل</p>
            <p className="font-bold tabular-nums">
              {profile.engagementRate != null ? `${profile.engagementRate.toFixed(2)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">منشور/أسبوع</p>
            <p className="font-bold tabular-nums">
              {profile.postsPerWeek != null ? profile.postsPerWeek.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* Top posts — full card is clickable */}
        {profile.topPosts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-muted-foreground font-medium">أفضل المحتوى</p>
            <div className="space-y-2">
              {profile.topPosts.slice(0, 3).map((post, i) => {
                const inner = (
                  <>
                    {post.caption && (
                      <p className="text-sm leading-snug line-clamp-2">{post.caption}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {post.views != null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="size-3" />{fmtK(post.views)}
                        </span>
                      )}
                      {post.likes != null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Heart className="size-3" />{fmtK(post.likes)}
                        </span>
                      )}
                      {post.comments != null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="size-3" />{fmtK(post.comments)}
                        </span>
                      )}
                      <Badge variant="outline" className="h-4 px-1.5 text-xs">
                        {post.type === 'reel' ? 'ريل' : post.type === 'video' ? 'فيديو' : 'منشور'}
                      </Badge>
                    </div>
                  </>
                );

                return post.url ? (
                  <a
                    key={i}
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={i} className="rounded-md border bg-muted/20 p-2.5">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentSection({ semantic }: { semantic: CollectedSemantic }) {
  const score = semantic.sentimentScore;
  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = score >= 70 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40'
    : score >= 40 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40'
    : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40';

  const sentimentLabel = score >= 70 ? 'إيجابي' : score >= 40 ? 'محايد' : 'سلبي';

  const SENTIMENT_TAG_CFG = {
    positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    neutral:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className="space-y-4">
      {/* Score + critical weakness */}
      <div className="flex gap-3 flex-wrap">
        <div className={cn("rounded-lg border p-4 flex items-center gap-4 flex-1 min-w-fit", scoreBg)}>
          <div className="text-center">
            <motion.p
              className={cn("text-4xl font-bold tabular-nums", scoreColor)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatedNumber value={score} />
            </motion.p>
            <p className={cn("font-medium", scoreColor)}>{sentimentLabel}</p>
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground mb-1.5">مزاج العملاء</p>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
                )}
                initial={{ width: "0%" }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
              />
            </div>
            <p className="text-muted-foreground mt-1">من 100</p>
          </div>
        </div>
        {semantic.criticalWeakness && (
          <div className="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10 p-4 flex-1 min-w-48">
            <p className="text-red-600 font-medium flex items-center gap-1.5 mb-1">
              <XCircle className="size-4" />نقطة الضعف الحرجة
            </p>
            <p className="text-foreground">{semantic.criticalWeakness}</p>
          </div>
        )}
      </div>

      {/* Theme tags */}
      {semantic.themes.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 font-medium">أبرز المواضيع ({semantic.themes.length})</p>
          <div className="flex flex-wrap gap-2">
            {semantic.themes.map((theme, i) => (
              <button
                key={i}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium flex items-center gap-1.5",
                  SENTIMENT_TAG_CFG[theme.sentiment]
                )}
                title={theme.exampleSnippets?.[0]}
              >
                {theme.topic}
                <span className="opacity-70">·{theme.mentions}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewSamples({ reviews }: { reviews: CollectedReviews }) {
  if (reviews.samples.length === 0) return null;
  return (
    <div className="space-y-3">
      {reviews.samples.map((review, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
          className="rounded-lg border bg-background p-3 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="font-medium">{review.userName}</span>
            </div>
            <span className="text-muted-foreground">{review.date}</span>
          </div>
          {review.snippet && (
            <p className="text-muted-foreground leading-snug line-clamp-3">{review.snippet}</p>
          )}
          {review.details && (
            <div className="flex gap-2 flex-wrap pt-0.5">
              {review.details.food != null && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  الطعام {review.details.food}/5
                </span>
              )}
              {review.details.service != null && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  الخدمة {review.details.service}/5
                </span>
              )}
              {review.details.atmosphere != null && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  الأجواء {review.details.atmosphere}/5
                </span>
              )}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function DigitalDataSection({
  socialProfiles,
  semantic,
  reviews,
  socialAudit,
}: {
  socialProfiles: CollectedSocialProfile[];
  semantic: CollectedSemantic;
  reviews: CollectedReviews;
  socialAudit: CollectedSocialAudit;
}) {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Social profiles */}
      {socialProfiles.length > 0 && (
        <div className="space-y-3">
          <div className={cn(
            "grid gap-4",
            socialProfiles.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          )}>
            {socialProfiles.map((profile, i) => (
              <SocialProfileCard key={i} profile={profile} />
            ))}
          </div>

          {/* Platform benchmarks from social audit */}
          {socialAudit.platformBenchmarks.length > 0 && (
            <div className="grid gap-2">
              {socialAudit.platformBenchmarks.map((bench, i) => {
                const statusCfg = {
                  'above-benchmark': { label: 'فوق المعيار', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
                  'at-benchmark':    { label: 'عند المعيار', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'    },
                  'below-benchmark': { label: 'تحت المعيار', cls: 'text-red-600 bg-red-50 dark:bg-red-950/20'          },
                }[bench.status];
                return (
                  <div key={i} className="rounded-lg border bg-background px-3 py-2 flex items-center justify-between gap-3">
                    <span className="font-medium">{bench.platform === 'instagram' ? 'انستقرام / Instagram' : 'تيك توك / TikTok'}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground tabular-nums">
                        تفاعل {bench.engagementRate.toFixed(2)}% · معيار {bench.benchmark.toFixed(2)}%
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusCfg.cls)}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sentiment */}
      <SentimentSection semantic={semantic} />

      {/* Review samples */}
      {reviews.samples.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium text-muted-foreground">
            عينة من التقييمات ({reviews.totalFetched} إجمالاً)
          </p>
          <ReviewSamples reviews={reviews} />
        </div>
      )}
    </div>
  );
}

// ── Market: Market Summary + Competitor Review Cards ──────────────────────────

function MarketDataSection({
  competitors,
  competitorReviews,
  marketData,
  location,
  businessName,
}: {
  competitors: CollectedCompetitor[];
  competitorReviews: CollectedCompetitorWithReviews[];
  marketData?: CollectedMarketData;
  location?: { lat: number; lon: number; radius: number };
  businessName?: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'rating' | 'reviews'>('rating');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'direct' | 'indirect'>('all');
  const itemsPerPage = 6;

  if (competitors.length === 0) return null;

  // Apply category filter then sort
  const filteredCompetitors = categoryFilter === 'all'
    ? competitors
    : competitors.filter(c => c.competitorCategory === categoryFilter);

  const sortedCompetitors = [...filteredCompetitors].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  });

  const totalPages = Math.ceil(sortedCompetitors.length / itemsPerPage);
  const currentCompetitors = sortedCompetitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const directCount = competitors.filter(c => c.competitorCategory === 'direct').length;
  const indirectCount = competitors.filter(c => c.competitorCategory === 'indirect').length;

  const PRICE_LABELS: Record<string, string> = {
    PRICE_LEVEL_FREE:           'مجاني',
    PRICE_LEVEL_INEXPENSIVE:    'اقتصادي',
    PRICE_LEVEL_MODERATE:       'متوسط',
    PRICE_LEVEL_EXPENSIVE:      'غالي',
    PRICE_LEVEL_VERY_EXPENSIVE: 'فاخر جداً',
  };

  return (
    <div className="space-y-6" dir="rtl">

      {/* Market Share Summary */}
      {marketData && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">حصة السوق (السمعة)</p>
                <p className="text-2xl font-bold">{marketData.localMarketShare?.toFixed(1) ?? '—'}%</p>
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-sm text-muted-foreground">إجمالي تقييمات السوق</p>
                <p className="text-lg font-semibold">{marketData.totalMarketReviews?.toLocaleString('ar-SA') ?? '—'}</p>
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-sm text-muted-foreground">متوسط تقييم المنافسين</p>
                <p className="text-lg font-semibold">{marketData.averageCompetitorRating?.toFixed(1) ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Map */}
      {location && (
        <CompetitorMap
          businessName={businessName ?? ''}
          location={location}
          competitors={competitors}
        />
      )}

      {/* Unified Competitor Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">المنافسين ({filteredCompetitors.length}{categoryFilter !== 'all' ? ` من ${competitors.length}` : ''})</CardTitle>
            <div className="flex flex-wrap gap-2">
              {/* Category filter */}
              <div className="flex gap-1 rounded-lg border bg-muted/30 p-0.5">
                {([['all', `الكل (${competitors.length})`], ['direct', `مباشر (${directCount})`], ['indirect', `غير مباشر (${indirectCount})`]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setCategoryFilter(val); setCurrentPage(1); }}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-colors",
                      categoryFilter === val
                        ? val === 'direct' ? "bg-red-500/20 text-red-400 font-medium"
                          : val === 'indirect' ? "bg-amber-500/20 text-amber-400 font-medium"
                          : "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <div className="flex gap-1">
                <button
                  onClick={() => setSortBy('rating')}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md border transition-colors",
                    sortBy === 'rating' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  )}
                >
                  ★ التقييم
                </button>
                <button
                  onClick={() => setSortBy('reviews')}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md border transition-colors",
                    sortBy === 'reviews' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  )}
                >
                  📝 المراجعات
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-16">الصورة</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">التقييمات</TableHead>
                <TableHead className="text-right">حصة السوق (السمعة)</TableHead>
                <TableHead className="text-right">السعر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentCompetitors.map((comp, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {comp.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <Image src={comp.photoUrl} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Globe className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{comp.name}</TableCell>
                  <TableCell>
                    {comp.rating != null ? (
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        <span className="tabular-nums">{comp.rating.toFixed(1)}</span>
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {comp.reviewCount != null ? comp.reviewCount.toLocaleString('ar-SA') : '—'}
                  </TableCell>
                  <TableCell>
                    {comp.localMarketShare != null ? (
                      <span className={comp.localMarketShare > 10 ? "text-emerald-600 font-medium" : comp.localMarketShare > 5 ? "text-amber-600" : "text-muted-foreground"}>
                        {comp.localMarketShare.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {comp.priceLevel ? (PRICE_LABELS[comp.priceLevel] ?? comp.priceLevel) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                صفحة {currentPage} من {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronRight className="size-4" />
                  السابق
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                >
                  التالي
                  <ChevronLeft className="size-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top competitor review cards */}
      {competitorReviews.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium text-muted-foreground">تقييمات المنافسين الأبرز</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {competitorReviews.map((comp, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm leading-tight">{comp.name}</CardTitle>
                  {(comp.rating != null || comp.reviewCount != null) && (
                    <div className="flex items-center gap-2">
                      {comp.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="size-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm tabular-nums">{comp.rating.toFixed(1)}</span>
                        </span>
                      )}
                      {comp.reviewCount != null && (
                        <span className="text-muted-foreground text-sm">
                          ({comp.reviewCount.toLocaleString('ar-SA')} تقييم)
                        </span>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {comp.reviews.map((review, j) => (
                    <div key={j} className="rounded-md border bg-muted/20 p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <StarRating rating={review.rating} />
                        {review.date && <span className="text-muted-foreground text-xs">{review.date}</span>}
                      </div>
                      {review.snippet && (
                        <p className="text-muted-foreground text-xs line-clamp-3">{review.snippet}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper: collected data above + LLM content below ─────────────────

function SectionWithData({
  section,
  collectedContent,
  collectedData,
  manifest,
}: {
  section: ReportSection;
  collectedContent?: React.ReactNode;
  collectedData?: CollectedData;
  manifest?: ReportManifest;
}) {
  return (
    <div className="space-y-8">
      {collectedContent && (
        <div>{collectedContent}</div>
      )}
      {collectedContent && (
        <DataSectionHeading label="تحليل" />
      )}
      <SectionContent section={section} collectedData={collectedData} manifest={manifest} />
    </div>
  );
}

// ── Section navigation ────────────────────────────────────────────────────────

function SectionNav({
  prev,
  next,
  onNavigate,
  accent,
}: {
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
  onNavigate: (id: string) => void;
  accent: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-12 mb-2" dir="rtl">

      {/* Previous — right column in RTL, muted */}
      {prev ? (
        <motion.button
          onClick={() => onNavigate(prev.id)}
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-right hover:bg-white/[0.04] hover:border-white/[0.10] transition-colors"
        >
          <ChevronRight className="size-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">السابق</p>
            <div className="flex items-center gap-1.5">
              <TabIcon sectionId={prev.id} />
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">{prev.title}</p>
            </div>
          </div>
        </motion.button>
      ) : <div />}

      {/* Next — left column in RTL, accented */}
      {next ? (
        <motion.button
          onClick={() => onNavigate(next.id)}
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="group flex items-center gap-3 rounded-2xl border px-5 py-4 text-right transition-all"
          style={{
            borderColor: `${accent[next.id] ?? "#6b7280"}28`,
            backgroundColor: `${accent[next.id] ?? "#6b7280"}05`,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${accent[next.id] ?? "#6b7280"}50`;
            (e.currentTarget as HTMLElement).style.backgroundColor = `${accent[next.id] ?? "#6b7280"}0d`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${accent[next.id] ?? "#6b7280"}28`;
            (e.currentTarget as HTMLElement).style.backgroundColor = `${accent[next.id] ?? "#6b7280"}05`;
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] mb-1 text-left">التالي</p>
            <div className="flex items-center gap-1.5 justify-end">
              <TabIcon sectionId={next.id} />
              <p className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors truncate">{next.title}</p>
            </div>
          </div>
          <ChevronLeft
            className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
            style={{ color: accent[next.id] ?? "#6b7280" }}
          />
        </motion.button>
      ) : <div />}

    </div>
  );
}

// ── Report View (Main) ─────────────────────────────────────────────────────


export function ReportView({
  manifest,
  collectedData,
  isGenerating,
  businessName,
}: {
  manifest?: ReportManifest;
  collectedData?: CollectedData;
  isGenerating: boolean;
  businessName: string;
}) {
  const sections = manifest?.sections ?? [];

  if (!manifest && !isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">لا يوجد تقرير بعد</p>
      </div>
    );
  }

  const tabSections = sections.filter(s => s.id !== 'action-plan');
  const actionPlan = sections.find(s => s.id === 'action-plan');
  const [activeTab, setActiveTab] = useState(() => tabSections[0]?.id ?? "");

  // Per-section accent color for the sliding indicator
  const SECTION_ACCENT: Record<string, string> = {
    financials:    "#10b981",
    digital:       "#06b6d4",
    market:        "#f97316",
    "action-plan": "#2E5BFF",
  };

  // Ordered tab list for prev/next navigation
  const orderedTabs = [
    ...tabSections,
    ...(actionPlan ? [actionPlan] : []),
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className="px-2 py-1.5 flex-shrink-0 bg-white/[0.02] backdrop-blur-sm border-b border-white/[0.06]">
          <TabsList className="w-full justify-start gap-1 bg-transparent rounded-none p-1">

            {/* Data tabs */}
            {tabSections.map((section) => {
              const isActive = activeTab === section.id;
              const accent = SECTION_ACCENT[section.id] ?? "#6b7280";
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className={cn(
                    "relative h-9 rounded-md px-4 gap-2 text-sm transition-all duration-200",
                    isActive
                      ? "bg-white/[0.07] text-foreground shadow-sm border border-white/[0.08]"
                      : "bg-transparent text-muted-foreground border border-transparent hover:bg-white/[0.04] hover:text-foreground/70"
                  )}
                >
                  <TabIcon sectionId={section.id} />
                  {section.title}
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full"
                      style={{ backgroundColor: accent }}
                      transition={{ type: "tween", stiffness: 380, damping: 40 }}
                    />
                  )}
                </TabsTrigger>
              );
            })}

            {/* Separator before action plan */}
            {actionPlan && (
              <div className="mx-3 self-center h-4 w-px bg-white/[0.08]" />
            )}

            {/* Action plan — primary accent, visually distinct */}
            {actionPlan && (
              <TabsTrigger
                value={actionPlan.id}
                className={cn(
                  "relative h-9 rounded-md px-4 gap-2 text-sm transition-all duration-200",
                  activeTab === actionPlan.id
                    ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                    : "bg-transparent text-muted-foreground border border-transparent hover:bg-white/[0.04] hover:text-primary/70"
                )}
              >
                <TabIcon sectionId="action-plan" />
                {actionPlan.title}
                {activeTab === actionPlan.id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </TabsTrigger>
            )}

            {/* Performance — locked / coming soon */}
            <TabsTrigger
              value="performance"
              disabled
              className="relative h-9 rounded-md border border-transparent bg-transparent px-4 gap-2 text-sm text-muted-foreground/30 cursor-not-allowed"
            >
              <TabIcon sectionId="performance" />
              مراقبة الأداء
              <span className="text-[9px] font-bold tracking-widest bg-white/[0.05] border border-white/[0.07] px-1.5 py-0.5 rounded-full">
                قريباً
              </span>
            </TabsTrigger>

          </TabsList>
        </div>

        {/* ── Per-tab scroll contexts ───────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">

          {tabSections.map((section) => {
            let collectedContent: React.ReactNode = undefined;

            if (section.id === 'financials' && collectedData?.financials) {
              collectedContent = <FinancialDataSection financials={collectedData.financials} />;
            } else if (section.id === 'digital' && collectedData) {
              collectedContent = (
                <DigitalDataSection
                  socialProfiles={collectedData.socialProfiles}
                  semantic={collectedData.semantic}
                  reviews={collectedData.reviews}
                  socialAudit={collectedData.socialAudit}
                />
              );
            } else if (section.id === 'market' && collectedData) {
              collectedContent = (
                <MarketDataSection
                  competitors={collectedData.competitors}
                  competitorReviews={collectedData.competitorReviews}
                  marketData={collectedData.marketData}
                  location={collectedData.location}
                  businessName={manifest?.metadata?.businessName}
                />
              );
            }

            const idx = orderedTabs.findIndex(t => t.id === section.id);
            const prev = idx > 0 ? orderedTabs[idx - 1] : undefined;
            const next = idx < orderedTabs.length - 1 ? orderedTabs[idx + 1] : undefined;

            return (
              <TabsContent key={section.id} value={section.id} className="mt-0 h-full overflow-y-auto report-scroll">
                <div className="mx-auto max-w-4xl px-6 py-6">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SectionWithData section={section} collectedContent={collectedContent} collectedData={collectedData} manifest={manifest} />
                    <SectionNav prev={prev} next={next} onNavigate={setActiveTab} accent={SECTION_ACCENT} />
                  </motion.div>
                </div>
              </TabsContent>
            );
          })}

          {actionPlan && (() => {
            const idx = orderedTabs.findIndex(t => t.id === actionPlan.id);
            const prev = idx > 0 ? orderedTabs[idx - 1] : undefined;
            return (
              <TabsContent value={actionPlan.id} className="mt-0 h-full overflow-y-auto report-scroll">
                <div className="mx-auto max-w-4xl px-6 py-6">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ActionPlanContent section={actionPlan} />
                    <SectionNav prev={prev} next={undefined} onNavigate={setActiveTab} accent={SECTION_ACCENT} />
                  </motion.div>
                </div>
              </TabsContent>
            );
          })()}

          <TabsContent value="performance" className="mt-0 h-full">
            <motion.div
              className="flex h-full flex-col items-center justify-center gap-5 text-center"
              dir="rtl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="flex size-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Activity className="size-7 text-muted-foreground/40" />
              </motion.div>
              <div className="space-y-2">
                <p className="font-semibold text-muted-foreground/60">مراقبة الأداء</p>
                <p className="text-sm text-muted-foreground/40 max-w-xs leading-relaxed">
                  تتبع مؤشراتك الرئيسية بشكل مستمر مقارنةً بالأهداف والمنافسين
                </p>
                <span className="inline-block mt-1 text-xs font-bold tracking-widest bg-white/[0.04] border border-white/[0.07] px-3 py-1 rounded-full text-muted-foreground/30">
                  قريباً
                </span>
              </div>
            </motion.div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
