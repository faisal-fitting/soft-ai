import { handleChatStream } from '@mastra/ai-sdk';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return NextResponse.json([]);
  }

  try {
    const agent = mastra.getAgent('cboAgent');
    const memory = await agent.getMemory();
    
    const response = await memory?.recall({
      threadId,
      resourceId: 'user',
    });

    const uiMessages = toAISdkV5Messages(response?.messages || []);
    return NextResponse.json(uiMessages);
  } catch (error) {
    console.error('[chat:GET] failed to fetch messages:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const { messages, threadId, resourceId, ...rest } = await req.json();

  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId is required' },
      { status: 400 }
    );
  }

  const stream = await handleChatStream({
    mastra,
    agentId: 'cboAgent',
    params: {
      messages,
      ...rest,
      memory: { thread: threadId, resource: resourceId ?? 'user' },
    },
  });

  return createUIMessageStreamResponse({ stream });
}
