import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { GoogleAuthButton } from '@/components/app/GoogleAuthButton';
import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function WelcomeScreen() {
  const { configured, isAnonymous, loading, profileComplete, session, signInWithGoogle } = useAuth();
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

  if (!loading && session && (isAnonymous || profileComplete)) {
    return <Redirect href="/(tabs)" />;
  }
  if (!loading && session && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  return (
    <View style={styles.screen}>
      <Image accessibilityLabel="Poopi mascot" source={require('../../assets/images/icon.png')} style={styles.brandMark} />
      <Text style={styles.logo}>poopi</Text>
      <Text style={styles.title}>Find the bathroom that will not betray you.</Text>
      <Text style={styles.copy}>
        Rank bathrooms, save access notes, and see real nearby restroom reports before you need them.
      </Text>

      <GoogleAuthButton
        disabled={!configured}
        loading={googleSubmitting}
        onPress={submitGoogle}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {configured ? (
          <>
          <Link href={'/sign-up' as any} asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryText}>Create account</Text>
            </Pressable>
          </Link>
          <Link href={'/sign-in' as any} asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Log in</Text>
            </Pressable>
          </Link>
          </>
        ) : (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Account setup is unavailable</Text>
            <Text style={styles.setupCopy}>Bathroom discovery still works without an account.</Text>
          </View>
        )}
        <Pressable style={styles.guestButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.guestText}>Browse as guest</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
    padding: 26,
    backgroundColor: palette.paper,
  },
  brandMark: {
    width: 96,
    height: 96,
    borderRadius: 22,
  },
  logo: {
    color: palette.jade,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '700',
    fontFamily: 'Georgia',
    letterSpacing: -2,
  },
  title: {
    color: palette.ink,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: 0,
  },
  copy: {
    color: palette.muted,
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
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  guestButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestText: {
    color: palette.jade,
    fontSize: 15,
    fontWeight: '900',
  },
  setupCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 6,
  },
  setupTitle: {
    color: palette.coral,
    fontSize: 16,
    fontWeight: '900',
  },
  setupCopy: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
