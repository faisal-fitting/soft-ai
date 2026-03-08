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
  reportSectionSchema,
  strategicDirectiveSchema,
  reportManifestSchema,
  semanticAnalysisOutputSchema,
  socialAuditOutputSchema
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
        const response = await agent.generate(`Analyze reviews: ${JSON.stringify(inputData.reviews.reviews.slice(0, 20))}`, {
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
        const response = await agent.generate(`Audit social data: ${JSON.stringify(inputData.socialData)}`, {
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
    const prompt = `Generate Financial Section based on directive: ${inputData.directive.theme}\nData: ${JSON.stringify(inputData.items)}`;
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
    const prompt = `Generate Digital Section. Semantic Analysis: ${JSON.stringify(inputData.semanticAnalysis)}\nSocial Audit: ${JSON.stringify(inputData.socialAudit)}`;
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
    const prompt = `Generate Market Section. Competitors: ${JSON.stringify(inputData.nearbyCompetitors.slice(0, 3))}`;
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
    
    const prompt = `Synthesize Action Plan:
Directive: ${JSON.stringify((inputData.base as any).directive)}
Financial Section: ${JSON.stringify(inputData.financials)}
Digital Section: ${JSON.stringify(inputData.digital)}
Market Section: ${JSON.stringify(inputData.market)}`;
    
    const response = await agent.generate(prompt, {
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

// ── Phase 4: Translation and Assembly ────────────────────────────────────────

const localizeManifest = createStep({
    id: 'localize-manifest',
    description: 'Translate all English text in the manifest to Arabic',
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
            stringsToTranslate.push(section.title);
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

        // 2. Call translation agent
        const response = await agent.generate(
            `Translate this JSON payload of texts: ${JSON.stringify({ texts: stringsToTranslate })}`,
            {
                structuredOutput: {
                    schema: translationSchema,
                    errorStrategy: 'fallback',
                    fallbackValue: { translations: stringsToTranslate } // Fallback to original English on error
                }
            }
        );
        
        let translations = response.object?.translations;
        if (!translations || translations.length !== stringsToTranslate.length) {
            return inputData; // Return original on translation failure
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

const assembleManifest = createStep({
  id: 'assemble-manifest',
  description: 'Merge all sections into the final dashboard manifest',
  inputSchema: z.object({
    base: expertInputSchema,
    financials: reportSectionSchema,
    digital: reportSectionSchema,
    market: reportSectionSchema,
    actionPlan: reportSectionSchema,
  }),
  outputSchema: reportManifestSchema,
  execute: async ({ inputData }) => {
    return {
      metadata: {
        businessName: inputData.base.businessName,
        businessType: inputData.base.businessType,
        generatedAt: new Date().toISOString(),
        healthScore: inputData.base.healthScore,
      },
      directive: inputData.base.directive,
      sections: [
        inputData.financials,
        inputData.digital,
        inputData.market,
        inputData.actionPlan,
      ],
    };
  },
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
  .map(async ({ inputData, getStepResult }) => {
    const base = getStepResult<z.infer<typeof placeEnrichedSchema>>('fetch-place-details');
    const parallel = inputData;
    return { 
        ...base, 
        reviews: parallel['fetch-target-reviews']?.reviews, 
        nearbyCompetitors: parallel['fetch-nearby-competitors']?.nearbyCompetitors,
        socialData: parallel['fetch-social-data']?.socialData
    };
  }, { id: 'merge-external-data' })
  .parallel([runSemanticAnalysis, runSocialAudit])
  .then(generateStrategicDirective)
  .map(async ({ inputData, getStepResult }) => {
    const base = getStepResult<z.infer<typeof mergedExternalSchema> & { socialData: any }>('merge-external-data');
    const semanticResult = getStepResult('run-semantic-analysis');
    const socialResult = getStepResult('run-social-audit');
    const directive = inputData;
    const healthScore = Math.round((base.grossMargin * 0.4) + (base.placeDetails.rating! * 10 * 0.6));
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
      ...expertOutput,
      actionPlan,
    };
  }, { id: 'prepare-manifest' })
  .then(assembleManifest)
  .then(localizeManifest);

businessAnalysisWorkflow.commit();