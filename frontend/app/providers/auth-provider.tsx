"use client";

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import type { AuthResponse, User } from "@/lib/types";

const STORAGE_KEY = "agentary.auth";
const SELECTED_AGENT_STORAGE_KEY = "agentary.selectedAgentId";

type AuthState = {
  isReady: boolean;
  logout: () => void;
  saveAuth: (payload: AuthResponse) => void;
  token: string | null;
  user: User | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { token: string; user: User };
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsReady(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isReady,
      logout: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SELECTED_AGENT_STORAGE_KEY);
        setToken(null);
        setUser(null);
      },
      saveAuth: (payload) => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: payload.access_token, user: payload.user })
        );
        setToken(payload.access_token);
        setUser(payload.user);
      },
      token,
      user
    }),
    [isReady, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
