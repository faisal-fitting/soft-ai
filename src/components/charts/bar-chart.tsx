"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

export function BarChartVisual({ visual }: { visual: ReportVisual }) {
  const hasComparison = visual.data.some((d) => d.comparisonValue != null);

  const config = {
    value:           { label: "القيمة",  color: "hsl(var(--chart-1))" },
    comparisonValue: { label: "المعيار", color: "hsl(var(--chart-2))" },
  };

  // Recharts needs data keys matching the dataKey prop
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
          <p className="text-xs text-muted-foreground">{visual.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="horizontal" style={{ direction: 'ltr' }} reverseStackOrder>
              <CartesianGrid horizontal={true} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("ar-SA")} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name, item) => {
                      const unit = item.payload.unit;
                      return [
                        `${Number(value).toLocaleString("ar-SA")} ${unit || ""}`,
                        item.name === "value" ? "القيمة" : "المعيار"
                      ];
                    }}
                  />
                } 
              />
              {hasComparison && <Legend />}
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              {hasComparison && (
                <Bar dataKey="comparisonValue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
