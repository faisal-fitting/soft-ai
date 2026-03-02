"use server";

import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { mastra } from '@/mastra';

export async function getThreadMessages(threadId: string) {
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) return [];

  const { messages } = await memory.recall({ threadId, resourceId: "user" });
  return toAISdkV5Messages(messages);
}

export async function listUserThreads() {
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
