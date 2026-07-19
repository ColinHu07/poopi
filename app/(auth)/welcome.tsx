import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function WelcomeScreen() {
  const { configured, continueAsGuest, isAnonymous, loading, profileComplete, session } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');

  if (!loading && session && (isAnonymous || profileComplete)) {
    return <Redirect href="/(tabs)" />;
  }
  if (!loading && session && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.brandMark}>
        <View style={styles.flattenedPTopSerif} />
        <View style={styles.flattenedPStem} />
        <View style={styles.flattenedPBowl} />
        <View style={styles.flattenedPBottomSerif} />
      </View>
      <Text style={styles.logo}>poopi</Text>
      <Text style={styles.title}>Find the bathroom that will not betray you.</Text>
      <Text style={styles.copy}>
        Rank bathrooms, save access notes, and see real nearby restroom reports before you need them.
      </Text>

      <Link href="/(tabs)" asChild>
        <Pressable accessibilityRole="link" style={styles.exploreButton}>
          <Text style={styles.exploreText}>Explore bathrooms as a guest</Text>
        </Pressable>
      </Link>

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
          <Text style={styles.setupTitle}>Supabase setup needed</Text>
          <Text style={styles.setupCopy}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, apply the schema, then restart Expo.
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
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: '#f8f7f2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    position: 'relative',
    overflow: 'hidden',
  },
  flattenedPStem: {
    position: 'absolute',
    top: 17,
    left: 17,
    width: 15,
    height: 48,
    backgroundColor: '#596169',
  },
  flattenedPBowl: {
    position: 'absolute',
    top: 23,
    left: 28,
    width: 37,
    height: 31,
    borderWidth: 9,
    borderLeftWidth: 0,
    borderColor: '#596169',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  flattenedPTopSerif: {
    position: 'absolute',
    zIndex: 2,
    top: 14,
    left: 12,
    width: 29,
    height: 7,
    backgroundColor: '#596169',
  },
  flattenedPBottomSerif: {
    position: 'absolute',
    zIndex: 2,
    top: 62,
    left: 12,
    width: 29,
    height: 7,
    backgroundColor: '#596169',
  },
  logo: {
    color: '#596169',
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
  actions: {
    gap: 10,
    marginTop: 10,
  },
  exploreButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreText: {
    color: '#fffaf6',
    fontSize: 16,
    fontWeight: '900',
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
