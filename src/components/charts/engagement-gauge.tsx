"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: number;
  benchmark: number;
  label?: string;
  size?: "sm" | "md" | "lg";
};

export function EngagementGauge({ value, benchmark, label = "معدل التفاعل", size = "md" }: Props) {
  const maxValue = Math.max(value, benchmark) * 1.5;
  const percentage = Math.min((value / maxValue) * 100, 100);
  const benchmarkPercentage = Math.min((benchmark / maxValue) * 100, 100);
  
  const isAboveBenchmark = value >= benchmark;
  const statusColor = isAboveBenchmark ? "text-green-500" : "text-yellow-500";
  
  const sizes = {
    sm: { container: "h-20", circle: "w-16 h-16", text: "text-xs", label: "text-[10px]" },
    md: { container: "h-28", circle: "w-24 h-24", text: "text-sm", label: "text-xs" },
    lg: { container: "h-36", circle: "w-32 h-32", text: "text-base", label: "text-sm" },
  };
  
  const s = sizes[size];

  return (
    <div className={cn("flex flex-col items-center justify-center", s.container)}>
      <div className="relative flex items-center justify-center">
        {/* Background arc */}
        <svg className={cn("transform -rotate-90", s.circle)} viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Benchmark marker */}
          <circle
            cx="50"
            cy="10"
            r="4"
            fill="currentColor"
            className={statusColor}
          />
        </svg>
        
        {/* Value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", s.text, statusColor)}>
            {value.toFixed(1)}%
          </span>
          <span className={cn("text-gray-500", s.label)}>معدل التفاعل</span>
        </div>
      </div>
      
      {/* Benchmark indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", isAboveBenchmark ? "bg-green-500" : "bg-yellow-500")} />
        <span className={cn("text-xs text-gray-500", s.label)}>
          المعيار: {benchmark}%
        </span>
      </div>
    </div>
  );
}
