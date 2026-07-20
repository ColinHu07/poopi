import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { GoogleAuthButton } from '@/components/app/GoogleAuthButton';
import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function WelcomeScreen() {
  const { configured, continueAsGuest, isAnonymous, loading, profileComplete, session, signInWithGoogle } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');
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

      {configured ? (
        <View style={styles.actions}>
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
          <Pressable
            disabled={guestLoading}
            style={styles.guestButton}
            onPress={async () => {
              setGuestLoading(true);
              setGuestError('');
              try {
                await continueAsGuest();
                router.replace('/(tabs)');
              } catch (error) {
                setGuestError(error instanceof Error ? error.message : 'Unable to continue as guest.');
              } finally {
                setGuestLoading(false);
              }
            }}>
            {guestLoading ? <ActivityIndicator color={palette.jade} /> : <Text style={styles.guestText}>Continue as guest</Text>}
          </Pressable>
          {guestError ? <Text style={styles.guestError}>{guestError}</Text> : null}
        </View>
      ) : (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Google sign-in is ready for Supabase</Text>
          <Text style={styles.setupCopy}>
            Finish connecting Supabase and enable its Google provider to turn on account creation.
          </Text>
        </View>
      )}
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
  guestError: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
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
