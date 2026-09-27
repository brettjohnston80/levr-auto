"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap, MapLayerMouseEvent } from "mapbox-gl";
import { OfferPhoto } from "@/components/offer-photo";
import { formatCents } from "@/lib/dashboard-format";
import { MAP_FIT_MAX_ZOOM, MAP_STYLE_URL, MAP_TOKEN } from "@/lib/map/config";
import { MAP_COPY, circleRing, type OfferMapData, type OfferPin } from "@/lib/map/pins";
import { roundMiles } from "@/lib/pickup-travel";

// THE ONLY FILE THAT IMPORTS mapbox-gl (see src/lib/map/config.ts for what a
// move to MapLibre changes). Loaded via next/dynamic from OfferMapView, so the
// library and its CSS only download when a customer opens the Map view -- a
// Mapbox "map load" is billed per initialization, which also only happens then.
//
// Mapbox's attribution control (logo + "© Mapbox © OpenStreetMap Improve this
// map") is required, can't be hidden, and is left exactly as Mapbox renders it.

// Mapbox's feature typings lean on the global GeoJSON namespace, which this
// project doesn't expose; these narrow shapes are all the handlers read.
type PinFeature = { properties?: Record<string, unknown> | null; geometry?: { coordinates?: unknown } };
const asPinFeature = (f: unknown) => f as PinFeature;

const EMERALD = "#10b981";
const AMBER = "#f59e0b";

export default function OfferMap({ data, onOpenOffer }: { data: OfferMapData; onOpenOffer: (offerId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<OfferPin | null>(null);
  const [clusterList, setClusterList] = useState<OfferPin[] | null>(null);
  useEffect(() => {
    // Rebuilt with the map whenever the data changes (it's the effect's dependency).
    const pinsById = new Map(data.pins.map((p) => [p.offerId, p]));
    let map: MapboxMap | null = null;
    let cancelled = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = MAP_TOKEN;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [-98.5, 39.8],
        zoom: 3,
        // Two-finger pan/zoom on touch screens, so a one-finger swipe still
        // scrolls the page past the map.
        cooperativeGestures: coarse,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (!map) return;

        if (data.customer && data.rangeMiles) {
          map.addSource("range", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [circleRing(data.customer, data.rangeMiles)] },
            },
          });
          map.addLayer({ id: "range-fill", type: "fill", source: "range", paint: { "fill-color": EMERALD, "fill-opacity": 0.07 } });
          map.addLayer({
            id: "range-line",
            type: "line",
            source: "range",
            paint: { "line-color": EMERALD, "line-opacity": 0.6, "line-width": 1.5, "line-dasharray": [2, 2] },
          });
        }

        if (data.customer) {
          map.addSource("customer", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {
                label: data.rangeMiles ? `${MAP_COPY.yourArea}\n${MAP_COPY.rangeLabel(data.rangeMiles)}` : MAP_COPY.yourArea,
              },
              geometry: { type: "Point", coordinates: [data.customer.lng, data.customer.lat] },
            },
          });
          map.addLayer({
            id: "customer-dot",
            type: "circle",
            source: "customer",
            paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": EMERALD, "circle-stroke-width": 2 },
          });
          map.addLayer({
            id: "customer-label",
            type: "symbol",
            source: "customer",
            layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top" },
            paint: { "text-color": "#e4e4e7", "text-halo-color": "#09090b", "text-halo-width": 1.5 },
          });
        }

        map.addSource("offers", {
          type: "geojson",
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 14,
          data: {
            type: "FeatureCollection",
            features: data.pins.map((p) => ({
              type: "Feature",
              properties: {
                offerId: p.offerId,
                status: p.status,
                highlighted: p.highlighted,
                beyondRange: p.beyondRange,
                // Declined/withdrawn drawn beneath everything else.
                sortKey: p.status === "inactive" ? 0 : p.status === "pending" ? 1 : 2,
              },
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            })),
          },
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "offers",
          filter: ["has", "point_count"],
          paint: { "circle-color": "#27272a", "circle-radius": 16, "circle-stroke-color": EMERALD, "circle-stroke-width": 2 },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "offers",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "offer-range-ring",
          type: "circle",
          source: "offers",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "beyondRange"], true]],
          paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": AMBER, "circle-stroke-width": 2 },
        });
        map.addLayer({
          id: "offer-pins",
          type: "circle",
          source: "offers",
          filter: ["!", ["has", "point_count"]],
          layout: { "circle-sort-key": ["get", "sortKey"] },
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "match",
              ["get", "status"],
              "accepted",
              EMERALD,
              "pending",
              "#09090b",
              "#52525b",
            ],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "highlighted"], true],
              AMBER,
              ["==", ["get", "status"], "inactive"],
              "#3f3f46",
              EMERALD,
            ],
            "circle-stroke-width": ["case", ["==", ["get", "highlighted"], true], 3.5, 2.5],
            "circle-opacity": ["case", ["==", ["get", "status"], "inactive"], 0.7, 1],
          },
        });

        const selectFromEvent = (e: MapLayerMouseEvent) => {
          const id = asPinFeature(e.features?.[0])?.properties?.offerId as string | undefined;
          const pin = id ? pinsById.get(id) : undefined;
          if (pin) {
            setClusterList(null);
            setSelected(pin);
          }
        };
        map.on("click", "offer-pins", selectFromEvent);
        // Desktop hover preview (touch devices get it on tap via click).
        map.on("mouseenter", "offer-pins", (e) => {
          map!.getCanvas().style.cursor = "pointer";
          if (!coarse) selectFromEvent(e);
        });
        map.on("mouseleave", "offer-pins", () => {
          map!.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "clusters", () => {
          map!.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map!.getCanvas().style.cursor = "";
        });
        map.on("click", "clusters", (e) => {
          const feature = asPinFeature(e.features?.[0]);
          if (!feature || !map) return;
          const clusterId = feature.properties?.cluster_id as number;
          const source = map.getSource("offers") as GeoJSONSource;
          const center = feature.geometry?.coordinates as [number, number];
          // Pins at the identical spot (e.g. two offers on one ZIP centroid)
          // can never split -- zooming to street level would only stack them
          // and imply a precision ZIP-based pins don't have. List them instead.
          source.getClusterLeaves(clusterId, 50, 0, (leafErr, leaves) => {
            if (leafErr || !leaves || !map) return;
            const leafPins = leaves
              .map((l) => pinsById.get(asPinFeature(l).properties?.offerId as string))
              .filter((p): p is OfferPin => !!p);
            const sameSpot = leafPins.every(
              (p) => Math.abs(p.lat - leafPins[0].lat) < 1e-6 && Math.abs(p.lng - leafPins[0].lng) < 1e-6,
            );
            if (sameSpot) {
              setSelected(null);
              setClusterList(leafPins);
              return;
            }
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null || !map) return;
              map.easeTo({ center, zoom });
            });
          });
        });

        // Fit every pin plus the customer's area, capped at city zoom.
        const points: [number, number][] = data.pins.map((p) => [p.lng, p.lat]);
        if (data.customer) points.push([data.customer.lng, data.customer.lat]);
        if (points.length === 1) {
          map.jumpTo({ center: points[0], zoom: 9 });
        } else if (points.length > 1) {
          const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
          for (const pt of points) bounds.extend(pt);
          map.fitBounds(bounds, { padding: 60, maxZoom: MAP_FIT_MAX_ZOOM, duration: 0 });
        }
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10">
      <div ref={containerRef} className="h-[60vh] w-full sm:h-[480px]" />

      {(selected || clusterList) && (
        <div className="absolute inset-x-2 bottom-8 z-10 sm:inset-x-auto sm:bottom-auto sm:top-3 sm:left-3 sm:w-80">
          <div className="rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-xl backdrop-blur">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setSelected(null);
                  setClusterList(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {selected ? (
              <PinPreview pin={selected} onOpenOffer={onOpenOffer} />
            ) : (
              <ul className="space-y-1">
                {clusterList!.map((p) => (
                  <li key={p.offerId}>
                    <button
                      type="button"
                      onClick={() => {
                        setClusterList(null);
                        setSelected(p);
                      }}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                    >
                      {p.dealerName} — {formatCents(p.priceCents)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PinPreview({ pin, onOpenOffer }: { pin: OfferPin; onOpenOffer: (offerId: string) => void }) {
  return (
    <div className="flex gap-3">
      <OfferPhoto photoUrl={pin.photoUrl} alt={pin.dealerName} />
      <div className="min-w-0">
        <p className="font-semibold text-white">{pin.dealerName}</p>
        <p className="text-sm text-zinc-300">{formatCents(pin.priceCents)}</p>
        {pin.distanceMiles !== null && (
          <p className="text-xs text-zinc-400">{MAP_COPY.milesAway(roundMiles(pin.distanceMiles))}</p>
        )}
        {pin.approximate && <p className="text-xs text-zinc-500">{MAP_COPY.approximate}</p>}
        <button
          type="button"
          onClick={() => onOpenOffer(pin.offerId)}
          className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
        >
          {MAP_COPY.viewDetails}
        </button>
      </div>
    </div>
  );
}
