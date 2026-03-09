import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReportStore {
  runId: string | null;
  threadId: string | null;
  businessName: string | null;
  phase: 'form' | 'chat';
  startReport: (runId: string, threadId: string, businessName: string) => void;
  selectThread: (threadId: string) => void;
  reset: () => void;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set) => ({
      runId: null,
      threadId: null,
      businessName: null,
      phase: 'form',
      startReport: (runId, threadId, businessName) => {
        console.log("[store:startReport]", { runId, threadId, businessName });
        set({ runId, threadId, businessName, phase: 'chat' });
      },
      selectThread: (threadId) => {
        console.log("[store:selectThread]", { threadId });
        set({ threadId, runId: null, businessName: null, phase: 'chat' });
      },
      reset: () => {
        console.log("[store:reset]");
        set({ runId: null, threadId: null, businessName: null, phase: 'form' });
      },
    }),
    { name: 'cbo-report' }
  )
);
