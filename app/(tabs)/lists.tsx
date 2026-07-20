import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/app/Screen';
import { AuthRequired } from '@/components/app/AuthRequired';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom, BathroomList } from '@/src/data/types';
import { getLists } from '@/src/services/bathroomApi';
import { useAuth } from '@/src/providers/AuthProvider';

type ListWithBathrooms = BathroomList & { bathrooms: Bathroom[] };

export default function ListsScreen() {
  const { isAnonymous, session } = useAuth();
  const [lists, setLists] = useState<ListWithBathrooms[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session || isAnonymous) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      getLists()
        .then((nextLists) => {
          if (!cancelled) setLists(nextLists);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [isAnonymous, session]),
  );

  if (!session || isAnonymous) {
    return (
      <AuthRequired
        title="Save reliable bathroom lists"
        description="Log in to save places and make lists for campus, commutes, trips, or emergency backups."
      />
    );
  }

  return (
    <Screen kicker="Saved" title="Bathroom lists" right={<TagChip label={`${lists.length} lists`} tone="info" />}>
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.emptyText}>Loading lists...</Text>
        </View>
      ) : lists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No lists yet</Text>
          <Text style={styles.emptyText}>Save bathrooms from the map to build lists like “reliable near campus.”</Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {lists.map((list) => (
            <View key={list.id} style={styles.card}>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{list.title}</Text>
                  <TagChip label={list.visibility} tone={list.visibility === 'public' ? 'good' : 'neutral'} />
                </View>
                <Text style={styles.description}>{list.description}</Text>
              </View>
              <View style={styles.photos}>
                {list.bathrooms.slice(0, 4).map((bathroom) => (
                  <Image key={bathroom.id} source={{ uri: bathroom.photos[0]?.url }} style={styles.photo} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  copy: {
    gap: 8,
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  photos: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: palette.paper,
    padding: 2,
  },
  photo: {
    flex: 1,
    width: 86,
    height: 88,
    backgroundColor: palette.line,
  },
  empty: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
