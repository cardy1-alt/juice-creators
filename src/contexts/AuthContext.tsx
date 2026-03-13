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

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@juicecreators.com').toLowerCase();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo mode profiles — activated via ?demo=creator|business|admin
const DEMO_PROFILES: Record<string, { role: UserRole; profile: any }> = {
  creator: {
    role: 'creator',
    profile: {
      id: 'demo-creator-1',
      email: 'sophie@demo.com',
      name: 'Sophie Carter',
      instagram_handle: '@sophiecarter',
      follower_count: '12.4k',
      code: 'SOPHIE01',
      approved: true,
      onboarding_complete: true,
      created_at: new Date().toISOString(),
    },
  },
  business: {
    role: 'business',
    profile: {
      id: 'demo-business-1',
      owner_email: 'hello@midgarcoffee.com',
      name: 'Midgar Coffee',
      slug: 'midgar-coffee',
      category: 'Cafe & Coffee',
      address: '42 High Street, London',
      latitude: 51.5074,
      longitude: -0.1278,
      bio: 'Specialty coffee & brunch spot',
      approved: true,
      created_at: new Date().toISOString(),
    },
  },
  admin: {
    role: 'admin',
    profile: { email: 'admin@juicecreators.com', name: 'Admin' },
  },
};

function getDemoRole(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  return demo && DEMO_PROFILES[demo] ? demo : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoKey = getDemoRole();
  const demo = demoKey ? DEMO_PROFILES[demoKey] : null;

  const [user, setUser] = useState<User | null>(
    demo ? ({ id: 'demo-user', email: demo.profile.email || demo.profile.owner_email } as unknown as User) : null
  );
  const [userRole, setUserRole] = useState<UserRole | null>(demo ? demo.role : null);
  const [userProfile, setUserProfile] = useState<any | null>(demo ? demo.profile : null);
  const [loading, setLoading] = useState(demo ? false : true);

  // Guard: prevent onAuthStateChange from overwriting state during signup
  const signingUpRef = useRef(false);

  // Login rate limiting
  const loginAttemptsRef = useRef(0);
  const lockoutUntilRef = useRef<number>(0);

  const fetchUserProfile = async (authUser: User) => {
    const email = authUser.email;
    if (!email) {
      console.warn('[AuthContext] No email on auth user');
      return;
    }

    if (email.toLowerCase() === ADMIN_EMAIL) {
      console.log('[AuthContext] Admin detected');
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
      console.error('[AuthContext] Error fetching creator profile:', creatorError.code, creatorError.message);
    }

    if (creator) {
      console.log('[AuthContext] Creator profile found:', creator.id);
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
      console.error('[AuthContext] Error fetching business profile:', businessError.code, businessError.message);
    }

    if (business) {
      console.log('[AuthContext] Business profile found:', business.id);
      setUserRole('business');
      setUserProfile(business);
      return;
    }

    // No profile found — clear role so fallback screen shows
    console.warn('[AuthContext] No profile found for user:', authUser.id);
    setUserRole(null);
    setUserProfile(null);
  };

  useEffect(() => {
    // Skip auth in demo mode
    if (demo) return;

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
      console.log('[AuthContext] Starting signup as', role);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { type: role }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      console.log('[AuthContext] Auth user created:', data.user.id, 'session:', !!data.session);

      // Check if we have a session — if email confirmation is required, session is null
      // and the INSERT will fail because RLS requires an authenticated session.
      if (!data.session) {
        console.log('[AuthContext] No session — attempting sign in to establish session');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw new Error(
            'Account created. Please check your email to confirm, then sign in.'
          );
        }
        console.log('[AuthContext] Session established via sign in');
      }

      // Now we have an authenticated session — INSERT the profile row
      if (role === 'creator') {
        console.log('[AuthContext] Inserting creator profile for:', data.user.id);
        const insertPayload = {
          email,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          approved: false
        };
        console.log('[AuthContext] Creator INSERT payload:', JSON.stringify(insertPayload));

        const { error: insertError } = await supabase.from('creators').insert(insertPayload);

        if (insertError) {
          console.error('[AuthContext] Creator INSERT failed:', insertError.code, insertError.message, insertError.details, insertError.hint);
          if (insertError.code === '23505') {
            throw new Error('An account with this email or Instagram handle already exists. Please sign in instead.');
          }
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
          approved: false,
          onboarding_complete: false
        });
      } else if (role === 'business') {
        console.log('[AuthContext] Inserting business profile for:', data.user.id);
        const insertPayload = {
          owner_email: email,
          name: additionalData.name,
          slug: additionalData.slug,
          category: additionalData.category || 'Food & Drink',
          address: additionalData.address,
          latitude: additionalData.latitude,
          longitude: additionalData.longitude,
          bio: additionalData.bio,
          approved: false
        };
        console.log('[AuthContext] Business INSERT payload:', JSON.stringify(insertPayload));

        const { error: insertError } = await supabase.from('businesses').insert(insertPayload);

        if (insertError) {
          console.error('[AuthContext] Business INSERT failed:', insertError.code, insertError.message, insertError.details, insertError.hint);
          if (insertError.code === '23505') {
            throw new Error('A business with this email or name already exists. Please sign in instead.');
          }
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
      // Delay releasing the guard so queued onAuthStateChange events
      // (from signUp/signIn above) don't race with our state updates
      setTimeout(() => {
        signingUpRef.current = false;
      }, 1000);
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
