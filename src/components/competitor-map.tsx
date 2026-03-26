"use client";

import { useEffect } from "react";
import turfCircle from "@turf/circle";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
  useMap,
} from "@/components/ui/map";
import type { CollectedCompetitor } from "@/lib/types";

// ── Radius Circle ─────────────────────────────────────────────────────────────

function RadiusCircle({
  center,
  radiusMeters,
}: {
  center: [number, number];
  radiusMeters: number;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "radius-circle";
    const fillId = "radius-fill";
    const borderId = "radius-border";

    const circleGeoJSON = turfCircle(center, radiusMeters / 1000, {
      units: "kilometers",
      steps: 64,
    });

    map.addSource(sourceId, { type: "geojson", data: circleGeoJSON });
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": "#2E5BFF", "fill-opacity": 0.07 },
    });
    map.addLayer({
      id: borderId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#2E5BFF",
        "line-width": 1.5,
        "line-opacity": 0.5,
        "line-dasharray": [4, 3],
      },
    });

    return () => {
      if (map.getLayer(borderId)) map.removeLayer(borderId);
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  return null;
}

// ── Pin SVGs ──────────────────────────────────────────────────────────────────

function TargetPin() {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
      <ellipse cx="14" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.25)" />
      <path
        d="M14 0C8.477 0 4 4.477 4 10c0 7.5 10 24 10 24S24 17.5 24 10C24 4.477 19.523 0 14 0z"
        fill="#2E5BFF"
      />
      <circle cx="14" cy="10" r="5" fill="white" />
      <circle cx="14" cy="10" r="2.5" fill="#2E5BFF" />
    </svg>
  );
}

function DirectPin() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <ellipse cx="11" cy="26.5" rx="4" ry="1.5" fill="rgba(0,0,0,0.2)" />
      <path
        d="M11 0C6.582 0 3 3.582 3 8c0 5.5 8 18 8 18S19 13.5 19 8C19 3.582 15.418 0 11 0z"
        fill="#ef4444"
      />
      <circle cx="11" cy="8" r="3.5" fill="white" opacity="0.9" />
    </svg>
  );
}

function IndirectPin() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <ellipse cx="11" cy="26.5" rx="4" ry="1.5" fill="rgba(0,0,0,0.2)" />
      <path
        d="M11 0C6.582 0 3 3.582 3 8c0 5.5 8 18 8 18S19 13.5 19 8C19 3.582 15.418 0 11 0z"
        fill="#f59e0b"
      />
      <circle cx="11" cy="8" r="3.5" fill="white" opacity="0.9" />
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div
      className="absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs backdrop-blur-sm"
      dir="rtl"
    >
      <div className="mb-1 font-semibold text-white/70">الرمز</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#2E5BFF]" />
          <span className="text-white/80">الهدف</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444]" />
          <span className="text-white/80">منافس مباشر</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b]" />
          <span className="text-white/80">منافس غير مباشر</span>
        </div>
      </div>
    </div>
  );
}

// ── Price level helper ────────────────────────────────────────────────────────

function priceLevelStr(level?: string | number) {
  const n = typeof level === "string" ? parseInt(level.replace(/\D/g, "")) : level;
  if (!n) return null;
  return "﷼".repeat(Math.min(n, 4));
}

// ── Main Component ────────────────────────────────────────────────────────────

type CompetitorMapProps = {
  businessName: string;
  location: { lat: number; lon: number; radius: number };
  competitors: CollectedCompetitor[];
};

export function CompetitorMap({ businessName, location, competitors }: CompetitorMapProps) {
  const placed = competitors.filter((c) => c.lat != null && c.lon != null);

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl">
      <Map
        center={[location.lon, location.lat]}
        zoom={14}
        theme="dark"
        className="h-full w-full"
      >
        <RadiusCircle
          center={[location.lon, location.lat]}
          radiusMeters={location.radius}
        />

        <MapControls showZoom showCompass />

        {/* Target business pin */}
        <MapMarker longitude={location.lon} latitude={location.lat} anchor="bottom">
          <MarkerContent>
            <TargetPin />
          </MarkerContent>
          <MarkerPopup>
            <div className="min-w-[140px] p-2" dir="rtl">
              <div className="text-sm font-semibold text-white">{businessName}</div>
              <div className="mt-0.5 text-xs text-[#2E5BFF]">المنشأة المستهدفة</div>
            </div>
          </MarkerPopup>
        </MapMarker>

        {/* Competitor pins */}
        {placed.map((comp) => (
          <MapMarker
            key={`${comp.name}-${comp.lat}-${comp.lon}`}
            longitude={comp.lon!}
            latitude={comp.lat!}
            anchor="bottom"
          >
            <MarkerContent className="cursor-pointer">
              {comp.competitorCategory === "direct" ? <DirectPin /> : <IndirectPin />}
            </MarkerContent>
            <MarkerPopup>
              <div className="min-w-[160px] p-2" dir="rtl">
                <div className="text-sm font-semibold text-white">{comp.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                  {comp.rating != null && (
                    <span>⭐ {comp.rating.toFixed(1)}</span>
                  )}
                  {comp.reviewCount != null && (
                    <span>({comp.reviewCount.toLocaleString()})</span>
                  )}
                  {priceLevelStr(comp.priceLevel) && (
                    <span className="text-amber-400">{priceLevelStr(comp.priceLevel)}</span>
                  )}
                </div>
                <div
                  className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    comp.competitorCategory === "direct"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {comp.competitorCategory === "direct" ? "منافس مباشر" : "منافس غير مباشر"}
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>

      <MapLegend />
    </div>
  );
}
