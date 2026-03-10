"use client";

import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.6 0.2 280)",
  "oklch(0.6 0.2 330)",
];

const RADIAN = Math.PI / 180;

export function PieChartVisual({ visual }: { visual: ReportVisual }) {
  const total = visual.data.reduce((s, d) => s + d.value, 0) || 1;

  const config: ChartConfig = Object.fromEntries(
    visual.data.map((d, i) => [
      `item${i}`,
      { label: d.label, color: COLORS[i % COLORS.length] },
    ])
  );

  const data = visual.data.map((d, i) => ({
    name: d.label,
    nameKey: `item${i}`,
    value: d.value,
    pct: `${((d.value / total) * 100).toFixed(1)}%`,
    unit: d.unit,
    fill: `var(--color-item${i})`,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{visual.title}</CardTitle>
        {visual.description && (
          <p className="text-muted-foreground">{visual.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-[250px] px-0"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => [
                    `${Number(value).toLocaleString("ar-SA")}${item.payload.unit ? ` ${item.payload.unit}` : ""}`,
                    item.payload.name,
                  ]}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="nameKey"
              cx="50%"
              cy="50%"
              outerRadius={70}
              labelLine={false}
              label={({ cx, cy, midAngle, outerRadius, payload }) => {
                const radius = outerRadius + 16;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={x > cx ? "start" : "end"}
                    dominantBaseline="central"
                    fontSize={11}
                    fill="hsl(var(--foreground))"
                  >
                    {payload.pct}
                  </text>
                );
              }}
            />
          </PieChart>
        </ChartContainer>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1">
          {visual.data.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground whitespace-nowrap">{d.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
