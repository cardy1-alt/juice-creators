import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (user: User) => {
    const email = user.email;
    if (!email) return;

    if (email === 'admin@juicecreators.com') {
      setUserRole('admin');
      setUserProfile({ email, name: 'Admin' });
      return;
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (creator) {
      setUserRole('creator');
      setUserProfile(creator);
      return;
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_email', email)
      .maybeSingle();

    if (business) {
      setUserRole('business');
      setUserProfile(business);
      return;
    }
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
      (async () => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user);
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
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign up failed');

    if (role === 'creator') {
      await supabase.from('creators').insert({
        email,
        name: additionalData.name,
        instagram_handle: additionalData.instagramHandle,
        code: additionalData.code,
        approved: false
      });
    } else if (role === 'business') {
      await supabase.from('businesses').insert({
        owner_email: email,
        name: additionalData.name,
        slug: additionalData.slug,
        approved: false
      });
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
