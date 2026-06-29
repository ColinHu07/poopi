import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BathroomCard } from '@/components/app/BathroomCard';
import { MapCanvas } from '@/components/app/MapCanvas';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { BathroomFilters } from '@/src/data/types';
import { getNearbyBathrooms } from '@/src/services/bathroomApi';

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
  const bathrooms = useMemo(() => getNearbyBathrooms(filters), [filters]);
  const [selectedId, setSelectedId] = useState(bathrooms[0]?.id);
  const selected = bathrooms.find((bathroom) => bathroom.id === selectedId) ?? bathrooms[0];

  function toggleFilter(id: keyof BathroomFilters) {
    setFilters((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <Screen
      kicker="New York beta"
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

      <MapCanvas bathrooms={bathrooms} selectedId={selected?.id} onSelect={setSelectedId} />

      {selected ? (
        <View style={styles.selectedWrap}>
          <Text style={styles.sectionLabel}>Selected</Text>
          <BathroomCard bathroom={selected} />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyText}>Try fewer filters for this launch area.</Text>
        </View>
      )}

      <View style={styles.list}>
        <Text style={styles.sectionLabel}>Best nearby</Text>
        {bathrooms.map((bathroom) => (
          <BathroomCard key={bathroom.id} bathroom={bathroom} compact />
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
  },
});
