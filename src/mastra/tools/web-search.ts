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
    '3. Saudi F&B consumer trends 2026. ' +
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
    if (process.env.MOCK_TOOLS === 'true') {
      console.log(`[web-search] MOCK — returning fake results for: "${query}"`);
      return {
        results: [
          {
            title: 'سوق المقاهي في السعودية 2026 — تقرير Euromonitor',
            snippet: 'يُقدَّر حجم سوق المقاهي والمشروبات في المملكة العربية السعودية بـ 4.2 مليار ريال في 2025، بمعدل نمو سنوي 8.5%. الرياض تستحوذ على 38% من السوق مع أكثر من 4,200 مقهى مرخص.',
            link: 'https://www.euromonitor.com/saudi-cafes-2026',
            position: 1,
          },
          {
            title: 'معايير الربحية في قطاع المطاعم السعودي — GASTAT 2025',
            snippet: 'متوسط هامش الربح الإجمالي لمقاهي الرياض: 58–65%. هامش الربح الصافي: 12–18%. نسبة التكاليف الثابتة: 28–33% من الإيرادات. متوسط قيمة الفاتورة: 42–58 ريال.',
            link: 'https://www.stats.gov.sa/fnb-benchmarks-2025',
            position: 2,
          },
          {
            title: 'اتجاهات المستهلك السعودي في قطاع الأغذية والمشروبات 2026 — NielsenIQ',
            snippet: 'ارتفع الطلب على القهوة المتخصصة بنسبة 23% خلال 2025. 67% من المستهلكين السعوديين يفضلون تجربة المقهى على الطلب الإلكتروني. الفئة العمرية 18–34 تمثل 61% من إجمالي زوار المقاهي.',
            link: 'https://www.nielseniq.com/sa-consumer-trends-2026',
            position: 3,
          },
        ],
        query_used: query,
      };
    }

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
