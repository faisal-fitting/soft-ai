import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJson } from 'serpapi';
import { reviewSchema, reviewsResponseSchema } from '../shared/schemas';

const SERPAPI_KEY =
  process.env.SERPAPI_API_KEY ||
  '7f5198da5c7782aae6f6a4a435749983ce94837843fff895abd964b9db31c492';

/**
 * Review sample size decision (40 reviews = 4 pages × ~10/page):
 *   - Minimum for 15% trend threshold: need ≥6 mentions out of 40
 *   - Balances analytical accuracy vs. API latency (~4 calls ≈ 4–8 s)
 *   - Stops early when the business has fewer total reviews
 * * sort_by strategy:
 *   - 'newestFirst'  → recommended for the target business (aligns with recency weighting)
 *   - 'qualityScore' → recommended for competitors (most representative sample)
 *   - 'ratingLow'    → optional deep-dive to surface critical failure patterns
 */
const MAX_REVIEW_PAGES = 4;

export const googleMapsReviewsTool = createTool({
  id: 'get-google-maps-reviews',
  description:
    'Fetch up to 40 Google Maps reviews (4 pages × ~10 reviews) for a business using its place_id. ' +
    'Paginates automatically up to the cap, stopping early if no more reviews exist. ' +
    'Use sort_by="newestFirst" for the target business (recency-weighted ABSA) and ' +
    '"qualityScore" (default) for competitors. ' +
    'Returns reviews, auto-extracted keyword topics, and overall place info.',
  inputSchema: z.object({
    place_id: z.string().describe('Google Maps place ID (e.g. ChIJ...)'),
    language: z.string().optional().describe('Language code — default: ar (Arabic)'),
    sort_by: z
      .enum(['qualityScore', 'newestFirst', 'ratingHigh', 'ratingLow'])
      .optional()
      .describe(
        'Sort order for reviews: ' +
        'qualityScore = most relevant (default), ' +
        'newestFirst = most recent, ' +
        'ratingHigh = highest stars first, ' +
        'ratingLow = lowest stars first (surfaces critical issues)',
      ),
  }),
  outputSchema: reviewsResponseSchema,
  execute: async ({ place_id, language, sort_by }) => {
    if (process.env.MOCK_TOOLS === 'true') {
      console.log(`[google-maps-reviews] MOCK — returning fake reviews for ${place_id}`);
      return {
        place_info: { title: 'فايل كوفي', address: 'حي النرجس، الرياض', rating: 4.3, reviews: 187, type: 'مقهى' },
        topics: [
          { keyword: 'القهوة', mentions: 52 },
          { keyword: 'الخدمة', mentions: 38 },
          { keyword: 'الجو', mentions: 24 },
          { keyword: 'الأسعار', mentions: 18 },
          { keyword: 'الانتظار', mentions: 14 },
        ],
        reviews: [
          { position: 1, rating: 5, date: '2026-02-15', snippet: 'قهوة رائعة وخدمة سريعة، من أفضل المقاهي في الحي. أنصح بتجربة الكابتشينو.', user: { name: 'أحمد العتيبي', reviews: 12, photos: 3 }, details: { food: 5, service: 5, atmosphere: 4 } },
          { position: 2, rating: 5, date: '2026-02-10', snippet: 'الجو هادئ ومريح للعمل، واي فاي ممتاز والقهوة لذيذة جداً.', user: { name: 'سارة المطيري', reviews: 28 }, details: { service: 5, atmosphere: 5 } },
          { position: 3, rating: 4, date: '2026-02-01', snippet: 'تجربة جيدة بشكل عام، لكن الانتظار كان طويلاً في وقت الذروة.', user: { name: 'فهد الغامدي', reviews: 7 }, details: { food: 4, service: 3 } },
          { position: 4, rating: 3, date: '2026-01-25', snippet: 'القهوة كويسة لكن الأسعار مرتفعة نسبياً مقارنة بالمنافسين في المنطقة.', user: { name: 'نورة الشمري', reviews: 45 }, details: { food: 4, service: 3, atmosphere: 3 } },
          { position: 5, rating: 5, date: '2026-01-20', snippet: 'أفضل لاتيه جربته في الرياض، والموظفين محترفين ومرحبين.', user: { name: 'خالد الدوسري', reviews: 19 }, details: { food: 5, service: 5 } },
          { position: 6, rating: 2, date: '2026-01-15', snippet: 'طلبت الكيك وكان جافاً ولم يكن طازجاً. يحتاجون لتحسين جودة المعجنات.', user: { name: 'ريم العنزي', reviews: 31 }, details: { food: 2, service: 3 } },
          { position: 7, rating: 4, date: '2026-01-10', snippet: 'مكان جميل، الديكور أنيق والإضاءة مريحة. سأرجع بالتأكيد.', user: { name: 'عبدالله الحربي', reviews: 8 }, details: { atmosphere: 5, service: 4 } },
          { position: 8, rating: 1, date: '2026-01-05', snippet: 'انتظرت 25 دقيقة للحصول على طلبي. غير مقبول في وقت الذروة.', user: { name: 'منال القحطاني', reviews: 22 }, details: { service: 1 } },
          { position: 9, rating: 5, date: '2025-12-28', snippet: 'من أجمل المقاهي في الحي، نظيف ومرتب والطاقم ودود.', user: { name: 'تركي السبيعي', reviews: 14 }, details: { food: 5, service: 5, atmosphere: 5 } },
          { position: 10, rating: 4, date: '2025-12-20', snippet: 'قهوة ممتازة لكن البار كان مزدحماً جداً. يحتاجون لزيادة الكاشير.', user: { name: 'هند الزهراني', reviews: 36 }, details: { food: 5, service: 3, atmosphere: 3 } },
        ],
        total_fetched: 10,
        sort_used: sort_by ?? 'qualityScore',
      };
    }

    const hl = language ?? 'ar';
    const sortUsed = sort_by ?? 'qualityScore';
    const allReviews: z.infer<typeof reviewSchema>[] = [];
    let placeInfo: Record<string, unknown> | undefined;
    let topics: { keyword: string; mentions: number; id?: string }[] | undefined;
    let nextPageToken: string | undefined;

    for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
      try {
        const result = await getJson({
          engine: 'google_maps_reviews',
          place_id,
          hl,
          sort_by: sortUsed,
          api_key: SERPAPI_KEY,
          ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
        });

        // Capture place info and topics once (first page only)
        if (page === 0) {
          placeInfo = result?.place_info as Record<string, unknown> | undefined;
          topics = result?.topics as { keyword: string; mentions: number; id?: string }[] | undefined;
        }

        const pageReviews = (result?.reviews ?? []) as z.infer<typeof reviewSchema>[];
        allReviews.push(...pageReviews);

        console.log(
          `[google-maps-reviews] Page ${page + 1}: +${pageReviews.length} reviews ` +
          `(total: ${allReviews.length}, sort: ${sortUsed})`,
        );

        // Stop early: no next page or page returned empty
        const pagination = (result?.serpapi_pagination ?? {}) as Record<string, string>;
        nextPageToken = pagination?.next_page_token;
        if (!nextPageToken || pageReviews.length === 0) break;

      } catch (err) {
        console.error(`[google-maps-reviews] Error on page ${page + 1}:`, err);
        break;
      }
    }

    console.log(`[google-maps-reviews] Done: ${allReviews.length} reviews for ${place_id}`);

    return {
      place_info: placeInfo as {
        title?: string;
        address?: string;
        rating?: number;
        reviews?: number;
        type?: string;
      } | undefined,
      topics,
      reviews: allReviews,
      total_fetched: allReviews.length,
      sort_used: sortUsed,
    };
  },
});
