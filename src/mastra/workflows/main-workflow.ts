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
// Helper — Build shared prompt data fragments
// ────────────────────────────────────────────────────────────────────────────
function buildFinancialKPIsBlock(d: z.infer<typeof reportInputSchema>) {
  const perProductTable = d.items.map((i) =>
    `| ${i.name} | ${i.sellingPrice.toFixed(2)} | ${i.variableCostPerUnit.toFixed(2)} | ${i.contributionMarginPerUnit.toFixed(2)} | ${i.breakEvenUnits >= Number.MAX_SAFE_INTEGER ? '∞' : i.breakEvenUnits.toFixed(0)} | ${i.soldUnits} | ${i.capacityUtilizationPercent.toFixed(1)}% | ${i.menuCategory} | ${i.isBelowCost ? 'LOSS' : 'OK'} |`,
  ).join('\n');

  const belowCostItems = d.items.filter((i) => i.isBelowCost);
  const priceWarnings = belowCostItems.length > 0
    ? belowCostItems.map((i) =>
        `> ⚠️ **${i.name} يُباع بخسارة!** سعر البيع (${i.sellingPrice.toFixed(2)} SAR) أقل من تكلفة الوحدة (${i.variableCostPerUnit.toFixed(2)} SAR) — خسارة ${i.lossPerUnit.toFixed(2)} SAR لكل وحدة.`,
      ).join('\n')
    : 'لا توجد منتجات تُباع بخسارة.';

  const marginRanking = [...d.items]
    .sort((a, b) => a.marginRank - b.marginRank)
    .map((i, idx) => `${idx + 1}. ${i.name}: هامش المساهمة ${i.contributionMarginPerUnit.toFixed(2)} SAR (ترتيب الإيراد: #${i.revenueRank})`)
    .join('\n');

  return `
## FINANCIAL KPIs (DO NOT RECALCULATE — treat as absolute facts)
- Net Revenue: ${d.netRevenue.toFixed(2)} SAR
- Variable Costs: ${d.variableCosts.toFixed(2)} SAR (Raw Materials: ${d.rawMaterials.toFixed(2)} SAR + Packaging: ${d.packaging.toFixed(2)} SAR + Production Staff: ${(d.variableCosts - d.rawMaterials - d.packaging).toFixed(2)} SAR)
- Fixed Costs: ${d.fixedCosts.toFixed(2)} SAR
- Total Costs: ${d.totalCosts.toFixed(2)} SAR
- Gross Profit: ${d.grossProfit.toFixed(2)} SAR | Gross Margin: ${d.grossMargin.toFixed(2)}%
- Net Profit: ${d.netProfit.toFixed(2)} SAR | Net Margin: ${d.netMargin.toFixed(2)}%
- Contribution Margin Ratio: ${(d.contributionMarginRatio * 100).toFixed(2)}%
- Break-Even Revenue: ${d.breakEvenRevenue.toFixed(2)} SAR
- Break-Even Gap: ${d.breakEvenGap.toFixed(2)} SAR (${d.isAboveBreakEven ? 'ABOVE break-even ✓' : 'BELOW break-even ✗'})

## PER-PRODUCT BREAKEVEN ANALYSIS
| Product | Selling Price | Variable Cost/Unit | Contribution Margin | Break-Even Units | Sold | Capacity Util. | Category | Status |
|---------|--------------|-------------------|-------------------|-----------------|------|---------------|----------|--------|
${perProductTable}

### Price Floor Warnings
${priceWarnings}

### Margin Ranking (by Contribution Margin)
${marginRanking}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Schemas for parallel section writers
// ────────────────────────────────────────────────────────────────────────────
const financialSectionSchema = z.object({
  sectionMarkdown: z.string().describe('Complete <!-- SECTION: financials --> content'),
});

const digitalPresenceSectionSchema = z.object({
  sectionMarkdown: z.string().describe('Complete <!-- SECTION: digital-presence --> content'),
});

const benchmarkSectionSchema = z.object({
  sectionMarkdown: z.string().describe('Complete <!-- SECTION: benchmarks --> content'),
});

const composerOutputSchema = z.object({
  report: z.string().describe('Full report with all 7 sections assembled in order with markers'),
});

// Structured data forwarded alongside the report for the frontend UI
const workflowOutputSchema = z.object({
  report: z.string(),
  data: reportInputSchema,
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Write Financial Section (parallel)
// ────────────────────────────────────────────────────────────────────────────
const writeFinancials = createStep({
  id: 'write-financials',
  description: 'Financial writer agent generates the financials section',
  inputSchema: reportInputSchema,
  outputSchema: z.object({ financialsSection: z.string() }),
  execute: async ({ inputData, mastra }) => {
    console.log(`[write-financials] ENTERED`);
    const agent = mastra?.getAgent('financialWriterAgent');
    if (!agent) throw new Error('financialWriterAgent not found');

    const prompt = `
Write the **financials** section (Section 2 + Section 2.5) for **${inputData.businessName}** (${inputData.businessType}).

${buildFinancialKPIsBlock(inputData)}

**MANDATORY: Write the entire section in Arabic. Follow your instructions exactly.**
`;

    const response = await agent.generate([{ role: 'user', content: prompt }], {
      structuredOutput: { schema: financialSectionSchema },
    });
    const raw = (response as any).object?.sectionMarkdown ?? response.text ?? '';
    // Safety net: replace any <br> tags the model may have used in table cells with Arabic comma
    const result = raw.replace(/<br\s*\/?>/gi, '، ');
    console.log('[write-financials] Done, length:', result.length);
    return { financialsSection: result };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Write Digital Presence Section (parallel)
// ────────────────────────────────────────────────────────────────────────────
const writeDigitalPresence = createStep({
  id: 'write-digital-presence',
  description: 'Digital presence writer agent generates the digital-presence section',
  inputSchema: reportInputSchema,
  outputSchema: z.object({ digitalPresenceSection: z.string() }),
  execute: async ({ inputData, mastra }) => {
    console.log(`[write-digital-presence] ENTERED`);
    const agent = mastra?.getAgent('digitalPresenceWriterAgent');
    if (!agent) throw new Error('digitalPresenceWriterAgent not found');

    const prompt = `
Write the **digital-presence** section (Section 4 + Section 5) for **${inputData.businessName}** (${inputData.businessType}).

## SOCIAL HANDLES
- Instagram: ${inputData.instagramUser ? '@' + inputData.instagramUser : 'Not provided'}
- TikTok: ${inputData.tiktokUser ? '@' + inputData.tiktokUser : 'Not provided'}

## GOOGLE PLACE DATA (place_id: ${inputData.placeId})
${JSON.stringify(inputData.placeDetails)}

## COMPETITOR LANDSCAPE (nearby businesses — for rating comparison)
${JSON.stringify(inputData.nearbyCompetitors)}

## REVIEW SENTIMENT ANALYSIS
${inputData.sentimentAnalysis}

## SOCIAL MEDIA AUDIT
${inputData.socialAudit}

**MANDATORY: Write the entire section in Arabic. Follow your instructions exactly.**
`;

    const response = await agent.generate([{ role: 'user', content: prompt }], {
      structuredOutput: { schema: digitalPresenceSectionSchema },
    });
    const result = (response as any).object?.sectionMarkdown ?? response.text ?? '';
    const finishReason = (response as any).finishReason ?? 'unknown';
    console.log(`[write-digital-presence] Done, length: ${result.length}, finishReason: ${finishReason}`);
    if (finishReason === 'length') {
      console.warn('[write-digital-presence] WARNING: output was TRUNCATED by token limit (finishReason=length)');
    }
    return { digitalPresenceSection: result };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Write Market Benchmarks Section (parallel)
// ────────────────────────────────────────────────────────────────────────────
const writeMarketBenchmarks = createStep({
  id: 'write-market-benchmarks',
  description: 'Market benchmark writer agent generates the benchmarks section with web search',
  inputSchema: reportInputSchema,
  outputSchema: z.object({ benchmarksSection: z.string() }),
  execute: async ({ inputData, mastra }) => {
    console.log(`[write-market-benchmarks] ENTERED`);
    const agent = mastra?.getAgent('marketBenchmarkWriterAgent');
    if (!agent) throw new Error('marketBenchmarkWriterAgent not found');

    const competitorAnalysisSection = inputData.competitorAnalyses.length > 0
      ? inputData.competitorAnalyses.map((c) =>
          `### Competitor: ${c.place_id}\n${c.analysis}`,
        ).join('\n\n')
      : 'No competitor analysis available.';

    const prompt = `
Write the **benchmarks** section (Section 6) for **${inputData.businessName}** (${inputData.businessType}).

## FINANCIAL KPIs (for comparison table)
- Net Revenue: ${inputData.netRevenue.toFixed(2)} SAR
- Gross Margin: ${inputData.grossMargin.toFixed(2)}%
- Net Margin: ${inputData.netMargin.toFixed(2)}%
- Fixed Costs: ${inputData.fixedCosts.toFixed(2)} SAR
- Contribution Margin Ratio: ${(inputData.contributionMarginRatio * 100).toFixed(2)}%

## GOOGLE PLACE DATA (place_id: ${inputData.placeId})
${JSON.stringify(inputData.placeDetails)}

## COMPETITOR LANDSCAPE (nearby businesses)
${JSON.stringify(inputData.nearbyCompetitors)}

## COMPETITOR ANALYSIS (pre-analyzed)
${competitorAnalysisSection}

## SOCIAL HANDLES (for comparison table)
- Instagram: ${inputData.instagramUser ? '@' + inputData.instagramUser : 'Not provided'}
- TikTok: ${inputData.tiktokUser ? '@' + inputData.tiktokUser : 'Not provided'}

## SOCIAL MEDIA AUDIT (for engagement rates in comparison table)
${inputData.socialAudit}

**COMPETITOR SWOT REQUIREMENT:**
The competitor analysis summaries are provided above in "COMPETITOR ANALYSIS (pre-analyzed)". You MUST:
1. Use the pre-analyzed competitor SWOT data provided above (already fetched and analyzed)
2. Synthesize each competitor's strengths and weaknesses into the SWOT table
3. If a competitor has zero reviews, infer from rating alone.

**MANDATORY: Write the entire section in Arabic. Follow your instructions exactly.**
**MANDATORY: Use webSearchTool for 2 searches as specified in your instructions.**
`;

    const response = await agent.generate([{ role: 'user', content: prompt }], {
      structuredOutput: {
        schema: benchmarkSectionSchema,
        jsonPromptInjection: true,
      },
    });
    const result = (response as any).object?.sectionMarkdown ?? response.text ?? '';
    console.log('[write-market-benchmarks] Done, length:', result.length);
    return { benchmarksSection: result };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP — Compose Final Report (after parallel writers)
// ────────────────────────────────────────────────────────────────────────────
const composeReport = createStep({
  id: 'compose-report',
  description: 'Report composer assembles all sections into the final report',
  inputSchema: reportInputSchema.extend({
    financialsSection: z.string(),
    digitalPresenceSection: z.string(),
    benchmarksSection: z.string(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    console.log(`[compose-report] ENTERED`);
    console.log('[compose-report] input keys:', Object.keys(inputData));
    console.log('[compose-report] input size (bytes):', JSON.stringify(inputData).length);
    const agent = mastra?.getAgent('reportComposerAgent');
    if (!agent) throw new Error('reportComposerAgent not found');

    const prompt = `
Compose the final F&B Business Intelligence Report for **${inputData.businessName}** (${inputData.businessType}).

## YOUR TASKS:
1. Write: header (business card + exec summary), health-score, assessment (strengths + weaknesses), action-plan
2. Assemble ALL 7 sections in order, inserting the 3 pre-written sections exactly as provided

## SOCIAL HANDLES (for §0 business card)
- Instagram: ${inputData.instagramUser ? '@' + inputData.instagramUser : 'Not provided'}
- TikTok: ${inputData.tiktokUser ? '@' + inputData.tiktokUser : 'Not provided'}

${buildFinancialKPIsBlock(inputData)}

## GOOGLE PLACE DATA (place_id: ${inputData.placeId})
${JSON.stringify(inputData.placeDetails)}

## COMPETITOR LANDSCAPE (nearby businesses — for competitive sub-score)
${JSON.stringify(inputData.nearbyCompetitors)}

## SOCIAL MEDIA AUDIT (for social sub-score + business card)
${inputData.socialAudit}

## REVIEW SENTIMENT ANALYSIS (for assessment strengths/weaknesses)
${inputData.sentimentAnalysis}

---

## PRE-WRITTEN SECTIONS (insert these exactly as-is in the correct positions)

### FINANCIALS SECTION (insert between health-score and digital-presence):
${inputData.financialsSection}

### DIGITAL PRESENCE SECTION (insert between financials and benchmarks):
${inputData.digitalPresenceSection}

### BENCHMARKS SECTION (insert between digital-presence and assessment):
${inputData.benchmarksSection}

---

**MANDATORY: Write the entire report in Arabic. Section headers may be in English, but all analysis, insights, and recommendations must be in Arabic.**
**MANDATORY: Calculate the Hybrid Health Score using the formula from your instructions.**
**MANDATORY: Insert the 3 pre-written sections EXACTLY as provided — do not modify, summarize, or rewrite them.**
`;

    const response = await agent.generate([{ role: 'user', content: prompt }], {
      structuredOutput: { schema: composerOutputSchema },
    });
    const report = (response as any).object?.report ?? response.text ?? 'Report generation failed.';
    console.log('[compose-report] Report generated, length:', report.length);

    // Forward structured data alongside the report for frontend UI rendering
    const { financialsSection: _fs, digitalPresenceSection: _dp, benchmarksSection: _bs, ...structuredData } = inputData;
    return { report, data: structuredData };
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
      console.log(`[workflow:onFinish] run=${result.runId} status=${result.status}`);
      console.log(`[workflow:onFinish] result keys:`, result.result ? Object.keys(result.result) : 'NO_RESULT');
      console.log(`[workflow:onFinish] report length:`, (result.result as any)?.report?.length ?? 0);
      if (result.status !== 'success') {
        console.error(`[workflow:onFinish] non-success status — full result:`, JSON.stringify(result.result)?.slice(0, 500));
      }
      // Log every step's final status
      for (const [stepId, stepResult] of Object.entries(result.steps)) {
        console.log(`[workflow:onFinish] step ${stepId}: ${stepResult.status}${stepResult.status === 'failed' ? ` — ${stepResult.error}` : ''}`);
      }
    },
    onError: async (errorInfo) => {
      console.error(`[workflow:onError] ${errorInfo.workflowId} FAILED:`, errorInfo.error?.message);
      console.error(`[workflow:onError] stack:`, errorInfo.error?.stack?.slice(0, 500));
      for (const [stepId, stepResult] of Object.entries(errorInfo.steps)) {
        if (stepResult.status === 'failed') {
          console.error(`[workflow:onError] step ${stepId}:`, stepResult.error);
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

      console.log(`[merge-all] parallel keys:`, Object.keys(parallelResult));
      console.log(`[merge-all] socialAnalysis keys:`, Object.keys(socialAnalysis));
      console.log(`[merge-all] sentimentAnalysis length:`, socialAnalysis.sentimentAnalysis?.length ?? 0);
      console.log(`[merge-all] socialAudit length:`, socialAnalysis.socialAudit?.length ?? 0);
      console.log(`[merge-all] competitorAnalyses count:`, Array.isArray(competitorAnalyses) ? competitorAnalyses.length : typeof competitorAnalyses);
      // Diagnostic: measure full merged payload
      const _mergeAllResult = {
        ...mergedData,
        sentimentAnalysis: socialAnalysis.sentimentAnalysis ?? '',
        socialAudit: socialAnalysis.socialAudit ?? '',
        competitorAnalyses,
      };
      console.log('[merge-all] FULL DATA SIZE (bytes):', JSON.stringify(_mergeAllResult).length);
      console.log('[merge-all] items count:', (_mergeAllResult as any).items?.length ?? 0);
      console.log('[merge-all] competitors count:', (_mergeAllResult as any).nearbyCompetitors?.length ?? 0);
      console.log('[merge-all] reviews count:', (_mergeAllResult as any).reviews?.reviews?.length ?? 0);

      return {
        ...mergedData,
        sentimentAnalysis: socialAnalysis.sentimentAnalysis ?? 'No reviews available for analysis.',
        socialAudit: socialAnalysis.socialAudit ?? 'No social media data available.',
        competitorAnalyses,
      };
    },
    { id: 'merge-all' },
  )
  // Parallel section writers: financials, digital-presence, benchmarks
  .parallel([writeFinancials, writeDigitalPresence, writeMarketBenchmarks])
  .map(
    async ({ inputData, getStepResult }) => {
      const mergeAllData = getStepResult<z.infer<typeof reportInputSchema>>('merge-all');
      const parallelResult = inputData as Record<string, any>;
      return {
        ...mergeAllData,
        financialsSection: parallelResult['write-financials']?.financialsSection ?? '',
        digitalPresenceSection: parallelResult['write-digital-presence']?.digitalPresenceSection ?? '',
        benchmarksSection: parallelResult['write-market-benchmarks']?.benchmarksSection ?? '',
      };
    },
    { id: 'merge-sections' },
  )
  .then(composeReport);

businessAnalysisWorkflow.commit();

// Legacy alias for backwards compatibility
export { businessAnalysisWorkflow as weatherWorkflow };
