// Shared types for the report manifest and workflow progress.
// Single source of truth — imported by page.tsx, report-view.tsx, charts, etc.

export type ChartDataSource =
  | "revenue-vs-breakeven"
  | "cost-breakdown"
  | "menu-bcg-distribution"
  | "engagement-vs-benchmark"
  | "sentiment-breakdown"
  | "top-review-topics"
  | "rating-comparison"
  | "review-volume";

export type ChartReference = {
  dataSource: ChartDataSource;
  insight: string;
};

export type ExpectedOutcome = {
  metric: string;
  current: number;
  target: number;
  unit: string;
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
  charts?: ChartReference[];
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
  expectedOutcomes?: ExpectedOutcome[];
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

// ── Step Progress Preview Payloads ───────────────────────────────────────────

export type ProgressPreviewFinancials = {
  netRevenue: number;
  grossMargin: number;
  breakEvenRevenue: number;
};

export type ProgressPreviewLocation = {
  lat: number;
  lon: number;
  businessName: string;
  address?: string;
  rating?: number;
  radius: number;
  staticMapUrl?: string;
  competitors?: Array<{ name: string; lat: number; lon: number; rating?: number }>;
};

export type ProgressPreviewReviews = {
  totalCount: number;
  samples: Array<{ authorName: string; rating: number; snippet?: string; profilePhoto?: string }>;
};

export type ProgressPreviewSocial = {
  instagram?: { username: string; followers?: number; engagementRate?: number };
  tiktok?: { username: string; followers?: number; engagementRate?: number };
};

export type ProgressPreviewAnalysis = {
  sentimentScore: number;
  topThemes: Array<{ topic: string; sentiment: "positive" | "negative" | "neutral" }>;
  healthScore?: number;
};

export type ProgressPreviewStrategy = {
  northStarName: string;
  northStarValue: number;
  northStarTarget: number;
  overallStatus: "CRITICAL" | "WARNING" | "HEALTHY" | "EXCEPTIONAL";
  focusAreas: { financial: string; digital: string; market: string };
};

export type ProgressPreviewExperts = {
  completed: Array<"financial" | "digital" | "market">;
};

export type ProgressPreview =
  | ProgressPreviewFinancials
  | ProgressPreviewLocation
  | ProgressPreviewReviews
  | ProgressPreviewSocial
  | ProgressPreviewAnalysis
  | ProgressPreviewStrategy
  | ProgressPreviewExperts;

export type StepProgress = {
  step: string;
  phase: number; // 1–8 UI narrative phase
  status: "running" | "complete";
  message: string;
  preview?: ProgressPreview;
};

// ── Collected Data (raw workflow step outputs surfaced for the UI) ─────────────

export type CollectedFinancialItem = {
  name: string;
  sellingPrice: number;
  soldUnits: number;
  totalRevenue: number;
  revenueShare: number;
  salesShare: number;
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
  // Individual cost lines for cost breakdown chart
  productionStaffCosts: number;
  rent: number;
  adminSalaries: number;
  adminExpenses: number;
  utilities: number;
  subscriptions: number;
  govFees: number;
  serviceLaborCosts: number;
  otherCosts: number;
  advertising: number;
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
  photoUrl?: string;
  localMarketShare?: number;
};

export type CollectedCompetitorWithReviews = {
  name: string;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  reviews: Array<{ rating: number; snippet?: string; date?: string }>;
};

export type CollectedPlaceDetails = {
  phone?: string;
  website?: string;
  openingHours?: string[];
  priceLevel?: string;
  photoUrls: string[];
};

export type CollectedMarketData = {
  localMarketShare?: number;
  totalMarketReviews?: number;
  averageCompetitorRating?: number;
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
  marketData?: CollectedMarketData;
};
