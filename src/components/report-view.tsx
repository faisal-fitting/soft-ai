"use client";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
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
  ReportVisual,
  CollectedData,
  CollectedFinancials,
  CollectedReviews,
  CollectedSocialProfile,
  CollectedSemantic,
  CollectedSocialAudit,
  CollectedCompetitor,
  CollectedCompetitorWithReviews,
} from "@/lib/types";
import { MessageResponse } from "@/components/ai-elements/message";
import { BarChartVisual } from "@/components/charts/bar-chart";
import { LineChartVisual } from "@/components/charts/line-chart";
import { PieChartVisual } from "@/components/charts/pie-chart";
import { RadarChartVisual } from "@/components/charts/radar-chart";

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
  const severityCfg = {
    success:  { icon: CheckCircle2,  className: "text-emerald-500" },
    warning:  { icon: AlertTriangle, className: "text-amber-500"   },
    critical: { icon: XCircle,       className: "text-red-500"     },
  }[conclusion.severity];
  const SeverityIcon = severityCfg.icon;
  return (
    <div className="flex items-start gap-2 mb-4 text-muted-foreground">
      <SeverityIcon className={cn("size-4 mt-0.5 shrink-0", severityCfg.className)} />
      <p className="leading-snug">{conclusion.text}</p>
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

// ── Visual Components ─────────────────────────────────────────────────────

function MetricGridVisual({ visual }: { visual: ReportVisual }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && <p className="text-muted-foreground">{visual.description}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visual.data.map((d, i) => {
            const hasCmp = d.comparisonValue != null;
            const diff = hasCmp ? d.value - d.comparisonValue! : null;
            const TrendIcon = diff && diff > 0 ? TrendingUp : diff && diff < 0 ? TrendingDown : Minus;

            return (
              <div key={i} className="rounded-lg border bg-background p-3 text-center">
                <p className="text-muted-foreground uppercase">{d.label}</p>
                <p className="text-2xl font-bold mt-1">{fmt(d.value, 0, d.unit)}</p>
                {hasCmp && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendIcon className={cn('size-3', diff! > 0 ? 'text-emerald-500' : diff! < 0 ? 'text-red-500' : 'text-muted-foreground')} />
                    <span className="text-muted-foreground">{fmt(d.comparisonValue!, 0, d.unit)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TableVisual({ visual }: { visual: ReportVisual }) {
  const hasComparison = visual.data.some(d => d.comparisonValue != null);
  const hasCategory = visual.data.some(d => d.category);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && <p className="text-muted-foreground">{visual.description}</p>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">البند</TableHead>
              <TableHead className="text-right">القيمة</TableHead>
              {hasComparison && <TableHead className="text-right">المعيار</TableHead>}
              {hasCategory && <TableHead className="text-right">الفئة</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visual.data.map((d, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{d.label}</TableCell>
                <TableCell className="tabular-nums">{fmt(d.value, 0, d.unit)}</TableCell>
                {hasComparison && <TableCell className="tabular-nums text-muted-foreground">{d.comparisonValue != null ? fmt(d.comparisonValue, 0, d.unit) : '-'}</TableCell>}
                {hasCategory && <TableCell className="text-muted-foreground">{d.category ?? '-'}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function VisualRenderer({ visual }: { visual: ReportVisual }) {
  if (!visual.data || visual.data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{visual.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات كافية</p>
        </CardContent>
      </Card>
    );
  }
  switch (visual.type) {
    case 'bar-chart':   return <BarChartVisual visual={visual} />;
    case 'line-chart':  return <LineChartVisual visual={visual} />;
    case 'pie-chart':   return <PieChartVisual visual={visual} />;
    case 'radar-chart': return <RadarChartVisual visual={visual} />;
    case 'metric-grid': return <MetricGridVisual visual={visual} />;
    case 'table':       return <TableVisual visual={visual} />;
    default:            return null;
  }
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

        {section.visuals.length > 0 && (
          <div className="flex flex-col gap-4">
            {section.visuals.map((visual, i) => (
              <VisualRenderer key={i} visual={visual} />
            ))}
          </div>
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

      {section.visuals.length > 0 && (
        <div className="flex flex-col gap-4">
          {section.visuals.map((visual, i) => <VisualRenderer key={i} visual={visual} />)}
        </div>
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

function SectionContent({ section }: { section: ReportSection }) {
  return (
    <div className="space-y-6">
      <ConclusionBadge conclusion={section.conclusion} />

      {section.visuals.length > 0 && (
        <div className="flex flex-col gap-4">
          {section.visuals.map((visual, i) => (
            <VisualRenderer key={i} visual={visual} />
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
  const kpis = [
    { label: 'صافي الإيرادات',  value: financials.netRevenue,    unit: 'ر.س', highlight: false },
    { label: 'هامش الربح الإجمالي', value: financials.grossMargin, unit: '%',   highlight: financials.grossMargin < 15 },
    { label: 'هامش الربح الصافي',   value: financials.netMargin,   unit: '%',   highlight: financials.netMargin < 5  },
    {
      label: financials.isAboveBreakEven ? 'فوق نقطة التعادل' : 'تحت نقطة التعادل',
      value: Math.abs(financials.breakEvenGap),
      unit: 'ر.س',
      highlight: !financials.isAboveBreakEven,
      positive: financials.isAboveBreakEven,
    },
  ];

  const sortedItems = [...financials.items].sort((a, b) => b.totalRevenue - a.totalRevenue);

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

      {/* Cost structure */}
      <div className="rounded-lg border bg-background p-4">
        <p className="font-semibold mb-3">هيكل التكاليف</p>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div>
            <p className="text-muted-foreground">تكاليف متغيرة</p>
            <p className="font-bold tabular-nums">{fmt(financials.variableCosts)} ر.س</p>
          </div>
          <div>
            <p className="text-muted-foreground">تكاليف ثابتة</p>
            <p className="font-bold tabular-nums">{fmt(financials.fixedCosts)} ر.س</p>
          </div>
          <div>
            <p className="text-muted-foreground">إجمالي التكاليف</p>
            <p className="font-bold tabular-nums">{fmt(financials.totalCosts)} ر.س</p>
          </div>
        </div>
        {financials.totalCosts > 0 && (
          <div className="flex rounded-full overflow-hidden h-2">
            <div
              className="bg-amber-400"
              style={{ width: `${(financials.variableCosts / financials.totalCosts) * 100}%` }}
            />
            <div
              className="bg-slate-400"
              style={{ width: `${(financials.fixedCosts / financials.totalCosts) * 100}%` }}
            />
          </div>
        )}
        <div className="flex gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full bg-amber-400 shrink-0" />متغيرة</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full bg-slate-400 shrink-0" />ثابتة</span>
        </div>
      </div>

      {/* Menu engineering table */}
      {sortedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">هندسة قائمة المنتجات</CardTitle>
            <CardDescription>تصنيف BCG لكل منتج حسب هامش الربح والحجم</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الوحدات</TableHead>
                  <TableHead className="text-right">الإيراد</TableHead>
                  <TableHead className="text-right">هامش/وحدة</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item, i) => {
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
                      <TableCell className="tabular-nums">{fmt(item.totalRevenue)} ر.س</TableCell>
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
                className="size-10 rounded-full object-cover border shrink-0"
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
                <p className="text-muted-foreground line-clamp-1 mt-0.5">{profile.bio}</p>
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
}: {
  competitors: CollectedCompetitor[];
  competitorReviews: CollectedCompetitorWithReviews[];
}) {
  if (competitors.length === 0) return null;

  const PRICE_LABELS: Record<string, string> = {
    PRICE_LEVEL_FREE:           'مجاني',
    PRICE_LEVEL_INEXPENSIVE:    'اقتصادي',
    PRICE_LEVEL_MODERATE:       'متوسط',
    PRICE_LEVEL_EXPENSIVE:      'غالي',
    PRICE_LEVEL_VERY_EXPENSIVE: 'فاخر جداً',
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Competitor table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">المنافسون القريبون ({competitors.length})</CardTitle>
          <CardDescription>مرتبون حسب التقييم الأعلى</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">التقييمات</TableHead>
                <TableHead className="text-right">السعر</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((comp, i) => (
                <TableRow key={i}>
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
                  <TableCell className="text-muted-foreground">
                    {comp.priceLevel ? (PRICE_LABELS[comp.priceLevel] ?? comp.priceLevel) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48">
                    <span className="line-clamp-1">{comp.address ?? '—'}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                        <span className="text-muted-foreground">
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
                        {review.date && <span className="text-muted-foreground">{review.date}</span>}
                      </div>
                      {review.snippet && (
                        <p className="text-muted-foreground line-clamp-2">{review.snippet}</p>
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
}: {
  section: ReportSection;
  collectedContent?: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      {collectedContent && (
        <div>{collectedContent}</div>
      )}
      {collectedContent && (
        <DataSectionHeading label="تحليل الذكاء الاصطناعي" />
      )}
      <SectionContent section={section} />
    </div>
  );
}

// ── Report View (Main) ─────────────────────────────────────────────────────

const PLACEHOLDER_TABS = [
  { id: "financials",  label: "التحليل المالي" },
  { id: "digital",     label: "الحضور الرقمي"  },
  { id: "market",      label: "تحليل السوق"    },
  { id: "action-plan", label: "خطة العمل"      },
  { id: "performance", label: "مراقبة الأداء"  },
];

export function ReportView({
  manifest,
  collectedData,
  isGenerating,
  businessName,
  progressMessage,
}: {
  manifest?: ReportManifest;
  collectedData?: CollectedData;
  isGenerating: boolean;
  businessName: string;
  progressMessage?: string;
}) {
  const sections = manifest?.sections ?? [];

  if (!manifest && !isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">لا يوجد تقرير بعد</p>
      </div>
    );
  }

  if (!manifest && isGenerating) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="px-4 py-2 pointer-events-none select-none opacity-40">
          <div className="bg-muted rounded-lg p-[3px] flex items-center w-full justify-start h-auto flex-wrap gap-0.5">
            {PLACEHOLDER_TABS.map((tab) => (
              <div
                key={tab.id}
                className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground"
              >
                <TabIcon sectionId={tab.id} />
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-bold">جارٍ تحليل {businessName}</h2>
          <p className="text-muted-foreground">{progressMessage ?? "يتم جمع البيانات وتحليلها…"}</p>
        </div>
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

        <div className="flex-1 overflow-y-auto">
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
                    <SectionWithData section={section} collectedContent={collectedContent} />
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
