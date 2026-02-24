import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const BASE_URL = 'https://api.scrapecreators.com';

// ── Sub-schemas ─────────────────────────────────────────────────────────────
const postSchema = z.object({
  caption: z.string().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  views: z.number().optional(),
  isReel: z.boolean().optional(),
  url: z.string().optional(),
  date: z.string().optional(),
});

const instagramProfileSchema = z.object({
  username: z.string(),
  fullName: z.string().optional(),
  bio: z.string().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  postsCount: z.number().optional(),
  isVerified: z.boolean().optional(),
  isBusinessAccount: z.boolean().optional(),
  categoryName: z.string().optional(),
  avgLikes: z.number().optional(),
  avgComments: z.number().optional(),
  avgViews: z.number().optional(),
  engagementRate: z.number().optional(),
  recentPosts: z.array(postSchema).optional(),
  error: z.string().optional(),
});

const tiktokProfileSchema = z.object({
  username: z.string(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  likes: z.number().optional(),
  videosCount: z.number().optional(),
  avgViews: z.number().optional(),
  avgLikes: z.number().optional(),
  avgComments: z.number().optional(),
  engagementRate: z.number().optional(),
  recentVideos: z.array(postSchema).optional(),
  error: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function fetchInstagram(handle: string, apiKey: string): Promise<z.infer<typeof instagramProfileSchema>> {
  // ── Profile ────────────────────────────────────────────────────────────────
  let profileData: Record<string, unknown> = {};
  try {
    const profileRes = await fetch(
      `${BASE_URL}/v1/instagram/profile?handle=${encodeURIComponent(handle)}&trim=true`,
      { headers: { 'x-api-key': apiKey } },
    );
    if (!profileRes.ok) {
      throw new Error(`Profile request failed: ${profileRes.status} ${profileRes.statusText}`);
    }
    profileData = await profileRes.json() as Record<string, unknown>;
  } catch (err) {
    console.error('[social-scraper] Instagram profile error:', err);
    return { username: handle, error: `Profile fetch failed: ${String(err)}` };
  }

  const user = (profileData as { data?: { user?: Record<string, unknown> } }).data?.user ?? {};

  const followers = ((user.edge_followed_by as { count?: number })?.count) ?? 0;

  // ── Posts ─────────────────────────────────────────────────────────────────
  let items: Record<string, unknown>[] = [];
  try {
    const postsRes = await fetch(
      `${BASE_URL}/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}&trim=true`,
      { headers: { 'x-api-key': apiKey } },
    );
    if (postsRes.ok) {
      const postsData = await postsRes.json() as { items?: Record<string, unknown>[] };
      items = postsData.items ?? [];
    }
  } catch (err) {
    console.warn('[social-scraper] Instagram posts error (non-fatal):', err);
  }

  const recentPosts = items.map((item) => {
    const caption = item.caption as { text?: string } | undefined;
    const isReel = item.media_type === 2;
    const playCount = (item.play_count as number | undefined) ?? (item.ig_play_count as number | undefined);
    return {
      caption: caption?.text,
      likes: (item.like_count as number | undefined),
      comments: (item.comment_count as number | undefined),
      views: isReel ? playCount : undefined,
      isReel,
      url: item.url as string | undefined,
      date: item.taken_at ? new Date((item.taken_at as number) * 1000).toISOString() : undefined,
    };
  });

  const likeList = recentPosts.map((p) => p.likes ?? 0);
  const commentList = recentPosts.map((p) => p.comments ?? 0);
  const reelViews = recentPosts.filter((p) => p.isReel && p.views != null).map((p) => p.views!);

  const avgLikes = avg(likeList);
  const avgComments = avg(commentList);
  const avgViews = reelViews.length > 0 ? avg(reelViews) : undefined;
  const engagementRate = followers > 0
    ? ((avgLikes + avgComments) / followers) * 100
    : undefined;

  return {
    username: (user.username as string | undefined) ?? handle,
    fullName: user.full_name as string | undefined,
    bio: user.biography as string | undefined,
    followers,
    following: ((user.edge_follow as { count?: number })?.count) ?? undefined,
    postsCount: ((user.edge_owner_to_timeline_media as { count?: number })?.count) ?? undefined,
    isVerified: user.is_verified as boolean | undefined,
    isBusinessAccount: user.is_business_account as boolean | undefined,
    categoryName: user.category_name as string | undefined,
    avgLikes,
    avgComments,
    ...(avgViews !== undefined ? { avgViews } : {}),
    ...(engagementRate !== undefined ? { engagementRate } : {}),
    recentPosts,
  };
}

async function fetchTikTok(handle: string, apiKey: string): Promise<z.infer<typeof tiktokProfileSchema>> {
  // ── Profile ──
  let profileRaw: Record<string, unknown> = {};
  try {
    const res = await fetch(
      `${BASE_URL}/v1/tiktok/profile?handle=${encodeURIComponent(handle)}&trim=true`,
      { headers: { 'x-api-key': apiKey } },
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    profileRaw = await res.json() as Record<string, unknown>;
  } catch (err) {
    console.error('[social-scraper] TikTok profile error:', err);
    return { username: handle, error: `TikTok fetch failed: ${String(err)}` };
  }

  // ScrapeCreators mirrors TikTok's internal API — try both known response shapes
  type TKStats  = { followerCount?: number; followingCount?: number; heartCount?: number; videoCount?: number };
  type TKUser   = { uniqueId?: string; nickname?: string; signature?: string; verified?: boolean };
  const userInfo = (profileRaw as { userInfo?: { user?: TKUser; stats?: TKStats } }).userInfo
    ?? (profileRaw as { data?: { user?: TKUser; stats?: TKStats } }).data
    ?? {};
  const user  = (userInfo as { user?: TKUser }).user   ?? {};
  const stats = (userInfo as { stats?: TKStats }).stats ?? {};

  // ── Videos ──
  let videos: Record<string, unknown>[] = [];
  try {
    const vRes = await fetch(
      `${BASE_URL}/v3/tiktok/profile/videos?handle=${encodeURIComponent(handle)}&amount=10&trim=true`,
      { headers: { 'x-api-key': apiKey } },
    );
    if (vRes.ok) {
      const vData = await vRes.json() as { videos?: Record<string, unknown>[]; items?: Record<string, unknown>[] };
      videos = vData.videos ?? vData.items ?? [];
    }
  } catch (err) {
    console.warn('[social-scraper] TikTok videos error (non-fatal):', err);
  }

  type VStats = { playCount?: number; diggCount?: number; commentCount?: number };
  const recentVideos = videos.map((v) => {
    const s = ((v as { stats?: VStats }).stats ?? {}) as VStats;
    return {
      caption:  v.desc as string | undefined,
      likes:    s.diggCount,
      comments: s.commentCount,
      views:    s.playCount,
    };
  });

  const playList    = recentVideos.map((v) => v.views    ?? 0);
  const likeList    = recentVideos.map((v) => v.likes    ?? 0);
  const commentList = recentVideos.map((v) => v.comments ?? 0);
  const followers   = stats.followerCount ?? 0;
  const avgViews    = playList.length    > 0 ? avg(playList)    : undefined;
  const avgLikes    = likeList.length    > 0 ? avg(likeList)    : undefined;
  const avgComments = commentList.length > 0 ? avg(commentList) : undefined;
  const engagementRate = followers > 0 && avgLikes !== undefined && avgComments !== undefined
    ? ((avgLikes + avgComments) / followers) * 100
    : undefined;

  console.log(`[social-scraper] TikTok @${handle} — followers: ${followers}`);
  return {
    username:    user.uniqueId   ?? handle,
    displayName: user.nickname,
    bio:         user.signature,
    followers,
    following:   stats.followingCount,
    likes:       stats.heartCount,
    videosCount: stats.videoCount,
    ...(avgViews    !== undefined ? { avgViews }    : {}),
    ...(avgLikes    !== undefined ? { avgLikes }    : {}),
    ...(avgComments !== undefined ? { avgComments } : {}),
    ...(engagementRate !== undefined ? { engagementRate } : {}),
    recentVideos,
  };
}

// ── Tool ─────────────────────────────────────────────────────────────────────
export const socialMediaScraperTool = createTool({
  id: 'scrape-social-media',
  description:
    'Fetch Instagram and TikTok profile metrics and recent posts for a Saudi F&B business. ' +
    'Returns follower counts, engagement rates, and a sample of recent posts/videos. ' +
    "Used by the Social Engagement Auditor to score the brand's digital footprint.",
  inputSchema: z.object({
    instagram_user: z.string().describe('Instagram username without @'),
    tiktok_user: z.string().describe('TikTok username without @'),
  }),
  outputSchema: z.object({
    instagram: instagramProfileSchema,
    tiktok: tiktokProfileSchema,
    note: z.string().optional(),
  }),
  execute: async ({ instagram_user, tiktok_user }) => {
    const apiKey = process.env.SCRAPE_CREATORS_API_KEY || "lo6KXLFenDW6YkxHO0VrSkAdLkg2";

    // Strip @ prefix defensively from both handles
    const igHandle = instagram_user.replace(/^@/, '');
    const ttHandle = tiktok_user.replace(/^@/, '');

    if (!apiKey) {
      console.warn('[social-scraper] SCRAPE_CREATORS_API_KEY not set — returning stub data.');
      return {
        instagram: { username: igHandle, error: 'SCRAPE_CREATORS_API_KEY not configured' },
        tiktok: { username: ttHandle, error: 'SCRAPE_CREATORS_API_KEY not configured' },
        note: 'Set SCRAPE_CREATORS_API_KEY env var to enable live social media data.',
      };
    }

    // ── Instagram ────────────────────────────────────────────────────────────
    const instagram = await fetchInstagram(igHandle, apiKey);

    // ── TikTok ───────────────────────────────────────────────────────────────
    const tiktok = ttHandle
      ? await fetchTikTok(ttHandle, apiKey)
      : { username: '' };

    return { instagram, tiktok };
  },
});
