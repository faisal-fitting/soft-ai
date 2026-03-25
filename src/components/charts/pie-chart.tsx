"use client";

import { Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type PieChartItem = {
  label: string;
  value: number;
};

type Props = {
  data: PieChartItem[];
  unit?: string;
};

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

export function DataPieChart({ data, unit }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [
      `item${i}`,
      { label: d.label, color: COLORS[i % COLORS.length] },
    ])
  );

  const chartData = data.map((d, i) => ({
    name: d.label,
    nameKey: `item${i}`,
    value: d.value,
    pct: `${((d.value / total) * 100).toFixed(1)}%`,
    fill: `var(--color-item${i})`,
  }));

  return (
    <div>
      <ChartContainer
        config={config}
        className="mx-auto aspect-square max-h-[300px] px-0"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, _name, item) => [
                  `${Number(value).toLocaleString("ar-SA")}${unit ? ` ${unit}` : ""}`,
                  item.payload.name,
                ]}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="nameKey"
            cx="50%"
            cy="50%"
            outerRadius={100}
            labelLine={false}
            label={({ cx, cy, midAngle, outerRadius, payload }) => {
              const radius = outerRadius + 18;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              return (
                <text
                  x={x}
                  y={y}
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                  fontSize={11}
                  fill="var(--color-foreground)"
                >
                  {payload.pct}
                </text>
              );
            }}
          />
        </PieChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground whitespace-nowrap">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
