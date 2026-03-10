"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
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

export function LineChartVisual({ visual }: { visual: ReportVisual }) {
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
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
            />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("ar-SA")} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const unit = item.payload.unit;
                    return [
                      `${Number(value).toLocaleString("ar-SA")} ${unit || ""}`,
                      name === "value" ? "القيمة" : "المعيار"
                    ];
                  }}
                />
              }
            />
            {hasComparison && <ChartLegend content={<ChartLegendContent />} />}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            {hasComparison && (
              <Line
                type="monotone"
                dataKey="comparisonValue"
                stroke="var(--color-comparisonValue)"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3 }}
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
