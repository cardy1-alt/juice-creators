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

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@juicecreators.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: prevent onAuthStateChange from overwriting state during signup
  const signingUpRef = useRef(false);

  // Login rate limiting
  const loginAttemptsRef = useRef(0);
  const lockoutUntilRef = useRef<number>(0);

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
      console.error('[AuthContext] Error fetching creator profile');
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
      console.error('[AuthContext] Error fetching business profile');
    }

    if (business) {
      setUserRole('business');
      setUserProfile(business);
      return;
    }

    // No profile found — clear role so fallback screen shows
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
    const now = Date.now();
    if (now < lockoutUntilRef.current) {
      const secsLeft = Math.ceil((lockoutUntilRef.current - now) / 1000);
      throw new Error(`Too many attempts. Please wait ${secsLeft} seconds.`);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginAttemptsRef.current += 1;
      if (loginAttemptsRef.current >= 5) {
        // Lock out for 30 seconds after 5 failed attempts
        lockoutUntilRef.current = Date.now() + 30_000;
        loginAttemptsRef.current = 0;
      }
      throw error;
    }
    loginAttemptsRef.current = 0;
  };

  const signUp = async (email: string, password: string, role: UserRole, additionalData: any) => {
    // Block onAuthStateChange from racing with us
    signingUpRef.current = true;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { type: role }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      // Check if we have a session — if email confirmation is required, session is null
      // and the INSERT will fail because RLS requires an authenticated session.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw new Error(
            'Account created. Please check your email to confirm, then sign in.'
          );
        }
      }

      // Now we have an authenticated session — INSERT the profile row
      if (role === 'creator') {
        const { error: insertError } = await supabase.from('creators').insert({
          email,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          approved: false
        });
        if (insertError) {
          throw new Error('Failed to create creator profile. Please try again.');
        }

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
          throw new Error('Failed to create business profile. Please try again.');
        }

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
