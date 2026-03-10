"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

export function RadarChartVisual({ visual }: { visual: ReportVisual }) {
  const hasComparison = visual.data.some((d) => d.comparisonValue != null);

  const config: ChartConfig = {
    value:           { label: "القيمة",  color: "var(--chart-1)" },
    comparisonValue: { label: "المعيار", color: "var(--chart-2)" },
  };

  const data = visual.data.map((d) => ({
    label: d.label,
    value: d.value,
    comparisonValue: d.comparisonValue,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && (
          <p className="text-muted-foreground">{visual.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="label" />
            <PolarRadiusAxis tickCount={4} />
            <Tooltip content={<ChartTooltipContent />} />
            {hasComparison && <ChartLegend content={<ChartLegendContent />} />}
            <Radar
              name="القيمة"
              dataKey="value"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.4}
            />
            {hasComparison && (
              <Radar
                name="المعيار"
                dataKey="comparisonValue"
                stroke="var(--color-comparisonValue)"
                fill="var(--color-comparisonValue)"
                fillOpacity={0.2}
              />
            )}
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
