// Shared types for the report manifest and workflow progress.
// Single source of truth — imported by page.tsx, report-view.tsx, charts, etc.

export type VisualType =
  | "bar-chart"
  | "line-chart"
  | "pie-chart"
  | "metric-grid"
  | "table"
  | "radar-chart";

export type ChartDataPoint = {
  label: string;
  value: number;
  comparisonValue?: number;
  category?: string;
};

export type ReportVisual = {
  type: VisualType;
  title: string;
  description: string;
  data: ChartDataPoint[];
  config?: Record<string, string | number | boolean>;
};

export type ReportSection = {
  id: string;
  title: string;
  conclusion: { text: string; severity: "success" | "warning" | "critical" };
  visuals: ReportVisual[];
  narrative: string;
  citations?: string[];
  tacticalMoves?: Array<{
    action: string;
    impact: "high" | "medium" | "low";
    deadline: string;
  }>;
};

export type ReportManifest = {
  metadata: {
    businessName: string;
    businessType: string;
    generatedAt: string;
    healthScore: number;
    photoUrl?: string;
    address?: string;
    rating?: number;
    reviewCount?: number;
  };
  directive: {
    theme: string;
    northStarMetric: {
      name: string;
      value: number;
      target: number;
      rationale: string;
    };
    focusAreas: { financial: string; digital: string; market: string };
    overallStatus: "CRITICAL" | "WARNING" | "HEALTHY" | "EXCEPTIONAL";
  };
  sections: ReportSection[];
};

export type StepProgress = {
  step: string;
  status: "running" | "complete";
  message: string;
};
