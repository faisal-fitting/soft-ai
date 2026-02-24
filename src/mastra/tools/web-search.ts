import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJson } from 'serpapi';

const SERPAPI_KEY =
  process.env.SERPAPI_API_KEY ||
  '7f5198da5c7782aae6f6a4a435749983ce94837843fff895abd964b9db31c492';

export const webSearchTool = createTool({
  id: 'web-search',
  description:
    'Search the web for Saudi F&B market intelligence. ' +
    'Use ONLY for: ' +
    '1. Saudi F&B market benchmarks (margins, ticket sizes by city). ' +
    '2. Competitor news (new branches, closures, promotions). ' +
    '3. Saudi F&B consumer trends 2025. ' +
    '4. Saudi regulatory context (VAT, municipal licensing). ' +
    'Maximum 2 searches per report. Cite the source title in the report. ' +
    'Never cite unverified blogs — only news outlets, government sites, or industry bodies.',
  inputSchema: z.object({
    query: z.string().describe('Search query in Arabic or English'),
    language: z
      .enum(['ar', 'en'])
      .optional()
      .describe('Search language — default: ar (Arabic)'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        link: z.string(),
        position: z.number(),
      }),
    ),
    query_used: z.string(),
  }),
  execute: async ({ query, language }) => {
    const hl = language ?? 'ar';

    try {
      const result = await getJson({
        engine: 'google',
        q: query,
        gl: 'sa',
        hl,
        num: 5,
        api_key: SERPAPI_KEY,
      });

      type OrganicResult = {
        title?: string;
        snippet?: string;
        link?: string;
        position?: number;
      };

      const organicResults = (result?.organic_results ?? []) as OrganicResult[];

      const results = organicResults.slice(0, 5).map((r, idx) => ({
        title: r.title ?? '',
        snippet: r.snippet ?? '',
        link: r.link ?? '',
        position: r.position ?? idx + 1,
      }));

      console.log(`[web-search] "${query}" → ${results.length} results`);

      return { results, query_used: query };
    } catch (err) {
      console.error('[web-search] Error:', err);
      return { results: [], query_used: query };
    }
  },
});
