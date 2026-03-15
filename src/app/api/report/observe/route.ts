import { createUIMessageStreamResponse } from 'ai';
import { toAISdkStream } from '@mastra/ai-sdk';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { runId } = body;

    if (!runId) {
      console.error('[workflow-observe] missing runId');
      return new Response(JSON.stringify({ error: 'runId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[workflow-observe] connecting to runId:', runId);

    const workflow = mastra.getWorkflow('businessAnalysisWorkflow');
    
    // Connect to existing workflow run
    const run = await workflow.createRun({ runId });
    
    // Reconnect to the running stream
    const mastraStream = run.observeStream();

    // Convert Mastra stream to AI SDK compatible stream
    // Cast to any since observeStream returns a different type signature
    const aiStream = toAISdkStream(mastraStream as any, {
      from: 'workflow',
      includeTextStreamParts: true,
    });

    console.log('[workflow-observe] stream connected for runId:', runId);

    return createUIMessageStreamResponse({ stream: aiStream as any });
  } catch (err) {
    console.error('[workflow-observe] error:', err);
    return new Response(JSON.stringify({ error: 'Failed to observe workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
