import { handleWorkflowStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { inputData, resumeData, runId, step } = await req.json();

  console.log('[workflow-stream] inputData:', JSON.stringify(inputData, null, 2));
  console.log('[workflow-stream] runId:', runId ?? '(none)');

  const stream = await handleWorkflowStream({
    mastra,
    workflowId: 'business-analysis-workflow',
    params: {
      inputData,
      resumeData,
      runId,
      step,
    },
  });

  console.log('[workflow-stream] stream created, sending response');

  return createUIMessageStreamResponse({ stream });
}
