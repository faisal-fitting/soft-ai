import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJson } from 'serpapi';

const SERPAPI_KEY =
  process.env.SERPAPI_API_KEY ||
  '7f5198da5c7782aae6f6a4a435749983ce94837843fff895abd964b9db31c492';

/**
 * Review sample size decision (40 reviews = 4 pages × ~10/page):
 *   - Minimum for 15% trend threshold: need ≥6 mentions out of 40
 *   - Balances analytical accuracy vs. API latency (~4 calls ≈ 4–8 s)
 *   - Stops early when the business has fewer total reviews
 *
 * sort_by strategy:
 *   - 'newestFirst'  → recommended for the target business (aligns with recency weighting)
 *   - 'qualityScore' → recommended for competitors (most representative sample)
 *   - 'ratingLow'    → optional deep-dive to surface critical failure patterns
 */
const MAX_REVIEW_PAGES = 4;

// ── Review schema (mirrors actual SerpAPI google_maps_reviews response) ───────
const reviewSchema = z.object({
  position: z.number(),
  link: z.string().optional(),
  rating: z.number(),
  date: z.string(),
  iso_date: z.string().optional(),
  iso_date_of_last_edit: z.string().optional(),
  images: z.array(z.string()).optional(),
  source: z.string().optional(),
  review_id: z.string().optional(),
  user: z.object({
    name: z.string(),
    link: z.string().optional(),
    contributor_id: z.string().optional(),
    thumbnail: z.string().optional(),
    local_guide: z.boolean().optional(),
    reviews: z.number().optional(),
    photos: z.number().optional(),
  }),
  snippet: z.string().optional(),
  extracted_snippet: z.object({
    original: z.string(),
  }).optional(),
  details: z.object({
    food: z.number().optional(),
    service: z.number().optional(),
    atmosphere: z.number().optional(),
    meal_type: z.string().optional(),
    price_per_person: z.string().optional(),
    noise_level: z.string().optional(),
    wait_time: z.string().optional(),
  }).optional(),
  likes: z.number().optional(),
});

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
  outputSchema: z.object({
    place_info: z.object({
      title: z.string().optional(),
      address: z.string().optional(),
      rating: z.number().optional(),
      reviews: z.number().optional(),
      type: z.string().optional(),
    }).optional(),
    topics: z.array(z.object({
      keyword: z.string(),
      mentions: z.number(),
      id: z.string().optional(),
    })).optional(),
    reviews: z.array(reviewSchema),
    total_fetched: z.number(),
    sort_used: z.string(),
  }),
  execute: async ({ place_id, language, sort_by }) => {
    const hl = language ?? 'ar';
    const sortUsed = sort_by ?? 'qualityScore';
    const allReviews: z.infer<typeof reviewSchema>[] = [];
    let placeInfo: Record<string, unknown> | undefined;
    let topics: { keyword: string; mentions: number; id?: string }[] | undefined;
    let nextPageToken: string | undefined;

    for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
      try {
        // Use object literal + conditional spread so TypeScript can infer
        // the type from the literal (not from a generic Record variable)
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
