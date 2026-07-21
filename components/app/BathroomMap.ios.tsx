import { AppleMaps } from 'expo-maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Bathroom } from '@/src/data/types';
import { clusterBathrooms, type MapViewport } from '@/src/lib/mapDiscovery';
import { palette } from './tokens';

interface BathroomMapProps {
  bathrooms: Bathroom[];
  center: { latitude: number; longitude: number };
  locationGranted: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  recenterNonce?: number;
}

export function BathroomMap({
  bathrooms,
  center,
  locationGranted,
  selectedId,
  onSelect,
  onViewportChange,
  recenterNonce = 0,
}: BathroomMapProps) {
  const mapRef = useRef<AppleMaps.MapView | null>(null);
  const [zoom, setZoom] = useState(14);
  const clusters = useMemo(() => clusterBathrooms(bathrooms, zoom), [bathrooms, zoom]);
  const annotations = clusters.map((cluster) => {
    const bathroom = cluster.bathrooms[0];
    const isCluster = cluster.bathrooms.length > 1;
    const selected = cluster.bathrooms.some(({ id }) => id === selectedId);
    return {
      id: cluster.id,
      coordinates: { latitude: cluster.latitude, longitude: cluster.longitude },
      title: isCluster ? `${cluster.bathrooms.length} bathrooms` : bathroom.name,
      text: isCluster
        ? String(cluster.bathrooms.length)
        : (bathroom.scores.communityReviewCount ?? 0) > 0
          ? bathroom.scores.community.toFixed(1)
          : '•',
      textColor: palette.surface,
      backgroundColor: selected ? palette.coral : isCluster ? palette.jade : palette.ink,
    };
  });

  useEffect(() => {
    mapRef.current?.setCameraPosition({ coordinates: center, zoom });
  }, [center.latitude, center.longitude, recenterNonce]);

  return (
    <View style={styles.mapWrap}>
      <AppleMaps.View
        ref={mapRef}
        style={styles.map}
        cameraPosition={{ coordinates: center, zoom: 14 }}
        annotations={annotations}
        colorScheme={AppleMaps.MapColorScheme.LIGHT}
        properties={{
          isMyLocationEnabled: locationGranted,
          mapType: AppleMaps.MapType.STANDARD,
        }}
        uiSettings={{
          compassEnabled: true,
          myLocationButtonEnabled: locationGranted,
          scaleBarEnabled: true,
        }}
        onAnnotationClick={(event) => {
          if (!event.id) return;
          const cluster = clusters.find(({ id }) => id === event.id);
          if (cluster && cluster.bathrooms.length > 1) {
            mapRef.current?.setCameraPosition({
              coordinates: { latitude: cluster.latitude, longitude: cluster.longitude },
              zoom: Math.min(19, zoom + 2),
            });
          } else {
            onSelect(event.id);
          }
        }}
        onCameraMove={(event) => {
          const latitude = event.coordinates.latitude;
          const longitude = event.coordinates.longitude;
          if (latitude == null || longitude == null) return;
          setZoom(event.zoom);
          onViewportChange?.({
            latitude,
            longitude,
            latitudeDelta: event.latitudeDelta,
            longitudeDelta: event.longitudeDelta,
            zoom: event.zoom,
          });
        }}
      />
      <Text style={styles.attribution}>Apple Maps · Refuge + Poopi data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 390,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  map: {
    flex: 1,
  },
  attribution: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: 'rgba(255, 250, 242, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
