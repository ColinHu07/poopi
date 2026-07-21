import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Bathroom } from '@/src/data/types';
import type { MapViewport } from '@/src/lib/mapDiscovery';
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

export function BathroomMap({ bathrooms, center, locationGranted, selectedId, onSelect }: BathroomMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Map coming to Android</Text>
      <Text style={styles.fallbackText}>
        Poopi now has a full browser map. Nearby bathroom results are still available here.
      </Text>
      <View style={styles.fallbackList}>
        {bathrooms.slice(0, 5).map((bathroom) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: bathroom.id === selectedId }}
            key={bathroom.id}
            onPress={() => onSelect(bathroom.id)}
            style={[styles.fallbackRow, bathroom.id === selectedId && styles.selectedRow]}>
            <Text style={styles.fallbackName} numberOfLines={1}>
              {bathroom.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 300,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 12,
  },
  fallbackTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  fallbackText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  fallbackList: {
    gap: 8,
  },
  fallbackRow: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: palette.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    gap: 10,
  },
  fallbackName: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  selectedRow: {
    borderWidth: 1,
    borderColor: palette.jade,
    backgroundColor: palette.mint,
  },
});
