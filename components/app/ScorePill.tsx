import { StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';

interface ScorePillProps {
  label: string;
  value: number | undefined;
  muted?: boolean;
}

export function ScorePill({ label, value, muted }: ScorePillProps) {
  return (
    <View style={[styles.container, muted && styles.muted]}>
      <Text style={styles.value}>{value?.toFixed(1) ?? '--'}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 70,
    borderRadius: 16,
    backgroundColor: palette.jadeDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  muted: {
    backgroundColor: palette.cocoa,
  },
  value: {
    color: palette.surface,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  label: {
    color: '#efece2',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
