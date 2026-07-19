import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { BathroomPhoto as BathroomPhotoRecord } from '@/src/data/types';
import { palette } from './tokens';

export function BathroomPhoto({
  photo,
  style,
  compact = false,
}: {
  photo?: BathroomPhotoRecord;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [photo?.url]);

  return (
    <View style={[styles.frame, style]}>
      {photo?.url && !failed ? (
        <Image
          accessibilityLabel={photo.alt || 'Bathroom photo'}
          onError={() => setFailed(true)}
          resizeMode="cover"
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View accessibilityLabel="No bathroom photo yet" style={styles.empty}>
          <Text style={[styles.icon, compact && styles.compactIcon]}>▧</Text>
          <Text style={[styles.emptyTitle, compact && styles.compactTitle]}>No photo yet</Text>
          {!compact ? <Text style={styles.emptyCopy}>Be the first to add one</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: palette.mint,
  },
  empty: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  icon: {
    color: palette.jade,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  compactIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
  emptyTitle: {
    color: palette.jade,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 10,
  },
  emptyCopy: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
});
