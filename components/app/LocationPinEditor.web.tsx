import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';

interface LocationPinEditorProps {
  latitude: number;
  longitude: number;
  onChange: (location: { latitude: number; longitude: number }) => void;
}

export function LocationPinEditor({ latitude, longitude, onChange }: LocationPinEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    async function createMap() {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([latitude, longitude], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:30px;height:30px;border:4px solid #fff;border-radius:999px;background:#d95b43;box-shadow:0 5px 16px rgba(32,33,36,.3);box-sizing:border-box"><div style="width:8px;height:8px;margin:7px;border-radius:999px;background:#fffaf6"></div></div>',
        iconAnchor: [15, 15],
        iconSize: [30, 30],
      });
      const marker = L.marker([latitude, longitude], { icon, draggable: true, keyboard: true, title: 'Bathroom location' }).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        onChangeRef.current({ latitude: point.lat, longitude: point.lng });
      });
      map.on('click', (event) => {
        marker.setLatLng(event.latlng);
        onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      mapRef.current = map;
      markerRef.current = marker;
      window.setTimeout(() => map.invalidateSize(), 0);
    }
    createMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView([latitude, longitude], mapRef.current.getZoom(), { animate: false });
    markerRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div
      aria-label="Bathroom location map. Tap the map or drag the pin to correct it."
      style={{ height: 230, overflow: 'hidden', borderRadius: 10, border: '1px solid #dedbd2' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
