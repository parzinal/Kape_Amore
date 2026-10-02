import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { authApi, type AuthUser } from "./authApi";

type AuthStatus = "loading" | "signed-out" | "signed-in" | "error";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  signUp: (name: string, email: string, password: string, confirmation: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const authRequestId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++authRequestId.current;
    setStatus("loading");
    setError(null);
    try {
      const currentUser = await authApi.currentUser();
      if (requestId !== authRequestId.current) return;
      setUser(currentUser);
      setStatus(currentUser ? "signed-in" : "signed-out");
    } catch (cause) {
      if (requestId !== authRequestId.current) return;
      setUser(null);
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Unable to verify your session.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    ++authRequestId.current;
    try {
      const authenticatedUser = await authApi.login(email, password, remember);
      setUser(authenticatedUser);
      setStatus("signed-in");
      setError(null);
      return authenticatedUser;
    } catch (cause) {
      setStatus("signed-out");
      throw cause;
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, confirmation: string) => {
    ++authRequestId.current;
    try {
      const authenticatedUser = await authApi.register(name, email, password, confirmation);
      setUser(authenticatedUser);
      setStatus("signed-in");
      setError(null);
      return authenticatedUser;
    } catch (cause) {
      setStatus("signed-out");
      throw cause;
    }
  }, []);

  const signOut = useCallback(async () => {
    ++authRequestId.current;
    await authApi.logout();
    setUser(null);
    setStatus("signed-out");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ user, status, error, signIn, signUp, signOut, refresh }),
    [user, status, error, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
