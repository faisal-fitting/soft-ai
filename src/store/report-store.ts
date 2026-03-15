import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FinancialFormData } from '@/components/business-form';

interface ReportStore {
  runId: string | null;
  threadId: string | null;
  businessName: string | null;
  
  // Form state for split-screen layout
  formStep: number;
  formData: FinancialFormData | null;
  
  startReport: (runId: string, threadId: string, businessName: string) => void;
  selectThread: (threadId: string) => void;
  setFormStep: (step: number) => void;
  setFormData: (data: FinancialFormData) => void;
  reset: () => void;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set) => ({
      runId: null,
      threadId: null,
      businessName: null,
      formStep: 0,
      formData: null,
      
      startReport: (runId, threadId, businessName) => {
        console.log("[store:startReport]", { runId, threadId, businessName });
        set({ runId, threadId, businessName });
      },
      selectThread: (threadId) => {
        console.log("[store:selectThread]", { threadId });
        set({ threadId, runId: null, businessName: null });
      },
      setFormStep: (step) => {
        console.log("[store:setFormStep]", { step });
        set({ formStep: step });
      },
      setFormData: (data) => {
        console.log("[store:setFormData]", { businessName: data.businessName });
        set({ formData: data });
      },
      reset: () => {
        console.log("[store:reset]");
        set({ runId: null, threadId: null, businessName: null, formStep: 0, formData: null });
      },
    }),
    { name: 'cbo-report' }
  )
);
