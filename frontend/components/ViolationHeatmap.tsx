'use client';

// Leaflet + OpenStreetMap replacement for the old Google Maps violation
// heatmap (no API key required). This module is loaded from
// app/entities/page.tsx via next/dynamic with `ssr: false`, so it (and
// Leaflet itself, which touches `window` at import time) only ever evaluates
// in the browser.

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './ViolationHeatmap.css';

export type ViolationHeatmapPoint = {
  lat: number;
  lng: number;
  weight: number;
};

export type ViolationHeatmapMarker = {
  seller_name: string;
  location: string;
  total_scrapes: number;
  products: string; // JSON string, same shape as the backend rows
  last_activity: string;
  lat: number;
  lng: number;
  score: number;
  markerColor: string;
};

type ViolationHeatmapProps = {
  /** One dot per (already geocoded) seller-location row. */
  markers: ViolationHeatmapMarker[];
  /** Heat points: the [lat, lng, weight] triples are derived internally. */
  points: ViolationHeatmapPoint[];
  /** Whether the heat overlay is shown (dots always render). */
  showHeatmap: boolean;
  /** True while the parent is fetching data (suppresses the empty overlay). */
  loading?: boolean;
  /** Marker whose popup should open — driven by card clicks in the page. */
  focusMarker?: { seller_name: string; location: string } | null;
  /** Gives the parent the Leaflet map instance (for panTo/setZoom). */
  onMapReady?: (map: L.Map | null) => void;
  /** Popup body for a marker. */
  renderPopup: (marker: ViolationHeatmapMarker) => React.ReactNode;
};

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

const markerKey = (m: { seller_name: string; location: string }) =>
  `${m.seller_name}::${m.location}`;

/** Reports the map instance to the parent once the map exists. */
function MapReporter({ onReady }: { onReady?: (map: L.Map | null) => void }) {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
    return () => onReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

/**
 * `leaflet.heat` is a plain script (no UMD wrapper) that patches the global
 * Leaflet `L` with a `heatLayer()` factory. It must only run in the browser,
 * after Leaflet has attached itself to `window.L`, so it is imported lazily
 * here and the layer is created/removed imperatively.
 */
function HeatOverlay({
  points,
  enabled,
}: {
  points: ViolationHeatmapPoint[];
  enabled: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || points.length === 0) return;

    let cancelled = false;

    const buildLayer = () => {
      const heatLayer = (L as any).heatLayer;
      if (cancelled || typeof heatLayer !== 'function') return;
      layerRef.current = heatLayer(
        points.map((p) => [p.lat, p.lng, p.weight]),
        {
          radius: 45,
          blur: 15,
          maxZoom: 10,
          gradient: {
            // Design tokens (design.md §1): success → warning → critical scale.
            0.0: 'rgba(22, 163, 74, 0)', // success, transparent
            0.4: 'rgba(22, 163, 74, 0.45)', // success ≥ 80
            0.6: 'rgba(217, 119, 6, 0.8)', // warning 40–79
            0.8: 'rgba(217, 119, 6, 1)', // warning (hot)
            1.0: 'rgba(220, 38, 38, 1)', // critical < 40
          },
        }
      ).addTo(map);
    };

    if (typeof (L as any).heatLayer === 'function') {
      buildLayer();
    } else {
      // Ensure the plugin's global `L` lookup resolves to the bundled Leaflet.
      (window as any).L = L;
      import('leaflet.heat')
        .then(buildLayer)
        .catch((err) => console.error('[HEATMAP PLUGIN ERROR]', err));
    }

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, enabled]);

  return null;
}

/**
 * Colored dot markers with the compliance score as their label. A registry
 * of rendered marker layers is kept so the parent can ask for a specific
 * seller's popup to open (list card -> map interaction).
 */
function ViolationMarkers({
  markers,
  focusMarker,
  renderPopup,
}: {
  markers: ViolationHeatmapMarker[];
  focusMarker?: { seller_name: string; location: string } | null;
  renderPopup: (marker: ViolationHeatmapMarker) => React.ReactNode;
}) {
  const layerRegistry = useRef<Map<string, L.Marker>>(new Map());

  const icons = useMemo(() => {
    const byKey = new Map<string, L.DivIcon>();
    markers.forEach((m) => {
      byKey.set(
        markerKey(m),
        L.divIcon({
          className: 'violation-marker',
          html: `<span class="violation-marker__dot" style="background-color:${m.markerColor}">${
            m.score ? Math.round(m.score) : 0
          }</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -12],
        })
      );
    });
    return byKey;
  }, [markers]);

  // Open the popup of the marker the parent asked to focus (card click).
  useEffect(() => {
    if (!focusMarker) return;
    const layer = layerRegistry.current.get(markerKey(focusMarker));
    if (layer) layer.openPopup();
  }, [focusMarker]);

  return (
    <>
      {markers.map((m, idx) => {
        const key = markerKey(m);
        return (
          <Marker
            key={`${key}-${idx}`}
            position={[m.lat, m.lng]}
            icon={icons.get(key)}
            eventHandlers={{
              add: (e: L.LeafletEvent) => {
                layerRegistry.current.set(key, e.target as L.Marker);
              },
              remove: (e: L.LeafletEvent) => {
                if (layerRegistry.current.get(key) === e.target) {
                  layerRegistry.current.delete(key);
                }
              },
            }}
          >
            <Popup>{renderPopup(m)}</Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function ViolationHeatmap({
  markers,
  points,
  showHeatmap,
  loading = false,
  focusMarker,
  onMapReady,
  renderPopup,
}: ViolationHeatmapProps) {
  return (
    <div className="relative">
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        minZoom={4}
        style={{ height: '600px', width: '100%', borderRadius: '1rem' }}
        className="violation-heatmap"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapReporter onReady={onMapReady} />
        <HeatOverlay points={points} enabled={showHeatmap} />
        <ViolationMarkers
          markers={markers}
          focusMarker={focusMarker}
          renderPopup={renderPopup}
        />
      </MapContainer>

      {!loading && markers.length === 0 && (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 bg-page/95 pointer-events-none rounded-card">
          <span className="text-sm uppercase tracking-widest text-secondary font-medium">
            No mappable locations yet
          </span>
          <span className="text-xs text-muted">
            Location coordinates appear once geocoded data is available
          </span>
        </div>
      )}
    </div>
  );
}

