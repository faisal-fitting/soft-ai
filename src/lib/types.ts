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
  unit?: string;
};

export type ReportVisual = {
  type: VisualType;
  title: string;
  description: string;
  data: ChartDataPoint[];
  config?: Record<string, string | number | boolean | string[]>;
};

// ── Action Plan Types ─────────────────────────────────────────────────────────

export type ActionPlanStep = {
  text: string;
};

export type ActionPlanTask = {
  title: string;
  duration: string;
  steps: ActionPlanStep[];
};

export type ActionPlanPhase = {
  title: string;
  goal: string;
  tasks: ActionPlanTask[];
};

// ── Report Section ────────────────────────────────────────────────────────────

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
  keyStrengths?: string[];
  keyRisks?: string[];
  phases?: ActionPlanPhase[];
};

// ── Report Manifest ───────────────────────────────────────────────────────────

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
    displayName?: string;
    strengths?: string[];
    weaknesses?: string[];
    criticalWeakness?: string;
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

// ── Collected Data (raw workflow step outputs surfaced for the UI) ─────────────

export type CollectedFinancialItem = {
  name: string;
  sellingPrice: number;
  soldUnits: number;
  totalRevenue: number;
  revenueShare: number;
  contributionMarginPerUnit: number;
  profitPerUnit: number;
  fullCostPerUnit: number;
  breakEvenUnits: number;
  capacityUtilizationPercent: number;
  menuCategory: "star" | "plowhorse" | "puzzle" | "dog";
  isBelowCost: boolean;
};

export type CollectedFinancials = {
  netRevenue: number;
  variableCosts: number;
  fixedCosts: number;
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  breakEvenRevenue: number;
  breakEvenGap: number;
  isAboveBreakEven: boolean;
  rawMaterials: number;
  packaging: number;
  items: CollectedFinancialItem[];
};

export type CollectedReviewSample = {
  rating: number;
  date: string;
  snippet?: string;
  userName: string;
  details?: { food?: number; service?: number; atmosphere?: number };
};

export type CollectedReviews = {
  totalFetched: number;
  topics: Array<{ keyword: string; mentions: number }>;
  samples: CollectedReviewSample[];
};

export type CollectedPost = {
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number;
  url?: string;
  date?: string;
  type: "post" | "reel" | "video";
};

export type CollectedSocialProfile = {
  platform: "instagram" | "tiktok";
  username: string;
  profileUrl?: string;
  profilePicUrl?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  engagementRate?: number;
  postsPerWeek?: number;
  isVerified?: boolean;
  bio?: string;
  topPosts: CollectedPost[];
};

export type CollectedSemanticTheme = {
  topic: string;
  sentiment: "positive" | "negative" | "neutral";
  mentions: number;
  exampleSnippets: string[];
};

export type CollectedSemantic = {
  sentimentScore: number;
  themes: CollectedSemanticTheme[];
  strengths?: string[];
  weaknesses?: string[];
  criticalWeakness?: string;
};

export type CollectedSocialAudit = {
  healthScore: number;
  platformBenchmarks: Array<{
    platform: "instagram" | "tiktok";
    status: "above-benchmark" | "at-benchmark" | "below-benchmark";
    engagementRate: number;
    benchmark: number;
  }>;
  contentStrategyGap: string;
  viralitySignals: {
    shareToImpressionRatio: number;
    growthPotential: "high" | "medium" | "low";
  };
  topPerformingContent?: Array<{
    platform: "instagram" | "tiktok";
    type: "post" | "reel" | "video";
    caption?: string;
    url?: string;
    likes?: number;
    views?: number;
    engagementScore: number;
    whySuccessful: string;
  }>;
};

export type CollectedCompetitor = {
  name: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  priceLevel?: string;
};

export type CollectedCompetitorWithReviews = {
  name: string;
  rating?: number;
  reviewCount?: number;
  reviews: Array<{ rating: number; snippet?: string; date?: string }>;
};

export type CollectedPlaceDetails = {
  phone?: string;
  website?: string;
  openingHours?: string[];
  priceLevel?: string;
  photoUrls: string[];
};

export type CollectedData = {
  financials: CollectedFinancials;
  reviews: CollectedReviews;
  socialProfiles: CollectedSocialProfile[];
  semantic: CollectedSemantic;
  socialAudit: CollectedSocialAudit;
  competitors: CollectedCompetitor[];
  competitorReviews: CollectedCompetitorWithReviews[];
  placeDetails: CollectedPlaceDetails;
};
