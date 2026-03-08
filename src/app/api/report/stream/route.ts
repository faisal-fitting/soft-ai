import { handleWorkflowStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { inputData, resumeData, runId, step } = await req.json();

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

  return createUIMessageStreamResponse({ stream });
}
