import 'leaflet/dist/leaflet.css';

import { useEffect, useRef, useState } from 'react';

import type { Bathroom } from '@/src/data/types';

interface BathroomMapProps {
  bathrooms: Bathroom[];
  center: { latitude: number; longitude: number };
  locationGranted: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

type LeafletModule = typeof import('leaflet');

export function BathroomMap({ bathrooms, center, locationGranted, selectedId, onSelect }: BathroomMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null);
  const locationRef = useRef<import('leaflet').CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([center.latitude, center.longitude], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    }

    createMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      locationRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.latitude, center.longitude], mapRef.current.getZoom(), { animate: true });
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markersRef.current;
    if (!L || !map || !markerLayer || !mapReady) {
      return;
    }

    markerLayer.clearLayers();
    bathrooms.forEach((bathroom) => {
      const selected = bathroom.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;justify-content:center;min-width:${selected ? 46 : 40}px;height:${selected ? 46 : 40}px;padding:0 8px;border:3px solid #fff;border-radius:999px;background:${selected ? '#d95b43' : '#202124'};color:#fffaf6;font:900 13px system-ui;box-shadow:0 5px 16px rgba(32,33,36,.28);box-sizing:border-box">${bathroom.scores.community.toFixed(1)}</div>`,
        iconAnchor: [selected ? 23 : 20, selected ? 23 : 20],
        iconSize: [selected ? 46 : 40, selected ? 46 : 40],
      });
      const marker = L.marker([bathroom.latitude, bathroom.longitude], {
        icon,
        keyboard: true,
        title: bathroom.name,
      });
      marker.on('add', () => {
        marker
          .getElement()
          ?.setAttribute('aria-label', `${bathroom.name}, community score ${bathroom.scores.community.toFixed(1)}`);
      });
      marker.on('click', () => onSelectRef.current(bathroom.id));
      marker.bindTooltip(bathroom.name, { direction: 'top', offset: [0, -20] });
      marker.addTo(markerLayer);
    });

    if (locationRef.current) {
      locationRef.current.removeFrom(map);
      locationRef.current = null;
    }
    if (locationGranted) {
      locationRef.current = L.circleMarker([center.latitude, center.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2d7dd2',
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [bathrooms, center.latitude, center.longitude, locationGranted, mapReady, selectedId]);

  return (
    <div
      aria-label={`Interactive map showing ${bathrooms.length} nearby bathrooms`}
      style={{
        position: 'relative',
        height: 'min(52vh, 520px)',
        minHeight: 360,
        overflow: 'hidden',
        border: '1px solid #dedbd2',
        borderRadius: 14,
        background: '#ffffff',
      }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!mapReady ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#687076',
            font: '800 14px system-ui',
            background: '#fffdf8',
          }}>
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
