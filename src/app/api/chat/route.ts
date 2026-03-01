import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, threadId, resourceId, ...rest } = await req.json();

  const stream = await handleChatStream({
    mastra,
    agentId: 'cboAgent',
    params: {
      messages,
      ...rest,
      ...(threadId && { memory: { thread: threadId, resource: resourceId ?? 'user' } }),
    },
  });

  return createUIMessageStreamResponse({ stream });
}
