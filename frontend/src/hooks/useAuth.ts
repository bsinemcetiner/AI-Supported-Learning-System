import { useState, useCallback } from "react";
import { auth as authApi, token as tokenStore } from "../services/api";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(username, password);
      tokenStore.set(res.access_token);
      setUser(res.user);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(
    async (full_name: string, username: string, password: string, role: string) => {
      setLoading(true);
      setError(null);
      try {
        await authApi.signup(full_name, username, password, role);
        return true;
      } catch (e: any) {
        setError(e.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return { user, setUser, error, loading, login, signup, logout };
}
