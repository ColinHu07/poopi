import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { BathroomPhoto as BathroomPhotoRecord } from '@/src/data/types';
import { palette } from './tokens';

export function BathroomPhoto({
  photo,
  style,
  compact = false,
  fallbackLabel,
}: {
  photo?: BathroomPhotoRecord;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  fallbackLabel?: string;
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
        <View
          accessibilityLabel={`${fallbackLabel ?? 'Bathroom'} location placeholder; no bathroom photo yet`}
          style={styles.locationPreview}>
          <View style={styles.roadHorizontal} />
          <View style={styles.roadVertical} />
          <View style={[styles.block, styles.blockTopLeft]} />
          <View style={[styles.block, styles.blockBottomRight]} />
          <View style={[styles.pin, compact && styles.compactPin]}>
            <Text style={[styles.pinDot, compact && styles.compactPinDot]}>•</Text>
          </View>
          <View style={[styles.locationCaption, compact && styles.compactLocationCaption]}>
            <Text style={[styles.emptyTitle, compact && styles.compactTitle]} numberOfLines={1}>
              {compact ? 'Location' : fallbackLabel || 'Location preview'}
            </Text>
            <Text style={[styles.emptyCopy, compact && styles.compactCopy]} numberOfLines={1}>
              Bathroom photo needed
            </Text>
          </View>
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
  locationPreview: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5f3ee',
    overflow: 'hidden',
  },
  roadHorizontal: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '42%',
    height: 24,
    backgroundColor: '#fffdf8',
    transform: [{ rotate: '-8deg' }],
  },
  roadVertical: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '57%',
    width: 20,
    backgroundColor: '#fffdf8',
    transform: [{ rotate: '9deg' }],
  },
  block: {
    position: 'absolute',
    width: 58,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#c9e4da',
  },
  blockTopLeft: {
    left: -10,
    top: 8,
    transform: [{ rotate: '-8deg' }],
  },
  blockBottomRight: {
    right: -12,
    bottom: 8,
    transform: [{ rotate: '-8deg' }],
  },
  pin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 4,
    borderColor: '#fffdf8',
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
  },
  compactPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    marginBottom: 30,
  },
  pinDot: {
    color: '#fffdf8',
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '900',
  },
  compactPinDot: {
    fontSize: 22,
    lineHeight: 22,
  },
  locationCaption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  compactLocationCaption: {
    left: 5,
    right: 5,
    bottom: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
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
    textAlign: 'center',
  },
  compactCopy: {
    fontSize: 8,
  },
});
