"use client";

import { PlusCircle, MapPin, Star, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import type { ReportManifest } from "@/lib/types";

const STATUS_CFG = {
  EXCEPTIONAL: { label: "استثنائي", variant: "default" as const, cls: "bg-emerald-500 text-white" },
  HEALTHY:     { label: "صحي",      variant: "default" as const, cls: "bg-blue-500 text-white" },
  WARNING:     { label: "تحذير",    variant: "default" as const, cls: "bg-amber-500 text-white" },
  CRITICAL:    { label: "حرج",      variant: "destructive" as const, cls: "" },
} as const;

interface Props {
  manifest: ReportManifest | null;
  isGenerating: boolean;
  onNewReport: () => void;
}

export function BusinessSidebar({ manifest, isGenerating, onNewReport }: Props) {
  const meta = manifest?.metadata;
  const directive = manifest?.directive;
  const status = directive?.overallStatus;
  const statusCfg = status ? STATUS_CFG[status] : null;

  return (
    <Sidebar side="left" dir="rtl" collapsible="none">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="space-y-0.5">
          <h1 className="text-sm font-bold tracking-wide">CBO.AI</h1>
          <p className="text-xs text-muted-foreground">تحليل الأعمال بالذكاء الاصطناعي</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Business Profile Card */}
        {meta && (
          <SidebarGroup>
            {meta.photoUrl && (
              <div className="mb-3 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.photoUrl}
                  alt={meta.businessName}
                  className="h-32 w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-1 px-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold leading-tight">{meta.businessName}</h2>
                {statusCfg && (
                  <Badge className={statusCfg.cls}>{statusCfg.label}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span>{meta.businessType}</span>
              </div>
            </div>

            {/* Health Score */}
            <div className="mt-4 rounded-lg border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Activity className="size-3" />
                  نقاط الصحة
                </span>
                <span className="text-xl font-bold">{meta.healthScore}</span>
              </div>
              <Progress value={meta.healthScore} className="h-1.5" />
              <p className="mt-1 text-right text-xs text-muted-foreground">/ 100</p>
            </div>

            {/* North Star */}
            {directive?.northStarMetric && (
              <div className="mt-2 rounded-lg border bg-background p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  المؤشر الأساسي
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold">
                    {directive.northStarMetric.value.toLocaleString("ar-SA")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {directive.northStarMetric.target.toLocaleString("ar-SA")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium">{directive.northStarMetric.name}</p>
              </div>
            )}
          </SidebarGroup>
        )}

        {/* Focus Areas */}
        {directive?.focusAreas && (
          <SidebarGroup>
            <SidebarGroupLabel>محاور التركيز</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-2 px-1">
                {[
                  { label: "المالي", value: directive.focusAreas.financial },
                  { label: "الرقمي", value: directive.focusAreas.digital },
                  { label: "السوق",  value: directive.focusAreas.market },
                ].map((area) => (
                  <div key={area.label} className="rounded-md border bg-background p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {area.label}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug">{area.value}</p>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Empty state */}
        {!meta && !isGenerating && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-1 py-4 text-center text-sm text-muted-foreground">
                <Star className="mx-auto mb-2 size-8 opacity-20" />
                <p>أدخل بيانات عملك لبدء التحليل</p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm"
          onClick={onNewReport}
          disabled={isGenerating}
        >
          <PlusCircle className="size-3.5" />
          تقرير جديد
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
