"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { mastra } from '@/mastra';
import type { ReportManifest } from '@/app/page';

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
    console.log(`[getWorkflowRun] result keys:`, Object.keys((state as any)?.result ?? {}));
    console.log(`[getWorkflowRun] raw state keys:`, Object.keys(state ?? {}));
    if (!state || state.status !== 'success') {
      return null;
    }
    const result = (state as any).result;
    // result could be the manifest directly or nested
    const manifest = result?.metadata ? result : result?.result;
    console.log(`[getWorkflowRun] manifest keys:`, Object.keys(manifest ?? {}));
    return manifest as ReportManifest ?? null;
  } catch (err) {
    console.error(`[getWorkflowRun] failed for runId=${runId}:`, err);
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
