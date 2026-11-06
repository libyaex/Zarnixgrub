import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (profile: { email: string; full_name: string; avatar_url?: string }) => Promise<UserProfile>;
  switchRole: (newRole: UserRole) => Promise<void>;
  login: (email: string) => Promise<void>;
  register: (fullName: string, email: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Read the authoritative profile from the server using the current
 * Supabase access token. Never trust a role cached in localStorage or
 * inferred from an email address in the browser.
 */
async function loadVerifiedProfile(accessToken: string): Promise<UserProfile | null> {
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body.user ?? null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    const syncSession = async (accessToken?: string) => {
      if (!accessToken) {
        if (active) {
          setUser(null);
          setLoading(false);
          localStorage.removeItem('zarnix_user');
        }
        return;
      }
      try {
        const profile = await loadVerifiedProfile(accessToken);
        if (!active) return;
        setUser(profile);
        if (profile) localStorage.setItem('zarnix_user', JSON.stringify(profile));
        else localStorage.removeItem('zarnix_user');
      } catch (error) {
        if (active) {
          setUser(null);
          localStorage.removeItem('zarnix_user');
          console.error('Could not verify the account profile with the server', error);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    // Do not hydrate auth or permissions from the localStorage profile cache.
    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session?.access_token);
    }).catch((error) => {
      console.error('Could not restore Supabase session', error);
      if (active) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      void syncSession(session?.access_token);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async (_profile: { email: string; full_name: string; avatar_url?: string }) => {
    if (!supabase) throw new Error('تسجيل الدخول غير متاح: إعداد Supabase غير مكتمل.');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    // OAuth navigates away; this is only a typed placeholder for the existing interface.
    return null as unknown as UserProfile;
  };

  const switchRole = async (newRole: UserRole) => {
    if (!supabase) throw new Error('إعداد Supabase غير مكتمل.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('يرجى تسجيل الدخول مجدداً.');
    const response = await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'تعذر تغيير الدور.');
    setUser(body.user ?? null);
  };

  // Email-only login and arbitrary registration were unsafe legacy flows.
  // Authentication is exclusively through configured Supabase Google OAuth.
  const login = async (_email: string) => {
    throw new Error('استخدم تسجيل الدخول الآمن عبر Google.');
  };

  const register = async (_fullName: string, _email: string, _phone: string) => {
    throw new Error('إنشاء الحساب يتم عبر تسجيل الدخول الآمن باستخدام Google.');
  };

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    localStorage.removeItem('zarnix_user');
    setUser(null);
  };

  const role = user?.role || 'customer';
  const isAdmin = ['owner', 'super_admin', 'admin', 'product_manager', 'payment_manager', 'support_manager'].includes(role);
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      isAuthenticated,
      loginWithGoogle,
      switchRole,
      login,
      register,
      logout,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
