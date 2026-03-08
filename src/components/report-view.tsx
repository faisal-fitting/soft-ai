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
import { Progress } from "@/components/ui/progress";
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
import type { ReportManifest } from "@/app/page";
import { Streamdown } from "streamdown";

// ── Types ─────────────────────────────────────────────────────────────────────

type VisualType = 'bar-chart' | 'line-chart' | 'pie-chart' | 'metric-grid' | 'table' | 'radar-chart';

type ChartDataPoint = {
  label: string;
  value: number;
  comparisonValue?: number;
  category?: string;
};

type ReportVisual = {
  type: VisualType;
  title: string;
  description: string;
  data: ChartDataPoint[];
  config?: Record<string, string | number | boolean>;
};

type ReportSection = {
  id: string;
  title: string;
  conclusion: { text: string; severity: 'success' | 'warning' | 'critical' };
  visuals: ReportVisual[];
  narrative: string;
  citations?: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: decimals });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
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

// ── Visual Components (Shadcn) ────────────────────────────────────────────

function BarChartVisual({ visual }: { visual: ReportVisual }) {
  const max = Math.max(...visual.data.map(d => Math.max(d.value, d.comparisonValue ?? 0)), 1);
  const hasComparison = visual.data.some(d => d.comparisonValue != null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && <p className="text-xs text-muted-foreground">{visual.description}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visual.data.map((d, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground truncate max-w-[60%]">{d.label}</span>
                <span className="font-medium">{fmt(d.value)}</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
              {hasComparison && d.comparisonValue != null && (
                <div className="h-1.5 rounded-full bg-muted/50 mt-0.5 overflow-hidden">
                  <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: `${(d.comparisonValue / max) * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
        {hasComparison && (
          <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />القيمة</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted-foreground/40" />المعيار</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PieChartVisual({ visual }: { visual: ReportVisual }) {
  const total = visual.data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ['bg-primary', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && <p className="text-xs text-muted-foreground">{visual.description}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visual.data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn('size-3 rounded-sm shrink-0', colors[i % colors.length])} />
              <span className="flex-1 text-xs truncate text-muted-foreground">{d.label}</span>
              <span className="text-xs font-medium">{pct(d.value / total)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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
    case 'bar-chart':
    case 'line-chart':
    case 'radar-chart':
      return <BarChartVisual visual={visual} />;
    case 'pie-chart':
      return <PieChartVisual visual={visual} />;
    case 'metric-grid':
      return <MetricGridVisual visual={visual} />;
    case 'table':
      return <TableVisual visual={visual} />;
    default:
      return null;
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

// ── Directive Banner ────────────────────────────────────────────────────────

const STATUS_CFG = {
  EXCEPTIONAL: { label: 'استثنائي', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-500' },
  HEALTHY: { label: 'صحي', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-500' },
  WARNING: { label: 'تحذير', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-500' },
  CRITICAL: { label: 'حرج', bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-500' },
} as const;

function DirectiveBanner({ manifest }: { manifest: ReportManifest }) {
  if (!manifest.directive || !manifest.metadata) return null;

  const { directive, metadata } = manifest;
  const statusCfg = STATUS_CFG[directive.overallStatus] ?? STATUS_CFG.WARNING;
  const nsm = directive.northStarMetric;

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{metadata.businessName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{directive.theme}</p>
        </div>
        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1", statusCfg.bg)}>
          <span className={cn("size-2 rounded-full", statusCfg.badge)} />
          <span className={cn("text-xs font-semibold", statusCfg.text)}>{statusCfg.label}</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs text-muted-foreground">نقاط الصحة</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold">{metadata.healthScore}</p>
              <div className="flex-1">
                <Progress value={metadata.healthScore} className="h-2" />
              </div>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Target className="size-3.5 text-primary/70" />
              <p className="text-xs text-muted-foreground">{nsm.name}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{fmt(nsm.value)}</p>
              <p className="mb-1 text-xs text-muted-foreground">الهدف: {fmt(nsm.target)}</p>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground leading-snug">{nsm.rationale}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'المالي', value: directive.focusAreas.financial },
          { label: 'الرقمي', value: directive.focusAreas.digital },
          { label: 'السوق', value: directive.focusAreas.market },
        ].map((area) => (
          <Card key={area.label}>
            <CardHeader className="pb-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">{area.label}</p>
            </CardHeader>
            <CardContent className="p-3">
              <p className="text-xs leading-snug">{area.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
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
    <div className="flex flex-1 flex-col overflow-hidden" dir="rtl">
      <Tabs defaultValue={tabSections[0]?.id} className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b px-4 py-2">
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
            {/* <DirectiveBanner manifest={manifest!} /> */}

            {tabSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="mb-4 text-lg font-bold">{section.title}</h2>
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
