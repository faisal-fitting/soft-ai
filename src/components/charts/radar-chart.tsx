"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

export function RadarChartVisual({ visual }: { visual: ReportVisual }) {
  const hasComparison = visual.data.some((d) => d.comparisonValue != null);

  const config = {
    value:           { label: "القيمة",  color: "hsl(var(--chart-1))" },
    comparisonValue: { label: "المعيار", color: "hsl(var(--chart-2))" },
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
          <p className="text-xs text-muted-foreground">{visual.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tickCount={4} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltipContent />} />
              {hasComparison && <Legend />}
              <Radar
                name="القيمة"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.4}
              />
              {hasComparison && (
                <Radar
                  name="المعيار"
                  dataKey="comparisonValue"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
