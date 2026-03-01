import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { getPlaceDetails, getNearbyPlaces } from '../tools/google-places';
import { googleMapsReviewsTool } from '../tools/google-maps-reiews';
import { socialMediaScraperTool } from '../tools/social-media-scrape';
import { financialInputSchema, financialOutputSchema, computeFinancials } from '../shared/financials';
import {
  placeDetailsSchema,
  reviewsResponseSchema,
  nearbyPlaceSchema,
  socialDataSchema,
  competitorAnalysisSchema,
} from '../shared/schemas';

// Re-export for backwards compatibility
export const workflowInputSchema = financialInputSchema;

// ── Schemas ──────────────────────────────────────────────────────────────────

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
});

const externalDataOutputSchema = mergedExternalSchema.extend({
  socialData: socialDataSchema,
});

const socialAnalysisOutputSchema = z.object({
  sentimentAnalysis: z.string(),
  socialAudit: z.string(),
});

const reportInputSchema = mergedExternalSchema.extend({
  sentimentAnalysis: z.string(),
  socialAudit: z.string(),
  competitorAnalyses: z.array(competitorAnalysisSchema),
});

// ── Constants ────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// STEP — Collect Financials
// ────────────────────────────────────────────────────────────────────────────
const collectFinancials = createStep({
  id: 'collect-financials',
  description: 'Compute deterministic financial KPIs from user-provided data',
  inputSchema: financialInputSchema,
  outputSchema: financialOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data missing');
    return computeFinancials(inputData);
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Fetch Place Details
// ────────────────────────────────────────────────────────────────────────────
const fetchPlaceDetails = createStep({
  id: 'fetch-place-details',
  description: 'Fetch Google Place details and compute nearby search params',
  inputSchema: financialOutputSchema,
  outputSchema: placeEnrichedSchema,
  retries: 2,
  execute: async ({ inputData, requestContext }) => {
    const result = await getPlaceDetails.execute!(
      { place_id: inputData.placeId },
      { requestContext },
    ) as z.infer<typeof placeDetailsSchema>;

    const lat = result.location?.latitude;
    const lon = result.location?.longitude;

    const apiTypes = (result.types ?? []).filter((t: string) => FOOD_TYPES.has(t));
    const includedTypes = apiTypes.length > 0
      ? apiTypes
      : (TYPE_MAP[inputData.businessType] ?? ['cafe', 'coffee_shop', 'restaurant']);
    const radius = RADIUS_MAP[inputData.businessType] ?? 1000;

    console.log('[fetch-place-details] Done | types:', includedTypes, '| radius:', radius);

    return {
      ...inputData,
      placeDetails: result,
      lat,
      lon,
      includedTypes,
      radius,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Fetch Reviews (generic, reusable for target + competitors)
// ────────────────────────────────────────────────────────────────────────────
const reviewInputSchema = z.object({
  place_id: z.string(),
  sort_by: z.enum(['qualityScore', 'newestFirst', 'ratingHigh', 'ratingLow']).optional(),
});

const fetchReviews = createStep({
  id: 'fetch-reviews',
  description: 'Fetch Google Maps reviews for any place_id',
  inputSchema: reviewInputSchema,
  outputSchema: z.object({ place_id: z.string(), reviews: reviewsResponseSchema }),
  retries: 2,
  execute: async ({ inputData, requestContext }) => {
    const result = await googleMapsReviewsTool.execute!(
      { place_id: inputData.place_id, language: 'ar', sort_by: inputData.sort_by ?? 'qualityScore' },
      { requestContext },
    ) as z.infer<typeof reviewsResponseSchema>;
    console.log(`[fetch-reviews] ${inputData.place_id} fetched: ${result?.total_fetched}`);
    return { place_id: inputData.place_id, reviews: result };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Fetch Nearby Competitors
// ────────────────────────────────────────────────────────────────────────────
const fetchNearbyCompetitors = createStep({
  id: 'fetch-nearby-competitors',
  description: 'Search for nearby competitor businesses',
  inputSchema: placeEnrichedSchema,
  outputSchema: z.object({ nearbyCompetitors: z.array(nearbyPlaceSchema) }),
  retries: 2,
  execute: async ({ inputData, requestContext }) => {
    if (inputData.lat == null || inputData.lon == null) {
      console.warn('[fetch-nearby-competitors] No coordinates — skipping');
      return { nearbyCompetitors: [] };
    }
    const result = await getNearbyPlaces.execute!(
      {
        lat: inputData.lat,
        lon: inputData.lon,
        radius: inputData.radius,
        includedTypes: inputData.includedTypes,
      },
      { requestContext },
    ) as { places: z.infer<typeof nearbyPlaceSchema>[] };
    const places = result.places ?? [];
    console.log('[fetch-nearby-competitors] Found:', places?.length ?? 0);
    return { nearbyCompetitors: places };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Fetch Social Media (branch: has handles)
// ────────────────────────────────────────────────────────────────────────────
const fetchSocialMedia = createStep({
  id: 'fetch-social-media',
  description: 'Scrape Instagram and TikTok profile data',
  inputSchema: mergedExternalSchema,
  outputSchema: z.object({ socialData: socialDataSchema }),
  retries: 1,
  execute: async ({ inputData, requestContext }) => {
    try {
      const result = await socialMediaScraperTool.execute!(
        { instagram_user: inputData.instagramUser ?? '', tiktok_user: inputData.tiktokUser ?? '' },
        { requestContext },
      ) as z.infer<typeof socialDataSchema>;
      console.log('[fetch-social-media] Data fetched');
      return { socialData: result };
    } catch (err) {
      console.error('[fetch-social-media] Error:', err);
      return {
        socialData: {
          instagram: { username: inputData.instagramUser ?? '' },
          tiktok: { username: inputData.tiktokUser ?? '' },
          note: 'Social media data unavailable',
        },
      };
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Skip Social Media (branch: no handles)
// ────────────────────────────────────────────────────────────────────────────
const skipSocialMedia = createStep({
  id: 'skip-social-media',
  description: 'No social handles provided — skip social fetch',
  inputSchema: mergedExternalSchema,
  outputSchema: z.object({ socialData: socialDataSchema }),
  execute: async () => {
    console.log('[skip-social-media] No social handles — skipping');
    return {
      socialData: {
        instagram: { username: '' },
        tiktok: { username: '' },
        note: 'No social handles provided',
      },
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Capture Input (passthrough for nested workflow access)
// ────────────────────────────────────────────────────────────────────────────
const captureInput = createStep({
  id: 'capture-input',
  description: 'Passthrough to capture nested workflow input for later steps',
  inputSchema: mergedExternalSchema,
  outputSchema: mergedExternalSchema,
  execute: async ({ inputData }) => inputData,
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Semantic Analysis
// ────────────────────────────────────────────────────────────────────────────
const runSemanticAnalysis = createStep({
  id: 'run-semantic-analysis',
  description: 'Run ABSA sentiment analysis on reviews',
  inputSchema: externalDataOutputSchema,
  outputSchema: z.object({ sentimentAnalysis: z.string() }),
  retries: 1,
  execute: async ({ inputData, mastra }) => {
    if (!inputData.reviews || inputData.reviews.reviews.length === 0) {
      return { sentimentAnalysis: 'No reviews available for analysis.' };
    }
    const agent = mastra?.getAgent('semanticAnalysisAgent');
    if (!agent) throw new Error('semanticAnalysisAgent not found');

    const response = await agent.generate([
      {
        role: 'user' as const,
        content:
          `Perform ABSA on the following Google Maps reviews for "${inputData.businessName}" (place_id: ${inputData.placeId}).\n\n` +
          `Reviews JSON:\n${JSON.stringify(inputData.reviews)}\n\n` +
          `Provide Top 5 Strengths and Top 5 Weaknesses following your instructions.`,
      },
    ]);
    console.log('[run-semantic-analysis] Complete');
    return { sentimentAnalysis: response.text ?? 'Analysis unavailable.' };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Social Audit
// ────────────────────────────────────────────────────────────────────────────
const runSocialAudit = createStep({
  id: 'run-social-audit',
  description: 'Audit social media presence and engagement',
  inputSchema: externalDataOutputSchema,
  outputSchema: z.object({ socialAudit: z.string() }),
  retries: 1,
  execute: async ({ inputData, mastra }) => {
    if (!inputData.socialData?.instagram?.username && !inputData.socialData?.tiktok?.username) {
      return { socialAudit: 'No social media data available.' };
    }
    const agent = mastra?.getAgent('socialEngagementAuditor');
    if (!agent) throw new Error('socialEngagementAuditor not found');

    const response = await agent.generate([
      {
        role: 'user' as const,
        content:
          `Audit the social media presence for "${inputData.businessName}".\n\n` +
          `Social Media Data:\n${JSON.stringify(inputData.socialData)}\n\n` +
          `Nearby Competitors (for context):\n${JSON.stringify(inputData.nearbyCompetitors)}\n\n` +
          `Provide the Social Health Score (1–10) and full audit following your instructions.`,
      },
    ]);
    console.log('[run-social-audit] Complete');
    return { socialAudit: response.text ?? 'Audit unavailable.' };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Analyze Competitor Reviews
// ────────────────────────────────────────────────────────────────────────────
const analyzeCompetitorReviews = createStep({
  id: 'analyze-competitor-reviews',
  description: 'Run compact SWOT analysis on competitor reviews',
  inputSchema: z.object({
    place_id: z.string(),
    reviews: reviewsResponseSchema,
  }),
  outputSchema: competitorAnalysisSchema,
  retries: 1,
  execute: async ({ inputData, mastra }) => {
    if (inputData.reviews.total_fetched === 0) {
      return { place_id: inputData.place_id, analysis: 'No reviews available for competitor.' };
    }
    const agent = mastra?.getAgent('semanticAnalysisAgent');
    if (!agent) throw new Error('semanticAnalysisAgent not found');

    const response = await agent.generate([
      {
        role: 'user' as const,
        content:
          `COMPETITOR ANALYSIS MODE: Analyze reviews for competitor place_id: ${inputData.place_id}.\n\n` +
          `Reviews JSON:\n${JSON.stringify(inputData.reviews)}\n\n` +
          `Provide compact SWOT: Top 2 strengths, Primary weakness, One opportunity for the target business. Max 150 words.`,
      },
    ]);
    console.log(`[analyze-competitor-reviews] ${inputData.place_id} complete`);
    return { place_id: inputData.place_id, analysis: response.text ?? 'Analysis unavailable.' };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Generate Final Report (CBO Agent)
// ────────────────────────────────────────────────────────────────────────────
const generateReport = createStep({
  id: 'generate-report',
  description: 'CBO agent synthesizes all data into a comprehensive business health report',
  inputSchema: reportInputSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data missing');

    const {
      businessName, businessType, placeId,
      instagramUser, tiktokUser,
      netRevenue, variableCosts, fixedCosts, totalCosts,
      grossProfit, netProfit, grossMargin, netMargin,
      contributionMarginRatio, breakEvenRevenue, breakEvenGap, isAboveBreakEven,
      rawMaterials, packaging,
      items,
      placeDetails, nearbyCompetitors,
      sentimentAnalysis, socialAudit,
      competitorAnalyses,
    } = inputData;

    const synthesisAgent = mastra?.getAgent('cboSynthesisAgent');
    if (!synthesisAgent) throw new Error('CBO Synthesis agent not found');

    // Build per-product breakeven table
    const perProductTable = items.map((i) =>
      `| ${i.name} | ${i.sellingPrice.toFixed(2)} | ${i.variableCostPerUnit.toFixed(2)} | ${i.contributionMarginPerUnit.toFixed(2)} | ${i.breakEvenUnits >= Number.MAX_SAFE_INTEGER ? '∞' : i.breakEvenUnits.toFixed(0)} | ${i.soldUnits} | ${i.capacityUtilizationPercent.toFixed(1)}% | ${i.menuCategory} | ${i.isBelowCost ? 'LOSS' : 'OK'} |`,
    ).join('\n');

    // Build price floor warnings
    const belowCostItems = items.filter((i) => i.isBelowCost);
    const priceWarnings = belowCostItems.length > 0
      ? belowCostItems.map((i) =>
          `> ⚠️ **${i.name} يُباع بخسارة!** سعر البيع (${i.sellingPrice.toFixed(2)} SAR) أقل من تكلفة الوحدة (${i.variableCostPerUnit.toFixed(2)} SAR) — خسارة ${i.lossPerUnit.toFixed(2)} SAR لكل وحدة.`,
        ).join('\n')
      : 'لا توجد منتجات تُباع بخسارة.';

    // Build margin ranking
    const marginRanking = [...items]
      .sort((a, b) => a.marginRank - b.marginRank)
      .map((i, idx) => `${idx + 1}. ${i.name}: هامش المساهمة ${i.contributionMarginPerUnit.toFixed(2)} SAR (ترتيب الإيراد: #${i.revenueRank})`)
      .join('\n');

    // Build competitor analysis section
    const competitorAnalysisSection = competitorAnalyses.length > 0
      ? competitorAnalyses.map((c) =>
          `### Competitor: ${c.place_id}\n${c.analysis}`,
        ).join('\n\n')
      : 'No competitor analysis available.';

    const prompt = `
Generate a comprehensive F&B Business Intelligence Report for **${businessName}** (${businessType}).

## SOCIAL HANDLES (use these for the §0 business card)
- Instagram: ${instagramUser ? '@' + instagramUser : 'Not provided'}
- TikTok: ${tiktokUser ? '@' + tiktokUser : 'Not provided'}

## FINANCIAL KPIs (DO NOT RECALCULATE — treat as absolute facts)
- Net Revenue: ${netRevenue.toFixed(2)} SAR
- Variable Costs: ${variableCosts.toFixed(2)} SAR (Raw Materials: ${rawMaterials.toFixed(2)} SAR + Packaging: ${packaging.toFixed(2)} SAR + Production Staff: ${(variableCosts - rawMaterials - packaging).toFixed(2)} SAR)
- Fixed Costs: ${fixedCosts.toFixed(2)} SAR
- Total Costs: ${totalCosts.toFixed(2)} SAR
- Gross Profit: ${grossProfit.toFixed(2)} SAR | Gross Margin: ${grossMargin.toFixed(2)}%
- Net Profit: ${netProfit.toFixed(2)} SAR | Net Margin: ${netMargin.toFixed(2)}%
- Contribution Margin Ratio: ${(contributionMarginRatio * 100).toFixed(2)}%
- Break-Even Revenue: ${breakEvenRevenue.toFixed(2)} SAR
- Break-Even Gap: ${breakEvenGap.toFixed(2)} SAR (${isAboveBreakEven ? 'ABOVE break-even ✓' : 'BELOW break-even ✗'})

## PER-PRODUCT BREAKEVEN ANALYSIS
| Product | Selling Price | Variable Cost/Unit | Contribution Margin | Break-Even Units | Sold | Capacity Util. | Category | Status |
|---------|--------------|-------------------|-------------------|-----------------|------|---------------|----------|--------|
${perProductTable}

### Price Floor Warnings
${priceWarnings}

### Margin Ranking (by Contribution Margin)
${marginRanking}

## GOOGLE PLACE DATA (place_id: ${placeId})
${JSON.stringify(placeDetails)}

## COMPETITOR LANDSCAPE (nearby businesses)
${JSON.stringify(nearbyCompetitors)}

## COMPETITOR ANALYSIS (pre-analyzed)
${competitorAnalysisSection}

## REVIEW SENTIMENT ANALYSIS
${sentimentAnalysis}

## SOCIAL MEDIA AUDIT
${socialAudit}

---

**COMPETITOR SWOT REQUIREMENT:**
The competitor analysis summaries are provided above in "COMPETITOR ANALYSIS (pre-analyzed)". You MUST:
1. Use the pre-analyzed competitor SWOT data provided above (already fetched and analyzed)
2. Synthesize each competitor's strengths and weaknesses into the SWOT table
3. Produce the SWOT mini-table in the Competitor Benchmarking section:

| المنافس | القوة 1 | القوة 2 | الضعف الرئيسي |
|---------|---------|---------|--------------|

4. Reference each competitor weakness in at least one Action Plan item
Do NOT skip this step. If a competitor has zero reviews, infer from rating alone.

---
Using all the above data, produce the full Business Health Report following your instructions exactly.
Calculate the Hybrid Health Score using the formula from your instructions.
**MANDATORY: Write the entire report in Arabic. Section headers may be in English, but all analysis, insights, and recommendations must be in Arabic.**
`;

    const response = await synthesisAgent.generate([
      { role: 'user', content: prompt },
    ]);

    const report = response.text ?? 'Report generation failed.';
    console.log('[generate-report] Report generated, length:', report.length);
    return { report };
  },
});

const processCompetitor = createWorkflow({
  id: 'process-competitor',
  inputSchema: reviewInputSchema,
  outputSchema: competitorAnalysisSchema,
})
  .then(fetchReviews)
  .then(analyzeCompetitorReviews);

processCompetitor.commit();

// ────────────────────────────────────────────────────────────────────────────
// NESTED WORKFLOW — Competitor Pipeline (select top → foreach process)
// ────────────────────────────────────────────────────────────────────────────
const competitorPipeline = createWorkflow({
  id: 'competitor-pipeline',
  inputSchema: mergedExternalSchema,
  outputSchema: z.array(competitorAnalysisSchema),
})
  .map(
    async ({ inputData }) => {
      const data = inputData as z.infer<typeof mergedExternalSchema>;
      const competitors = data.nearbyCompetitors;
      const ranked = competitors
        .filter((c) => {
          const name = c.displayName?.text ?? '';
          return name !== data.businessName;
        })
        .map((c) => ({
          place_id: c.id ?? '',
          name: c.displayName?.text ?? '',
          rating: c.rating ?? 0,
          userRatingCount: c.userRatingCount ?? 0,
          reputationScore: (c.rating ?? 0) * (c.userRatingCount ?? 0),
        }))
        .sort((a, b) => b.reputationScore - a.reputationScore)
        .slice(0, 3);
      console.log('[select-top-competitors]', ranked.map((c) => `${c.name} (${c.reputationScore})`).join(', '));
      return ranked.map((c) => ({ place_id: c.place_id, sort_by: 'qualityScore' as const }));
    },
    { id: 'select-top-competitors' },
  )
  .foreach(processCompetitor, { concurrency: 3 });

competitorPipeline.commit();

// ────────────────────────────────────────────────────────────────────────────
// NESTED WORKFLOW — Social + Analysis Path
// ────────────────────────────────────────────────────────────────────────────
const socialAndAnalysisPath = createWorkflow({
  id: 'social-and-analysis-path',
  inputSchema: mergedExternalSchema,
  outputSchema: socialAnalysisOutputSchema,
})
  .then(captureInput)
  .branch([
    [async ({ inputData }: { inputData: z.infer<typeof mergedExternalSchema> }) => !!(inputData.instagramUser || inputData.tiktokUser), fetchSocialMedia],
    [async ({ inputData }: { inputData: z.infer<typeof mergedExternalSchema> }) => !(inputData.instagramUser || inputData.tiktokUser), skipSocialMedia],
  ])
  .map(
    async ({ inputData, getStepResult }) => {
      const baseData = getStepResult<z.infer<typeof mergedExternalSchema>>('capture-input');
      const branchResult = inputData as Record<string, { socialData?: z.infer<typeof socialDataSchema> } | undefined>;
      const socialData = branchResult['fetch-social-media']?.socialData
        ?? branchResult['skip-social-media']?.socialData
        ?? { instagram: { username: '' }, tiktok: { username: '' }, note: 'No social data' };
      return { ...baseData, socialData };
    },
    { id: 'normalize-social-data' },
  )
  .parallel([runSemanticAnalysis, runSocialAudit])
  .map(
    async ({ inputData }) => {
      const analysisResult = inputData as Record<string, { sentimentAnalysis?: string; socialAudit?: string }>;
      return {
        sentimentAnalysis: analysisResult['run-semantic-analysis']?.sentimentAnalysis ?? 'No reviews available for analysis.',
        socialAudit: analysisResult['run-social-audit']?.socialAudit ?? 'No social media data available.',
      };
    },
    { id: 'merge-social-analysis' },
  );

socialAndAnalysisPath.commit();

// ────────────────────────────────────────────────────────────────────────────
// Workflow Assembly
// ────────────────────────────────────────────────────────────────────────────
export const businessAnalysisWorkflow = createWorkflow({
  id: 'business-analysis-workflow',
  inputSchema: financialInputSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
  options: {
    onFinish: async (result) => {
      console.log(`[workflow] ${result.workflowId} run ${result.runId} finished: ${result.status}`);
    },
    onError: async (errorInfo) => {
      console.error(`[workflow] ${errorInfo.workflowId} failed:`, errorInfo.error?.message);
      for (const [stepId, stepResult] of Object.entries(errorInfo.steps)) {
        if (stepResult.status === 'failed') {
          console.error(`[workflow] Step ${stepId} failed:`, stepResult.error);
        }
      }
    },
  },
})
  .then(collectFinancials)
  .then(fetchPlaceDetails)
  // Fetch target reviews + nearby competitors in parallel
  .parallel([
    createStep({
      id: 'fetch-target-reviews',
      description: 'Fetch reviews for the target business',
      inputSchema: placeEnrichedSchema,
      outputSchema: z.object({ reviews: reviewsResponseSchema }),
      retries: 2,
      execute: async ({ inputData, requestContext }) => {
        const result = await googleMapsReviewsTool.execute!(
          { place_id: inputData.placeId, language: 'ar', sort_by: 'newestFirst' },
          { requestContext },
        ) as z.infer<typeof reviewsResponseSchema>;
        console.log(`[fetch-target-reviews] Fetched: ${result?.total_fetched}`);
        return { reviews: result };
      },
    }),
    fetchNearbyCompetitors,
  ])
  .map(
    async ({ inputData, getStepResult }) => {
      const placeData = getStepResult(fetchPlaceDetails);
      const parallelResult = inputData as Record<string, any>;
      return {
        ...placeData,
        reviews: parallelResult['fetch-target-reviews']?.reviews ?? { reviews: [], total_fetched: 0, sort_used: 'newestFirst' },
        nearbyCompetitors: parallelResult['fetch-nearby-competitors']?.nearbyCompetitors ?? [],
      };
    },
    { id: 'merge-external-data' },
  )
  // Social+analysis path runs in parallel with competitor pipeline
  .parallel([socialAndAnalysisPath, competitorPipeline])
  .map(
    async ({ inputData, getStepResult }) => {
      const mergedData = getStepResult<z.infer<typeof mergedExternalSchema>>('merge-external-data');
      const parallelResult = inputData as Record<string, any>;

      const socialAnalysis = parallelResult['social-and-analysis-path'] ?? {};
      const competitorAnalyses = parallelResult['competitor-pipeline'] ?? [];

      return {
        ...mergedData,
        sentimentAnalysis: socialAnalysis.sentimentAnalysis ?? 'No reviews available for analysis.',
        socialAudit: socialAnalysis.socialAudit ?? 'No social media data available.',
        competitorAnalyses,
      };
    },
    { id: 'merge-all' },
  )
  .then(generateReport);

businessAnalysisWorkflow.commit();

// Legacy alias for backwards compatibility
export { businessAnalysisWorkflow as weatherWorkflow };
