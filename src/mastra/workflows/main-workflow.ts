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

// Re-export for backwards compatibility
export const workflowInputSchema = financialInputSchema;

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
  inputSchema: financialInputSchema,
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
  execute: async ({ inputData, mastra, writer }) => {
    const agent = mastra?.getAgent('cboAgent');
    if (!agent) throw new Error('cboAgent not found');

    const threadId = inputData.threadId || `studio-${Date.now()}`;

    await writer?.write({ type: 'data-step-progress', data: { step: 'directive', status: 'running', message: 'جاري تحليل الاستراتيجية...' } });
    const prompt = `Analyze this business and set the strategic directive:\n${JSON.stringify(inputData)}`;
    
    const response = await agent.generate(prompt, {
      memory: { thread: threadId, resource: 'user' },
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
    const threadId = (inputData.base as any)?.threadId;
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
    
    // Update working memory with human-readable summary
    if (threadId && agent) {
      try {
        const memory = await agent.getMemory(threadId);
        const result = response.object;
        const summary = `[الملخص المالي]
- هامش الربح الإجمالي: ${(inputData.base as any)?.grossMargin?.toFixed(1) ?? 'N/A'}%
- صافي الربح: ${(inputData.base as any)?.netProfit?.toFixed(0) ?? 'N/A'} ر.س
- الإيرادات الصافية: ${(inputData.base as any)?.netRevenue?.toFixed(0) ?? 'N/A'} ر.س
- التكاليف المتغيرة: ${(inputData.base as any)?.variableCosts?.toFixed(0) ?? 'N/A'} ر.س
- التكاليف الثابتة: ${(inputData.base as any)?.fixedCosts?.toFixed(0) ?? 'N/A'} ر.س
- حالة الربحية: ${(inputData.base as any)?.isAboveBreakEven ? 'مربح' : 'خاسر'}
- النتيجة: ${result?.conclusion?.text ?? 'تحليل مالي'}`.slice(0, 1000);
        
        await memory?.updateWorkingMemory({ threadId, resource: 'user', workingMemory: summary });
      } catch { /* ignore memory errors */ }
    }
    
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

    const threadId = (inputData.base as any).threadId || `studio-${Date.now()}`;
    
    const prompt = `## Action Plan Synthesis

## Overall Goal (North Star)
${toYaml((inputData.base as any).directive)}

## Input Analysis
### Financial Data
${toYaml(inputData.financials)}

### Digital/Social Data  
${toYaml(inputData.digital)}

### Market/Competitor Data
${toYaml(inputData.market)}

## Required Output Format

**IMPORTANT: Follow this exact structure:**

## Goal
[One sentence: The overall business objective]
Example: Increase CSAT from 68 to 85, translating to +20% customer retention and +15% revenue

## Phase 1: [Timeframe]
**Target Goal:** +[X] SAR revenue (e.g., +30,000 SAR/month)
**Steps:**
1. **Prepare Tools:** [Internal - hire staff, inventory, setup systems]
2. **Execute:** [External - advertise, based on [specific finding from analysis]]
[Additional steps as needed]

## Phase 2: [Timeframe]  
**Target Goal:** +[X] SAR revenue
**Steps:**
1. **Prepare Tools:** [Internal preparations]
2. **Execute:** [Based on [specific finding from analysis]]
[Additional steps as needed]

## Phase 3: [Timeframe]
**Target Goal:** [Final milestone]
**Steps:**
1. **Prepare Tools:** [Internal]
2. **Execute:** [Based on analysis]

## Rules:
1. **Internal before External:** All "prepare tools" steps (hiring, inventory, systems) MUST come BEFORE advertising/marketing steps
2. **Link to Analysis:** Every execution step must reference a specific finding from the input data
   - Example: "Launch Instagram ads featuring our cold brew (top performer per Digital Analysis)"
   - Example: "Address competitor X's weak pricing on lattes by offering promotions"
3. **Measurable:** Each step should have a metric or target
4. **Maximum 7 total steps** across all phases

## tacticalMoves Format:
List 5-7 top actions. Each must include:
- Phase reference: "[Phase 1]", "[Phase 2]", "[Phase 3]"
- Specific action with metric
- Source: "From Financial/Digital/Market analysis"
`;
    
    const response = await agent.generate(prompt, {
      prepareStep: () => ({ model: 'openrouter/google/gemini-3.1-pro-preview' }),
      memory: { thread: threadId, resource: 'user' },
      structuredOutput: {
        schema: reportSectionSchema,
        errorStrategy: 'fallback',
        fallbackValue: { 
          id: 'action-plan', 
          title: 'Action Plan', 
          conclusion: { text: 'Action plan synthesis failed', severity: 'warning' }, 
          visuals: [], 
          narrative: 'Could not generate action plan.',
          tacticalMoves: []
        }
      }
    });
    
    await writer?.write({ 
      type: 'data-step-progress', 
      data: { step: 'action-plan', status: 'complete', message: 'تم بناء خطة العمل' } 
    });
    
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

const localizeManifest = createStep({
    id: 'localize-manifest',
    description: 'Translate all English text in the manifest to Arabic with Saudi tone',
    inputSchema: reportManifestSchema,
    outputSchema: reportManifestSchema,
    execute: async ({ inputData, mastra, writer }) => {
        await writer?.write({ type: 'data-step-progress', data: { step: 'translate', status: 'running', message: 'جاري الترجمة إلى العربية...' } });
        const agent = mastra?.getAgent('translationAgent');
        if (!agent) return inputData;

        // 1. Collect all strings to be translated
        let stringsToTranslate: string[] = [];
        stringsToTranslate.push(inputData.directive.theme);
        stringsToTranslate.push(inputData.directive.northStarMetric.name);
        stringsToTranslate.push(inputData.directive.northStarMetric.rationale);
        stringsToTranslate.push(inputData.directive.focusAreas.financial);
        stringsToTranslate.push(inputData.directive.focusAreas.digital);
        stringsToTranslate.push(inputData.directive.focusAreas.market);

        inputData.sections.forEach(section => {
            // Override title with hard-coded Arabic title
            stringsToTranslate.push(ARABIC_SECTION_TITLES[section.id] || section.title);
            stringsToTranslate.push(section.conclusion.text);
            stringsToTranslate.push(section.narrative);
            section.visuals.forEach(visual => {
                stringsToTranslate.push(visual.title);
                stringsToTranslate.push(visual.description);
            });
            section.tacticalMoves?.forEach(move => {
                stringsToTranslate.push(move.action);
            });
        });
        
        const translationSchema = z.object({ translations: z.array(z.string()) });

        // 2. Call translation agent with Saudi tone guidance
        const tonePrompt = `
أنت كاتب محتوى عربي متخصص في التقارير المالية والتسويقية للمطاعم والمقاهي في السعودية.
هدفك هو جعل النص翻译 يبدو وكأنه كتبه محلل أعمال سعودي محترف - ودّي، قريب من الواقع، واحترافي.

قواعد مهمة جداً:
1. **الأرقام**: استخدم الأرقام الإنجليزية (1,234.56) وليس العربية (١٬٢٣٤٫٥٦). لا تترجم الأرقام مطلقاً.
2. **الرموز**: أضف رموز العملة والنسبة مباشرة بعد الرقم (مثل: 1,234 ر.س أو 25%)
3. **المصطلحات**: استخدم المصطلحات الشائعة في السوق السعودي (ريال، نسبة، هامش، إلخ)
4. **التنسيق**: اجعل الجمل قصيرة ومباشرة. تجنب الترجمة الحرفية.
5. **النبرة**: كأنك تكتب لصاحب café صغير - واضح، عملي، ومتفهم.

النصوص المراد ترجمتها:
${toYaml({ texts: stringsToTranslate })}`;

        // 2. Call translation agent
        const response = await agent.generate(
            tonePrompt,
            {
                structuredOutput: {
                    schema: translationSchema,
                    errorStrategy: 'fallback',
                    fallbackValue: { translations: stringsToTranslate }
                }
            }
        );
        
        let translations = response.object?.translations;
        if (!translations || translations.length !== stringsToTranslate.length) {
            return inputData;
        }
        
        // 3. Re-assemble the manifest with translated strings
        let i = 0;
        const translatedManifest = { ...inputData };

        translatedManifest.directive.theme = translations[i++];
        translatedManifest.directive.northStarMetric.name = translations[i++];
        translatedManifest.directive.northStarMetric.rationale = translations[i++];
        translatedManifest.directive.focusAreas.financial = translations[i++];
        translatedManifest.directive.focusAreas.digital = translations[i++];
        translatedManifest.directive.focusAreas.market = translations[i++];

        translatedManifest.sections.forEach(section => {
            // Use the translated title (already with hard-coded Arabic)
            section.title = translations[i++];
            section.conclusion.text = translations[i++];
            section.narrative = translations[i++];
            section.visuals.forEach(visual => {
                visual.title = translations[i++];
                visual.description = translations[i++];
            });
            section.tacticalMoves?.forEach(move => {
                move.action = translations[i++];
            });
        });

        await writer?.write({ type: 'data-step-progress', data: { step: 'translate', status: 'complete', message: 'تم الترجمة' } });
        return translatedManifest;
    }
});



// ── Workflow Definition ───────────────────────────────────────────────────────

export const businessAnalysisWorkflow = createWorkflow({
  id: 'business-analysis-workflow',
  inputSchema: financialInputSchema,
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
  .then(localizeManifest);

businessAnalysisWorkflow.commit();