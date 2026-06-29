import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';
import type { Bathroom } from '@/src/data/types';

interface MapCanvasProps {
  bathrooms: Bathroom[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function MapCanvas({ bathrooms, selectedId, onSelect }: MapCanvasProps) {
  const bounds = getBounds(bathrooms);

  return (
    <View style={styles.map}>
      <View style={styles.gridHorizontal} />
      <View style={styles.gridVertical} />
      <View style={[styles.parkBlock, { top: '9%', left: '8%' }]} />
      <View style={[styles.waterBlock, { right: '0%', top: '0%' }]} />
      <View style={[styles.road, { top: '32%', left: '0%', transform: [{ rotate: '-14deg' }] }]} />
      <View style={[styles.road, { top: '65%', left: '0%', transform: [{ rotate: '9deg' }] }]} />
      {bathrooms.map((bathroom) => {
        const point = projectPoint(bathroom, bounds);
        const selected = bathroom.id === selectedId;
        return (
          <Pressable
            key={bathroom.id}
            accessibilityRole="button"
            accessibilityLabel={bathroom.name}
            onPress={() => onSelect(bathroom.id)}
            style={[
              styles.marker,
              selected && styles.selectedMarker,
              { left: `${point.x}%`, top: `${point.y}%` },
            ]}>
            <Text style={[styles.markerText, selected && styles.selectedMarkerText]}>
              {bathroom.scores.community.toFixed(1)}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.attribution}>Open-data demo layer · OSM-ready</Text>
    </View>
  );
}

function getBounds(bathrooms: Bathroom[]) {
  const lats = bathrooms.map((bathroom) => bathroom.latitude);
  const lngs = bathrooms.map((bathroom) => bathroom.longitude);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function projectPoint(bathroom: Bathroom, bounds: ReturnType<typeof getBounds>) {
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  return {
    x: 8 + ((bathroom.longitude - bounds.minLng) / lngSpan) * 84,
    y: 8 + (1 - (bathroom.latitude - bounds.minLat) / latSpan) * 76,
  };
}

const styles = StyleSheet.create({
  map: {
    height: 330,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#dfeee8',
    borderWidth: 1,
    borderColor: palette.line,
    position: 'relative',
  },
  gridHorizontal: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(47, 143, 131, 0.22)',
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '48%',
    width: 1,
    backgroundColor: 'rgba(47, 143, 131, 0.22)',
  },
  parkBlock: {
    position: 'absolute',
    width: '38%',
    height: '26%',
    borderRadius: 8,
    backgroundColor: '#b8dfbe',
  },
  waterBlock: {
    position: 'absolute',
    width: '18%',
    height: '100%',
    backgroundColor: '#b9dff6',
  },
  road: {
    position: 'absolute',
    width: '112%',
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  marker: {
    position: 'absolute',
    minWidth: 42,
    height: 34,
    marginLeft: -21,
    marginTop: -17,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.surface,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMarker: {
    backgroundColor: palette.coral,
    transform: [{ scale: 1.08 }],
  },
  markerText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedMarkerText: {
    color: '#fffaf6',
  },
  attribution: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
});
