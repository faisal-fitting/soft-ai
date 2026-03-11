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

const placeEnrichedSchema = financialOutputSchema.extend({
  placeDetails: placeDetailsSchema,
  lat: z.number().optional(),
  lon: z.number().optional(),
  includedTypes: z.array(z.string()),
  radius: z.number(),
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
  execute: async ({ inputData }) => computeFinancials(inputData),
});

const fetchPlaceDetails = createStep({
  id: 'fetch-place-details',
  description: 'Fetch Google Place details',
  inputSchema: financialOutputSchema,
  outputSchema: placeEnrichedSchema,
  execute: async ({ inputData, requestContext, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'place-details', status: 'running', message: 'جاري جلب معلومات الموقع...' } });
    const result = await getPlaceDetails.execute!({ place_id: inputData.placeId }, { requestContext }) as any;
    const lat = result.location?.latitude;
    const lon = result.location?.longitude;
    const apiTypes = (result.types ?? []).filter((t: string) => FOOD_TYPES.has(t));
    const includedTypes = apiTypes.length > 0 ? apiTypes : (TYPE_MAP[inputData.businessType] ?? ['cafe', 'coffee_shop']);
    const radius = RADIUS_MAP[inputData.businessType] ?? 1000;
    await writer?.write({ type: 'data-step-progress', data: { step: 'place-details', status: 'complete', message: 'تم جلب معلومات الموقع' } });
    return { ...inputData, placeDetails: result, lat, lon, includedTypes, radius };
  },
});

const fetchNearbyCompetitors = createStep({
  id: 'fetch-nearby-competitors',
  description: 'Search for nearby competitor businesses',
  inputSchema: placeEnrichedSchema,
  outputSchema: z.object({ nearbyCompetitors: z.array(nearbyPlaceSchema) }),
  execute: async ({ inputData, requestContext, writer }) => {
    if (inputData.lat == null || inputData.lon == null) return { nearbyCompetitors: [] };
    await writer?.write({ type: 'data-step-progress', data: { step: 'competitors', status: 'running', message: 'جاري البحث عن المنافسين...' } });
    const result = await getNearbyPlaces.execute!({ lat: inputData.lat, lon: inputData.lon, radius: inputData.radius, includedTypes: inputData.includedTypes }, { requestContext }) as any;
    await writer?.write({ type: 'data-step-progress', data: { step: 'competitors', status: 'complete', message: 'تم تحليل المنافسين' } });
    return { nearbyCompetitors: result.places ?? [] };
  },
});

const fetchTargetReviews = createStep({
  id: 'fetch-target-reviews',
  description: 'Fetch reviews for the target business',
  inputSchema: placeEnrichedSchema,
  outputSchema: z.object({ reviews: reviewsResponseSchema }),
  execute: async ({ inputData, requestContext, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'reviews', status: 'running', message: 'جاري جلب التقييمات...' } });
    const result = await googleMapsReviewsTool.execute!({ place_id: inputData.placeId, language: 'ar', sort_by: 'newestFirst' }, { requestContext }) as any;
    await writer?.write({ type: 'data-step-progress', data: { step: 'reviews', status: 'complete', message: 'تم جلب التقييمات' } });
    return { reviews: result };
  },
});

const fetchCompetitorReviews = createStep({
  id: 'fetch-competitor-reviews',
  description: 'Fetch reviews for top 3 competitors to enable strengths/weaknesses analysis',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.object({ competitorReviews: z.array(competitorReviewSummarySchema) }),
  execute: async ({ inputData, requestContext, writer }) => {
    const competitors: z.infer<typeof nearbyPlaceSchema>[] = inputData['fetch-nearby-competitors']?.nearbyCompetitors ?? [];
    if (!competitors.length) return { competitorReviews: [] };

    await writer?.write({ type: 'data-step-progress', data: { step: 'competitor-reviews', status: 'running', message: 'جاري جلب تقييمات المنافسين...' } });

    // Pick top 3 by (rating * reviewCount) — most established competitors
    const top3 = [...competitors]
      .filter(c => c.id && c.userRatingCount && c.userRatingCount > 5)
      .sort((a, b) => ((b.rating ?? 0) * (b.userRatingCount ?? 0)) - ((a.rating ?? 0) * (a.userRatingCount ?? 0)))
      .slice(0, 3);

    const results = await Promise.allSettled(
      top3.map(async (c) => {
        const data = await googleMapsReviewsTool.execute!(
          { place_id: c.id, language: 'ar', sort_by: 'qualityScore' },
          { requestContext }
        ) as any;
        return {
          placeId: c.id,
          name: c.displayName?.text ?? 'Unknown',
          rating: c.rating,
          reviewCount: c.userRatingCount,
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

    await writer?.write({ type: 'data-step-progress', data: { step: 'competitor-reviews', status: 'complete', message: `تم جلب تقييمات ${competitorReviews.length} منافس` } });
    return { competitorReviews };
  },
});

const fetchSocialData = createStep({
  id: 'fetch-social-data',
  description: 'Scrape social media profiles',
  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.object({ socialData: socialDataSchema }),
  execute: async ({ inputData, requestContext, writer }) => {
    if (!inputData.instagramUser && !inputData.tiktokUser) return { socialData: { instagram: { username: '' }, tiktok: { username: '' } } as any };
    await writer?.write({ type: 'data-step-progress', data: { step: 'social', status: 'running', message: 'جاري تحليل وسائل التواصل...' } });
    try {
      const result = await socialMediaScraperTool.execute!({ instagram_user: inputData.instagramUser ?? '', tiktok_user: inputData.tiktokUser ?? '' }, { requestContext }) as any;
      await writer?.write({ type: 'data-step-progress', data: { step: 'social', status: 'complete', message: 'تم تحليل وسائل التواصل' } });
      return { socialData: result };
    } catch (err) {
      await writer?.write({ type: 'data-step-progress', data: { step: 'social', status: 'complete', message: 'فشل تحليل وسائل التواصل' } });
      return { socialData: { instagram: { username: inputData.instagramUser ?? '' }, tiktok: { username: inputData.tiktokUser ?? '' }, note: 'Fetch failed' } as any };
    }
  },
});

const runSemanticAnalysis = createStep({
    id: 'run-semantic-analysis',
    description: 'Extract structured themes from reviews',
    inputSchema: z.record(z.string(), z.any()),
    outputSchema: semanticAnalysisOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent('semanticAnalysisAgent');
        if (!agent) throw new Error('semanticAnalysisAgent not found');
        const response = await agent.generate(`Analyze reviews:\n${toYaml(inputData.reviews.reviews.slice(0, 20))}`, {
            structuredOutput: {
                schema: semanticAnalysisOutputSchema,
                errorStrategy: 'fallback',
                fallbackValue: { sentimentScore: 50, themes: [], criticalWeakness: 'Analysis failed' }
            }
        });
        return response.object;
    }
});

const runSocialAudit = createStep({
    id: 'run-social-audit',
    description: 'Extract structured metrics from social data',
    inputSchema: z.record(z.string(), z.any()),
    outputSchema: socialAuditOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent('socialEngagementAuditor');
        if (!agent) throw new Error('socialEngagementAuditor not found');
        const response = await agent.generate(`Audit social data:\n${toYaml(inputData.socialData)}`, {
            structuredOutput: {
                schema: socialAuditOutputSchema,
                errorStrategy: 'fallback',
                fallbackValue: { healthScore: 5, platformBenchmarks: [], contentStrategyGap: 'N/A', viralitySignals: { shareToImpressionRatio: 0, growthPotential: 'low' } }
            }
        });
        return response.object;
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

    await writer?.write({ type: 'data-step-progress', data: { step: 'directive', status: 'running', message: 'جاري تحليل الاستراتيجية...' } });
    const prompt = `Analyze this business and set the strategic directive:\n${JSON.stringify(inputData)}`;
    
    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: strategicDirectiveSchema,
        errorStrategy: 'fallback',
        fallbackValue: {
          theme: 'Business Health Assessment',
          northStarMetric: { name: 'Net Profit Margin', value: 0, target: 15, rationale: 'Core profitability focus' },
          focusAreas: { financial: 'Efficiency', digital: 'Reputation', market: 'Benchmarking' },
          overallStatus: 'WARNING' as const,
        },
      },
    });
    await writer?.write({ type: 'data-step-progress', data: { step: 'directive', status: 'complete', message: 'تم تحديد التوجه الاستراتيجي' } });
    return response.object;
  },
});

// ── Phase 2: Expert Sections (Parallel) ──────────────────────────────────────

const generateFinancialSection = createStep({
  id: 'generate-financial-section',
  description: 'Produce the structured Financials dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'financials', status: 'running', message: 'جاري تحليل الوضع المالي...' } });
    const agent = mastra?.getAgent('financialExpertAgent');
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

## Per-Product Data
${toYaml(inputData.items)}

## Task
Analyze the financial data and provide actionable insights.
IMPORTANT: Use the pre-computed KPIs exactly as provided in your metric-grid visuals.
Do NOT recalculate totals from per-product data.

**Visual Requirements:**
- For "top products by revenue" visualization: Use type "table" NOT "bar-chart". Include columns: المنتج، الإيرادات، هامش الربح، التصنيف (نجم/حصان/كلب/لغز)
- Keep bar-chart only for simple comparisons (2-3 items max)

Focus on profitability, break-even analysis, cost optimization, and menu engineering.`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'financials', title: 'Financial Performance', conclusion: { text: 'Financial analysis pending', severity: 'warning' }, visuals: [], narrative: 'Financial data is currently unavailable.' }
      }
    });
    
    await writer?.write({ type: 'data-step-progress', data: { step: 'financials', status: 'complete', message: 'تم تحليل الوضع المالي' } });
    return response.object;
  },
});

const generateDigitalSection = createStep({
  id: 'generate-digital-section',
  description: 'Produce the structured Digital Presence dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'digital', status: 'running', message: 'جاري تحليل الحضور الرقمي...' } });
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
Include visual components that show rating metrics, engagement benchmarks, and competitor comparisons.`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'digital', title: 'Digital Presence', conclusion: { text: 'Digital analysis pending', severity: 'warning' }, visuals: [], narrative: 'Social media data is currently unavailable.' }
      }
    });
    await writer?.write({ type: 'data-step-progress', data: { step: 'digital', status: 'complete', message: 'تم تحليل الحضور الرقمي' } });
    return response.object;
  },
});

const generateMarketSection = createStep({
  id: 'generate-market-section',
  description: 'Produce the structured Market Intelligence dashboard section',
  inputSchema: expertInputSchema,
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ type: 'data-step-progress', data: { step: 'market', status: 'running', message: 'جاري تحليل السوق...' } });
    const agent = mastra?.getAgent('marketExpertAgent');
    const prompt = `## Context
You are a market research specialist for Saudi F&B businesses.

## Data Fields (Arabic sample for output labels)
- competitorCount: عدد المنافسين
- averageRating: متوسط التقييم
- priceRange: نطاق الأسعار
- marketSaturation: تشبع السوق

## Strategic Directive
${inputData.directive.theme}

## Nearby Competitors
${toYaml(inputData.nearbyCompetitors.slice(0, 5))}

## Competitor Reviews (sampled from Google Maps)
${toYaml(inputData.competitorReviews ?? [])}

## Task
Analyze the market data and provide competitive insights.
Focus on competitor positioning, pricing strategies, and market opportunities.
Include visual components that show competitor metrics, pricing comparison, and market benchmarks.

**IMPORTANT: Exclude any competitor from your analysis if they have 0 reviews AND 0 rating.**
These are unverified or inactive listings, not real competitors.

**REQUIRED: Competitor Strengths & Weaknesses Table**
In your narrative, include a markdown table comparing each competitor:

| المنافس | نقاط القوة | نقاط الضعف | التقييم |
|---------|-----------|-----------|--------|
| اسم المنافس | قوة 1، قوة 2 | ضعف 1 | 4.5 ⭐ |

Base the strengths/weaknesses on their review content above.`;
    const response = await agent!.generate(prompt, {
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { id: 'market', title: 'Market Analysis', conclusion: { text: 'Market analysis pending', severity: 'warning' }, visuals: [], narrative: 'Competitor data is currently unavailable.' }
      }
    });
    await writer?.write({ type: 'data-step-progress', data: { step: 'market', status: 'complete', message: 'تم تحليل السوق' } });
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
  }),
  outputSchema: reportSectionSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await writer?.write({ 
      type: 'data-step-progress', 
      data: { step: 'action-plan', status: 'running', message: 'جاري بناء خطة العمل...' } 
    });
    
    const agent = mastra?.getAgent('cboAgent');
    if (!agent) throw new Error('cboAgent not found');

    const threadId: string | undefined = (inputData.base as any).threadId;
    
    const semanticSW = {
      strengths: (inputData.base as any).semanticAnalysis?.strengths ?? [],
      weaknesses: (inputData.base as any).semanticAnalysis?.weaknesses ?? [],
      criticalWeakness: (inputData.base as any).semanticAnalysis?.criticalWeakness ?? null,
    };

    const prompt = `## توليف خطة العمل

## التوجه الاستراتيجي
${toYaml((inputData.base as any).directive)}

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
      prepareStep: () => ({ model: 'openrouter/google/gemini-3.1-pro-preview' }),
      // No memory option — don't write to thread history, use working memory for context
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { 
          id: 'action-plan', 
          title: 'خطة العمل', 
          conclusion: { text: 'لم يتمكن النظام من إنشاء خطة العمل', severity: 'warning' as const }, 
          visuals: [], 
          narrative: 'حدث خطأ أثناء إنشاء خطة العمل.',
          phases: [],
          keyStrengths: [],
          keyRisks: [],
        }
      }
    });
    
    await writer?.write({ 
      type: 'data-step-progress', 
      data: { step: 'action-plan', status: 'complete', message: 'تم بناء خطة العمل' } 
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