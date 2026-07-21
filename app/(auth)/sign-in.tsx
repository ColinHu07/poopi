import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GoogleAuthButton } from '@/components/app/GoogleAuthButton';
import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function SignInScreen() {
  const { configured, profileComplete, session, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!configured) {
    return <Redirect href={'/welcome' as any} />;
  }
  if (session && profileComplete) {
    return <Redirect href="/(tabs)" />;
  }
  if (session && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      await signIn({ email, password });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  }

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
    <View style={styles.screen}>
      <Text style={styles.title}>Log in</Text>
      <Text style={styles.copy}>Get back to your saved access notes and bathroom rankings.</Text>
      <GoogleAuthButton loading={googleSubmitting} onPress={submitGoogle} />
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or use email</Text>
        <View style={styles.dividerLine} />
      </View>
      <Field value={email} onChangeText={setEmail} label="Email" autoCapitalize="none" keyboardType="email-address" />
      <Field value={password} onChangeText={setPassword} label="Password" secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={submitting} style={styles.primaryButton} onPress={submit}>
        {submitting ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.primaryText}>Log in</Text>}
      </Pressable>
      <Link href={'/sign-up' as any} asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkText}>Need an account?</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={palette.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    padding: 28,
    backgroundColor: palette.paper,
  },
  title: {
    color: palette.ink,
    fontSize: 40,
    fontWeight: '900',
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.line,
  },
  dividerText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  field: {
    gap: 6,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
});
