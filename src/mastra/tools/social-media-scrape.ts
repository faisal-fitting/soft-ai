import { createTool } from '@mastra/core/tools';
import axios from 'axios';
import { z } from 'zod';
import {
  instagramProfileSchema,
  tiktokProfileSchema,
  socialDataSchema,
} from '../shared/schemas';

// ── Axios instance ────────────────────────────────────────────────────────────
const scraperClient = axios.create({
  baseURL: 'https://api.scrapecreators.com',
  timeout: 12_000,
});

function headers(apiKey: string) {
  return { 'x-api-key': apiKey };
}

// ── Raw API types ─────────────────────────────────────────────────────────────
interface TtVideoStats {
  digg_count?: number;    diggCount?: number;
  comment_count?: number; commentCount?: number;
  play_count?: number;    playCount?: number;
  share_count?: number;   shareCount?: number;
  collect_count?: number; collectCount?: number;
}

interface TtVideo {
  desc?: string;
  statistics?: TtVideoStats;
  stats?: TtVideoStats;
  create_time?: number;
  create_time_utc?: string;
  video?: { duration?: number }; // milliseconds
  url?: string;
  share_url?: string;
}

interface IgReelMediaItem {
  taken_at?: number;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  ig_play_count?: number;
  video_duration?: number; // seconds
  url?: string;
}

interface IgReelItem { media?: IgReelMediaItem; }

interface IgReelsResponse {
  items?: IgReelItem[];
  paging_info?: { max_id?: string; more_available?: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computePostsPerWeek(dates: (string | undefined)[]): number | undefined {
  const timestamps = dates
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));
  if (timestamps.length < 2) return undefined;
  const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
  const weeks = spanMs / (7 * 24 * 60 * 60 * 1000);
  return weeks > 0 ? Math.round((timestamps.length / weeks) * 10) / 10 : undefined;
}

// ── Instagram ─────────────────────────────────────────────────────────────────
async function fetchInstagramRaw(handle: string, apiKey: string) {
  const [profileRes, postsRes, reelsRes] = await Promise.all([
    scraperClient.get(`/v1/instagram/profile?handle=${encodeURIComponent(handle)}&trim=true`, { headers: headers(apiKey) }),
    scraperClient.get(`/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}&trim=true`, { headers: headers(apiKey) })
      .catch(() => null),
    scraperClient.get<IgReelsResponse>(
      `/v1/instagram/user/reels?handle=${encodeURIComponent(handle)}&trim=true`,
      { headers: headers(apiKey) },
    ).catch(() => null),
  ]);
  return {
    profileData: profileRes.data,
    postsData:   postsRes?.data  ?? {},
    reelsData:   (reelsRes?.data ?? {}) as IgReelsResponse,
  };
}

function computeInstagramMetrics(
  handle: string,
  profileData: Record<string, unknown>,
  postsData: Record<string, unknown>,
  reelsData: IgReelsResponse,
): z.infer<typeof instagramProfileSchema> {
  const user = (profileData as any).data?.user ?? {};
  const followers = user.edge_followed_by?.count ?? 0;

  // Static posts only (media_type !== 2) — keeps captions
  const items: any[] = (postsData as any).items ?? [];
  const recentPosts = items
    .filter((item: any) => item.media_type !== 2)
    .map((item: any) => ({
      caption:  item.caption?.text,
      likes:    item.like_count,
      comments: item.comment_count,
      isReel:   false,
      url:      item.url,
      date:     item.taken_at ? new Date(item.taken_at * 1000).toISOString() : undefined,
    }));

  // Reels from dedicated endpoint — accurate view counts, no captions
  const reelItems: IgReelMediaItem[] = (reelsData.items ?? [])
    .map((ri) => ri.media)
    .filter((m): m is IgReelMediaItem => Boolean(m));

  const recentReels = reelItems.map((m) => ({
    likes:    m.like_count,
    comments: m.comment_count,
    views:    m.ig_play_count ?? m.play_count,
    isReel:   true,
    url:      m.url,
    date:     m.taken_at ? new Date(m.taken_at * 1000).toISOString() : undefined,
    duration: m.video_duration, // already in seconds
  }));

  // Averages: likes/comments across static + reels; views only from reels endpoint
  const allPosts = [...recentPosts, ...recentReels];
  const avgLikes    = avg(allPosts.map((p) => p.likes    ?? 0));
  const avgComments = avg(allPosts.map((p) => p.comments ?? 0));

  const reelViewValues = recentReels
    .filter((r) => r.views != null)
    .map((r) => r.views!);
  const avgViews = reelViewValues.length > 0 ? avg(reelViewValues) : undefined;

  const engagementRate = followers > 0
    ? ((avgLikes + avgComments) / followers) * 100
    : undefined;

  const postsPerWeek = computePostsPerWeek([
    ...recentPosts.map((p) => p.date),
    ...recentReels.map((r) => r.date),
  ]);

  const igUsername = user.username ?? handle;
  console.log(`[social-scraper] Instagram @${igUsername} — followers: ${followers || 'n/a'}`);
  return {
    username:          igUsername,
    profileUrl:        `https://www.instagram.com/${igUsername}/`,
    profilePicUrl:     user.profile_pic_url_hd ?? user.profile_pic_url,
    fullName:          user.full_name,
    bio:               user.biography,
    followers:         followers || undefined,
    following:         user.edge_follow?.count,
    postsCount:        user.edge_owner_to_timeline_media?.count,
    isVerified:        user.is_verified,
    isBusinessAccount: user.is_business_account,
    categoryName:      user.category_name,
    avgLikes, avgComments,
    ...(avgViews       !== undefined ? { avgViews }       : {}),
    ...(engagementRate !== undefined ? { engagementRate } : {}),
    ...(postsPerWeek   !== undefined ? { postsPerWeek }   : {}),
    recentPosts:  recentPosts.length  > 0 ? recentPosts  : undefined,
    recentReels:  recentReels.length  > 0 ? recentReels  : undefined,
  };
}

// ── TikTok ────────────────────────────────────────────────────────────────────
async function fetchTikTokRaw(handle: string, apiKey: string) {
  const [profileRes, videosRes] = await Promise.all([
    scraperClient.get(`/v1/tiktok/profile?handle=${encodeURIComponent(handle)}`, { headers: headers(apiKey) }),
    scraperClient.get(`/v3/tiktok/profile/videos?handle=${encodeURIComponent(handle)}&amount=10&trim=true`, { headers: headers(apiKey) })
      .catch(() => null),
  ]);
  return { profileData: profileRes.data, videosData: videosRes?.data ?? {} };
}

function computeTikTokMetrics(
  handle: string,
  profileData: Record<string, unknown>,
  videosData: Record<string, unknown>,
): z.infer<typeof tiktokProfileSchema> {
  const user  = (profileData as any).user  ?? {};
  const stats = (profileData as any).stats ?? {};

  const videos: TtVideo[] = (videosData as any).aweme_list ?? (videosData as any).videos ?? (videosData as any).items ?? [];
  const recentVideos = videos.map((v) => {
    const s: TtVideoStats = v.statistics ?? v.stats ?? {};
    const durationMs = v.video?.duration;
    const date = v.create_time_utc
      ? v.create_time_utc
      : v.create_time
        ? new Date(v.create_time * 1000).toISOString()
        : undefined;
    return {
      caption:  v.desc,
      likes:    s.digg_count    ?? s.diggCount,
      comments: s.comment_count ?? s.commentCount,
      views:    s.play_count    ?? s.playCount,
      shares:   s.share_count   ?? s.shareCount,
      saves:    s.collect_count ?? s.collectCount,
      duration: durationMs != null ? Math.round(durationMs / 1000) : undefined,
      url:      v.url ?? v.share_url,
      date,
    };
  });

  const followers   = stats.followerCount || undefined;
  const avgViews    = recentVideos.length > 0 ? avg(recentVideos.map((v) => v.views    ?? 0)) : undefined;
  const avgLikes    = recentVideos.length > 0 ? avg(recentVideos.map((v) => v.likes    ?? 0)) : undefined;
  const avgComments = recentVideos.length > 0 ? avg(recentVideos.map((v) => v.comments ?? 0)) : undefined;
  const engagementRate = followers && avgLikes !== undefined && avgComments !== undefined
    ? ((avgLikes + avgComments) / followers) * 100
    : undefined;

  const shareValues = recentVideos.map((v) => v.shares ?? 0);
  const saveValues  = recentVideos.map((v) => v.saves  ?? 0);
  const avgShareCount = recentVideos.length > 0 ? avg(shareValues) : undefined;
  const avgSaveCount  = recentVideos.length > 0 ? avg(saveValues)  : undefined;

  const postsPerWeek = computePostsPerWeek(recentVideos.map((v) => v.date));

  // Extract the real handle from a video share_url — this survives cases where
  // uniqueId doesn't match the URL (e.g. auto-generated "user676918178" handles)
  const ttUsername = user.uniqueId ?? handle;
  let ttProfileUrl = `https://www.tiktok.com/@${ttUsername}`;
  for (const v of videos) {
    const rawUrl = v.share_url ?? v.url;
    if (rawUrl && typeof rawUrl === 'string') {
      const m = rawUrl.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([^/?&#]+)/);
      if (m && m[1]) { ttProfileUrl = `https://www.tiktok.com/@${m[1]}`; break; }
    }
  }

  console.log(`[social-scraper] TikTok @${ttUsername} — followers: ${followers ?? 'n/a'}`);
  return {
    username:      ttUsername,
    profileUrl:    ttProfileUrl,
    profilePicUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb,
    displayName:   user.nickname,
    bio:           user.signature,
    followers,
    following:   stats.followingCount,
    likes:       stats.heartCount,
    videosCount: stats.videoCount,
    ...(avgViews        !== undefined ? { avgViews }        : {}),
    ...(avgLikes        !== undefined ? { avgLikes }        : {}),
    ...(avgComments     !== undefined ? { avgComments }     : {}),
    ...(engagementRate  !== undefined ? { engagementRate }  : {}),
    ...(avgShareCount   !== undefined ? { avgShareCount }   : {}),
    ...(avgSaveCount    !== undefined ? { avgSaveCount }    : {}),
    ...(postsPerWeek    !== undefined ? { postsPerWeek }    : {}),
    recentVideos,
  };
}

// ── Tool ──────────────────────────────────────────────────────────────────────
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
  outputSchema: socialDataSchema,
  execute: async ({ instagram_user, tiktok_user }) => {
    if (process.env.MOCK_TOOLS === 'true') {
      const igHandle = instagram_user.replace(/^@/, '');
      const ttHandle = tiktok_user.replace(/^@/, '');
      console.log(`[social-scraper] MOCK — returning fake social data for @${igHandle} / @${ttHandle}`);
      return {
        instagram: {
          username: igHandle,
          profileUrl: `https://www.instagram.com/${igHandle}/`,
          profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(igHandle)}&background=E1306C&color=fff&size=128`,
          followers: 48770,
          following: 312,
          postsCount: 184,
          isVerified: false,
          isBusinessAccount: true,
          categoryName: 'Coffee Shop',
          avgLikes: 1240,
          avgComments: 38,
          avgViews: 28500,
          engagementRate: 2.6,
          postsPerWeek: 3.5,
          recentPosts: [
            { caption: 'صباح القهوة 🌅 ابدأ يومك بكوب لاتيه دافئ من عندنا', likes: 1820, comments: 54, isReel: false, url: `https://www.instagram.com/p/mock1/`, date: '2026-02-20T08:00:00Z' },
            { caption: 'منيو رمضان جاهز 🌙 تعالوا جربوا تشكيلة القهوة الموسمية', likes: 2340, comments: 87, isReel: false, url: `https://www.instagram.com/p/mock2/`, date: '2026-02-15T18:00:00Z' },
            { caption: 'خلف الكواليس — كيف نحضر الكابتشينو المثالي', likes: 980, comments: 21, isReel: false, url: `https://www.instagram.com/p/mock3/`, date: '2026-02-10T10:00:00Z' },
          ],
          recentReels: [
            { likes: 3100, comments: 112, views: 141000, isReel: true, url: `https://www.instagram.com/reel/mockreel1/`, date: '2026-02-18T15:00:00Z', duration: 18 },
            { likes: 1650, comments: 45, views: 52000, isReel: true, url: `https://www.instagram.com/reel/mockreel2/`, date: '2026-02-12T12:00:00Z', duration: 22 },
            { likes: 890, comments: 29, views: 21000, isReel: true, url: `https://www.instagram.com/reel/mockreel3/`, date: '2026-02-05T09:00:00Z', duration: 30 },
          ],
        },
        tiktok: {
          username: ttHandle,
          profileUrl: `https://www.tiktok.com/@${ttHandle}`,
          profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(ttHandle)}&background=010101&color=fff&size=128`,
          followers: 12400,
          following: 88,
          likes: 94000,
          videosCount: 67,
          avgViews: 18200,
          avgLikes: 620,
          avgComments: 42,
          engagementRate: 5.3,
          avgShareCount: 210,
          avgSaveCount: 145,
          postsPerWeek: 2.8,
          recentVideos: [
            { caption: 'أسرع طريقة تحضير إسبريسو في المنزل 🔥', likes: 1240, comments: 88, views: 67000, shares: 430, saves: 310, duration: 15, url: `https://www.tiktok.com/@${ttHandle}/video/mock1`, date: '2026-02-19T14:00:00Z' },
            { caption: 'ريلز تحضير القهوة المثلجة — 3 خطوات بس', likes: 890, comments: 55, views: 34000, shares: 180, saves: 220, duration: 20, url: `https://www.tiktok.com/@${ttHandle}/video/mock2`, date: '2026-02-14T11:00:00Z' },
            { caption: 'منيو جديد وصل 🎉 كولد برو بالتمر السعودي', likes: 540, comments: 31, views: 12000, shares: 90, saves: 75, duration: 25, url: `https://www.tiktok.com/@${ttHandle}/video/mock3`, date: '2026-02-08T16:00:00Z' },
          ],
        },
      };
    }

    const apiKey = process.env.SCRAPE_CREATORS_API_KEY!;

    const igHandle = instagram_user.replace(/^@/, '');
    const ttHandle = tiktok_user.replace(/^@/, '');

    if (!apiKey) {
      console.warn('[social-scraper] SCRAPE_CREATORS_API_KEY not set.');
      return {
        instagram: { username: igHandle, error: 'SCRAPE_CREATORS_API_KEY not configured' },
        tiktok:    { username: ttHandle, error: 'SCRAPE_CREATORS_API_KEY not configured' },
      };
    }

    const [igResult, ttResult] = await Promise.allSettled([
      igHandle
        ? fetchInstagramRaw(igHandle, apiKey).then(({ profileData, postsData, reelsData }) =>
            computeInstagramMetrics(igHandle, profileData, postsData, reelsData))
        : Promise.resolve({ username: '' } as z.infer<typeof instagramProfileSchema>),
      ttHandle
        ? fetchTikTokRaw(ttHandle, apiKey).then(({ profileData, videosData }) =>
            computeTikTokMetrics(ttHandle, profileData, videosData))
        : Promise.resolve({ username: '' } as z.infer<typeof tiktokProfileSchema>),
    ]);

    return {
      instagram: igResult.status === 'fulfilled' ? igResult.value : { username: igHandle, error: String((igResult as PromiseRejectedResult).reason) },
      tiktok: ttResult.status === 'fulfilled' ? ttResult.value : { username: ttHandle, error: String((ttResult as PromiseRejectedResult).reason) },
    };
  },
});
