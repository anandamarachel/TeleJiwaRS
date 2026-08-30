"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";

type UserInfo = {
  id: number;
  email: string;
  role: "patient" | "doctor" | "admin";
  is_super_admin: boolean;
};

type AuthContextValue = {
  user: UserInfo | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  login: (email: string, password: string) => Promise<UserInfo>;
  logout: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    apiFetch<UserInfo>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const userInfo = await apiFetch<UserInfo>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setIsLoggingOut(false);
    setUser(userInfo);
    return userInfo;
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      setUser(null);
    } catch (error) {
      setIsLoggingOut(false);
      throw error;
    }
  }

  function clearSession() {
    setIsLoggingOut(true);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggingOut, login, logout, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
