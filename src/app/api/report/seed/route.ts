import { mastra } from '@/mastra';
import { reportManifestSchema } from '@/mastra/shared/schemas';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { manifest, threadId, resourceId } = await req.json();

  console.log('[seed] received manifest keys:', Object.keys(manifest ?? {}));
  console.log('[seed] manifest sample:', JSON.stringify(manifest).slice(0, 500));

  let validatedManifest;
  try {
    validatedManifest = reportManifestSchema.parse(manifest);
  } catch (err) {
    console.error('[seed] validation failed:', err);
    return Response.json({ error: 'Invalid manifest', details: String(err) }, { status: 400 });
  }

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
