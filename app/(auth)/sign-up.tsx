import { Link, Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GoogleAuthButton } from '@/components/app/GoogleAuthButton';
import { palette } from '@/components/app/tokens';
import { validateSignupInput } from '@/src/lib/profile';
import { useAuth } from '@/src/providers/AuthProvider';

export default function SignUpScreen() {
  const { configured, profileComplete, session, signInWithGoogle, signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const validation = useMemo(
    () => validateSignupInput({ firstName, lastName, dateOfBirth, displayName, email, password }),
    [dateOfBirth, displayName, email, firstName, lastName, password],
  );

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
    setMessage('');
    if (!validation.valid) {
      setError(Object.values(validation.errors)[0] ?? 'Check your signup details.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp({ firstName, lastName, dateOfBirth, displayName, email, password });
      if (result.needsEmailConfirmation) {
        setMessage('Check your email to confirm your account, then log in.');
      } else {
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGoogle() {
    setError('');
    setMessage('');
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue with Google.');
      setGoogleSubmitting(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.copy}>
        Your personal information stays private. Only your display name and bathroom ratings can appear publicly.
      </Text>
      <GoogleAuthButton loading={googleSubmitting} onPress={submitGoogle} />
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or use email</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.nameRow}>
        <View style={styles.nameField}>
          <Field value={firstName} onChangeText={setFirstName} label="First name" autoComplete="given-name" />
        </View>
        <View style={styles.nameField}>
          <Field value={lastName} onChangeText={setLastName} label="Last name" autoComplete="family-name" />
        </View>
      </View>
      <Field
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        value={displayName}
        onChangeText={setDisplayName}
        label="Display name"
        placeholder="poopi_fan"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.helper}>Public and unique. Friends will use this to find you.</Text>
      <Field value={email} onChangeText={setEmail} label="Email" autoCapitalize="none" keyboardType="email-address" />
      <Field value={password} onChangeText={setPassword} label="Password" secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable disabled={submitting} style={styles.primaryButton} onPress={submit}>
        {submitting ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.primaryText}>Sign up</Text>}
      </Pressable>
      <Link href={'/sign-in' as any} asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkText}>Already have an account?</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor={palette.muted} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    paddingVertical: 36,
    backgroundColor: palette.paper,
  },
  title: {
    color: palette.ink,
    fontSize: 38,
    letterSpacing: -1,
    fontWeight: '900',
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 6,
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
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameField: {
    flex: 1,
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
  helper: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -4,
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    color: palette.jade,
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
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
});
