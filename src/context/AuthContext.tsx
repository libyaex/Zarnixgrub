import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  authError: string | null;
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
 *
 * Returns a human-readable error instead of failing silently — a swallowed
 * failure here is what sent signed-in users straight back to the login page.
 */
async function loadVerifiedProfile(
  accessToken: string
): Promise<{ profile: UserProfile | null; error: string | null }> {
  let lastError = 'تعذر التحقق من الحساب مع الخادم.';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      if (!isJson) {
        lastError =
          `الخادم لم يُرجع JSON (HTTP ${response.status}). غالباً مسارات /api غير مفعّلة على الاستضافة أو الدالة تعطّلت. افتح /api/health للتشخيص.`;
        break;
      }
      const body = await response.json();
      if (response.ok && body.user) return { profile: body.user as UserProfile, error: null };
      lastError = body.error || `فشل التحقق (HTTP ${response.status})`;
      if (body.code) lastError += ` [${body.code}]`;
      if (response.status < 500) break; // retry only server-side hiccups
    } catch (error) {
      lastError = 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.';
      console.error('auth/me request failed', error);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return { profile: null, error: lastError };
}

/** Surface OAuth errors Supabase puts in the redirect URL (hash or query). */
function readOAuthRedirectError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const desc = params.get('error_description') || hash.get('error_description');
  return desc ? `فشل الدخول عبر Google: ${desc.replace(/\+/g, ' ')}` : null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(() => readOAuthRedirectError());

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    let seq = 0; // only the most recent sync may update state (prevents races)

    const syncSession = async (accessToken?: string) => {
      const mySeq = ++seq;
      if (!accessToken) {
        if (active && mySeq === seq) {
          setUser(null);
          setLoading(false);
          localStorage.removeItem('zarnix_user');
        }
        return;
      }
      const { profile, error } = await loadVerifiedProfile(accessToken);
      if (!active || mySeq !== seq) return;
      setUser(profile);
      if (profile) {
        setAuthError(null);
        localStorage.setItem('zarnix_user', JSON.stringify(profile));
      } else {
        // Keep the Supabase session but EXPLAIN why the app cannot open.
        setAuthError(error);
        localStorage.removeItem('zarnix_user');
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session?.access_token);
    }).catch((error) => {
      console.error('Could not restore Supabase session', error);
      if (active) setLoading(false);
    });

    // INITIAL_SESSION is handled by getSession above and TOKEN_REFRESHED does
    // not change identity; re-syncing on those (or flashing the splash screen
    // on every tab focus) used to unmount the whole app.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_OUT') {
        void syncSession(undefined);
        return;
      }
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
    setAuthError(null);
  };

  const role = user?.role || 'customer';
  const isAdmin = ['owner', 'super_admin', 'admin', 'product_manager', 'payment_manager', 'support_manager'].includes(role);
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      authError,
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
