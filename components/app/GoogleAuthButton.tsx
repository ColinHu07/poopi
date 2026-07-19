import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';

interface GoogleAuthButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  label?: string;
}

export function GoogleAuthButton({
  disabled = false,
  loading = false,
  onPress,
  label = 'Continue with Google',
}: GoogleAuthButtonProps) {
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.button, unavailable && styles.disabled, pressed && !unavailable && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <>
          <View style={styles.googleMark} accessibilityElementsHidden>
            <Text style={styles.googleGlyph}>G</Text>
          </View>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c9c7c0',
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    backgroundColor: '#f2f1ec',
  },
  googleMark: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGlyph: {
    color: '#4285f4',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
  label: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
});
