"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import type { ReportManifest, ReportSection, ReportVisual } from "@/lib/types";
import { Streamdown } from "streamdown";
import { BarChartVisual } from "@/components/charts/bar-chart";
import { LineChartVisual } from "@/components/charts/line-chart";
import { PieChartVisual } from "@/components/charts/pie-chart";
import { RadarChartVisual } from "@/components/charts/radar-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: decimals });
}

// ── Conclusion Badge ──────────────────────────────────────────────────────────

function ConclusionBadge({ conclusion }: { conclusion: ReportSection['conclusion'] }) {
  const cfg = {
    success: { icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-400' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-400' },
    critical: { icon: XCircle, bg: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800/40 dark:text-red-400' },
  }[conclusion.severity];

  const Icon = cfg.icon;

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3 mb-4", cfg.bg)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="text-sm leading-snug">{conclusion.text}</p>
    </div>
  );
}

// ── Citations ─────────────────────────────────────────────────────────────────

function Citations({ citations }: { citations?: string[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">المصادر:</p>
      <ul className="text-xs text-muted-foreground space-y-1">
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
    <div className="prose prose-sm dark:prose-invert mt-4 max-w-none text-right leading-relaxed" dir="rtl">
      <Streamdown>{markdown}</Streamdown>
    </div>
  );
}

// ── Visual Components ─────────────────────────────────────────────────────

function MetricGridVisual({ visual }: { visual: ReportVisual }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && <p className="text-xs text-muted-foreground">{visual.description}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visual.data.map((d, i) => {
            const hasCmp = d.comparisonValue != null;
            const diff = hasCmp ? d.value - d.comparisonValue! : null;
            const TrendIcon = diff && diff > 0 ? TrendingUp : diff && diff < 0 ? TrendingDown : Minus;

            return (
              <div key={i} className="rounded-lg border bg-background p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">{d.label}</p>
                <p className="text-2xl font-bold mt-1">{fmt(d.value)}</p>
                {hasCmp && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendIcon className={cn('size-3', diff! > 0 ? 'text-emerald-500' : diff! < 0 ? 'text-red-500' : 'text-muted-foreground')} />
                    <span className="text-[10px] text-muted-foreground">{fmt(d.comparisonValue!)}</span>
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
        {visual.description && <p className="text-xs text-muted-foreground">{visual.description}</p>}
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
                <TableCell className="tabular-nums">{fmt(d.value)}</TableCell>
                {hasComparison && <TableCell className="tabular-nums text-muted-foreground">{d.comparisonValue != null ? fmt(d.comparisonValue) : '-'}</TableCell>}
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

// ── Generating Placeholder ─────────────────────────────────────────────────

function GeneratingPlaceholder({ businessName }: { businessName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-bold">جارٍ تحليل {businessName}</h2>
      <p className="text-sm text-muted-foreground">يتم جمع البيانات وتحليلها…</p>
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
    return <GeneratingPlaceholder businessName={businessName} />;
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
                {section.conclusion.severity === 'critical' && <XCircle className="size-3 text-red-500" />}
                {section.conclusion.severity === 'warning' && <AlertTriangle className="size-3 text-amber-500" />}
                {section.conclusion.severity === 'success' && <CheckCircle2 className="size-3 text-emerald-500" />}
                {section.title}
              </TabsTrigger>
            ))}
            {actionPlan && (
              <TabsTrigger value={actionPlan.id} className="gap-2">
                <Target className="size-3" />
                {actionPlan.title}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-6">
            {tabSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0 space-y-8">
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
              <TabsContent value={actionPlan.id} className="mt-0 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="mb-4 text-lg font-bold">{actionPlan.title}</h2>
                  <SectionContent section={actionPlan} />
                </motion.div>
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
