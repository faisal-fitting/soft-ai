import { mastra } from '@/mastra';
import { reportManifestSchema } from '@/mastra/shared/schemas';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { manifest, threadId, resourceId } = await req.json();

  const validatedManifest = reportManifestSchema.parse(manifest);

  const cboAgent = mastra.getAgent('cboAgent');
  if (!cboAgent) {
    return Response.json({ error: 'Agent not found' }, { status: 404 });
  }

  const memory = await cboAgent.getMemory(threadId);
  if (!memory) {
    return Response.json({ error: 'Memory not found' }, { status: 404 });
  }

  await memory.updateWorkingMemory({
    threadId,
    resourceId: resourceId || 'user',
    workingMemory: `[سياق] هذا تقرير تحليل الأعمال (JSON):

${JSON.stringify(validatedManifest, null, 2)}

استخدم هذا التقرير للإجابة على أسئلة المستخدم. كن دقيقاً واستشهد ببيانات التقرير.`,
  });

  return Response.json({ success: true });
}
