import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';
import { sendCreatorWelcomeEmail, sendBusinessWelcomeEmail, sendAdminApprovalRequest } from '../lib/notifications';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  userProfile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole, additionalData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'hello@nayba.app').toLowerCase();

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
      onboarding_complete: true,
      onboarding_step: 5,
      created_at: new Date().toISOString(),
    },
  },
  admin: {
    role: 'admin',
    profile: { email: 'hello@nayba.app', name: 'Admin' },
  },
};

function getDemoRole(): string | null {
  if (typeof window === 'undefined') return null;
  if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO !== 'true') return null;
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

  // Login rate limiting — persisted to localStorage so refreshing doesn't reset
  const getLoginAttempts = (): number => {
    try { return parseInt(localStorage.getItem('nayba_login_attempts') || '0', 10); } catch { return 0; }
  };
  const setLoginAttempts = (n: number) => {
    try { localStorage.setItem('nayba_login_attempts', String(n)); } catch {}
  };
  const getLockoutUntil = (): number => {
    try { return parseInt(localStorage.getItem('nayba_lockout_until') || '0', 10); } catch { return 0; }
  };
  const setLockoutUntil = (t: number) => {
    try { localStorage.setItem('nayba_lockout_until', String(t)); } catch {}
  };

  const fetchUserProfile = async (authUser: User) => {
    const email = authUser.email;
    if (!email) {
      return;
    }

    if (email.toLowerCase() === ADMIN_EMAIL) {
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
      // TODO: add error tracking
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
      // TODO: add error tracking
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
      // Skip everything during signup — signUp() sets user/role/profile
      // together in one batch. Setting user here prematurely causes an
      // "Account Not Found" flash (user truthy, role still null).
      if (signingUpRef.current) {
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
    const lockoutUntil = getLockoutUntil();
    if (now < lockoutUntil) {
      const secsLeft = Math.ceil((lockoutUntil - now) / 1000);
      throw new Error(`Too many attempts. Please wait ${secsLeft} seconds.`);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const attempts = getLoginAttempts() + 1;
      setLoginAttempts(attempts);
      if (attempts >= 5) {
        // Lock out for 30 seconds after 5 failed attempts
        setLockoutUntil(Date.now() + 30_000);
        setLoginAttempts(0);
      }
      throw error;
    }
    setLoginAttempts(0);
  };

  const signUp = async (email: string, password: string, role: UserRole, additionalData: any) => {
    // Normalise email to lowercase to match Supabase Auth's JWT (auth.jwt()->>'email')
    // which is always lowercase. Without this, RLS policies like
    // `email = auth.jwt()->>'email'` fail on case-mismatched emails.
    const normEmail = email.toLowerCase().trim();

    // Block onAuthStateChange from racing with us
    signingUpRef.current = true;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normEmail,
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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normEmail, password });
        if (signInError) {
          throw new Error(
            'Account created. Please check your email to confirm, then sign in.'
          );
        }
      }

      // Now we have an authenticated session — INSERT the profile row
      if (role === 'creator') {
        const insertPayload: Record<string, any> = {
          id: data.user.id,
          email: normEmail,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          approved: false
        };
        if (additionalData.dateOfBirth) insertPayload.date_of_birth = additionalData.dateOfBirth;
        if (additionalData.address) {
          insertPayload.address = additionalData.address;
          insertPayload.latitude = additionalData.latitude;
          insertPayload.longitude = additionalData.longitude;
        }
        const { error: insertError } = await supabase.from('creators').insert(insertPayload);

        if (insertError) {
          // TODO: add error tracking
          // Try to recover — the profile may already exist from a previous
          // attempt (23505) or the INSERT may have been blocked by RLS (42501).
          // Either way, check if a profile row exists for this email.
          const { data: existing } = await supabase
            .from('creators')
            .select('*')
            .eq('email', normEmail)
            .maybeSingle();
          if (existing) {
            setUser(data.user);
            setUserRole('creator');
            setUserProfile(existing);
            return;
          }
          // No recoverable row — surface the error
          if (insertError.code === '23505') {
            throw new Error('An account with this email or Instagram handle already exists. Please sign in instead.');
          }
          throw new Error(`Failed to create creator profile: ${insertError.message}`);
        }
        // Best-effort fetch to get the generated id — if RLS blocks the
        // read (e.g. email case mismatch with JWT), fall back gracefully
        let creatorId: string | undefined;
        try {
          const { data: row } = await supabase.from('creators').select('id').eq('email', normEmail).maybeSingle();
          creatorId = row?.id;
        } catch { /* non-critical */ }

        const creatorProfile = {
          id: creatorId,
          email: normEmail,
          name: additionalData.name,
          instagram_handle: additionalData.instagramHandle,
          follower_count: additionalData.followerCount || null,
          code: additionalData.code,
          date_of_birth: additionalData.dateOfBirth || null,
          address: additionalData.address || null,
          latitude: additionalData.latitude || null,
          longitude: additionalData.longitude || null,
          approved: false,
          onboarding_complete: false
        };

        setUser(data.user);
        setUserRole('creator');
        setUserProfile(creatorProfile);

        // Fire welcome email + admin approval request (non-blocking)
        if (creatorId) {
          sendCreatorWelcomeEmail(creatorId).catch(() => {});
          sendAdminApprovalRequest({ userType: 'creator', userId: creatorId, displayName: additionalData.name, email: normEmail }).catch(() => {});
        }
      } else if (role === 'business') {
        const insertPayload = {
          owner_email: normEmail,
          name: additionalData.name,
          slug: additionalData.slug,
          category: additionalData.category || 'Food & Drink',
          address: additionalData.address,
          latitude: additionalData.latitude,
          longitude: additionalData.longitude,
          bio: additionalData.bio,
          approved: false
        };
        const { error: insertError } = await supabase.from('businesses').insert(insertPayload);

        if (insertError) {
          // TODO: add error tracking
          // Try to recover — the profile may already exist from a previous
          // attempt (23505) or the INSERT may have been blocked by RLS (42501).
          // Either way, check if a profile row exists for this email.
          const { data: existing } = await supabase
            .from('businesses')
            .select('*')
            .eq('owner_email', normEmail)
            .maybeSingle();
          if (existing) {
            setUser(data.user);
            setUserRole('business');
            setUserProfile(existing);
            return;
          }
          // No recoverable row — surface the error
          if (insertError.code === '23505') {
            throw new Error('A business with this email or name already exists. Please sign in instead.');
          }
          throw new Error(`Failed to create business profile: ${insertError.message}`);
        }
        // Best-effort fetch to get the generated id
        let businessId: string | undefined;
        try {
          const { data: row } = await supabase.from('businesses').select('id').eq('owner_email', normEmail).maybeSingle();
          businessId = row?.id;
        } catch { /* non-critical */ }

        const businessProfile = {
          id: businessId,
          owner_email: normEmail,
          name: additionalData.name,
          slug: additionalData.slug,
          category: additionalData.category || 'Food & Drink',
          address: additionalData.address,
          latitude: additionalData.latitude,
          longitude: additionalData.longitude,
          bio: additionalData.bio,
          approved: false,
          onboarding_complete: false
        };

        setUser(data.user);
        setUserRole('business');
        setUserProfile(businessProfile);

        // Fire welcome email + admin approval request (non-blocking)
        if (businessId) {
          sendBusinessWelcomeEmail(businessId).catch(() => {});
          sendAdminApprovalRequest({ userType: 'business', userId: businessId, displayName: additionalData.name, email: normEmail }).catch(() => {});
        }
      }
    } catch (err) {
      // If signup fails after onAuthStateChange has already set `user`,
      // clear everything so the user lands back on the Auth screen
      // where the error message will be visible — not on "Account Not Found".
      setUser(null);
      setUserRole(null);
      setUserProfile(null);
      await supabase.auth.signOut().catch(() => {});
      throw err;
    } finally {
      // Delay releasing the guard so queued onAuthStateChange events
      // (from signUp/signIn above) don't race with our state updates
      setTimeout(() => {
        signingUpRef.current = false;
      }, 1000);
    }
  };

  const signOut = async () => {
    setUser(null);
    setUserRole(null);
    setUserProfile(null);
    await supabase.auth.signOut().catch(() => {});
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
