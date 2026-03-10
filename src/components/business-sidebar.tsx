"use client";

import { MapPin, Star, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import type { ReportManifest } from "@/lib/types";
import { MessageResponse } from "./ai-elements/message";

const STATUS_CFG = {
  EXCEPTIONAL: { label: "استثنائي", variant: "default" as const, cls: "bg-emerald-500 text-white" },
  HEALTHY:     { label: "صحي",      variant: "default" as const, cls: "bg-blue-500 text-white"    },
  WARNING:     { label: "تحذير",    variant: "default" as const, cls: "bg-amber-500 text-white"   },
  CRITICAL:    { label: "حرج",      variant: "destructive" as const, cls: ""                      },
} as const;

interface Props {
  manifest: ReportManifest | null;
  isGenerating: boolean;
}

export function BusinessSidebar({ manifest, isGenerating }: Props) {
  const meta = manifest?.metadata;
  const directive = manifest?.directive;
  const status = directive?.overallStatus;
  const statusCfg = status ? STATUS_CFG[status] : null;

  return (
    <Sidebar side="left" dir="rtl" collapsible="none">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="space-y-0.5">
          <h1 className="text-sm font-bold tracking-wide">CBO.AI</h1>
          <p className="text-sm text-muted-foreground">تحليل الأعمال بالذكاء الاصطناعي</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Loading skeleton while workflow runs ── */}
        {isGenerating && !meta && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="space-y-3 px-1 py-2">
                {/* Photo skeleton */}
                <Skeleton className="h-32 w-full rounded-lg" />

                {/* Name + badge */}
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>

                {/* Address */}
                <Skeleton className="h-4 w-full" />

                {/* Rating */}
                <Skeleton className="h-4 w-20" />

                {/* Health score card */}
                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-10" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>

                {/* North star card */}
                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Business Profile Card ── */}
        {meta && (
          <SidebarGroup>
            {meta.photoUrl && (
              <div className="mb-3 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.photoUrl}
                  alt={meta.displayName ?? meta.businessName}
                  className="h-32 w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-1 px-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold leading-tight">
                  {meta.displayName ?? meta.businessName}
                </h2>
                {statusCfg && (
                  <Badge className={statusCfg.cls}>{statusCfg.label}</Badge>
                )}
              </div>
              {meta.address && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="line-clamp-2">{meta.address}</span>
                </div>
              )}
              {(meta.rating != null || meta.reviewCount != null) && (
                <div className="flex items-center gap-2 text-sm">
                  {meta.rating != null && (
                    <span className="flex items-center gap-0.5 font-medium">
                      <Star className="size-3 fill-yellow-500 text-yellow-500" />
                      {meta.rating.toFixed(1)}
                    </span>
                  )}
                  {meta.reviewCount != null && (
                    <span className="text-muted-foreground">
                      ({meta.reviewCount.toLocaleString()} تقييم)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Health Score */}
            <div className="mt-4 rounded-lg border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Activity className="size-3" />
                  درجة الأداء
                </span>
                <span className="text-xl font-bold">{meta.healthScore}</span>
              </div>
              <Progress value={meta.healthScore} className="h-1.5" />
              <p className="mt-1 text-right text-sm text-muted-foreground">/ 100</p>
            </div>

            {/* North Star */}
            {directive?.northStarMetric && (
              <div className="mt-2 rounded-lg border bg-background p-3">
                <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  المؤشر الأساسي
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold">
                    {directive.northStarMetric.value.toLocaleString("ar-SA")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {directive.northStarMetric.target.toLocaleString("ar-SA")}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium">{directive.northStarMetric.name}</p>
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
                  { label: "السوق",  value: directive.focusAreas.market   },
                ].map((area) => (
                  <div key={area.label} className="rounded-md border bg-background p-2.5">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {area.label}
                    </p>
                    <MessageResponse>{area.value}</MessageResponse>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Focus area skeletons while generating */}
        {isGenerating && !directive?.focusAreas && (
          <SidebarGroup>
            <SidebarGroupLabel>محاور التركيز</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-2 px-1">
                {['المالي', 'الرقمي', 'السوق'].map((label) => (
                  <div key={label} className="rounded-md border bg-background p-2.5 space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
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
    </Sidebar>
  );
}
