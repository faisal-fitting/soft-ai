import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { stringify as toYaml } from 'yaml';
import { getPlaceDetails, getNearbyPlaces } from '../tools/google-places';
import { googleMapsReviewsTool } from '../tools/google-maps-reiews';
import { socialMediaScraperTool } from '../tools/social-media-scrape';
import { financialInputSchema, financialOutputSchema, computeFinancials } from '../shared/financials';
import {
  placeDetailsSchema,
  reviewsResponseSchema,
  nearbyPlaceSchema,
  socialDataSchema,
  reportSectionSchema,
  strategicDirectiveSchema,
  reportManifestSchema,
  semanticAnalysisOutputSchema,
  socialAuditOutputSchema,
  competitorReviewSummarySchema,
} from '../shared/schemas';

// Workflow input extends financial schema with optional orchestration metadata
export const workflowInputSchema = financialInputSchema.extend({
  threadId: z.string().optional().describe('Chat thread ID for working memory context — passed from the frontend'),
});

// ── Shared Schemas & Constants ────────────────────────────────────────────────

const businessStyleSchema = z.object({
  googleTypes: z.array(z.string()),
  primaryType: z.string().nullable(),
  priceLevel: z.string().nullable(),
  hasDineIn: z.boolean().nullable(),
  hasTakeout: z.boolean().nullable(),
  hasDelivery: z.boolean().nullable(),
  servesBreakfast: z.boolean().nullable(),
  servesCoffee: z.boolean().nullable(),
});

const placeEnrichedSchema = financialOutputSchema.extend({
  placeDetails: placeDetailsSchema,
  lat: z.number().optional(),
  lon: z.number().optional(),
  includedTypes: z.array(z.string()),
  radius: z.number(),
  businessStyle: businessStyleSchema.optional(),
});

const mergedExternalSchema = placeEnrichedSchema.extend({
  reviews: reviewsResponseSchema,
  nearbyCompetitors: z.array(nearbyPlaceSchema),
  competitorReviews: z.array(competitorReviewSummarySchema).optional(),
});

const expertInputSchema = mergedExternalSchema.extend({
  socialData: socialDataSchema,
  semanticAnalysis: semanticAnalysisOutputSchema,
  socialAudit: socialAuditOutputSchema,
  directive: strategicDirectiveSchema,
  healthScore: z.number(),
});

const FOOD_TYPES = new Set([
  'cafe', 'coffee_shop', 'coffee_stand', 'restaurant',
  'fast_food_restaurant', 'casual_dining_restaurant',
  'fine_dining_restaurant', 'food_court', 'bakery',
  'bar', 'juice_shop', 'ice_cream_shop', 'dessert_shop',
]);

const TYPE_MAP: Record<string, string[]> = {
  cafe:          ['cafe', 'coffee_shop', 'coffee_stand'],
  restaurant:    ['restaurant', 'fast_food_restaurant', 'casual_dining_restaurant'],
  cloud_kitchen: ['restaurant', 'fast_food_restaurant'],
  fine_dining:   ['fine_dining_restaurant', 'restaurant'],
};

const RADIUS_MAP: Record<string, number> = {
  cafe: 1000,
  restaurant: 1500,
  cloud_kitchen: 2000,
  fine_dining: 2000,
};

// ── Phase 0: Data Fetching & Extraction Steps ──────────────────────────────────

const collectFinancials = createStep({
  id: 'collect-financials',
  description: 'Compute deterministic financial KPIs',
  inputSchema: workflowInputSchema,
  outputSchema: financialOutputSchema,
  execute: async ({ inputData, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'collect-financials', phase: 1, status: 'running', message: 'جاري حساب المؤشرات المالية...' } });
    const result = computeFinancials(inputData);
    await writer?.write({
      type: 'data-step-progress',
      data: {
        step: 'collect-financials',
        phase: 1,
        status: 'complete',
        message: 'تم حساب المؤشرات المالية',
        preview: {
          netRevenue: result.netRevenue,
          grossMargin: result.grossMargin,
          breakEvenRevenue: result.breakEvenRevenue,
        },
      },
    });
    return result;
  },
});

const fetchPlaceDetails = createStep({
  id: 'fetch-place-details',
  description: 'Fetch Google Place details',
  inputSchema: financialOutputSchema,
  outputSchema: placeEnrichedSchema,
  execute: async ({ inputData, requestContext, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'place-details', phase: 2, status: 'running', message: 'جاري جلب معلومات الموقع...' } });
    const result = await getPlaceDetails.execute!({ place_id: inputData.placeId }, { requestContext }) as any;
    const lat = result.location?.latitude;
    const lon = result.location?.longitude;
    const apiTypes = (result.types ?? []).filter((t: string) => FOOD_TYPES.has(t));
    const includedTypes = apiTypes.length > 0 ? apiTypes : (TYPE_MAP[inputData.businessType] ?? ['cafe', 'coffee_shop']);
    const radius = RADIUS_MAP[inputData.businessType] ?? 1000;
    await writer?.write({
      type: 'data-step-progress',
      data: {
        step: 'place-details',
        phase: 2,
        status: 'complete',
        message: 'تم جلب معلومات الموقع',
        preview: {
          lat,
          lon,
          businessName: inputData.businessName,
          address: result.formattedAddress,
          rating: result.rating,
          radius,
          staticMapUrl: lat && lon
            ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=600x300&scale=2&markers=color:red%7C${lat},${lon}&key=${process.env.GOOGLE_PLACES_API_KEY || ''}`
            : undefined,
        },
      },
    });
    // Extract business style signals from Google Places data
    const businessStyle = {
      googleTypes: result.types ?? [],
      primaryType: result.primaryType ?? null,
      priceLevel: result.priceLevel ?? null,
      hasDineIn: result.dineIn ?? null,
      hasTakeout: result.takeout ?? null,
      hasDelivery: result.delivery ?? null,
      servesBreakfast: result.servesBreakfast ?? null,
      servesCoffee: result.servesCoffee ?? null,
    };
    return { ...inputData, placeDetails: result, lat, lon, includedTypes, radius, businessStyle };
  },
});

const fetchNearbyCompetitors = createStep({
  id: 'fetch-nearby-competitors',
  description: 'Search for nearby competitor businesses',
  inputSchema: placeEnrichedSchema,
  outputSchema: z.object({ nearbyCompetitors: z.array(nearbyPlaceSchema) }),
  execute: async ({ inputData, requestContext, writer }) => {
    if (inputData.lat == null || inputData.lon == null) return { nearbyCompetitors: [] };
    await writer?.write({ type: 'data-step-progress', data: { step: 'competitors', phase: 2, status: 'running', message: 'جاري البحث عن المنافسين...' } });
    const result = await getNearbyPlaces.execute!({ lat: inputData.lat, lon: inputData.lon, radius: inputData.radius, includedTypes: inputData.includedTypes }, { requestContext }) as any;
    const places: any[] = result.places ?? [];
    await writer?.write({
      type: 'data-step-progress',
      data: {
        step: 'competitors',
        phase: 2,
        status: 'complete',
        message: 'تم تحليل المنافسين',
        preview: {
          competitors: places.slice(0, 10).map((p: any) => ({
            name: p.displayName?.text ?? '',
            lat: p.location?.latitude,
            lon: p.location?.longitude,
            rating: p.rating,
          })),
        },
      },
    });
    return { nearbyCompetitors: places };
  },
});

const fetchTargetReviews = createStep({
  id: 'fetch-target-reviews',
  description: 'Fetch reviews for the target business',
  inputSchema: placeEnrichedSchema,
  outputSchema: z.object({ reviews: reviewsResponseSchema }),
  execute: async ({ inputData, requestContext, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'reviews', phase: 3, status: 'running', message: 'جاري جلب التقييمات...' } });
    const result = await googleMapsReviewsTool.execute!({ place_id: inputData.placeId, language: 'ar', sort_by: 'newestFirst' }, { requestContext }) as any;
    const reviews: any[] = result?.reviews ?? [];
    await writer?.write({
      type: 'data-step-progress',
      data: {
        step: 'reviews',
        phase: 3,
        status: 'complete',
        message: `تم جلب ${reviews.length} تقييم`,
        preview: {
          totalCount: reviews.length,
          samples: reviews.slice(0, 5).map((r: any) => ({
            authorName: r.author_name ?? r.authorAttribution?.displayName ?? 'مجهول',
            rating: r.rating ?? 0,
            snippet: r.snippet ?? r.extracted_snippet?.original ?? r.text?.slice(0, 120),
            profilePhoto: r.profile_photo_url ?? r.authorAttribution?.photoUri,
          })),
        },
      },
    });
    return { reviews: result };
  },
});

const fetchCompetitorReviews = createStep({
  id: 'fetch-competitor-reviews',
  description: 'Fetch reviews for top 6 competitors with revenue estimation and photos',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.object({ competitorReviews: z.array(competitorReviewSummarySchema) }),
  execute: async ({ inputData, requestContext, writer }) => {
    const competitors: z.infer<typeof nearbyPlaceSchema>[] = inputData['fetch-nearby-competitors']?.nearbyCompetitors ?? [];
    if (!competitors.length) return { competitorReviews: [] };

    await writer?.write({ type: 'data-step-progress', data: { step: 'competitor-reviews', phase: 3, status: 'running', message: 'جاري جلب تقييمات المنافسين...' } });

    // Pick top 6 by (rating * reviewCount) — most established competitors
    const top6 = [...competitors]
      .filter(c => c.id && c.userRatingCount && c.userRatingCount > 5)
      .sort((a, b) => ((b.rating ?? 0) * (b.userRatingCount ?? 0)) - ((a.rating ?? 0) * (a.userRatingCount ?? 0)))
      .slice(0, 6);

    // Base revenue factor: 1000 SAR per (rating point × review count per month)
    // This is a reasonable estimate for Saudi F&B market
    const calculateEstimatedRevenue = (rating: number | undefined, reviewCount: number | undefined) => {
      if (!rating || !reviewCount) return 0;
      // More reviews = more established = higher base. Rating amplifies the estimate.
      // Assume ~10% of customers leave reviews
      const baseFactor = 1000; // SAR
      return Math.round(rating * reviewCount * baseFactor);
    };

    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

    const results = await Promise.allSettled(
      top6.map(async (c) => {
        const data = await googleMapsReviewsTool.execute!(
          { place_id: c.id, language: 'ar', sort_by: 'qualityScore' },
          { requestContext }
        ) as any;

        // Build photo URL if available
        const photoName = c.photos?.[0]?.name;
        const photoUrl = photoName
          ? `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=200&key=${GOOGLE_MAPS_API_KEY}`
          : undefined;

        return {
          placeId: c.id,
          name: c.displayName?.text ?? 'Unknown',
          rating: c.rating,
          reviewCount: c.userRatingCount,
          estimatedMonthlyRevenue: calculateEstimatedRevenue(c.rating, c.userRatingCount),
          photoUrl,
          priceLevel: c.priceLevel ? parseInt(c.priceLevel.replace(/\D/g, '')) || 2 : 2,
          lat: c.location?.latitude,
          lon: c.location?.longitude,
          types: c.types,
          primaryType: c.primaryType,
          reviews: (data.reviews ?? []).slice(0, 10).map((r: any) => ({
            rating: r.rating,
            snippet: r.snippet ?? r.extracted_snippet?.original,
            date: r.date,
          })),
        };
      })
    );

    const competitorReviews = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    // Calculate total estimated revenue for market share calculation
    const totalCompetitorRevenue = competitorReviews.reduce((sum, c) => sum + (c.estimatedMonthlyRevenue ?? 0), 0);

    await writer?.write({ type: 'data-step-progress', data: { step: 'competitor-reviews', phase: 3, status: 'complete', message: `تم جلب تقييمات ${competitorReviews.length} منافس`, preview: { totalEstimatedRevenue: totalCompetitorRevenue } } });
    return { competitorReviews };
  },
});

const fetchSocialData = createStep({
  id: 'fetch-social-data',
  description: 'Scrape social media profiles',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.object({ socialData: socialDataSchema }),
  execute: async ({ inputData, requestContext, writer }) => {
    if (!inputData.instagramUser && !inputData.tiktokUser) {
      await writer?.write({ type: 'data-step-progress', data: { step: 'social', phase: 4, status: 'complete', message: 'لا توجد حسابات تواصل اجتماعي' } });
      return { socialData: { instagram: { username: '' }, tiktok: { username: '' } } as any };
    }
    await writer?.write({ type: 'data-step-progress', data: { step: 'social', phase: 4, status: 'running', message: 'جاري تحليل وسائل التواصل...' } });
    try {
      const result = await socialMediaScraperTool.execute!({ instagram_user: inputData.instagramUser ?? '', tiktok_user: inputData.tiktokUser ?? '' }, { requestContext }) as any;
      const ig = result?.instagram;
      const tt = result?.tiktok;
      await writer?.write({
        type: 'data-step-progress',
        data: {
          step: 'social',
          phase: 4,
          status: 'complete',
          message: 'تم تحليل وسائل التواصل',
          preview: {
            instagram: ig?.username ? { username: ig.username, followers: ig.followers, engagementRate: ig.engagement_rate } : undefined,
            tiktok: tt?.username ? { username: tt.username, followers: tt.followers, engagementRate: tt.engagement_rate } : undefined,
          },
        },
      });
      return { socialData: result };
    } catch (err) {
      await writer?.write({ type: 'data-step-progress', data: { step: 'social', phase: 4, status: 'complete', message: 'فشل تحليل وسائل التواصل' } });
      return { socialData: { instagram: { username: inputData.instagramUser ?? '' }, tiktok: { username: inputData.tiktokUser ?? '' }, note: 'Fetch failed' } as any };
    }
  },
});

const runSemanticAnalysis = createStep({
    id: 'run-semantic-analysis',
    description: 'Extract structured themes from reviews',
    inputSchema: z.record(z.string(), z.any()),
    outputSchema: semanticAnalysisOutputSchema,
    execute: async ({ inputData, mastra, writer }) => {
        await writer?.write({ type: 'data-step-progress', data: { step: 'semantic-analysis', phase: 5, status: 'running', message: 'جاري تحليل المراجعات بالذكاء الاصطناعي...' } });
        const agent = mastra?.getAgent('semanticAnalysisAgent');
        if (!agent) throw new Error('semanticAnalysisAgent not found');
        const response = await agent.generate(`Analyze reviews:\n${toYaml(inputData.reviews.reviews.slice(0, 20))}`, {
            structuredOutput: {
                schema: semanticAnalysisOutputSchema,
                errorStrategy: 'fallback',
                fallbackValue: { sentimentScore: 50, themes: [], criticalWeakness: 'Analysis failed' }
            }
        });
        const result = response.object;
        await writer?.write({
            type: 'data-step-progress',
            data: {
                step: 'semantic-analysis',
                phase: 5,
                status: 'complete',
                message: 'تم تحليل المراجعات',
                preview: {
                    sentimentScore: result.sentimentScore,
                    topThemes: (result.themes ?? []).slice(0, 4).map((t: any) => ({ topic: t.topic, sentiment: t.sentiment })),
                },
            },
        });
        return result;
    }
});

const runSocialAudit = createStep({
    id: 'run-social-audit',
    description: 'Extract structured metrics from social data',
    inputSchema: z.record(z.string(), z.any()),
    outputSchema: socialAuditOutputSchema,
    execute: async ({ inputData, mastra, writer }) => {
        await writer?.write({ type: 'data-step-progress', data: { step: 'social-audit', phase: 5, status: 'running', message: 'جاري تدقيق وسائل التواصل...' } });
        const agent = mastra?.getAgent('socialEngagementAuditor');
        if (!agent) throw new Error('socialEngagementAuditor not found');
        const response = await agent.generate(`Audit social data:\n${toYaml(inputData.socialData)}`, {
            structuredOutput: {
                schema: socialAuditOutputSchema,
                errorStrategy: 'fallback',
                fallbackValue: { healthScore: 5, platformBenchmarks: [], contentStrategyGap: 'N/A', viralitySignals: { shareToImpressionRatio: 0, growthPotential: 'low' } }
            }
        });
        const result = response.object;
        await writer?.write({ type: 'data-step-progress', data: { step: 'social-audit', phase: 5, status: 'complete', message: 'تم تدقيق وسائل التواصل' } });
        return result;
    }
});

// ── Phase 1: Strategic Directive ─────────────────────────────────────────────

const generateStrategicDirective = createStep({
  id: 'generate-strategic-directive',
  description: 'Set the tone and North Star for the report',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: strategicDirectiveSchema,
  execute: async ({ inputData, mastra, writer, getStepResult }) => {
    const agent = mastra?.getAgent('cboAgent');
    if (!agent) throw new Error('cboAgent not found');

    const threadId = inputData.threadId;
    const memoryThreadId = threadId ?? `workflow-${Date.now()}`;

    // Create thread if it doesn't exist yet (required for observational memory)
    const mem = await agent.getMemory();
    if (mem) {
      try { await mem.createThread({ resourceId: 'user', threadId: memoryThreadId }); } catch { /* ignore if already exists */ }
    }

    await writer?.write({ type: 'data-step-progress', data: { step: 'directive', phase: 6, status: 'running', message: 'جاري بناء التوجه الاستراتيجي...' } });
    const prompt = `Analyze this business and set the strategic directive:\n${JSON.stringify(inputData)}`;
    
    const response = await agent.generate(prompt, {
      // Always pass memory with threadId for ObservationalMemory
      memory: { thread: memoryThreadId, resource: 'user' },
      structuredOutput: {
        schema: strategicDirectiveSchema,
        errorStrategy: 'fallback',
        fallbackValue: {
          theme: 'Business Health Assessment',
          northStarMetric: { name: 'Net Profit Margin', value: 0, target: 15, unit: '%', rationale: 'Core profitability focus' },
          focusAreas: { financial: 'Efficiency', digital: 'Reputation', market: 'Benchmarking' },
          overallStatus: 'WARNING' as const,
        },
      },
    });
    const directive = response.object;
    await writer?.write({
      type: 'data-step-progress',
      data: {
        step: 'directive',
        phase: 6,
        status: 'complete',
        message: 'تم تحديد التوجه الاستراتيجي',
        preview: {
          northStarName: directive.northStarMetric?.name,
          northStarValue: directive.northStarMetric?.value,
          northStarTarget: directive.northStarMetric?.target,
          northStarUnit: directive.northStarMetric?.unit,
          overallStatus: directive.overallStatus,
          focusAreas: directive.focusAreas,
        },
      },
    });
    return directive;
  },
});

// ── Phase 2: Expert Sections (Parallel) ──────────────────────────────────────

const generateFinancialSection = createStep({
  id: 'generate-financial-section',
  description: 'Produce the structured Financials dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'financials', phase: 7, status: 'running', message: 'جاري تحليل الوضع المالي...' } });
    const agent = mastra?.getAgent('financialExpertAgent');
    
    // Calculate local market share based on competitor revenues
    const competitorRevenues = (inputData as any).competitorReviews?.map((c: any) => c.estimatedMonthlyRevenue ?? 0) ?? [];
    const totalCompetitorRevenue = competitorRevenues.reduce((sum: number, r: number) => sum + r, 0);
    const targetRevenue = inputData.netRevenue ?? 0;
    const totalMarketRevenue = targetRevenue + totalCompetitorRevenue;
    const localMarketShare = totalMarketRevenue > 0 ? (targetRevenue / totalMarketRevenue) * 100 : 0;

    const prompt = `## Context
You are a financial analyst specializing in Saudi F&B businesses.

## Strategic Directive
${inputData.directive.theme}

## Business-Level KPIs (pre-computed — use exactly as provided)
${toYaml({
  netRevenue: inputData.netRevenue,
  variableCosts: inputData.variableCosts,
  fixedCosts: inputData.fixedCosts,
  grossProfit: inputData.grossProfit,
  netProfit: inputData.netProfit,
  grossMargin: inputData.grossMargin,
  netMargin: inputData.netMargin,
  breakEvenRevenue: inputData.breakEvenRevenue,
  breakEvenGap: inputData.breakEvenGap,
  isAboveBreakEven: inputData.isAboveBreakEven,
})}

## Per-Product Data (includes salesShare = % of total items sold)
${toYaml(inputData.items)}

## Local Market Context
- Target Business Monthly Revenue: ${targetRevenue.toLocaleString()} SAR
- Total Estimated Competitor Revenue: ${totalCompetitorRevenue.toLocaleString()} SAR
- Target Business Local Market Share: ${localMarketShare.toFixed(1)}%
- Average Competitor Revenue: ${competitorRevenues.length > 0 ? (totalCompetitorRevenue / competitorRevenues.length).toLocaleString() : 'N/A'} SAR/month

## Task
Analyze the financial data and provide actionable insights.
IMPORTANT: Use the pre-computed KPIs exactly as provided — do NOT recalculate totals from per-product data.
IMPORTANT: Always use complete terminology - say "تكلفة البضاعة المباعة (COGS)" not just "COGS".

**Chart Selection:**
Pick 1-3 charts from: "revenue-vs-breakeven", "cost-breakdown", "menu-bcg-distribution".
For each, write a one-sentence Arabic insight explaining why it matters for this specific business.

Focus on profitability, break-even analysis, cost optimization, menu engineering, and local market positioning.

**Per-Product Analysis:**
For each menu item, emphasize:
- revenueShare: نسبة الإيراد = (سعر البيع × الكمية المباعة / إجمالي إيراد المنتجات) × 100
- salesShare: نسبة المبيعات = (الكمية المباعة / إجمالي الكميات المباعة) × 100

**Local Market Share:**
Include a subsection in your narrative about the target business's position in the local market based on revenue comparison with competitors.
`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'financials', title: 'الوضع المالي', conclusion: { text: 'التحليل المالي قيد الانتظار', severity: 'warning' as const }, charts: [], narrative: 'البيانات المالية غير متوفرة حالياً.' }
      }
    });
    
    await writer?.write({ type: 'data-step-progress', data: { step: 'financials', phase: 7, status: 'complete', message: 'تم تحليل الوضع المالي', preview: { completed: ['financial'] } } });
    return response.object;
  },
});

const generateDigitalSection = createStep({
  id: 'generate-digital-section',
  description: 'Produce the structured Digital Presence dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'digital', phase: 7, status: 'running', message: 'جاري تحليل الحضور الرقمي...' } });
    const agent = mastra?.getAgent('digitalExpertAgent');
    const prompt = `## Context
You are a digital marketing specialist for Saudi F&B businesses.

## Data Fields (Arabic sample for output labels)
- rating: التقييم
- reviewCount: عدد التقييمات
- sentimentScore: درجة المشاعر
- engagementRate: معدل التفاعل
- platformBenchmarks: معايير المنصات

## Strategic Directive
${inputData.directive.theme}

## Semantic Analysis (from Google Reviews)
${toYaml(inputData.semanticAnalysis)}

## Social Media Audit
${toYaml(inputData.socialAudit)}

## Task
Analyze the digital presence data and provide actionable insights.
Focus on online reputation, social media performance, and competitive digital positioning.

**Chart Selection:**
Pick 1-3 charts from: "engagement-vs-benchmark", "sentiment-breakdown", "top-review-topics".
For each, write a one-sentence Arabic insight explaining why it matters for this specific business.`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'digital', title: 'تحليل التواجد الرقمي', conclusion: { text: 'تحليل الحضور الرقمي قيد الانتظار', severity: 'warning' as const }, charts: [], narrative: 'بيانات وسائل التواصل الاجتماعي غير متوفرة حالياً.' }
      }
    });
    await writer?.write({ type: 'data-step-progress', data: { step: 'digital', phase: 7, status: 'complete', message: 'تم تحليل الحضور الرقمي', preview: { completed: ['digital'] } } });
    return response.object;
  },
});

const generateMarketSection = createStep({
  id: 'generate-market-section',
  description: 'Produce the structured Market Intelligence dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'market', phase: 7, status: 'running', message: 'جاري تحليل السوق...' } });
    const agent = mastra?.getAgent('marketExpertAgent');
    // Classify competitors for the prompt
    const targetPrimaryType = (inputData as any).businessStyle?.primaryType;
    const targetIncludedTypes = new Set<string>((inputData as any).includedTypes ?? []);
    const competitorsWithCategory = (inputData.competitorReviews ?? []).map((c: any) => ({
      ...c,
      competitorCategory: (c.primaryType && (c.primaryType === targetPrimaryType || targetIncludedTypes.has(c.primaryType))) ? 'direct' : 'indirect',
    }));
    const directCompetitors = competitorsWithCategory.filter((c: any) => c.competitorCategory === 'direct');
    const indirectCompetitors = competitorsWithCategory.filter((c: any) => c.competitorCategory === 'indirect');

    const prompt = `## Context
You are a market research specialist for Saudi F&B businesses.

## Strategic Directive
${inputData.directive.theme}

## Target Business Revenue Data
- Monthly Revenue: ${inputData.netRevenue?.toLocaleString() ?? 'N/A'} SAR
- Google Rating: ${inputData.placeDetails?.rating ?? 'N/A'}
- Total Reviews: ${inputData.placeDetails?.userRatingCount ?? 'N/A'}
- Primary Type: ${targetPrimaryType ?? 'N/A'}

## Direct Competitors (same business type — ${directCompetitors.length} found)
${directCompetitors.length > 0 ? toYaml(directCompetitors) : 'None found'}

## Indirect Competitors (different type, overlapping audience — ${indirectCompetitors.length} found)
${indirectCompetitors.length > 0 ? toYaml(indirectCompetitors.map((c: any) => ({ name: c.name, rating: c.rating, reviewCount: c.reviewCount, primaryType: c.primaryType }))) : 'None'}

## Business Style Context
${toYaml((inputData as any).businessStyle ?? {})}

## Reputation-Based Market Share:
- Weight = rating × reviewCount for each business
- Market share = businessWeight / totalMarketWeight × 100%
- Google Rating: ${inputData.placeDetails?.rating ?? 'N/A'} | Total Reviews: ${inputData.placeDetails?.userRatingCount ?? 'N/A'}
- Do NOT use estimated revenue for market share in this section — revenue estimation belongs in the financials section.

## Task
Analyze the market data and provide competitive insights.
Focus on direct competitor positioning, pricing strategies, reputation-based market share, and market opportunities.
Briefly mention indirect competitors as context for the overall market landscape (they compete for the same customers, even though they are a different business type).

**Chart Selection:**
Use the "competitor-matrix" chart (which shows ONLY direct competitors in the frontend). Write a one-sentence Arabic insight explaining what it reveals about direct competition.

**IMPORTANT: Exclude any competitor from your analysis if they have 0 reviews AND 0 rating.**
These are unverified or inactive listings, not real competitors.

**Local Market Share Analysis:**
Calculate and include reputation-based market share (rating × reviewCount weight) for the target business vs direct competitors only.`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'market', title: 'السوق والمنافسين القريبين', conclusion: { text: 'تحليل السوق قيد الانتظار', severity: 'warning' as const }, charts: [], narrative: 'بيانات المنافسين غير متوفرة حالياً.' }
      }
    });
    await writer?.write({ type: 'data-step-progress', data: { step: 'market', phase: 7, status: 'complete', message: 'تم تحليل السوق', preview: { completed: ['market'] } } });
    return response.object;
  },
});

// ── Phase 3: Action Plan Synthesis ───────────────────────────────────────────

const generateActionPlanSection = createStep({
  id: 'generate-action-plan',
  description: 'Synthesize unified action plan from expert sections',
  inputSchema: z.object({
    base: expertInputSchema,
    financials: reportSectionSchema,
    digital: reportSectionSchema,
    market: reportSectionSchema,
    threadId: z.string().optional(),
  }),
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ 
      type: 'data-step-progress', 
      data: { step: 'action-plan', phase: 8, status: 'running', message: 'جاري تجميع خطة العمل...' } 
    });
    
    const agent = mastra?.getAgent('cboAgent');
    if (!agent) throw new Error('cboAgent not found');

    const threadId = inputData.threadId;
    
    const semanticSW = {
      strengths: (inputData.base as any).semanticAnalysis?.strengths ?? [],
      weaknesses: (inputData.base as any).semanticAnalysis?.weaknesses ?? [],
      criticalWeakness: (inputData.base as any).semanticAnalysis?.criticalWeakness ?? null,
    };

    const prompt = `## توليف خطة العمل

## التوجه الاستراتيجي
${toYaml((inputData.base as any).directive)}

## Business Style Context
${toYaml((inputData.base as any).businessStyle ?? {})}

## نقاط القوة والضعف من المحللين المتخصصين

### التحليل المالي
- نقاط القوة: ${toYaml(inputData.financials.keyStrengths ?? [])}
- نقاط الضعف: ${toYaml(inputData.financials.keyRisks ?? [])}

### التحليل الرقمي
- نقاط القوة: ${toYaml(inputData.digital.keyStrengths ?? [])}
- نقاط الضعف: ${toYaml(inputData.digital.keyRisks ?? [])}

### تحليل السوق
- نقاط القوة: ${toYaml(inputData.market.keyStrengths ?? [])}
- نقاط الضعف: ${toYaml(inputData.market.keyRisks ?? [])}

### التحليل الدلالي (من آراء العملاء)
- نقاط القوة: ${toYaml(semanticSW.strengths)}
- نقاط الضعف: ${toYaml(semanticSW.weaknesses)}
- النقطة الحرجة: ${semanticSW.criticalWeakness ?? 'غير محدد'}

## بيانات المحللين الكاملة

### البيانات المالية
${toYaml({ conclusion: inputData.financials.conclusion, tacticalMoves: inputData.financials.tacticalMoves })}

### البيانات الرقمية
${toYaml({ conclusion: inputData.digital.conclusion, tacticalMoves: inputData.digital.tacticalMoves })}

### بيانات السوق
${toYaml({ conclusion: inputData.market.conclusion, tacticalMoves: inputData.market.tacticalMoves })}

## المطلوب منك:

1. راجع كل نقاط القوة والضعف من جميع المصادر أعلاه.
2. اختر أبرز 3 نقاط قوة حقيقية وأبرز 3 نقاط ضعف حرجة عبر كل المجالات — وضعها في keyStrengths وكeyRisks.
3. حدد النقطة الحرجة الواحدة الأكثر ضرراً — ضعها كأول مهمة في المرحلة 1.
4. ابنِ خطة عمل منظمة من 3 مراحل، كل مرحلة تحتوي على 2-3 مهام، وكل مهمة تحتوي على 2-4 خطوات عملية.
5. كل خطوة يجب أن تستند لبيانات محددة من التحليل أعلاه.
6. الداخلي (تجهيز، توظيف، أنظمة) قبل الخارجي (إعلانات، ترويج) في كل مرحلة.
`;
    
    // Use threadId if available; otherwise generate a throwaway for working memory
    const memoryThreadId = threadId ?? `workflow-${Date.now()}`;

    // Create thread if it doesn't exist yet (required before updating working memory)
    const mem = await agent.getMemory();
    if (mem) {
      try { await mem.createThread({ resourceId: 'user', threadId: memoryThreadId }); } catch { /* ignore if already exists */ }
    }

    const response = await agent.generate(prompt, {
      prepareStep: () => ({ model: 'openrouter/anthropic/claude-opus-4-6' }),
      // Always pass memory with threadId for ObservationalMemory
      memory: { thread: memoryThreadId, resource: 'user' },
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { 
          id: 'action-plan', 
          title: 'خطة العمل', 
          conclusion: { text: 'لم يتمكن النظام من إنشاء خطة العمل', severity: 'warning' as const }, 
          charts: [],
          narrative: 'حدث خطأ أثناء إنشاء خطة العمل.',
          phases: [],
          keyStrengths: [],
          keyRisks: [],
          expectedOutcomes: [],
        }
      }
    });
    
    await writer?.write({ 
      type: 'data-step-progress', 
      data: { step: 'action-plan', phase: 8, status: 'complete', message: 'تم تجميع التقرير النهائي' } 
    });

    // Update CBO agent working memory with a compact report summary.
    // Done here — at the final agent step — where all data is available.
    // Only runs when a real threadId was passed (chat session exists).
    if (threadId) {
      try {
        const memory = await agent.getMemory();
        const result = response.object ?? {};
        const directive = (inputData.base as any).directive;
        const base = inputData.base;

        const summary = [
          `[ملخص التقرير]`,
          `الاسم: ${base.businessName} | النوع: ${base.businessType}`,
          `النجم الشمالي: ${directive?.northStarMetric?.name} — الحالي: ${directive?.northStarMetric?.value} — الهدف: ${directive?.northStarMetric?.target}`,
          `الحالة العامة: ${directive?.overallStatus} | الثيم: ${directive?.theme}`,
          ``,
          `[الوضع المالي] ${inputData.financials.conclusion?.text}`,
          `  إيرادات: ${base.netRevenue?.toFixed(0)} | صافي ربح: ${base.netProfit?.toFixed(0)} | هامش: ${base.grossMargin?.toFixed(1)}%`,
          ``,
          `[الرقمي] ${inputData.digital.conclusion?.text}`,
          ``,
          `[السوق] ${inputData.market.conclusion?.text}`,
          ``,
          `[نقاط القوة] ${((result as any).keyStrengths ?? []).join(' | ')}`,
          `[نقاط الضعف] ${((result as any).keyRisks ?? []).join(' | ')}`,
          ``,
          `[خطة العمل] ${(result as any).conclusion?.text ?? ''}`,
          `المراحل: ${((result as any).phases ?? []).map((p: any) => `${p.title} (${p.goal})`).join(' → ')}`,
        ].join('\n').slice(0, 1500);

        await memory?.updateWorkingMemory({
          threadId: memoryThreadId,
          resourceId: 'user',
          workingMemory: summary,
        });
      } catch { /* memory update is best-effort — never block the workflow */ }
    }
    
    return response.object;
  },
});

// ── Phase 4: Assembly ───────────────────────────────────────────────────────────


const ARABIC_SECTION_TITLES: Record<string, string> = {
  'financials': 'الوضع المالي',
  'digital': 'تحليل التواجد الرقمي',
  'market': 'السوق والمنافسين القريبين',
  'action-plan': 'خطة العمل',
};

// ── Workflow Definition ───────────────────────────────────────────────────────

export const businessAnalysisWorkflow = createWorkflow({
  id: 'business-analysis-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: reportManifestSchema,
})
  .then(collectFinancials)
  .then(fetchPlaceDetails)
  .parallel([fetchTargetReviews, fetchNearbyCompetitors, fetchSocialData])
  .then(fetchCompetitorReviews)
  .map(async ({ inputData, getStepResult }) => {
    const base = getStepResult<z.infer<typeof placeEnrichedSchema>>('fetch-place-details');
    const reviews = getStepResult<{ reviews: z.infer<typeof reviewsResponseSchema> }>('fetch-target-reviews');
    const nearby = getStepResult<{ nearbyCompetitors: z.infer<typeof nearbyPlaceSchema>[] }>('fetch-nearby-competitors');
    const social = getStepResult<{ socialData: any }>('fetch-social-data');
    const competitorReviews = getStepResult<{ competitorReviews: z.infer<typeof competitorReviewSummarySchema>[] }>('fetch-competitor-reviews');
    return { 
        ...base, 
        reviews: reviews?.reviews, 
        nearbyCompetitors: nearby?.nearbyCompetitors,
        socialData: social?.socialData,
        competitorReviews: competitorReviews?.competitorReviews ?? [],
        threadId: (inputData as any).threadId,
    };
  }, { id: 'merge-external-data' })
  .parallel([runSemanticAnalysis, runSocialAudit])
  .then(generateStrategicDirective)
  .map(async ({ inputData, getStepResult }) => {
    const base = getStepResult<z.infer<typeof mergedExternalSchema> & { socialData: any }>('merge-external-data');
    const semanticResult = getStepResult('run-semantic-analysis');
    const socialResult = getStepResult('run-social-audit');
    const directive = inputData;
    
    // Cap grossMargin between -50 and +50 to prevent extreme health scores
    const cappedMargin = Math.max(-50, Math.min(50, base.grossMargin));
    const healthScore = Math.round((cappedMargin * 0.4) + (base.placeDetails.rating! * 10 * 0.6));
    return {
      ...base,
      semanticAnalysis: semanticResult,
      socialAudit: socialResult,
      directive,
      healthScore,
      threadId: (inputData as any).threadId,
    };
  }, { id: 'prepare-expert-input' })
  .parallel([generateFinancialSection, generateDigitalSection, generateMarketSection])
  .map(async ({ inputData, getStepResult }) => {
    const base = getStepResult<z.infer<typeof expertInputSchema>>('prepare-expert-input');
    const parallel = inputData;
    return {
      base,
      financials: parallel['generate-financial-section'],
      digital: parallel['generate-digital-section'],
      market: parallel['generate-market-section'],
      threadId: (inputData as any).threadId,
    };
  }, { id: 'expert-aggregator' })
  .then(generateActionPlanSection)
  .map(async ({ inputData, getStepResult }) => {
    const expertOutput = getStepResult<any>('expert-aggregator');
    const actionPlan = inputData;
    return {
      metadata: {
        businessName: expertOutput.base.businessName,
        businessType: expertOutput.base.businessType,
        generatedAt: new Date().toISOString(),
        healthScore: expertOutput.base.healthScore,
        photoUrl: expertOutput.base.placeDetails?.photos?.[0]?.name
          ? `https://places.googleapis.com/v1/${expertOutput.base.placeDetails.photos[0].name}/media?maxHeightPx=400&key=${process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyAgbQvK5FZC_2liZ9mM6a7-HJSz8lC4CoQ'}`
          : undefined,
        address: expertOutput.base.placeDetails?.formattedAddress,
        rating: expertOutput.base.placeDetails?.rating,
        reviewCount: expertOutput.base.placeDetails?.userRatingCount,
        displayName: expertOutput.base.placeDetails?.displayName?.text,
        // CBO-refined global S/W — sourced from the action plan step output
        strengths: actionPlan.keyStrengths,
        weaknesses: actionPlan.keyRisks,
        criticalWeakness: actionPlan.keyRisks?.[0],
      },
      directive: expertOutput.base.directive,
      sections: [
        expertOutput.financials,
        expertOutput.digital,
        expertOutput.market,
        actionPlan,
      ],
    };
  }, { id: 'assemble-manifest' })

businessAnalysisWorkflow.commit();