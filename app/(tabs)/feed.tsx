import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/app/Screen';
import { AuthRequired } from '@/components/app/AuthRequired';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { FeedItem } from '@/src/data/types';
import { getFeedItems } from '@/src/services/bathroomApi';
import { useAuth } from '@/src/providers/AuthProvider';

export default function FeedScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (!session) {
    return (
      <AuthRequired
        title="See bathroom notes from friends"
        description="Log in to follow people you trust and see the bathrooms they rated, ranked, or confirmed."
      />
    );
  }

  return (
    <Screen kicker="Friends" title="Live notes" right={<TagChip label={`${items.length} updates`} tone="good" />}>
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No feed yet</Text>
          <Text style={styles.emptyText}>Follow friends or log your first bathroom visit to start seeing activity.</Text>
        </View>
      ) : (
        <View style={styles.feed}>
          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.actorAvatar}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>
                  {item.actorName} {verbForAction(item.action)}
                </Text>
                <Text style={styles.note}>{item.note}</Text>
                <Text style={styles.time}>{item.createdAt}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function verbForAction(action: string) {
  if (action === 'ranked') return 'ranked a bathroom';
  if (action === 'listed') return 'saved a bathroom';
  if (action === 'confirmed') return 'confirmed access info';
  return 'logged a bathroom';
}

const styles = StyleSheet.create({
  feed: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: palette.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.plum,
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  note: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
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
