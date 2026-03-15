import { handleWorkflowStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const { inputData, resumeData, runId, step, threadId } = body;

  console.log('[workflow-stream] inputData keys:', inputData ? Object.keys(inputData) : 'none');
  console.log('[workflow-stream] runId:', runId ?? '(none)');
  console.log('[workflow-stream] threadId:', threadId ?? '(none)');

  // Merge threadId into inputData for workflow consumption
  const workflowInput = threadId ? { ...inputData, threadId } : inputData;

  const stream = await handleWorkflowStream({
    mastra,
    workflowId: 'business-analysis-workflow',
    params: {
      inputData: workflowInput,
      resumeData,
      runId,
      step,
    },
  });

  return createUIMessageStreamResponse({ stream: stream as any });
}
