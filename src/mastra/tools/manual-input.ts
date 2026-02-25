import { createTool } from '@mastra/core/tools';
import { financialInputSchema, financialOutputSchema, computeFinancials } from '../shared/financials';

export const manualInputTool = createTool({
  id: 'manual-input',
  description:
    'Accept user-provided financial and business data for a Saudi F&B business. ' +
    'Computes all deterministic KPIs (break-even, margins, contribution margin, per-product breakeven) and ' +
    'returns structured output for the CBO agent. The agent must treat all computed ' +
    'values as absolute facts and never recalculate them.',
  inputSchema: financialInputSchema,
  outputSchema: financialOutputSchema,
  execute: async (input) => {
    return computeFinancials(input);
  },
});
