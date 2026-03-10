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
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import type { ReportManifest, ReportSection, ReportVisual } from "@/lib/types";
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

// ── Tab icon map — fixed per section ID ──────────────────────────────────────

const SECTION_ICON_MAP: Record<string, { icon: LucideIcon; className: string }> = {
  financials:   { icon: DollarSign, className: "size-4 text-emerald-500" },
  digital:      { icon: Globe,      className: "size-4 text-blue-500"    },
  market:       { icon: BarChart3,  className: "size-4 text-orange-500"  },
  "action-plan":{ icon: Target,     className: "size-4 text-primary"     },
  performance:  { icon: Activity,   className: "size-4 text-muted-foreground" },
};

function TabIcon({ sectionId }: { sectionId: string }) {
  const cfg = SECTION_ICON_MAP[sectionId] ?? { icon: Activity, className: "size-4 text-muted-foreground" };
  const Icon = cfg.icon;
  return <Icon className={cfg.className} />;
}

// ── Conclusion — subtle inline treatment ─────────────────────────────────────

function ConclusionBadge({ conclusion }: { conclusion: ReportSection['conclusion'] }) {
  const cfg = {
    success:  { icon: CheckCircle2, className: "text-emerald-500" },
    warning:  { icon: AlertTriangle, className: "text-amber-500"  },
    critical: { icon: XCircle,      className: "text-red-500"     },
  }[conclusion.severity];

  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-2 mb-4 text-muted-foreground">
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

const PHASE_COLORS = [
  { header: 'bg-rose-50/60 dark:bg-rose-950/10',   progress: '[&>div]:bg-rose-500'   },
  { header: 'bg-amber-50/60 dark:bg-amber-950/10', progress: '[&>div]:bg-amber-400'  },
  { header: 'bg-emerald-50/60 dark:bg-emerald-950/10', progress: '[&>div]:bg-emerald-500' },
];

type ParsedNarrative = {
  goal: string;
  phases: Array<{ title: string; targetGoal: string; body: string }>;
};

/** Split narrative into a goal statement + phase cards.
 *  The first ## heading that does NOT look like "Phase N" is treated as the goal.
 */
function parseNarrative(narrative: string): ParsedNarrative {
  const lines = narrative.split('\n');
  let goal = '';
  const phases: ParsedNarrative['phases'] = [];
  let current: { title: string; targetGoal: string; bodyLines: string[] } | null = null;

  const isPhaseHeading = (t: string) => /phase|مرحلة/i.test(t);

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Flush previous section
      if (current) {
        phases.push({ title: current.title, targetGoal: current.targetGoal, body: current.bodyLines.join('\n').trim() });
      }
      const title = line.replace(/^##\s+/, '').trim();
      if (!isPhaseHeading(title) && !phases.length && !goal) {
        // This is the Goal heading — collect its body into goal string
        current = { title: '', targetGoal: '', bodyLines: [] };
      } else {
        current = { title, targetGoal: '', bodyLines: [] };
      }
    } else if (current) {
      if (!current.title) {
        // Collecting goal body lines
        goal += (goal ? '\n' : '') + line;
      } else {
        const goalMatch = line.match(/\*{0,2}(?:Target Goal|الهدف المستهدف|الهدف التشغيلي|الهدف)[:\s*]+(.*)/i);
        if (goalMatch) {
          current.targetGoal = goalMatch[1].replace(/\*+/g, '').trim();
        } else {
          current.bodyLines.push(line);
        }
      }
    }
  }
  if (current?.title) {
    phases.push({ title: current.title, targetGoal: current.targetGoal, body: current.bodyLines.join('\n').trim() });
  }

  return {
    goal: goal.trim(),
    phases: phases.filter(p => p.title && (p.body || p.targetGoal)),
  };
}

function ActionPlanContent({ section }: { section: ReportSection }) {
  const { goal, phases } = parseNarrative(section.narrative ?? '');
  const hasPhases = phases.length >= 1;

  return (
    <div className="space-y-5" dir="rtl">
      <ConclusionBadge conclusion={section.conclusion} />

      {/* ── Visuals ── */}
      {section.visuals.length > 0 && (
        <div className="flex flex-col gap-4">
          {section.visuals.map((visual, i) => (
            <VisualRenderer key={i} visual={visual} />
          ))}
        </div>
      )}

      {/* ── Goal banner ── */}
      {goal && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="size-4 shrink-0 text-primary" />
            <p className="text-sm font-bold">الهدف الرئيسي</p>
          </div>
          <div className="text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_strong]:font-semibold [&_p]:m-0">
            <MessageResponse>{goal}</MessageResponse>
          </div>
        </div>
      )}

      {/* ── Phase timeline ── */}
      {hasPhases && (
        <div className="relative">
          {/* Vertical connector line on the right (RTL) */}
          <div className="absolute top-4 bottom-4 right-[11px] w-0.5 bg-border" />

          <div className="space-y-4">
            {phases.map((phase, i) => {
              const color = PHASE_COLORS[i % PHASE_COLORS.length];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className="relative pr-8"
                >
                  {/* Timeline dot */}
                  <div className="absolute right-0 top-4 size-[22px] rounded-full border-2 border-border bg-background flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                  </div>

                  <Card className="gap-0 py-0 overflow-hidden">
                    <CardHeader className={cn("border-b pt-4 items-center", color.header)}>
                      <CardTitle className="text-sm">{phase.title}</CardTitle>
                      <CardAction>
                        <Badge variant="outline" className="shrink-0">
                          المرحلة {i + 1}
                        </Badge>
                      </CardAction>
                      {phase.targetGoal && (
                        <CardDescription className="flex items-center gap-1">
                          <Target className="size-3 shrink-0" />
                          {phase.targetGoal}
                        </CardDescription>
                      )}
                    </CardHeader>

                    {phase.body && (
                      <CardContent>
                        <div className="text-sm leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_ol]:list-decimal [&_ol]:pr-4 [&_ul]:list-disc [&_ul]:pr-4 [&_li]:mt-1">
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

      {/* ── Fallback: plain narrative if no phases could be parsed ── */}
      {!hasPhases && section.narrative && (
        <NarrativeBlock markdown={section.narrative} />
      )}
    </div>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

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

// ── Report View (Main) ─────────────────────────────────────────────────────

export function ReportView({
  manifest,
  isGenerating,
  businessName,
}: {
  manifest?: ReportManifest;
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

  if (!manifest && isGenerating) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-bold">جارٍ تحليل {businessName}</h2>
        <p className="text-muted-foreground">يتم جمع البيانات وتحليلها…</p>
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
            {tabSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0 space-y-8 py-6">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <SectionContent section={section} />
                </motion.div>
              </TabsContent>
            ))}

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
