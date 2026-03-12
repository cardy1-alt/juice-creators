import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  userProfile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole, additionalData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const ADMIN_EMAIL = 'admin@juicecreators.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: prevent onAuthStateChange from overwriting state during signup
  const signingUpRef = useRef(false);

  const fetchUserProfile = async (authUser: User) => {
    const email = authUser.email;
    if (!email) return;

    if (email === ADMIN_EMAIL) {
      setUserRole('admin');
      setUserProfile({ email, name: 'Admin' });
      return;
    }

    // Check creators table
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (creatorError) {
      console.error('[AuthContext] Error fetching creator profile:', creatorError.message);
    }

    if (creator) {
      setUserRole('creator');
      setUserProfile(creator);
      return;
    }

    // Check businesses table
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_email', email)
      .maybeSingle();

    if (businessError) {
      console.error('[AuthContext] Error fetching business profile:', businessError.message);
    }

    if (business) {
      setUserRole('business');
      setUserProfile(business);
      return;
    }

    // No profile found — clear role so fallback screen shows
    console.warn('[AuthContext] No profile found for', email);
    setUserRole(null);
    setUserProfile(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Skip profile fetch during signup — signUp() manages state directly
      if (signingUpRef.current) {
        if (session?.user) {
          setUser(session.user);
        }
        return;
      }

      (async () => {
        if (session?.user) {
          // Keep loading true until profile is fetched — prevents
          // "Account Not Found" flash while profile fetch is in-flight
          setLoading(true);
          setUser(session.user);
          await fetchUserProfile(session.user);
          setLoading(false);
        } else {
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, role: UserRole, additionalData: any) => {
    // Block onAuthStateChange from racing with us
    signingUpRef.current = true;

    try {
      console.log('[AuthContext] Starting signup for', email, 'as', role);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { type: role }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      console.log('[AuthContext] Auth user created:', data.user.id);

      // Check if we have a session — if email confirmation is required, session is null
      // and the INSERT will fail because RLS requires an authenticated session.
      if (!data.session) {
        console.log('[AuthContext] No session after signUp — attempting sign in to establish session');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw new Error(
            'Account created but could not establish session. ' +
            'If email confirmation is required, please confirm your email first, then sign in.'
          );
        }
        console.log('[AuthContext] Session established via sign in');
      }

      // Now we have an authenticated session — INSERT the profile row
      if (role === 'creator') {
        console.log('[AuthContext] Inserting creator profile');
        const { error: insertError } = await supabase.from('creators').insert({
          email,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          approved: false
        });
        if (insertError) {
          console.error('[AuthContext] Creator insert failed:', insertError.message);
          throw new Error(`Failed to create creator profile: ${insertError.message}`);
        }
        console.log('[AuthContext] Creator profile inserted successfully');

        // Set state directly — no need to re-fetch, we know what we just inserted
        setUser(data.user);
        setUserRole('creator');
        setUserProfile({
          email,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          approved: false
        });
      } else if (role === 'business') {
        console.log('[AuthContext] Inserting business profile');
        const { error: insertError } = await supabase.from('businesses').insert({
          owner_email: email,
          name: additionalData.name,
          slug: additionalData.slug,
          category: additionalData.category || 'Food & Drink',
          address: additionalData.address,
          latitude: additionalData.latitude,
          longitude: additionalData.longitude,
          bio: additionalData.bio,
          approved: false
        });
        if (insertError) {
          console.error('[AuthContext] Business insert failed:', insertError.message);
          throw new Error(`Failed to create business profile: ${insertError.message}`);
        }
        console.log('[AuthContext] Business profile inserted successfully');

        setUser(data.user);
        setUserRole('business');
        setUserProfile({
          owner_email: email,
          name: additionalData.name,
          slug: additionalData.slug,
          category: additionalData.category || 'Food & Drink',
          address: additionalData.address,
          latitude: additionalData.latitude,
          longitude: additionalData.longitude,
          bio: additionalData.bio,
          approved: false
        });
      }
    } finally {
      signingUpRef.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, userRole, userProfile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
