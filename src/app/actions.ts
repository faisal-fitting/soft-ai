"use server";

import { unstable_noStore as noStore } from 'next/cache';

import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { mastra } from '@/mastra';

export async function getThreadMessages(threadId: string) {
  noStore();
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) {
    console.log(`[getThreadMessages] No memory found for agent`);
    return [];
  }

  const { messages } = await memory.recall({ threadId, resourceId: "user" });
  console.log(`[getThreadMessages] raw: ${messages.length}`);
  const converted = toAISdkV5Messages(messages);
  console.log(`[getThreadMessages] converted: ${JSON.stringify(converted.map((m) => ({
    role: m.role,
    parts: (m as unknown as { parts?: Array<{ type: string; text?: string }> }).parts?.map((p) => ({
      type: p.type,
      textLen: p.text?.length,
      textPreview: p.text?.slice(0, 80),
    })),
    contentType: typeof (m as unknown as { content?: unknown }).content,
    contentLen: typeof (m as unknown as { content?: unknown }).content === 'string'
      ? ((m as unknown as { content: string }).content).length
      : Array.isArray((m as unknown as { content?: unknown }).content)
        ? (m as unknown as { content: unknown[] }).content.length
        : 0,
  })))}`);
  return converted;
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
