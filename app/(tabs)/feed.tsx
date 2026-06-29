import { Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import { getBathroomById, getFeedItems } from '@/src/services/bathroomApi';

export default function FeedScreen() {
  const items = getFeedItems();

  return (
    <Screen kicker="Friends" title="Live notes" right={<TagChip label="3 updates" tone="good" />}>
      <View style={styles.feed}>
        {items.map((item) => {
          const bathroom = getBathroomById(item.bathroomId);
          if (!bathroom) {
            return null;
          }
          return (
            <View key={item.id} style={styles.item}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.actorAvatar}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>
                  {item.actorName} {verbForAction(item.action)} {bathroom.name}
                </Text>
                <Text style={styles.note}>{item.note}</Text>
                <Text style={styles.time}>{item.createdAt}</Text>
              </View>
              <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.image} />
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function verbForAction(action: string) {
  if (action === 'ranked') return 'ranked';
  if (action === 'listed') return 'saved';
  if (action === 'confirmed') return 'confirmed';
  return 'logged';
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
  image: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: palette.line,
  },
});
