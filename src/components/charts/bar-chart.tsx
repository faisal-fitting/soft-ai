"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type BarChartItem = {
  label: string;
  value: number;
  comparisonValue?: number;
};

type Props = {
  data: BarChartItem[];
  unit?: string;
  valueLabel?: string;
  comparisonLabel?: string;
  highlightLabel?: string; // this label's bar gets --chart-1, others get --chart-2
  height?: string;
};

export function DataBarChart({
  data,
  unit,
  valueLabel = "القيمة",
  comparisonLabel = "المعيار",
  height = "h-52",
}: Props) {
  const hasComparison = data.some((d) => d.comparisonValue != null);

  const config: ChartConfig = {
    value: { label: valueLabel, color: "var(--chart-1)" },
    comparisonValue: { label: comparisonLabel, color: "var(--chart-3)" },
  };

  const chartData = data.map((d) => ({
    label: d.label,
    value: d.value,
    comparisonValue: d.comparisonValue,
  }));

  return (
    <ChartContainer config={config} className={`${height} w-full`}>
      <BarChart data={chartData} layout="vertical" style={{ direction: "ltr" }}>
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
          width={120}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                `${Number(value).toLocaleString("ar-SA")}${unit ? ` ${unit}` : ""}`,
                name === "value" ? valueLabel : comparisonLabel,
              ]}
            />
          }
        />
        {hasComparison && <ChartLegend content={<ChartLegendContent />} />}
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
        {hasComparison && (
          <Bar
            dataKey="comparisonValue"
            fill="var(--color-comparisonValue)"
            radius={[0, 4, 4, 0]}
          />
        )}
      </BarChart>
    </ChartContainer>
  );
}
