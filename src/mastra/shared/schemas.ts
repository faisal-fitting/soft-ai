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
  photos: z.array(z.object({
    name: z.string(),
    widthPx: z.number().optional(),
    heightPx: z.number().optional(),
  })).optional(),
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
  profilePicUrl: z.string().optional(), // profile picture URL
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
  profilePicUrl: z.string().optional(), // profile picture URL
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
  sentimentScore: z.number().min(0).max(100).describe('Overall sentiment score 0-100, where 0=extremely negative, 50=neutral, 100=extremely positive'),
  themes: z.array(z.object({
    topic: z.string().describe('Theme topic in Arabic, e.g. "جودة القهوة", "سرعة الخدمة"'),
    sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Dominant sentiment for this theme'),
    mentions: z.number().describe('Number of reviews mentioning this theme'),
    exampleSnippets: z.array(z.string()).describe('2-3 verbatim review snippets that best illustrate this theme'),
  })).describe('Recurring themes found in reviews (only themes appearing in ≥15% of reviews)'),
  criticalWeakness: z.string().optional().describe('The single most damaging recurring complaint in Arabic — the one that most hurts customer satisfaction'),
  strengths: z.array(z.string()).optional().describe('Top 3 business strengths in Arabic, identified from positive review themes'),
  weaknesses: z.array(z.string()).optional().describe('Top 3 business weaknesses in Arabic, identified from negative review themes'),
});

export const topContentSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).describe('Social media platform'),
  type: z.enum(['post', 'reel', 'video']).describe('Content type'),
  caption: z.string().optional().describe('Post caption or title'),
  url: z.string().optional().describe('Direct URL to the post/video for citation'),
  likes: z.number().optional().describe('Number of likes'),
  views: z.number().optional().describe('Number of views'),
  engagementScore: z.number().describe('Engagement score = (likes + comments + shares) / followers * 100'),
  whySuccessful: z.string().describe('Markdown explanation of why this content performed well'),
});

export const socialAuditOutputSchema = z.object({
  healthScore: z.number().min(1).max(10).describe('Overall social media health score 1-10'),
  platformBenchmarks: z.array(z.object({
    platform: z.enum(['instagram', 'tiktok']).describe('Social media platform'),
    status: z.enum(['above-benchmark', 'at-benchmark', 'below-benchmark']).describe('Performance vs Saudi F&B benchmark'),
    engagementRate: z.number().describe('Actual engagement rate as percentage'),
    benchmark: z.number().describe('Saudi F&B benchmark engagement rate for this platform'),
  })).describe('Per-platform engagement benchmarks'),
  contentStrategyGap: z.string().describe('Markdown description of the biggest content strategy gap — what type of content is missing or underperforming'),
  viralitySignals: z.object({
    shareToImpressionRatio: z.number().describe('Ratio of shares to impressions — 1%+ indicates viral potential'),
    growthPotential: z.enum(['high', 'medium', 'low']).describe('Overall growth potential assessment'),
  }).describe('Virality and growth potential signals'),
  topPerformingContent: z.array(topContentSchema).optional().describe('Top 3-5 best performing posts/videos by engagement, with URLs for citations'),
});

// ── Competitor Reviews Schema ─────────────────────────────────────────────────

export const competitorReviewSummarySchema = z.object({
  placeId: z.string().describe('Google place ID of the competitor'),
  name: z.string().describe('Competitor business name'),
  rating: z.number().optional().describe('Overall Google rating'),
  reviewCount: z.number().optional().describe('Total number of reviews'),
  reviews: z.array(z.object({
    rating: z.number(),
    snippet: z.string().optional(),
    date: z.string().optional(),
  })).describe('Sample reviews (up to 10) sorted by qualityScore'),
});

// ── Structured Dashboard Schemas (The "Mastra Way") ──────────────────────────

// Hard-coded Arabic section titles
export const ARABIC_SECTION_TITLES: Record<string, string> = {
  'financials': 'الوضع المالي',
  'digital': 'تحليل التواجد الرقمي',
  'market': 'السوق والمنافسين القريبين',
  'action-plan': 'خطة العمل',
};

// Bilingual Expert Persona - injected into all expert agents
export const BILINGUAL_EXPERT_PERSONA = `
Write in a friendly, casual Saudi Arabic tone. Think of it as talking to a cafe owner you know personally. Use simple everyday words. Occasionally add a light touch like "أخوي", "يا طويل العمر", or "والله". Keep it natural and warm, not stiff or corporate. Explain any technical terms in plain Arabic.
`;

// Compact format guide for rich markdown output
export const OUTPUT_FORMAT_GUIDE = `
You are an expert at creating visually rich, highly engaging, and scannable Markdown content.
When populating the \`narrative\` field in the JSON response, you MUST adhere to the following rules:

1. **Rich Formatting**: Break up text into scannable chunks using headings (##, ###) and bold text (**text**).
2. **Visual Elements**: Use Markdown tables to present data clearly. Simulate "stat cards" using blockquotes (>) combined with bold text.
3. **Emojis**: Liberally use emojis to create visual anchors and make the text engaging (e.g., 📊, 📈, 📉, 🔥, 💡, ✨, 🚀).
4. **JSON String Escaping**: Since the output must be valid JSON, NEVER output raw newlines. Use literal \\n for all line breaks.

<examples>
{
  "narrative": "## 📊 خلاصة الوضع يا طويل العمر 🔥\\n\\nأخوي، الوضع الحالي فيه نقاط قوة وفيه أشياء لازم ن修正ها! 📈\\n\\n### ✨ اللي يحتاج اهتمامك:\\n\\n> 💡 **هامش الربح:** **8%** بس والله، والمعيار 23% 🔥\\n> 👥 **معدل التفاعل:** **1.02%** فقط، يحتاج يصير 3%\\n\\n### 📊 الأرقام على السريع:\\n\\n| البند | القيمة | الحالة |\\n|---------|--------|-----------|\\n| المبيعات | 53,200 | زين ⚖️ |\\n| التكاليف | 29,999 | عالية 🔥 |\\n\\nوالله إذا سوينا التعديلات هذي،鹊个项目 بيكون روووعه! 🚀"
}
</examples>
`;

// ── Action Plan Structured Schemas ───────────────────────────────────────────

export const actionPlanStepSchema = z.object({
  text: z.string().describe('Concise, practical Arabic instruction for this step'),
});

export const actionPlanTaskSchema = z.object({
  title: z.string().describe('Task title in Arabic'),
  duration: z.string().describe('Estimated duration, e.g. "3 أيام", "أسبوع"'),
  steps: z.array(actionPlanStepSchema).describe('Practical steps to complete this task'),
});

export const actionPlanPhaseSchema = z.object({
  title: z.string().describe('Phase title in Arabic, e.g. "المرحلة 1: التأسيس"'),
  goal: z.string().describe('Target goal for this phase, e.g. "+30,000 ريال/شهر"'),
  tasks: z.array(actionPlanTaskSchema).describe('2-3 tasks to complete this phase'),
});

export const visualTypeSchema = z.enum([
  'bar-chart',
  'line-chart',
  'pie-chart',
  'metric-grid',
  'table',
  'radar-chart',
]);

export const chartDataPointSchema = z.object({
  label: z.string().describe('Label for the data point'),
  value: z.number().describe('Numeric value for the data point'),
  comparisonValue: z.number().optional().describe('Optional benchmark or comparison value'),
  unit: z.string().optional().describe('Optional unit for the value (e.g., "SAR", "%", " SAR")'),
  category: z.string().optional().describe('Optional category grouping for the data point'),
});

export const reportVisualSchema = z.object({
  type: visualTypeSchema.describe('Chart type to render'),
  title: z.string().describe('Title for the visual'),
  description: z.string().describe('Markdown description explaining what this visual shows'),
  data: z.array(chartDataPointSchema).min(1).describe('Data points for the visual (must have at least 1)'),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional().describe('Optional chart config overrides (columns should be array of strings)'),
});

export const reportSectionSchema = z.object({
  id: z.string().describe('Section identifier, e.g. "financials", "digital", "market", "action-plan"'),
  title: z.string().describe('Fixed Arabic section title from ARABIC_SECTION_TITLES'),
  conclusion: z.object({
    text: z.string().describe('One-sentence conclusion summarizing the section finding'),
    severity: z.enum(['success', 'warning', 'critical']).describe('Traffic-light severity: success=healthy, warning=needs attention, critical=urgent'),
  }).describe('Section conclusion with severity indicator'),
  visuals: z.array(reportVisualSchema).describe('2-3 charts or grids that visually prove the conclusion'),
  narrative: z.string().describe('Detailed Markdown narrative with analysis and key findings'),
  citations: z.array(z.string()).optional().describe('Source URLs or references used in the analysis'),
  tacticalMoves: z.array(z.object({
    action: z.string().describe('Action description — specific, measurable, data-backed'),
    impact: z.enum(['high', 'medium', 'low']).describe('Business impact level'),
    deadline: z.string().describe('Relative deadline string, e.g. "1 week", "2 weeks", "1 month", "Ongoing"'),
  })).optional().describe('Prioritized list of tactical actions derived from this section\'s analysis'),
  keyStrengths: z.array(z.string()).optional().describe('2-3 domain-specific strengths discovered in this section (Arabic)'),
  keyRisks: z.array(z.string()).optional().describe('2-3 domain-specific risks or weaknesses discovered in this section (Arabic)'),
  phases: z.array(actionPlanPhaseSchema).optional().describe('Structured action plan phases — only populated for the action-plan section'),
});

export const strategicDirectiveSchema = z.object({
  theme: z.string().describe('Narrative theme for the report — the business story in one line'),
  northStarMetric: z.object({
    name: z.string().describe('Name of the single most important metric to improve'),
    value: z.number().describe('Current value of the north star metric'),
    target: z.number().describe('Target value to achieve'),
    rationale: z.string().describe('Explanation of why this metric was chosen as the north star'),
  }).describe('The single metric that if improved would resolve the core business conflict'),
  focusAreas: z.object({
    financial: z.string().describe('One-line financial focus area'),
    digital: z.string().describe('One-line digital focus area'),
    market: z.string().describe('One-line market focus area'),
  }).describe('Strategic focus area per domain'),
  overallStatus: z.enum(['CRITICAL', 'WARNING', 'HEALTHY', 'EXCEPTIONAL']).describe('Overall business health status'),
});

export const reportManifestSchema = z.object({
  metadata: z.object({
    businessName: z.string(),
    businessType: z.string(),
    generatedAt: z.string(),
    healthScore: z.number(),
    photoUrl: z.string().optional(),
    address: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    displayName: z.string().optional(),
    strengths: z.array(z.string()).optional().describe('Top business strengths — refined and selected by CBO agent'),
    weaknesses: z.array(z.string()).optional().describe('Top business weaknesses — refined and selected by CBO agent'),
    criticalWeakness: z.string().optional().describe('Single most damaging issue — refined by CBO agent'),
  }),
  directive: strategicDirectiveSchema,
  sections: z.array(reportSectionSchema),
});
