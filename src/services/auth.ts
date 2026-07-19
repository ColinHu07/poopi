import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  normalizePhoneE164,
  normalizeUsername,
  validateSignupInput,
  type ProfileRecord,
  type SignupInput,
} from '@/src/lib/profile';
import { requireSupabase, supabase } from '@/src/services/supabase';

export interface ProfileInput {
  displayName: string;
  username: string;
  phone?: string;
  homeCity?: string;
}

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  phone_e164: string | null;
  home_city: string;
};

export function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    phoneE164: row.phone_e164,
    homeCity: row.home_city,
  };
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function getCurrentProfile(): Promise<ProfileRecord | null> {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, username, phone_e164, home_city')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapProfile(data) : null;
}

export async function upsertProfile(input: ProfileInput): Promise<ProfileRecord> {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error('You need to be signed in to update your profile.');
  }

  const row = {
    id: user.id,
    display_name: input.displayName.trim(),
    username: normalizeUsername(input.username),
    phone_e164: normalizePhoneE164(input.phone),
    home_city: input.homeCity?.trim() || 'New York',
  };

  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('id, display_name, username, phone_e164, home_city')
    .single();

  if (error) {
    throw error;
  }
  return mapProfile(data);
}

export async function signUp(input: SignupInput) {
  const validation = validateSignupInput(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0] ?? 'Check your signup details.');
  }

  const client = requireSupabase();
  const username = normalizeUsername(input.username);
  const phoneE164 = normalizePhoneE164(input.phone);
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        display_name: input.displayName.trim(),
        username,
        phone_e164: phoneE164,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.session) {
    await upsertProfile({
      displayName: input.displayName,
      username,
      phone: phoneE164 ?? undefined,
      homeCity: 'New York',
    });
  }

  return data;
}

export async function signIn(input: { email: string; password: string }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) {
    throw error;
  }
  return data;
}

function getOAuthRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }
  return Linking.createURL('/');
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectUrl(),
    },
  });

  if (error) {
    throw error;
  }
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}
