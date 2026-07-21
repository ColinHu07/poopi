import 'leaflet/dist/leaflet.css';

import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';

import type { Bathroom } from '@/src/data/types';
import { clusterBathrooms, type MapViewport } from '@/src/lib/mapDiscovery';

interface BathroomMapProps {
  bathrooms: Bathroom[];
  center: { latitude: number; longitude: number };
  locationGranted: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  recenterNonce?: number;
}

type LeafletModule = typeof import('leaflet');
const MASCOT_URL = Asset.fromModule(require('../../assets/images/icon.png')).uri;

export function BathroomMap({
  bathrooms,
  center,
  locationGranted,
  selectedId,
  onSelect,
  onViewportChange,
  recenterNonce = 0,
}: BathroomMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null);
  const locationRef = useRef<import('leaflet').CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(14);

  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;

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
      map.on('moveend', () => {
        const mapCenter = map.getCenter();
        const bounds = map.getBounds();
        const nextZoom = map.getZoom();
        setZoom(nextZoom);
        onViewportChangeRef.current?.({
          latitude: mapCenter.lat,
          longitude: mapCenter.lng,
          latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
          longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
          zoom: nextZoom,
        });
      });
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
  }, [center.latitude, center.longitude, recenterNonce]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markersRef.current;
    if (!L || !map || !markerLayer || !mapReady) {
      return;
    }

    markerLayer.clearLayers();
    clusterBathrooms(bathrooms, zoom).forEach((cluster) => {
      const bathroom = cluster.bathrooms[0];
      const isCluster = cluster.bathrooms.length > 1;
      const selected = cluster.bathrooms.some(({ id }) => id === selectedId);
      const markerSize = isCluster ? 42 : selected ? 34 : 28;
      const icon = L.divIcon({
        className: '',
        html: isCluster
          ? `<div style="display:flex;align-items:center;justify-content:center;width:${markerSize}px;height:${markerSize}px;border:3px solid #fffaf2;border-radius:999px;background:#168c7b;color:#fffaf2;font:900 14px system-ui;box-shadow:0 5px 16px rgba(43,29,24,.25);box-sizing:border-box">${cluster.bathrooms.length}</div>`
          : `<div style="display:flex;align-items:center;justify-content:center;width:${markerSize}px;height:${markerSize}px;border:${selected ? 4 : 3}px solid ${selected ? '#ee684f' : '#fffaf2'};border-radius:999px;background:#fffaf2;box-shadow:0 5px 16px rgba(43,29,24,.28);box-sizing:border-box;overflow:hidden"><img src="${MASCOT_URL}" alt="" style="width:100%;height:100%;object-fit:cover" /></div>`,
        iconAnchor: [markerSize / 2, markerSize / 2],
        iconSize: [markerSize, markerSize],
      });
      const marker = L.marker([cluster.latitude, cluster.longitude], {
        icon,
        keyboard: true,
        title: isCluster ? `${cluster.bathrooms.length} bathrooms` : bathroom.name,
      });
      marker.on('add', () => {
        marker
          .getElement()
          ?.setAttribute('aria-label', isCluster ? `${cluster.bathrooms.length} bathrooms in this area` : bathroom.name);
      });
      marker.on('click', () => {
        if (isCluster) {
          map.setView([cluster.latitude, cluster.longitude], Math.min(19, map.getZoom() + 2), { animate: true });
        } else {
          onSelectRef.current(bathroom.id);
        }
      });
      marker.bindTooltip(isCluster ? `${cluster.bathrooms.length} bathrooms` : bathroom.name, {
        direction: 'top',
        offset: [0, -20],
      });
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
  }, [bathrooms, center.latitude, center.longitude, locationGranted, mapReady, selectedId, zoom]);

  return (
    <div
      aria-label={`Interactive map showing ${bathrooms.length} nearby bathrooms`}
      style={{
        position: 'relative',
        height: 'min(44vh, 440px)',
        minHeight: 300,
        overflow: 'hidden',
        border: '2px solid #dacbbb',
        borderRadius: 22,
        background: '#fffaf2',
      }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!mapReady ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#75675f',
            font: '800 14px system-ui',
            background: '#fffaf2',
          }}>
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
