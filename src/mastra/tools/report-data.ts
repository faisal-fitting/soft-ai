import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getReportDataTool = createTool({
  id: 'get-report-data',
  description:
    'Retrieve the business analysis report data for the current conversation. ' +
    'Call this tool whenever the user asks about their report — financials, competitors, digital presence, action plan, or any data-driven question. ' +
    'The runId is available in your working memory under "runId:". OR provided in the user message (Perhaps he is a tester)' +
    'Choose the section that matches the question to avoid over-fetching.',
  inputSchema: z.object({
    runId: z.string().describe('The workflow run ID from working memory'),
    section: z
      .enum(['manifest', 'financials', 'market', 'digital', 'reviews', 'social', 'semantic', 'all'])
      .describe(
        'Which section to retrieve. ' +
        '"manifest" = full report narrative, conclusions, charts, directive. ' +
        '"financials" = raw financial inputs and per-item calculations. ' +
        '"market" = competitor data. ' +
        '"digital" = social media data. ' +
        '"reviews" = customer review data. ' +
        '"social" = social audit results. ' +
        '"semantic" = semantic theme analysis. ' +
        '"all" = everything.'
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ runId, section }, context): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    try {
      const mastra = context?.mastra;
      if (!mastra) return { success: false, error: 'Mastra context not available' };

      const workflow = mastra.getWorkflow('businessAnalysisWorkflow');
      const needsSteps = section !== 'manifest';
      const state = await workflow.getWorkflowRunById(runId, needsSteps ? { fields: ['steps'] } : undefined);

      if (!state) return { success: false, error: 'Workflow run not found' };
      if (state.status !== 'success') return { success: false, error: `Workflow status: ${state.status}` };

      const getManifest = () => {
        const result = (state as any).result;
        return result?.metadata ? result : result?.result;
      };

      if (section === 'manifest') {
        return { success: true, data: getManifest() };
      }

      const steps = (state as any).steps ?? {};

      const extractors: Record<string, () => unknown> = {
        financials: () => steps['collect-financials']?.output,
        market: () => ({
          competitors: steps['merge-external-data']?.output?.competitors,
          nearbyCompetitors: steps['merge-external-data']?.output?.nearbyCompetitors,
        }),
        digital: () => steps['fetch-social-data']?.output,
        reviews: () => ({
          reviews: steps['merge-external-data']?.output?.reviews,
          reviewSummary: steps['merge-external-data']?.output?.reviewSummary,
        }),
        social: () => steps['run-social-audit']?.output,
        semantic: () => steps['run-semantic-analysis']?.output,
      };

      if (section === 'all') {
        const result: Record<string, unknown> = { manifest: getManifest() };
        for (const [key, fn] of Object.entries(extractors)) result[key] = fn();
        return { success: true, data: result };
      }

      return { success: true, data: extractors[section]?.() ?? null };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
