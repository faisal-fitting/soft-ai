import { z } from 'zod';

// ── Place Details (Google Places API) ────────────────────────────────────────

export const placeDetailsSchema = z.object({
  id: z.string(),
  displayName: z.object({
    text: z.string(),
    languageCode: z.string().optional(),
  }),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  formattedAddress: z.string().optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  regularOpeningHours: z.object({
    openNow: z.boolean().optional(),
    weekdayDescriptions: z.array(z.string()).optional(),
  }).optional(),
  priceLevel: z.string().optional(),
});

export const nearbyPlaceSchema = placeDetailsSchema;

// ── Review (SerpAPI google_maps_reviews) ─────────────────────────────────────

export const reviewSchema = z.object({
  position: z.number(),
  link: z.string().optional(),
  rating: z.number(),
  date: z.string(),
  iso_date: z.string().optional(),
  iso_date_of_last_edit: z.string().optional(),
  images: z.array(z.string()).optional(),
  source: z.string().optional(),
  review_id: z.string().optional(),
  user: z.object({
    name: z.string(),
    link: z.string().optional(),
    contributor_id: z.string().optional(),
    thumbnail: z.string().optional(),
    local_guide: z.boolean().optional(),
    reviews: z.number().optional(),
    photos: z.number().optional(),
  }),
  snippet: z.string().optional(),
  extracted_snippet: z.object({
    original: z.string(),
  }).optional(),
  details: z.object({
    food: z.number().optional(),
    service: z.number().optional(),
    atmosphere: z.number().optional(),
    meal_type: z.string().optional(),
    price_per_person: z.string().optional(),
    noise_level: z.string().optional(),
    wait_time: z.string().optional(),
  }).optional(),
  likes: z.number().optional(),
});

// ── Reviews Response (googleMapsReviewsTool output) ──────────────────────────

export const reviewsResponseSchema = z.object({
  place_info: z.object({
    title: z.string().optional(),
    address: z.string().optional(),
    rating: z.number().optional(),
    reviews: z.number().optional(),
    type: z.string().optional(),
  }).optional(),
  topics: z.array(z.object({
    keyword: z.string(),
    mentions: z.number(),
    id: z.string().optional(),
  })).optional(),
  reviews: z.array(reviewSchema),
  total_fetched: z.number(),
  sort_used: z.string(),
});

// ── Social Media (socialMediaScraperTool output) ─────────────────────────────

export const postSchema = z.object({
  caption: z.string().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  views: z.number().optional(),
  isReel: z.boolean().optional(),
  url: z.string().optional(),
  date: z.string().optional(),
  duration: z.number().optional(), // seconds (both platforms)
  shares: z.number().optional(),   // TikTok only
  saves: z.number().optional(),    // TikTok only
});

export const instagramProfileSchema = z.object({
  username: z.string(),
  profileUrl: z.string().optional(), // canonical profile URL
  fullName: z.string().optional(),
  bio: z.string().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  postsCount: z.number().optional(),
  isVerified: z.boolean().optional(),
  isBusinessAccount: z.boolean().optional(),
  categoryName: z.string().optional(),
  avgLikes: z.number().optional(),
  avgComments: z.number().optional(),
  avgViews: z.number().optional(),
  engagementRate: z.number().optional(),
  postsPerWeek: z.number().optional(),
  recentPosts: z.array(postSchema).optional(),
  recentReels: z.array(postSchema).optional(), // accurate views, no captions
  error: z.string().optional(),
});

export const tiktokProfileSchema = z.object({
  username: z.string(),
  profileUrl: z.string().optional(), // canonical profile URL — extracted from video share_url when possible
  displayName: z.string().optional(),
  bio: z.string().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  likes: z.number().optional(),
  videosCount: z.number().optional(),
  avgViews: z.number().optional(),
  avgLikes: z.number().optional(),
  avgComments: z.number().optional(),
  engagementRate: z.number().optional(),
  postsPerWeek: z.number().optional(),
  avgShareCount: z.number().optional(),
  avgSaveCount: z.number().optional(),
  recentVideos: z.array(postSchema).optional(),
  error: z.string().optional(),
});

export const socialDataSchema = z.object({
  instagram: instagramProfileSchema,
  tiktok: tiktokProfileSchema,
  note: z.string().optional(),
});

// ── Competitor Analysis Result ───────────────────────────────────────────────

export const competitorAnalysisSchema = z.object({
  place_id: z.string(),
  analysis: z.string(),
});

// ── Feature Extractor Schemas (For Supporting Agents) ──────────────────────

export const semanticAnalysisOutputSchema = z.object({
  sentimentScore: z.number().min(0).max(100),
  themes: z.array(z.object({
    topic: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    mentions: z.number(),
    exampleSnippets: z.array(z.string()),
  })),
  criticalWeakness: z.string().optional(),
});

export const socialAuditOutputSchema = z.object({
  healthScore: z.number().min(1).max(10),
  platformBenchmarks: z.array(z.object({
    platform: z.enum(['instagram', 'tiktok']),
    status: z.enum(['above-benchmark', 'at-benchmark', 'below-benchmark']),
    engagementRate: z.number(),
    benchmark: z.number(),
  })),
  contentStrategyGap: z.string(),
  viralitySignals: z.object({
    shareToImpressionRatio: z.number(),
    growthPotential: z.enum(['high', 'medium', 'low']),
  }),
});

// ── Structured Dashboard Schemas (The "Mastra Way") ──────────────────────────

// Hard-coded Arabic section titles
export const ARABIC_SECTION_TITLES: Record<string, string> = {
  'financials': 'الوضع المالي',
  'digital': 'تحليل التواجد الرقمي',
  'market': 'السوق والمنافسين القريبين',
  'action-plan': 'خطة العمل',
};

export const visualTypeSchema = z.enum([
  'bar-chart',
  'line-chart',
  'pie-chart',
  'metric-grid',
  'table',
  'radar-chart',
]);

export const chartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  comparisonValue: z.number().optional(),
  category: z.string().optional(),
});

export const reportVisualSchema = z.object({
  type: visualTypeSchema,
  title: z.string(),
  description: z.string(),
  data: z.array(chartDataPointSchema),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const reportSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  conclusion: z.object({
    text: z.string(),
    severity: z.enum(['success', 'warning', 'critical']),
  }),
  visuals: z.array(reportVisualSchema),
  narrative: z.string().describe('Detailed Markdown explanation with citations'),
  citations: z.array(z.string()).optional(),
  tacticalMoves: z.array(z.object({
    action: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    deadline: z.string(),
  })).optional(),
});

export const strategicDirectiveSchema = z.object({
  theme: z.string(),
  northStarMetric: z.object({
    name: z.string(),
    value: z.number(),
    target: z.number(),
    rationale: z.string(),
  }),
  focusAreas: z.object({
    financial: z.string(),
    digital: z.string(),
    market: z.string(),
  }),
  overallStatus: z.enum(['CRITICAL', 'WARNING', 'HEALTHY', 'EXCEPTIONAL']),
});

export const reportManifestSchema = z.object({
  metadata: z.object({
    businessName: z.string(),
    businessType: z.string(),
    generatedAt: z.string(),
    healthScore: z.number(),
  }),
  directive: strategicDirectiveSchema,
  sections: z.array(reportSectionSchema),
});
