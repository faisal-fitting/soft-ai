"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

export function BarChartVisual({ visual }: { visual: ReportVisual }) {
  const hasComparison = visual.data.some((d) => d.comparisonValue != null);

  const config: ChartConfig = {
    value:           { label: "القيمة",  color: "var(--chart-1)" },
    comparisonValue: { label: "المعيار", color: "var(--chart-2)" },
  };

  const data = visual.data.map((d) => ({
    label: d.label,
    value: d.value,
    comparisonValue: d.comparisonValue,
    unit: d.unit,
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
        <ChartContainer config={config} className="h-52 w-full">
          <BarChart data={data} layout="vertical" style={{ direction: "ltr" }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toLocaleString("ar-SA")}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => [
                    `${Number(value).toLocaleString("ar-SA")}${item.payload.unit ? ` ${item.payload.unit} ` : " "}`,
                    name === "value" ? "القيمة" : "المعيار",
                  ]}
                />
              }
            />
            {hasComparison && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
            {hasComparison && (
              <Bar dataKey="comparisonValue" fill="var(--color-comparisonValue)" radius={[0, 4, 4, 0]} />
            )}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
