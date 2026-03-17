"use client";
import { useState } from "react";
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
import { ArrowLeft } from "lucide-react";

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

// ── Tab icon map — fixed per section ID ──────────────────────────────────────

const SECTION_ICON_MAP: Record<string, { icon: LucideIcon; className: string }> = {
  financials:    { icon: DollarSign, className: "size-4 text-emerald-500" },
  digital:       { icon: Globe,      className: "size-4 text-blue-500"    },
  market:        { icon: BarChart3,  className: "size-4 text-orange-500"  },
  "action-plan": { icon: Target,     className: "size-4 text-primary"     },
  performance:   { icon: Activity,   className: "size-4 text-muted-foreground" },
};

function TabIcon({ sectionId }: { sectionId: string }) {
  const cfg = SECTION_ICON_MAP[sectionId] ?? { icon: Activity, className: "size-4 text-muted-foreground" };
  const Icon = cfg.icon;
  return <Icon className={cfg.className} />;
}

// ── Conclusion — subtle inline treatment ─────────────────────────────────────

function ConclusionBadge({ conclusion }: { conclusion: ReportSection['conclusion'] }) {
  if (!conclusion) return null;
  
  // Use custom emoji if provided, otherwise use severity-based styling without icon
  const emoji = conclusion.emoji;
  
  const severityStyles = {
    success:  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
    warning:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
    critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
  };
  
  const style = severityStyles[conclusion.severity] || severityStyles.warning;
  
  return (
    <div className={cn("rounded-lg border p-4 mb-4", style.bg, style.border)}>
      <div className="flex items-start gap-3">
        {emoji && <span className="text-2xl">{emoji}</span>}
        <p className={cn("leading-relaxed flex-1", style.text)}>{conclusion.text}</p>
      </div>
    </div>
  );
}

// ── Citations ─────────────────────────────────────────────────────────────────

function Citations({ citations }: { citations?: string[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <p className="font-semibold text-muted-foreground mb-2">المصادر:</p>
      <ul className="text-muted-foreground space-y-1">
        {citations.map((cite, i) => (
          <li key={i}>• {cite}</li>
        ))}
      </ul>
    </div>
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
    label: b.platform === 'instagram' ? 'Instagram' : 'TikTok',
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

function RatingComparisonChart({ competitors, manifest, insight }: { competitors: CollectedCompetitor[]; manifest?: ReportManifest; insight: string }) {
  const businessName = manifest?.metadata?.displayName ?? manifest?.metadata?.businessName ?? 'مشروعك';
  const businessRating = manifest?.metadata?.rating;
  const data: Array<{ label: string; value: number }> = [];
  if (businessRating != null) data.push({ label: businessName, value: businessRating });
  for (const c of competitors.slice(0, 6)) {
    if (c.rating != null) data.push({ label: c.name, value: c.rating });
  }
  if (data.length === 0) return null;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">مقارنة التقييمات مع المنافسين</CardTitle>
      </CardHeader>
      <CardContent>
        <DataBarChart data={sorted} unit="★" highlightLabel={businessName} />
        <ChartInsight insight={insight} />
      </CardContent>
    </Card>
  );
}

function ReviewVolumeChart({ competitors, manifest, insight }: { competitors: CollectedCompetitor[]; manifest?: ReportManifest; insight: string }) {
  const businessName = manifest?.metadata?.displayName ?? manifest?.metadata?.businessName ?? 'مشروعك';
  const businessReviewCount = manifest?.metadata?.reviewCount;
  const data: Array<{ label: string; value: number }> = [];
  if (businessReviewCount != null) data.push({ label: businessName, value: businessReviewCount });
  for (const c of competitors.slice(0, 6)) {
    if (c.reviewCount != null) data.push({ label: c.name, value: c.reviewCount });
  }
  if (data.length === 0) return null;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">حجم التقييمات مقارنة بالمنافسين</CardTitle>
      </CardHeader>
      <CardContent>
        <DataBarChart data={sorted} valueLabel="عدد التقييمات" highlightLabel={businessName} />
        <ChartInsight insight={insight} />
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
    case 'rating-comparison':
      return <RatingComparisonChart competitors={collectedData.competitors} manifest={manifest} insight={chart.insight} />;
    case 'review-volume':
      return <ReviewVolumeChart competitors={collectedData.competitors} manifest={manifest} insight={chart.insight} />;
    default:
      return null;
  }
}

// ── Expected Outcomes (action plan KPI targets) ───────────────────────────────

function ExpectedOutcomesRow({ outcomes }: { outcomes: ExpectedOutcome[] }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-muted-foreground">النتائج المتوقعة</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {outcomes.map((o, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <p className="text-muted-foreground leading-snug mb-2">{o.metric}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="tabular-nums text-muted-foreground">{fmt(o.current, 1)} {o.unit}</span>
                <ArrowLeft className="size-3.5 text-muted-foreground shrink-0" />
                <span className="tabular-nums font-bold text-primary">{fmt(o.target, 1)} {o.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Action Plan ──────────────────────────────────────────────────────────────

const PHASE_PALETTE = [
  {
    dot:        'bg-rose-500',
    line:       'bg-rose-200 dark:bg-rose-900/40',
    headerBg:   'bg-rose-50/60 dark:bg-rose-950/10',
    taskBorder: 'border-rose-200 dark:border-rose-900/50',
    badge:      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    stepNum:    'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  },
  {
    dot:        'bg-amber-500',
    line:       'bg-amber-200 dark:bg-amber-900/40',
    headerBg:   'bg-amber-50/60 dark:bg-amber-950/10',
    taskBorder: 'border-amber-200 dark:border-amber-900/50',
    badge:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    stepNum:    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    dot:        'bg-emerald-500',
    line:       'bg-emerald-200 dark:bg-emerald-900/40',
    headerBg:   'bg-emerald-50/60 dark:bg-emerald-950/10',
    taskBorder: 'border-emerald-200 dark:border-emerald-900/50',
    badge:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    stepNum:    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
];

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
      <div className="space-y-5" dir="rtl">
        <ConclusionBadge conclusion={section.conclusion} />

        {(section.expectedOutcomes?.length ?? 0) > 0 && (
          <ExpectedOutcomesRow outcomes={section.expectedOutcomes!} />
        )}

        <div className="space-y-4">
          {section.phases!.map((phase, phaseIdx) => {
            const pal = PHASE_PALETTE[phaseIdx % PHASE_PALETTE.length];
            return (
              <motion.div
                key={phaseIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: phaseIdx * 0.08 }}
              >
                <Card className="gap-0 py-0 overflow-hidden">
                  <CardHeader className={cn("border-b py-3 px-4", pal.headerBg)}>
                    <div className="flex items-center gap-2">
                      <div className={cn("size-5 rounded-full flex items-center justify-center shrink-0", pal.dot)}>
                        <span className="text-[10px] font-bold text-white">{phaseIdx + 1}</span>
                      </div>
                      <CardTitle className="font-semibold leading-snug">{phase.title}</CardTitle>
                    </div>
                    <div className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium w-fit", pal.badge)}>
                      {phase.goal}
                    </div>
                  </CardHeader>

                  <CardContent className="p-0 divide-y divide-border">
                    {phase.tasks.map((task, taskIdx) => (
                      <div key={taskIdx} className={cn("px-4 py-3 border-r-2", pal.taskBorder)}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="font-semibold">{task.title}</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            pal.badge
                          )}>
                            <Clock className="size-3" />
                            {task.duration}
                          </span>
                        </div>
                        <p className="text-muted-foreground mb-1.5">الخطوات</p>
                        <ol className="space-y-1.5">
                          {task.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-2">
                              <span className={cn(
                                "mt-0.5 size-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                                pal.stepNum
                              )}>
                                {stepIdx + 1}
                              </span>
                              <p className="text-muted-foreground leading-snug">{step.text}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </CardContent>
                </Card>
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
    <div className="flex items-center gap-3 mb-4">
      <Separator className="flex-1" />
      <span className="text-muted-foreground shrink-0">{label}</span>
      <Separator className="flex-1" />
    </div>
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
          <div
            key={i}
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
              {fmt(kpi.value, kpi.unit === '%' ? 1 : 0)} {kpi.unit}
            </p>
          </div>
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
            <div
              className="bg-emerald-500"
              style={{ width: `${safeCogsPct}%` }}
            />
            <div
              className="bg-blue-500"
              style={{ width: `${safeLaborPct}%` }}
            />
            <div
              className="bg-slate-200 dark:bg-slate-800"
              style={{ width: `${safeRemainingPct}%` }}
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profilePicUrl}
                alt={`@${profile.username}`}
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
            <p className={cn("text-4xl font-bold tabular-nums", scoreColor)}>{score}</p>
            <p className={cn("font-medium", scoreColor)}>{sentimentLabel}</p>
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground mb-1.5">مزاج العملاء</p>
            <Progress value={score} className="h-2" />
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
        <div key={i} className="rounded-lg border bg-background p-3 space-y-1.5">
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
        </div>
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
                    <span className="font-medium capitalize">{bench.platform === 'instagram' ? 'Instagram' : 'TikTok'}</span>
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

// ── Market: Competitor Table + Review Cards ───────────────────────────────────

function MarketDataSection({
  competitors,
  competitorReviews,
  marketData,
}: {
  competitors: CollectedCompetitor[];
  competitorReviews: CollectedCompetitorWithReviews[];
  marketData?: CollectedMarketData;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'rating' | 'reviews'>('rating');
  const itemsPerPage = 6;
  
  if (competitors.length === 0) return null;

  // Sort competitors by selected criteria
  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (sortBy === 'rating') {
      return (b.rating ?? 0) - (a.rating ?? 0);
    }
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  });

  const totalPages = Math.ceil(sortedCompetitors.length / itemsPerPage);
  const currentCompetitors = sortedCompetitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                <p className="text-sm text-muted-foreground">حصة السوق المحلية</p>
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

      {/* Unified Competitor Matrix Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base"> المنافسين ({competitors.length})</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('rating')}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  sortBy === 'rating' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background hover:bg-muted"
                )}
              >
                ★ ترتيب بالتقييم
              </button>
              <button
                onClick={() => setSortBy('reviews')}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  sortBy === 'reviews' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background hover:bg-muted"
                )}
              >
                📝 ترتيب بالمراجعات
              </button>
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
                <TableHead className="text-right">حصة السوق</TableHead>
                <TableHead className="text-right">السعر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentCompetitors.map((comp, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {comp.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comp.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
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
        <DataSectionHeading label="تحليل الذكاء الاصطناعي" />
      )}
      <SectionContent section={section} collectedData={collectedData} manifest={manifest} />
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs defaultValue={tabSections[0]?.id} className="flex flex-1 flex-col overflow-hidden">
        <div className="px-4 py-2">
          <TabsList className="w-full justify-start h-auto flex-wrap">
            {tabSections.map((section) => (
              <TabsTrigger key={section.id} value={section.id} className="gap-2">
                <TabIcon sectionId={section.id} />
                {section.title}
              </TabsTrigger>
            ))}
            {actionPlan && (
              <TabsTrigger value={actionPlan.id} className="gap-2">
                <TabIcon sectionId="action-plan" />
                {actionPlan.title}
              </TabsTrigger>
            )}
            <TabsTrigger value="performance" className="gap-2">
              <TabIcon sectionId="performance" />
              مراقبة الأداء
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto report-scroll">
          <div className="mx-auto max-w-4xl px-6 py-6">
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
                  />
                );
              }

              return (
                <TabsContent key={section.id} value={section.id} className="mt-0 py-6">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SectionWithData section={section} collectedContent={collectedContent} collectedData={collectedData} manifest={manifest} />
                  </motion.div>
                </TabsContent>
              );
            })}

            {actionPlan && (
              <TabsContent value={actionPlan.id} className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ActionPlanContent section={actionPlan} />
                </motion.div>
              </TabsContent>
            )}

            <TabsContent value="performance" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-24 text-center"
                dir="rtl"
              >
                <Activity className="size-10 mb-4 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">مراقبة الأداء</p>
                <p className="text-muted-foreground/60 mt-1">قريباً</p>
              </motion.div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
