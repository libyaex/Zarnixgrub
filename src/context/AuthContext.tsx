import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    // 1. Try checking local cache first for instant loading
    const cached = localStorage.getItem('zarnix_user');
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem('zarnix_user');
      }
    }

    // 2. Try fetching latest from backend API
    try {
      const res = await fetch('/api/auth/me');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('zarnix_user', JSON.stringify(data.user));
        }
      }
    } catch (err) {
      // Backend offline or running purely as static SPA on Vercel
      console.warn('Backend session check skipped', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    // 3. Listen to Supabase Auth state changes if Supabase is initialized
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const email = session.user.email || '';
          const isOwner = email.toLowerCase() === 'advesapp@gmail.com';
          const profile: UserProfile = {
            id: session.user.id,
            email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
            role: isOwner ? 'owner' : 'customer',
            status: 'active',
            created_at: session.user.created_at || new Date().toISOString()
          };
          setUser(profile);
          localStorage.setItem('zarnix_user', JSON.stringify(profile));
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const email = session.user.email || '';
          const isOwner = email.toLowerCase() === 'advesapp@gmail.com';
          const profile: UserProfile = {
            id: session.user.id,
            email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
            role: isOwner ? 'owner' : 'customer',
            status: 'active',
            created_at: session.user.created_at || new Date().toISOString()
          };
          setUser(profile);
          localStorage.setItem('zarnix_user', JSON.stringify(profile));
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const loginWithGoogle = async (profile: { email: string; full_name: string; avatar_url?: string }) => {
    // If Supabase is active, trigger real Google OAuth popup / redirect!
    if (supabase) {
      try {
        const redirectUrl = window.location.origin.includes('localhost')
          ? 'https://zarnixgrub.vercel.app'
          : window.location.origin;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl
          }
        });
        if (!error) {
          return null as any;
        }
      } catch (err) {
        console.warn('Supabase OAuth trigger error, falling back to local session', err);
      }
    }

    const isOwner = profile.email.toLowerCase() === 'advesapp@gmail.com';
    let authenticatedUser: UserProfile | null = null;

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.user) {
          authenticatedUser = data.user;
        }
      }
    } catch (err) {
      console.warn('Backend API auth offline, using resilient client auth', err);
    }

    // If backend was unreachable or returned static HTML on Vercel, use resilient fallback
    if (!authenticatedUser) {
      authenticatedUser = {
        id: `usr_${Date.now()}`,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: isOwner ? 'owner' : 'customer',
        status: 'active',
        created_at: new Date().toISOString()
      };
    }

    setUser(authenticatedUser);
    localStorage.setItem('zarnix_user', JSON.stringify(authenticatedUser));
    return authenticatedUser as UserProfile;
  };

  const switchRole = async (newRole: UserRole) => {
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to switch role', err);
    }
  };

  const login = async (email: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Login error', err);
    }
  };

  const register = async (fullName: string, email: string, phone: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, phone })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'فشل إنشاء الحساب');
    }
    const data = await res.json();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('zarnix_user');
    setUser(null);
  };

  const role = user?.role || 'customer';
  const isAdmin = ['owner', 'admin', 'product_manager', 'payment_manager', 'support_manager'].includes(role);
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
      isAdmin 
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
