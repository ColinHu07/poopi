import type { Bathroom } from '@/src/data/types';

export interface MapViewport {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  zoom: number;
}

export interface BathroomMapCluster {
  id: string;
  latitude: number;
  longitude: number;
  bathrooms: Bathroom[];
}

export function clusterBathrooms(bathrooms: Bathroom[], zoom: number): BathroomMapCluster[] {
  const cellSize = 360 / 2 ** Math.max(3, Math.min(22, zoom + 3));
  const buckets = new Map<string, Bathroom[]>();

  bathrooms.forEach((bathroom) => {
    const latitudeCell = Math.floor((bathroom.latitude + 90) / cellSize);
    const longitudeCell = Math.floor((bathroom.longitude + 180) / cellSize);
    const key = `${latitudeCell}:${longitudeCell}`;
    buckets.set(key, [...(buckets.get(key) ?? []), bathroom]);
  });

  return [...buckets.values()].map((items) => {
    const ids = items.map(({ id }) => id).sort();
    return {
      id: ids.length === 1 ? ids[0] : `cluster:${ids.join(',')}`,
      latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
      longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
      bathrooms: items,
    };
  });
}

export function viewportRadiusMeters(viewport: MapViewport): number {
  const latitudeMeters = viewport.latitudeDelta * 111_000;
  const longitudeMeters =
    viewport.longitudeDelta * 111_000 * Math.max(0.2, Math.cos((viewport.latitude * Math.PI) / 180));
  return Math.round(Math.min(25_000, Math.max(1_000, Math.max(latitudeMeters, longitudeMeters) * 0.65)));
}

export function viewportMoved(origin: { latitude: number; longitude: number }, viewport: MapViewport): boolean {
  const latitudeThreshold = Math.max(0.0008, viewport.latitudeDelta * 0.08);
  const longitudeThreshold = Math.max(0.0008, viewport.longitudeDelta * 0.08);
  return (
    Math.abs(origin.latitude - viewport.latitude) > latitudeThreshold ||
    Math.abs(origin.longitude - viewport.longitude) > longitudeThreshold
  );
}
