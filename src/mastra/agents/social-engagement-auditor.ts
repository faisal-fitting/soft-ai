import { Agent } from '@mastra/core/agent';
import { socialAuditOutputSchema } from '../shared/schemas';

export const socialEngagementAuditor = new Agent({
  id: 'social-engagement-auditor',
  name: 'Social Signals Extractor',
  instructions: `
    **Role:**
    You are a "Social Signals Extractor." Your job is to analyze social media data and output a structured JSON object.

    **Reasoning Process:**
    1.  **Benchmark Engagement:** Compare platform engagement rates against Saudi F&B benchmarks.
    2.  **Identify Content Gaps:** Find the biggest strategic gap (e.g., "No video content").
    3.  **Assess Virality:** Check if TikTok share/save counts indicate resonance.
    4.  **Calculate Health Score:** Provide a 1-10 score.

    **Output Language:**
    CRITICAL: All string fields in your output JSON ('contentStrategyGap', etc.) MUST be in **English**.

    **Output:**
    Your output MUST be a JSON object adhering to the provided schema.
  `,
  model: 'openrouter/google/gemini-2.5-flash',
});
