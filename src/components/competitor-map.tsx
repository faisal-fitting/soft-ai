"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import turfCircle from "@turf/circle";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup,
  MapControls,
  useMap,
} from "@/components/ui/map";
import type { CollectedCompetitor } from "@/lib/types";
import {
  MapPin,
  MapPinned,
  Star,
  MessageSquareText,
  TrendingUp,
} from "lucide-react";

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
      paint: { "fill-color": "#034bff", "fill-opacity": 0.07 },
    });
    map.addLayer({
      id: borderId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#034bff",
        "line-width": 1.5,
        "line-opacity": 0.5,
        "line-dasharray": [4, 3],
      },
    });

    // Fit the map to the circle bounds so it's fully visible
    const coords = circleGeoJSON.geometry.coordinates[0] as [number, number][];
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds([minLng, minLat, maxLng, maxLat], { padding: 40, maxZoom: 15 });

    // No cleanup needed — parent Map's map.remove() destroys all layers/sources
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: "مجاني",
  PRICE_LEVEL_INEXPENSIVE: "اقتصادي",
  PRICE_LEVEL_MODERATE: "متوسط",
  PRICE_LEVEL_EXPENSIVE: "غالي",
  PRICE_LEVEL_VERY_EXPENSIVE: "فاخر",
};

const TYPE_LABELS: Record<string, string> = {
  cafe: "مقهى",
  coffee_shop: "محمصة قهوة",
  restaurant: "مطعم",
  fast_food_restaurant: "وجبات سريعة",
  casual_dining_restaurant: "مطعم عائلي",
  fine_dining_restaurant: "مطعم فاخر",
  bakery: "مخبز",
  juice_shop: "عصائر",
  ice_cream_shop: "آيس كريم",
  dessert_shop: "حلويات",
};

function priceLevelDisplay(level?: string) {
  if (!level) return null;
  return PRICE_LABELS[level] ?? level;
}

function typeLabel(primaryType?: string) {
  if (!primaryType) return null;
  return TYPE_LABELS[primaryType] ?? primaryType.replace(/_/g, " ");
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div
      className="absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs backdrop-blur-sm"
      dir="rtl"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <MapPin size={12} className="fill-[#034bff] text-[#034bff]" />
          <span className="text-white/80">المنشأة</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={12} className="fill-red-500 text-red-500" />
          <span className="text-white/80">منافس مباشر</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={12} className="fill-amber-500 text-amber-500" />
          <span className="text-white/80">منافس غير مباشر</span>
        </div>
      </div>
    </div>
  );
}


// ── Main Component ────────────────────────────────────────────────────────────

type CompetitorMapProps = {
  businessName: string;
  location: { lat: number; lon: number; radius: number };
  competitors: CollectedCompetitor[];
};

export function CompetitorMap({
  businessName,
  location,
  competitors,
}: CompetitorMapProps) {
  const placed = useMemo(
    () =>
      competitors.filter((c) => {
        if (c.lat == null || c.lon == null) return false;
        // Exclude the target business itself (exact same coordinates)
        return c.lat !== location.lat || c.lon !== location.lon;
      }),
    [competitors, location.lat, location.lon],
  );
  return (
    <div className="relative h-100 w-full overflow-hidden rounded-xl">
      <Map
        center={[location.lon, location.lat]}
        zoom={13}
        theme="dark"
        className="h-full w-full"
      >
        <RadiusCircle
          center={[location.lon, location.lat]}
          radiusMeters={location.radius}
        />

        <MapControls showZoom />

        {/* Target business pin */}
        <MapMarker
          longitude={location.lon}
          latitude={location.lat}
          anchor="bottom"
        >
          <MarkerContent>
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-[#034bff] p-1.5 shadow-lg shadow-[#034bff]/30 ring-2 ring-white/20">
                <MapPinned size={18} className="text-white" strokeWidth={2} />
              </div>
            </div>
            <MarkerLabel position="bottom">
              <span className="rounded-md bg-[#034bff]/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                {businessName}
              </span>
            </MarkerLabel>
          </MarkerContent>
          <MarkerPopup className="p-0 w-56">
            <div
              className="space-y-2 rounded-lg border border-white/10 bg-[#0a0f1a] p-3"
              dir="rtl"
            >
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#034bff]">
                  المنشأة المستهدفة
                </span>
                <h3 className="text-sm font-semibold leading-tight text-white">
                  {businessName}
                </h3>
              </div>
              <div className="text-xs text-white/50">
                نطاق البحث:{" "}
                {location.radius >= 1000
                  ? `${(location.radius / 1000).toFixed(1)} كم`
                  : `${location.radius} م`}
              </div>
            </div>
          </MarkerPopup>
        </MapMarker>

        {/* Competitor pins */}
        {placed.map((comp) => {
          const isDirect = comp.competitorCategory === "direct";
          const pinColor = isDirect ? "rgb(239 68 68)" : "rgb(245 158 11)";
          const badgeCls = isDirect ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400";

          return (
            <MapMarker
              key={`${comp.name}-${comp.lat}-${comp.lon}`}
              longitude={comp.lon!}
              latitude={comp.lat!}
              anchor="bottom"
            >
              <MarkerContent className="cursor-pointer">
                <MapPin
                  size={18}
                  strokeWidth={2.5}
                  fill={pinColor}
                  className="drop-shadow-sm transition-transform hover:scale-125 hover:drop-shadow-md"
                  style={{ color: pinColor }}
                />
              </MarkerContent>
              <MarkerPopup className="p-0 w-64">
                <div
                  className="space-y-2.5 rounded-lg border border-white/10 bg-[#0a0f1a] p-3"
                  dir="rtl"
                >
                  {/* Header: photo + name */}
                  <div className="flex items-start gap-2.5">
                    {comp.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <Image
                        src={comp.photoUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">
                        <MapPin size={16} className="text-white/30" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold leading-tight text-white">
                        {comp.name}
                      </h3>
                      {typeLabel(comp.primaryType) && (
                        <span className="text-[11px] text-white/40">
                          {typeLabel(comp.primaryType)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {comp.rating != null && (
                      <div className="flex items-center gap-1">
                        <Star
                          size={12}
                          className="fill-amber-400 text-amber-400"
                        />
                        <span className="font-medium text-white">
                          {comp.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {comp.reviewCount != null && (
                      <div className="flex items-center gap-1 text-white/50">
                        <MessageSquareText size={11} />
                        <span>{comp.reviewCount.toLocaleString()}</span>
                      </div>
                    )}
                    {priceLevelDisplay(comp.priceLevel) && (
                      <span className="text-amber-400/70">
                        {priceLevelDisplay(comp.priceLevel)}
                      </span>
                    )}
                  </div>

                  {/* Market share bar */}
                  {comp.localMarketShare != null &&
                    comp.localMarketShare > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="flex items-center gap-1 text-white/40">
                            <TrendingUp size={10} />
                            حصة السوق
                          </span>
                          <span className="font-medium text-white/70">
                            {comp.localMarketShare.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(comp.localMarketShare, 100)}%`,
                              backgroundColor: pinColor,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                    )}

                  {/* Address */}
                  {comp.address && (
                    <p className="line-clamp-1 text-[11px] leading-relaxed text-white/30">
                      {comp.address}
                    </p>
                  )}

                  {/* Category badge */}
                  <div
                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeCls}`}
                  >
                    {isDirect ? "منافس مباشر" : "منافس غير مباشر"}
                  </div>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>
      <MapLegend />
    </div>
  );
}
