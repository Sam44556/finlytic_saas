"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const now = Math.floor(Date.now() / 1000);
    const fresh =
      session?.access_token &&
      session.expires_at != null &&
      session.expires_at > now + 60;

    if (fresh) return session.access_token.trim();

    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) return data.session.access_token.trim();

    return session?.access_token?.trim() ?? null;
  };

  const signIn = async (email: string, password: string) => {
    // Call your API route instead of Supabase directly
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Sign in failed');
    }

    // Set the session in Supabase client
    const { data, error } = await supabase.auth.setSession({
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
    });

    if (error) throw error;
    
    // Update user state immediately
    setUser(data.user);
    
    // Small delay to ensure session is persisted
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Call your API route instead of Supabase directly
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Sign up failed');
    }

    // Set the session in Supabase client
    const { data, error } = await supabase.auth.setSession({
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
    });

    if (error) throw error;
    
    // Update user state immediately
    setUser(data.user);
    
    // Small delay to ensure session is persisted
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, getToken }}>
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
