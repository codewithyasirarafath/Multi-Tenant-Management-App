import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, setRefreshHandler } from "@/shared/lib/api";
import type { AuthResponse, Membership, User } from "@/shared/types";

interface AuthState {
  user: User | null;
  memberships: Membership[];
  membershipCodes: number[];
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

const AuthContext = createContext<AuthState | null>(null);

function applyAuthResponse(data: AuthResponse): User {
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipCodes, setMembershipCodes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api("/auth/logout", { method: "POST", body: { refreshToken }, skipAuth: true }).catch(() => {});
    }
    clearTokens();
    setUser(null);
    setMemberships([]);
    setMembershipCodes([]);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const data = await api<AuthResponse>("/auth/token/refresh", {
        method: "POST",
        body: { refreshToken },
        skipAuth: true,
        retryOn401: false,
      });
      setUser(data.user);
      setMemberships(data.memberships ?? []);
      setMembershipCodes(data.membershipCodes ?? []);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      return data.accessToken;
    } catch {
      clearTokens();
      return null;
    }
  }, []);

  // Register the refresh handler once so api.ts can use it on 401s.
  useEffect(() => {
    setRefreshHandler(refresh);
  }, [refresh]);

  // On mount: if we hold tokens, try refresh to hydrate the session.
  useEffect(() => {
    (async () => {
      if (getAccessToken() || getRefreshToken()) {
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  // Global logout event fired by api.ts when a refresh attempt fails.
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setMemberships([]);
      setMembershipCodes([]);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    setUser(applyAuthResponse(data));
    setMemberships(data.memberships ?? []);
    setMembershipCodes(data.membershipCodes ?? []);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await api<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
      skipAuth: true,
    });
    setUser(applyAuthResponse(data));
    setMemberships(data.memberships ?? []);
    setMembershipCodes(data.membershipCodes ?? []);
  }, []);

  const value = useMemo(
    () => ({
      user,
      memberships,
      membershipCodes,
      isAuthenticated: Boolean(user),
      loading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, memberships, membershipCodes, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
