import { AppleMaps } from 'expo-maps';
import { StyleSheet, Text, View } from 'react-native';

import type { Bathroom } from '@/src/data/types';
import { palette } from './tokens';

interface BathroomMapProps {
  bathrooms: Bathroom[];
  center: { latitude: number; longitude: number };
  locationGranted: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function BathroomMap({ bathrooms, center, locationGranted, selectedId, onSelect }: BathroomMapProps) {
  const annotations = bathrooms.map((bathroom) => {
    const selected = bathroom.id === selectedId;
    return {
      id: bathroom.id,
      coordinates: { latitude: bathroom.latitude, longitude: bathroom.longitude },
      title: bathroom.name,
      text:
        (bathroom.scores.communityReviewCount ?? 0) > 0 ? bathroom.scores.community.toFixed(1) : '•',
      textColor: selected ? '#fffaf6' : palette.surface,
      backgroundColor: selected ? palette.coral : palette.ink,
    };
  });

  return (
    <View style={styles.mapWrap}>
      <AppleMaps.View
        key={`${center.latitude.toFixed(4)}-${center.longitude.toFixed(4)}`}
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
          if (event.id) {
            onSelect(event.id);
          }
        }}
      />
      <Text style={styles.attribution}>Apple Maps · Refuge + Poopi data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 390,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
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
    backgroundColor: 'rgba(255, 253, 248, 0.86)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
