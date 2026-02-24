import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { googleMapsReviewsTool } from '../tools/google-maps-reiews';
import { socialMediaScraperTool } from '../tools/social-media-scrape';

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyAgbQvK5FZC_2liZ9mM6a7-HJSz8lC4CoQ';

// ── Workflow Input Schema ────────────────────────────────────────────────────
export const workflowInputSchema = z.object({
  // Business identity
  businessName: z.string(),
  businessType: z.enum(['cafe', 'restaurant', 'cloud_kitchen', 'fine_dining']),
  placeId: z.string().describe('Google Places place_id for the business'),
  instagramUser: z.string().optional(),
  tiktokUser: z.string().optional(),
  // Revenue
  sales: z.number(),
  returns: z.number(),
  advertising: z.number(),
  discounts: z.number(),
  // Variable costs
  laborCosts: z.number(),
  productionStaffCosts: z.number(),
  packaging: z.number(),
  rawMaterials: z.number(),
  // Fixed costs
  adminSalaries: z.number(),
  adminExpenses: z.number(),
  rent: z.number(),
  utilities: z.number(),
  subscriptions: z.number(),
  govFees: z.number(),
  otherCosts: z.number(),
  // Items
  items: z.array(z.object({
    name: z.string(),
    sellingPrice: z.number(),
    soldUnits: z.number(),
  })),
});

// ── Step 1 Output Schema ──────────────────────────────────────────────────
const financialsOutputSchema = z.object({
  // Identifiers (passed through)
  businessName: z.string(),
  businessType: z.string(),
  placeId: z.string(),
  instagramUser: z.string().optional(),
  tiktokUser: z.string().optional(),
  // Computed KPIs
  netRevenue: z.number(),
  variableCosts: z.number(),
  fixedCosts: z.number(),
  totalCosts: z.number(),
  grossProfit: z.number(),
  netProfit: z.number(),
  grossMargin: z.number(),
  netMargin: z.number(),
  contributionMarginRatio: z.number(),
  breakEvenRevenue: z.number(),
  breakEvenGap: z.number(),
  isAboveBreakEven: z.boolean(),
  items: z.array(z.object({
    name: z.string(),
    totalRevenue: z.number(),
    revenueShare: z.number(),
  })),
});

// ── Step 2 Output Schema ──────────────────────────────────────────────────
const externalDataOutputSchema = financialsOutputSchema.extend({
  placeDetails: z.string(),       // JSON string
  reviews: z.string(),            // JSON string (array)
  nearbyCompetitors: z.string(),  // JSON string (array)
  socialData: z.string(),         // JSON string
});

// ── Step 3 Output Schema ──────────────────────────────────────────────────
const analysisOutputSchema = externalDataOutputSchema.extend({
  sentimentAnalysis: z.string(),
  socialAudit: z.string(),
});

// ────────────────────────────────────────────────────────────────────────────
// STEP 1 — Collect Financials
// ────────────────────────────────────────────────────────────────────────────
const collectFinancials = createStep({
  id: 'collect-financials',
  description: 'Compute deterministic financial KPIs from user-provided data',
  inputSchema: workflowInputSchema,
  outputSchema: financialsOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data missing');

    const {
      businessName, businessType, placeId,
      instagramUser, tiktokUser,
      sales, returns, advertising, discounts,
      laborCosts, productionStaffCosts, packaging, rawMaterials,
      adminSalaries, adminExpenses, rent, utilities,
      subscriptions, govFees, otherCosts,
      items,
    } = inputData;

    const netRevenue = sales - returns - discounts - advertising;
    const variableCosts = rawMaterials + packaging + laborCosts + productionStaffCosts;
    const fixedCosts =
      adminSalaries + adminExpenses + rent + utilities + subscriptions + govFees + otherCosts;
    const totalCosts = variableCosts + fixedCosts;
    const grossProfit = netRevenue - variableCosts;
    const netProfit = netRevenue - totalCosts;
    const grossMargin = netRevenue !== 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue !== 0 ? (netProfit / netRevenue) * 100 : 0;
    const variableCostRatio = netRevenue !== 0 ? variableCosts / netRevenue : 0;
    const contributionMarginRatio = 1 - variableCostRatio;
    const breakEvenRevenue = contributionMarginRatio !== 0 ? fixedCosts / contributionMarginRatio : 0;
    const breakEvenGap = netRevenue - breakEvenRevenue;

    const itemsWithRevenue = items.map((item) => ({
      name: item.name,
      totalRevenue: item.sellingPrice * item.soldUnits,
    }));
    const totalItemRevenue = itemsWithRevenue.reduce((s, i) => s + i.totalRevenue, 0);
    const processedItems = itemsWithRevenue.map((item) => ({
      name: item.name,
      totalRevenue: item.totalRevenue,
      revenueShare: totalItemRevenue !== 0 ? (item.totalRevenue / totalItemRevenue) * 100 : 0,
    }));

    console.log(`[collect-financials] ${businessName} | netRevenue=${netRevenue} | breakEvenGap=${breakEvenGap.toFixed(0)}`);

    return {
      businessName, businessType, placeId,
      instagramUser, tiktokUser,
      netRevenue, variableCosts, fixedCosts, totalCosts,
      grossProfit, netProfit,
      grossMargin, netMargin,
      contributionMarginRatio, breakEvenRevenue, breakEvenGap,
      isAboveBreakEven: breakEvenGap >= 0,
      items: processedItems,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP 2 — Collect External Data
// ────────────────────────────────────────────────────────────────────────────
const collectExternalData = createStep({
  id: 'collect-external-data',
  description: 'Fetch Google Place details, reviews, nearby competitors, and social media data',
  inputSchema: financialsOutputSchema,
  outputSchema: externalDataOutputSchema,
  execute: async ({ inputData, requestContext }) => {
    if (!inputData) throw new Error('Input data missing');
    const { placeId, businessType, instagramUser, tiktokUser } = inputData;

    // ── Place Details ──────────────────────────────────────────────────────
    let placeDetails = '{}';
    try {
      const res = await axios.get(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          params: { languageCode: 'ar' },
          headers: {
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask':
              'id,displayName,rating,userRatingCount,location,formattedAddress,' +
              'types,primaryType,priceLevel,websiteUri,nationalPhoneNumber',
          },
        },
      );
      placeDetails = JSON.stringify(res.data);
      console.log('[collect-external-data] Place details fetched');
    } catch (err) {
      console.error('[collect-external-data] Place details error:', err);
    }

    // ── Extract coordinates and place types from place details ────────────
    type PlaceData = {
      location?: { latitude: number; longitude: number };
      types?: string[];
      primaryType?: string;
    };
    const parsedPlace = JSON.parse(placeDetails) as PlaceData;
    const lat = parsedPlace.location?.latitude;
    const lon = parsedPlace.location?.longitude;

    // Use types from the Places API response as includedTypes for nearby search.
    // Filter to food/drink establishment types that the Nearby Search API accepts.
    const FOOD_TYPES = new Set([
      'cafe', 'coffee_shop', 'coffee_stand', 'restaurant',
      'fast_food_restaurant', 'casual_dining_restaurant',
      'fine_dining_restaurant', 'food_court', 'bakery',
      'bar', 'juice_shop', 'ice_cream_shop', 'dessert_shop',
    ]);
    const apiTypes = (parsedPlace.types ?? []).filter((t) => FOOD_TYPES.has(t));

    // Fall back to businessType-derived types if the API returned nothing useful.
    const typeMap: Record<string, string[]> = {
      cafe:          ['cafe', 'coffee_shop', 'coffee_stand'],
      restaurant:    ['restaurant', 'fast_food_restaurant', 'casual_dining_restaurant'],
      cloud_kitchen: ['restaurant', 'fast_food_restaurant'],
      fine_dining:   ['fine_dining_restaurant', 'restaurant'],
    };
    const includedTypes = apiTypes.length > 0
      ? apiTypes
      : (typeMap[businessType] ?? ['cafe', 'coffee_shop', 'restaurant']);

    // Radius based on businessType.
    const radiusMap: Record<string, number> = {
      cafe: 1000,
      restaurant: 1500,
      cloud_kitchen: 2000,
      fine_dining: 2000,
    };
    const radius = radiusMap[businessType] ?? 1000;

    // ── Business Reviews (40 reviews, newestFirst for recency weighting) ────
    let reviews = '[]';
    try {
      const result = await googleMapsReviewsTool.execute!(
        { place_id: placeId, language: 'ar', sort_by: 'newestFirst' },
        { requestContext },
      );
      reviews = JSON.stringify(result);
      console.log('[collect-external-data] Reviews fetched:', (result as { total_fetched?: number })?.total_fetched);
    } catch (err) {
      console.error('[collect-external-data] Reviews error:', err);
    }

    // ── Nearby Competitors ────────────────────────────────────────────────
    let nearbyCompetitors = '[]';
    if (lat != null && lon != null) {
      try {
        const res = await axios.post(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            includedTypes,
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lon },
                radius,
              },
            },
            languageCode: 'ar',
            rankPreference: 'DISTANCE',
            maxResultCount: 20,
          },
          {
            headers: {
              'X-Goog-Api-Key': GOOGLE_API_KEY,
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.rating,places.userRatingCount,' +
                'places.formattedAddress,places.location,places.types,places.primaryType,places.priceLevel',
              'Content-Type': 'application/json',
            },
          },
        );
        nearbyCompetitors = JSON.stringify(res.data?.places ?? []);
        console.log('[collect-external-data] Nearby competitors fetched:', res.data?.places?.length ?? 0, '| types:', includedTypes, '| radius:', radius);
      } catch (err) {
        console.error('[collect-external-data] Nearby competitors error:', err);
      }
    } else {
      console.warn('[collect-external-data] Coordinates not available — skipping nearby competitor search');
    }

    // ── Social Media ──────────────────────────────────────────────────────
    let socialData = '{}';
    if (instagramUser || tiktokUser) {
      try {
        const result = await socialMediaScraperTool.execute!(
          { instagram_user: instagramUser ?? '', tiktok_user: tiktokUser ?? '' },
          { requestContext },
        );
        socialData = JSON.stringify(result);
        console.log('[collect-external-data] Social data fetched');
      } catch (err) {
        console.error('[collect-external-data] Social data error:', err);
        socialData = JSON.stringify({
          instagram: { username: instagramUser ?? '' },
          tiktok: { username: tiktokUser ?? '' },
          note: 'Social media data unavailable',
        });
      }
    }

    return {
      ...inputData,
      placeDetails,
      reviews,
      nearbyCompetitors,
      socialData,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP 3 — Analyze Content (Semantic + Social agents)
// ────────────────────────────────────────────────────────────────────────────
const analyzeContent = createStep({
  id: 'analyze-content',
  description: 'Run semantic review analysis and social media audit via specialized agents',
  inputSchema: externalDataOutputSchema,
  outputSchema: analysisOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data missing');
    const { businessName, reviews, socialData, nearbyCompetitors, placeId } = inputData;

    // ── Semantic Analysis ─────────────────────────────────────────────────
    let sentimentAnalysis = 'No reviews available for analysis.';
    try {
      const semanticAgent = mastra?.getAgent('semanticAnalysisAgent');
      if (semanticAgent && reviews !== '[]') {
        const response = await semanticAgent.generate([
          {
            role: 'user',
            content:
              `Perform ABSA on the following Google Maps reviews for "${businessName}" (place_id: ${placeId}).\n\n` +
              `Reviews JSON:\n${reviews}\n\n` +
              `Provide Top 5 Strengths and Top 5 Weaknesses following your instructions.`,
          },
        ]);
        sentimentAnalysis = response.text ?? 'Analysis unavailable.';
        console.log('[analyze-content] Sentiment analysis complete');
      }
    } catch (err) {
      console.error('[analyze-content] Sentiment analysis error:', err);
    }

    // ── Social Audit ──────────────────────────────────────────────────────
    let socialAudit = 'No social media data available.';
    try {
      const socialAgent = mastra?.getAgent('socialEngagementAuditor');
      if (socialAgent && socialData !== '{}') {
        const response = await socialAgent.generate([
          {
            role: 'user',
            content:
              `Audit the social media presence for "${businessName}".\n\n` +
              `Social Media Data:\n${socialData}\n\n` +
              `Nearby Competitors (for context):\n${nearbyCompetitors}\n\n` +
              `Provide the Social Health Score (1–10) and full audit following your instructions.`,
          },
        ]);
        socialAudit = response.text ?? 'Audit unavailable.';
        console.log('[analyze-content] Social audit complete');
      }
    } catch (err) {
      console.error('[analyze-content] Social audit error:', err);
    }

    return {
      ...inputData,
      sentimentAnalysis,
      socialAudit,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// STEP 4 — Generate Final Report (CBO Agent)
// ────────────────────────────────────────────────────────────────────────────
const generateReport = createStep({
  id: 'generate-report',
  description: 'CBO agent synthesizes all data into a comprehensive business health report',
  inputSchema: analysisOutputSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data missing');

    const {
      businessName, businessType, placeId,
      netRevenue, variableCosts, fixedCosts, totalCosts,
      grossProfit, netProfit, grossMargin, netMargin,
      contributionMarginRatio, breakEvenRevenue, breakEvenGap, isAboveBreakEven,
      items,
      placeDetails, reviews, nearbyCompetitors, socialData,
      sentimentAnalysis, socialAudit,
    } = inputData;

    const cboAgent = mastra?.getAgent('cboAgent');
    if (!cboAgent) throw new Error('CBO agent not found');

    const prompt = `
Generate a comprehensive F&B Business Intelligence Report for **${businessName}** (${businessType}).

## FINANCIAL KPIs (DO NOT RECALCULATE — treat as absolute facts)
- Net Revenue: ${netRevenue.toFixed(2)} SAR
- Variable Costs: ${variableCosts.toFixed(2)} SAR
- Fixed Costs: ${fixedCosts.toFixed(2)} SAR
- Total Costs: ${totalCosts.toFixed(2)} SAR
- Gross Profit: ${grossProfit.toFixed(2)} SAR | Gross Margin: ${grossMargin.toFixed(2)}%
- Net Profit: ${netProfit.toFixed(2)} SAR | Net Margin: ${netMargin.toFixed(2)}%
- Contribution Margin Ratio: ${(contributionMarginRatio * 100).toFixed(2)}%
- Break-Even Revenue: ${breakEvenRevenue.toFixed(2)} SAR
- Break-Even Gap: ${breakEvenGap.toFixed(2)} SAR (${isAboveBreakEven ? 'ABOVE break-even ✓' : 'BELOW break-even ✗'})

## REVENUE DISTRIBUTION BY ITEM
${items.map((i) => `- ${i.name}: SAR ${i.totalRevenue.toFixed(2)} (${i.revenueShare.toFixed(1)}%)`).join('\n')}

## GOOGLE PLACE DATA (place_id: ${placeId})
${placeDetails}

## COMPETITOR LANDSCAPE (nearby businesses)
${nearbyCompetitors}

## REVIEW SENTIMENT ANALYSIS
${sentimentAnalysis}

## SOCIAL MEDIA AUDIT
${socialAudit}

---

**COMPETITOR SWOT REQUIREMENT:**
The nearbyCompetitors JSON is provided above. You MUST:
1. Rank all competitors by (rating × userRatingCount) descending
2. Select TOP 3 (exclude the target business by name: ${businessName})
3. Call googleMapsReviewsTool for each → extract SWOT (Top 2 strengths, Top 1 weakness)
4. Produce the SWOT mini-table in the Competitor Benchmarking section:

| المنافس | القوة 1 | القوة 2 | الضعف الرئيسي |
|---------|---------|---------|--------------|

5. Reference each competitor weakness in at least one Action Plan item
Do NOT skip this step. If a competitor has zero reviews, infer from rating alone.

---
Using all the above data, produce the full Business Health Report following your instructions exactly.
Calculate the Hybrid Health Score using the formula from your instructions.
**MANDATORY: Write the entire report in Arabic. Section headers may be in English, but all analysis, insights, and recommendations must be in Arabic.**
`;

    const response = await cboAgent.generate([
      { role: 'user', content: prompt },
    ]);

    const report = response.text ?? 'Report generation failed.';
    console.log('[generate-report] Report generated, length:', report.length);
    return { report };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Workflow Assembly
// ────────────────────────────────────────────────────────────────────────────
export const businessAnalysisWorkflow = createWorkflow({
  id: 'business-analysis-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
})
  .then(collectFinancials)
  .then(collectExternalData)
  .then(analyzeContent)
  .then(generateReport);

businessAnalysisWorkflow.commit();

// Legacy alias for backwards compatibility
export { businessAnalysisWorkflow as weatherWorkflow };
