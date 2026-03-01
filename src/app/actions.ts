"use server";

import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { mastra } from '@/mastra';

export async function getThreadMessages(threadId: string) {
  const agent = mastra.getAgent('cboAgent');
  const memory = await agent.getMemory();
  if (!memory) return [];

  const { messages } = await memory.recall({ threadId });
  return toAISdkV5Messages(messages);
}
