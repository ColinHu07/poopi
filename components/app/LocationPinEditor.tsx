import { StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';

interface LocationPinEditorProps {
  latitude: number;
  longitude: number;
  onChange: (location: { latitude: number; longitude: number }) => void;
}

export function LocationPinEditor({ latitude, longitude }: LocationPinEditorProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Location pin</Text>
      <Text style={styles.copy}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
      <Text style={styles.copy}>Use the searched address or your current location to correct this pin.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 110, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, justifyContent: 'center', padding: 14, gap: 5 },
  title: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  copy: { color: palette.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
