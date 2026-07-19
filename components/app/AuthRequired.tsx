import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/providers/AuthProvider';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Screen } from './Screen';
import { palette } from './tokens';

export function AuthRequired({ title, description }: { title: string; description: string }) {
  const { configured, signInWithGoogle } = useAuth();
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submitGoogle() {
    setError('');
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue with Google.');
      setGoogleSubmitting(false);
    }
  }

  return (
    <Screen kicker="Free account" title={title}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Keep discovery open. Protect contributions.</Text>
        <Text style={styles.copy}>{description}</Text>
        <GoogleAuthButton
          disabled={!configured}
          loading={googleSubmitting}
          onPress={submitGoogle}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {configured ? (
          <View style={styles.actions}>
            <Link href={'/sign-in' as any} asChild>
              <Pressable accessibilityRole="link" style={styles.primaryButton}>
                <Text style={styles.primaryText}>Log in</Text>
              </Pressable>
            </Link>
            <Link href={'/sign-up' as any} asChild>
              <Pressable accessibilityRole="link" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Create account</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Google sign-in is ready for Supabase</Text>
            <Text style={styles.setupCopy}>
              Finish connecting Supabase to enable this button. You can still use the map and bathroom details as a guest.
            </Text>
          </View>
        )}
      </View>

      <Link href="/(tabs)" asChild>
        <Pressable accessibilityRole="link" style={styles.mapButton}>
          <Text style={styles.mapButtonText}>Back to the bathroom map</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 20,
    gap: 12,
  },
  eyebrow: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
  copy: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  setupCard: {
    borderRadius: 10,
    backgroundColor: palette.coralSoft,
    padding: 14,
    gap: 5,
  },
  setupTitle: {
    color: palette.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  setupCopy: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonText: {
    color: palette.jade,
    fontSize: 15,
    fontWeight: '900',
  },
});
