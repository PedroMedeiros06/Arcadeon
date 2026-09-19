"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Avatar } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  coins: number;
  equippedAvatar: Avatar | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [equippedAvatar, setEquippedAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("username, coins, equipped_avatar_id, avatars:equipped_avatar_id(*)")
        .eq("id", userId)
        .single();
      setUsername(data?.username ?? null);
      setCoins(data?.coins ?? 0);
      setEquippedAvatar((data?.avatars as unknown as Avatar) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) loadProfile(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setUsername(null);
        setCoins(0);
        setEquippedAvatar(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (!session?.user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("username, coins, equipped_avatar_id, avatars:equipped_avatar_id(*)")
      .eq("id", session.user.id)
      .single();
    setUsername(data?.username ?? null);
    setCoins(data?.coins ?? 0);
    setEquippedAvatar((data?.avatars as unknown as Avatar) ?? null);
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        username,
        coins,
        equippedAvatar,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
