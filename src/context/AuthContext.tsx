import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';

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
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to load current user', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const loginWithGoogle = async (profile: { email: string; full_name: string; avatar_url?: string }) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'فشل تسجيل الدخول عبر Google');
    }
    const data = await res.json();
    setUser(data.user);
    return data.user;
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
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
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
