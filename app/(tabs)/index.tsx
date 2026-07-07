import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BathroomCard } from '@/components/app/BathroomCard';
import { BathroomMap } from '@/components/app/BathroomMap';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom, BathroomFilters } from '@/src/data/types';
import { DEFAULT_MAP_CENTER, getNearbyBathrooms } from '@/src/services/bathroomApi';

const FILTERS: Array<{ id: keyof BathroomFilters; label: string }> = [
  { id: 'openNow', label: 'Open now' },
  { id: 'free', label: 'Free' },
  { id: 'wheelchair', label: 'Wheelchair' },
  { id: 'babyChanging', label: 'Baby change' },
  { id: 'allGender', label: 'All-gender' },
  { id: 'singleStall', label: 'Single-stall' },
  { id: 'customersOnly', label: 'Customers' },
  { id: 'paid', label: 'Paid' },
  { id: 'highConfidence', label: 'High confidence' },
];

export default function MapScreen() {
  const [filters, setFilters] = useState<BathroomFilters>({ openNow: true });
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => bathrooms.find((bathroom) => bathroom.id === selectedId),
    [bathrooms, selectedId],
  );

  useEffect(() => {
    resolveLocation();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBathrooms() {
      setLoading(true);
      setError('');
      try {
        const nextBathrooms = await getNearbyBathrooms({ ...center, filters });
        if (!cancelled) {
          setBathrooms(nextBathrooms);
          setSelectedId((current) =>
            current && nextBathrooms.some((bathroom) => bathroom.id === current) ? current : undefined,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load nearby bathrooms.');
          setBathrooms([]);
          setSelectedId(undefined);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBathrooms();

    return () => {
      cancelled = true;
    };
  }, [center, filters]);

  async function resolveLocation() {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationGranted(false);
        setCenter(DEFAULT_MAP_CENTER);
        return;
      }

      setLocationGranted(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setLocationGranted(false);
      setCenter(DEFAULT_MAP_CENTER);
    } finally {
      setLocationLoading(false);
    }
  }

  function toggleFilter(id: keyof BathroomFilters) {
    setFilters((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <Screen
      kicker={locationGranted ? 'Nearby now' : 'New York fallback'}
      title="Nearby bathrooms"
      right={<TagChip label={`${bathrooms.length} results`} tone="info" />}>
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = Boolean(filters[filter.id]);
          return (
            <Pressable
              key={filter.id}
              onPress={() => toggleFilter(filter.id)}
              style={[styles.filterButton, active && styles.activeFilter]}>
              <Text style={[styles.filterText, active && styles.activeFilterText]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!locationGranted && !locationLoading ? (
        <View style={styles.locationPanel}>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>Location is off</Text>
            <Text style={styles.locationText}>Poopi is showing a New York fallback. Enable location for nearby results.</Text>
          </View>
          <Pressable style={styles.locationButton} onPress={resolveLocation}>
            <Text style={styles.locationButtonText}>Enable</Text>
          </Pressable>
        </View>
      ) : null}

      <BathroomMap
        bathrooms={bathrooms}
        center={center}
        locationGranted={locationGranted}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {loading ? (
        <View style={styles.statusPanel}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.statusText}>Loading real bathroom reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not load bathrooms</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : selected ? (
        <View style={styles.selectedWrap}>
          <Text style={styles.sectionLabel}>Selected</Text>
          <BathroomCard bathroom={selected} />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{bathrooms.length ? 'Tap a marker' : 'No bathrooms found'}</Text>
          <Text style={styles.emptyText}>
            {bathrooms.length
              ? 'Pick a real nearby bathroom to see access notes and log a visit.'
              : 'Try fewer filters or enable location for a better search.'}
          </Text>
        </View>
      )}

      <View style={styles.list}>
        <Text style={styles.sectionLabel}>Nearby results</Text>
        {bathrooms.map((bathroom) => (
          <BathroomCard key={bathroom.id} bathroom={bathroom} compact onPress={() => setSelectedId(bathroom.id)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilter: {
    borderColor: '#b6dfd4',
    backgroundColor: palette.mint,
  },
  filterText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activeFilterText: {
    color: palette.jade,
  },
  locationPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 12,
  },
  locationCopy: {
    flex: 1,
    gap: 3,
  },
  locationTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  locationText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  locationButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: palette.ink,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  statusPanel: {
    minHeight: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedWrap: {
    gap: 10,
  },
  list: {
    gap: 10,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  empty: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 4,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
