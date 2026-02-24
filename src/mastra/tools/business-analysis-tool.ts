import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { businessAnalysisWorkflow, workflowInputSchema } from '../workflows/main-workflow';

export const businessAnalysisTool = createTool({
  id: 'run-business-analysis',
  description:
    'Run the full F&B business analysis pipeline. ' +
    'Requires complete financial data, a Google Places placeId, and optional social handles. ' +
    'Returns a comprehensive Arabic business health report.',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({ report: z.string() }),
  execute: async (inputData) => {
    const run = await businessAnalysisWorkflow.createRun();
    const result = await run.start({ inputData });
    return { report: result.status == "success" ? result?.result?.report : 'Report generation failed.' };
  },
});
