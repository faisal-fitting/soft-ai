"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { ReportVisual } from "@/lib/types";

const COLORS = [
  "#0ea5e9", // sky-500
  "#f97316", // orange-500
  "#22c55e", // green-500
  "#eab308", // yellow-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
];

export function PieChartVisual({ visual }: { visual: ReportVisual }) {
  const total = visual.data.reduce((s, d) => s + d.value, 0) || 1;

  const config = Object.fromEntries(
    visual.data.map((d, i) => [
      d.label,
      { label: d.label, color: COLORS[i % COLORS.length] },
    ])
  );

  const data = visual.data.map((d) => ({
    name: d.label,
    value: d.value,
    pct: ((d.value / total) * 100).toFixed(1),
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
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={30}
                label={({ pct }) => `${pct}%`}
                labelLine={true}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                content={<ChartTooltipContent />} 
                formatter={(value: number) => [value.toLocaleString("en-US"), ""]}
              />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 11, paddingLeft: 10 }}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
