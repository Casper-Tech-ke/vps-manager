import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const SESSION_KEY = "xcm_api_key";
const WELCOME_KEY = "xcm_welcome_shown";

interface AuthContextValue {
  apiKey: string | null;
  isAuthenticated: boolean;
  welcomeShown: boolean;
  login: (key: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() =>
    sessionStorage.getItem(SESSION_KEY)
  );
  const [welcomeShown, setWelcomeShown] = useState<boolean>(() =>
    sessionStorage.getItem(WELCOME_KEY) === "true"
  );

  const login = useCallback(async (key: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, key);
        setApiKey(key);
        return { ok: true };
      }
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "Invalid API key" };
    } catch {
      return { ok: false, error: "Cannot reach server" };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setApiKey(null);
  }, []);

  const dismissWelcome = useCallback(() => {
    sessionStorage.setItem(WELCOME_KEY, "true");
    setWelcomeShown(true);
  }, []);

  return (
    <AuthContext.Provider value={{ apiKey, isAuthenticated: !!apiKey, welcomeShown, login, logout, dismissWelcome }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
