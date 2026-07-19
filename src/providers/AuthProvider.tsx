import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { isProfileComplete, type ProfileRecord, type SignupInput } from '@/src/lib/profile';
import {
  getCurrentProfile,
  signIn as signInWithService,
  signInWithGoogle as signInWithGoogleService,
  signOut as signOutWithService,
  signUp as signUpWithService,
  upsertProfile,
  type ProfileInput,
} from '@/src/services/auth';
import { getOrCreateRatingUser, isSupabaseConfigured, supabase } from '@/src/services/supabase';

interface AuthContextValue {
  session: Session | null;
  profile: ProfileRecord | null;
  loading: boolean;
  configured: boolean;
  isAnonymous: boolean;
  profileComplete: boolean;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignupInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  completeProfile: (input: ProfileInput) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(null);
      return;
    }
    const nextProfile = await getCurrentProfile();
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      if (error) {
        setLoading(false);
        throw error;
      }
      setSession(data.session);
      if (data.session && !data.session.user.is_anonymous) {
        await refreshProfile();
      }
      setLoading(false);
    }

    load();

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && !nextSession.user.is_anonymous) {
        refreshProfile().catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configured: isSupabaseConfigured,
      isAnonymous: Boolean(session?.user.is_anonymous),
      profileComplete: isProfileComplete(profile),
      async signIn(input) {
        const data = await signInWithService(input);
        setSession(data.session);
        await refreshProfile();
      },
      async signInWithGoogle() {
        await signInWithGoogleService();
      },
      async signUp(input) {
        const data = await signUpWithService(input);
        setSession(data.session);
        if (data.session) {
          await refreshProfile();
        }
        return { needsEmailConfirmation: !data.session };
      },
      async signOut() {
        await signOutWithService();
        setSession(null);
        setProfile(null);
      },
      async completeProfile(input) {
        const nextProfile = await upsertProfile(input);
        setProfile(nextProfile);
      },
      async continueAsGuest() {
        await getOrCreateRatingUser();
        const { data } = await supabase!.auth.getSession();
        setSession(data.session);
        setProfile(null);
      },
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
