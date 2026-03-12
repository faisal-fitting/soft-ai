"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { mastra } from '@/mastra';
import type { ReportManifest, CollectedData } from '@/lib/types';

export async function getThreadMessages(threadId: string) {
  noStore();
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) return [];

  const { messages } = await memory.recall({ threadId, resourceId: "user" });
  console.log(`[getThreadMessages] threadId=${threadId} | raw: ${messages.length}`);
  const converted = toAISdkV5Messages(messages);
  console.log(`[getThreadMessages] converted: ${converted.length}`);
  return converted;
}

export async function getWorkflowRun(runId: string): Promise<ReportManifest | null> {
  noStore();
  try {
    const workflow = mastra.getWorkflow('businessAnalysisWorkflow');
    const state = await workflow.getWorkflowRunById(runId);
    console.log(`[getWorkflowRun] runId=${runId} status=${state?.status ?? 'not found'}`);
    if (!state || state.status !== 'success') return null;
    const result = (state as any).result;
    const manifest = result?.metadata ? result : result?.result;
    return manifest as ReportManifest ?? null;
  } catch (err) {
    console.error(`[getWorkflowRun] failed for runId=${runId}:`, err);
    return null;
  }
}

export async function getCollectedData(runId: string): Promise<CollectedData | null> {
  noStore();
  try {
    const workflow = mastra.getWorkflow('businessAnalysisWorkflow');
    const state = await workflow.getWorkflowRunById(runId, { fields: ['steps'] });
    if (!state?.steps) return null;

    const financialsStep = state.steps['collect-financials']?.output;
    const mergedStep = state.steps['merge-external-data']?.output;
    const socialStep = state.steps['fetch-social-data']?.output;
    const semanticStep = state.steps['run-semantic-analysis']?.output;
    const socialAuditStep = state.steps['run-social-audit']?.output;

    if (!financialsStep || !mergedStep) return null;

    // ── Financials ────────────────────────────────────────────────────────────
    const financials: CollectedData['financials'] = {
      netRevenue: financialsStep.netRevenue ?? 0,
      variableCosts: financialsStep.variableCosts ?? 0,
      fixedCosts: financialsStep.fixedCosts ?? 0,
      totalCosts: financialsStep.totalCosts ?? 0,
      grossProfit: financialsStep.grossProfit ?? 0,
      netProfit: financialsStep.netProfit ?? 0,
      grossMargin: financialsStep.grossMargin ?? 0,
      netMargin: financialsStep.netMargin ?? 0,
      breakEvenRevenue: financialsStep.breakEvenRevenue ?? 0,
      breakEvenGap: financialsStep.breakEvenGap ?? 0,
      isAboveBreakEven: financialsStep.isAboveBreakEven ?? false,
      rawMaterials: financialsStep.rawMaterials ?? 0,
      packaging: financialsStep.packaging ?? 0,
      items: (financialsStep.items ?? []).map((item: any) => ({
        name: item.name,
        sellingPrice: item.sellingPrice,
        soldUnits: item.soldUnits,
        totalRevenue: item.totalRevenue,
        revenueShare: item.revenueShare,
        contributionMarginPerUnit: item.contributionMarginPerUnit,
        profitPerUnit: item.profitPerUnit,
        fullCostPerUnit: item.fullCostPerUnit,
        breakEvenUnits: item.breakEvenUnits,
        capacityUtilizationPercent: item.capacityUtilizationPercent,
        menuCategory: item.menuCategory,
        isBelowCost: item.isBelowCost,
      })),
    };

    // ── Reviews ───────────────────────────────────────────────────────────────
    const rawReviews = mergedStep.reviews;
    const reviews: CollectedData['reviews'] = {
      totalFetched: rawReviews?.total_fetched ?? 0,
      topics: (rawReviews?.topics ?? [])
        .slice(0, 12)
        .map((t: any) => ({ keyword: t.keyword, mentions: t.mentions })),
      samples: (rawReviews?.reviews ?? [])
        .slice(0, 8)
        .map((r: any) => ({
          rating: r.rating,
          date: r.date,
          snippet: r.snippet ?? r.extracted_snippet?.original,
          userName: r.user?.name ?? 'مجهول',
          details: r.details
            ? { food: r.details.food, service: r.details.service, atmosphere: r.details.atmosphere }
            : undefined,
        })),
    };

    // ── Social Profiles ───────────────────────────────────────────────────────
    const rawSocial = socialStep?.socialData ?? mergedStep.socialData;
    const socialProfiles: CollectedData['socialProfiles'] = [];

    if (rawSocial?.instagram && !rawSocial.instagram.error) {
      const ig = rawSocial.instagram;
      const allPosts = [
        ...(ig.recentReels ?? []).map((p: any) => ({ ...p, type: 'reel' as const })),
        ...(ig.recentPosts ?? []).map((p: any) => ({ ...p, type: p.isReel ? 'reel' as const : 'post' as const })),
      ];
      const topPosts = allPosts
        .sort((a: any, b: any) => ((b.views ?? 0) + (b.likes ?? 0)) - ((a.views ?? 0) + (a.likes ?? 0)))
        .slice(0, 5)
        .map((p: any) => ({
          caption: p.caption,
          likes: p.likes,
          comments: p.comments,
          views: p.views,
          url: p.url,
          date: p.date,
          type: p.type,
        }));

      socialProfiles.push({
        platform: 'instagram',
        username: ig.username,
        profileUrl: ig.profileUrl,
        profilePicUrl: ig.profilePicUrl,
        followers: ig.followers,
        following: ig.following,
        postsCount: ig.postsCount,
        engagementRate: ig.engagementRate,
        postsPerWeek: ig.postsPerWeek,
        isVerified: ig.isVerified,
        bio: ig.bio,
        topPosts,
      });
    }

    if (rawSocial?.tiktok && !rawSocial.tiktok.error) {
      const tt = rawSocial.tiktok;
      const topPosts = (tt.recentVideos ?? [])
        .sort((a: any, b: any) => ((b.views ?? 0) + (b.likes ?? 0)) - ((a.views ?? 0) + (a.likes ?? 0)))
        .slice(0, 5)
        .map((p: any) => ({
          caption: p.caption,
          likes: p.likes,
          comments: p.comments,
          views: p.views,
          url: p.url,
          date: p.date,
          type: 'video' as const,
        }));

      socialProfiles.push({
        platform: 'tiktok',
        username: tt.username,
        profileUrl: tt.profileUrl,
        profilePicUrl: tt.profilePicUrl,
        followers: tt.followers,
        following: tt.following,
        postsCount: tt.videosCount,
        engagementRate: tt.engagementRate,
        postsPerWeek: tt.postsPerWeek,
        bio: tt.bio,
        topPosts,
      });
    }

    // ── Semantic Analysis ─────────────────────────────────────────────────────
    const semantic: CollectedData['semantic'] = semanticStep
      ? {
          sentimentScore: semanticStep.sentimentScore ?? 50,
          themes: (semanticStep.themes ?? []).map((t: any) => ({
            topic: t.topic,
            sentiment: t.sentiment,
            mentions: t.mentions,
            exampleSnippets: t.exampleSnippets ?? [],
          })),
          strengths: semanticStep.strengths,
          weaknesses: semanticStep.weaknesses,
          criticalWeakness: semanticStep.criticalWeakness,
        }
      : { sentimentScore: 50, themes: [] };

    // ── Social Audit ──────────────────────────────────────────────────────────
    const socialAudit: CollectedData['socialAudit'] = socialAuditStep
      ? {
          healthScore: socialAuditStep.healthScore ?? 5,
          platformBenchmarks: socialAuditStep.platformBenchmarks ?? [],
          contentStrategyGap: socialAuditStep.contentStrategyGap ?? '',
          viralitySignals: socialAuditStep.viralitySignals ?? { shareToImpressionRatio: 0, growthPotential: 'low' },
          topPerformingContent: socialAuditStep.topPerformingContent,
        }
      : { healthScore: 5, platformBenchmarks: [], contentStrategyGap: '', viralitySignals: { shareToImpressionRatio: 0, growthPotential: 'low' } };

    // ── Competitors ───────────────────────────────────────────────────────────
    const competitors: CollectedData['competitors'] = (mergedStep.nearbyCompetitors ?? [])
      .map((c: any) => ({
        name: c.displayName?.text ?? c.id,
        rating: c.rating,
        reviewCount: c.userRatingCount,
        address: c.formattedAddress,
        priceLevel: c.priceLevel,
      }))
      .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));

    const competitorReviews: CollectedData['competitorReviews'] = (mergedStep.competitorReviews ?? [])
      .map((cr: any) => ({
        name: cr.name,
        rating: cr.rating,
        reviewCount: cr.reviewCount,
        reviews: (cr.reviews ?? []).slice(0, 4).map((r: any) => ({
          rating: r.rating,
          snippet: r.snippet,
          date: r.date,
        })),
      }));

    // ── Place Details ─────────────────────────────────────────────────────────
    const pd = mergedStep.placeDetails;
    const photoUrls = (pd?.photos ?? [])
      .slice(0, 4)
      .map((p: any) =>
        p.name
          ? `https://places.googleapis.com/v1/${p.name}/media?maxHeightPx=400&key=${process.env.GOOGLE_PLACES_API_KEY ?? ''}`
          : null
      )
      .filter(Boolean) as string[];

    const placeDetails: CollectedData['placeDetails'] = {
      phone: pd?.internationalPhoneNumber ?? pd?.nationalPhoneNumber,
      website: pd?.websiteUri,
      openingHours: pd?.regularOpeningHours?.weekdayDescriptions,
      priceLevel: pd?.priceLevel,
      photoUrls,
    };

    return { financials, reviews, socialProfiles, semantic, socialAudit, competitors, competitorReviews, placeDetails };
  } catch (err) {
    console.error(`[getCollectedData] failed for runId=${runId}:`, err);
    return null;
  }
}

export async function startWorkflowRun(
  runId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputData: Record<string, any>
): Promise<ReportManifest | null> {
  noStore();
  try {
    console.log(`[startWorkflowRun] attempting to start runId=${runId}`);
    const workflow = mastra.getWorkflow('businessAnalysisWorkflow');
    const run = await workflow.createRun({ runId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (run as any).start({ inputData });
    console.log(`[startWorkflowRun] result status=${result?.status}`);
    if (result?.status === 'success') return result.result as ReportManifest;
    return null;
  } catch (err) {
    console.error(`[startWorkflowRun] failed for runId=${runId}:`, err);
    return null;
  }
}

export async function listUserThreads() {
  noStore();
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) return [];

  const result = await memory.listThreads({
    filter: { resourceId: "user" },
    page: 0,
    perPage: 100,
  });

  return (result.threads ?? [])
    .map((t) => ({ id: t.id, title: t.title ?? "", updatedAt: t.updatedAt as Date }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveThreadTitle(threadId: string, title: string) {
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) return;

  await memory.saveThread({
    thread: {
      id: threadId,
      title,
      resourceId: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    },
  });
}
