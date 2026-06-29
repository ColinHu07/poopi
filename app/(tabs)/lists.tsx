import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import { getLists } from '@/src/services/bathroomApi';

export default function ListsScreen() {
  const lists = getLists();

  return (
    <Screen kicker="Saved" title="Bathroom lists" right={<TagChip label={`${lists.length} lists`} tone="info" />}>
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
                <Link key={bathroom.id} href={{ pathname: '/bathroom/[id]', params: { id: bathroom.id } }} asChild>
                  <Pressable>
                    <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.photo} />
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        ))}
      </View>
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
});
