import React from "react";
import { FinancialFormData } from "./business-form";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentStep: number;
  data: FinancialFormData;
}

export function BusinessFormSidebar({ currentStep, data }: Props) {
  const steps = [
    { id: 0, label: "المعلومات الأساسية" },
    { id: 1, label: "البيانات المالية" },
    { id: 2, label: "المنتجات" },
  ];

  return (
    <div className="w-64 bg-[#000B26] p-6 flex flex-col border-l border-white/5">
      <h3 className="text-white font-bold text-lg mb-8">Briefing Status</h3>
      
      <div className="space-y-6 flex-1">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className={cn(
              "size-6 rounded-full flex items-center justify-center border",
              currentStep === step.id ? "border-[#001CFF] bg-[#001CFF]/10 text-[#001CFF]" :
              currentStep > step.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" :
              "border-white/20 text-white/20"
            )}>
              {currentStep > step.id ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
            </div>
            <span className={cn(
              "text-sm",
              currentStep === step.id ? "text-white font-semibold" : "text-white/50"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-white/10">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Vitals</p>
        <div className="space-y-2">
           <div className="flex justify-between text-sm">
             <span className="text-white/70">الإيراد المتوقع</span>
             <span className="text-white font-mono">{data.sales.toLocaleString()}</span>
           </div>
           <div className="flex justify-between text-sm">
             <span className="text-white/70">المنتجات</span>
             <span className="text-white font-mono">{data.items.length}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
