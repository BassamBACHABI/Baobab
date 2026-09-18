import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = en cours de vérification ; null = non connecté ; objet = connecté
  const [user, setUser] = useState(undefined);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: retour d'OAuth Google -> AuthCallback fait l'échange, on ne vérifie pas ici.
    if (window.location.hash?.includes("session_id=")) return;
    const token = localStorage.getItem("baobab_token");
    if (!token) {
      setUser(null);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("baobab_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("baobab_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const handleGoogleCallback = async (sessionId) => {
    const { data } = await api.post("/auth/google/session", { session_id: sessionId });
    if (data.session_token) localStorage.setItem("baobab_token", data.session_token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/client";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("baobab_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, register, logout, loginWithGoogle, handleGoogleCallback }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const isStaff = (user) =>
  !!user && user.roles?.some((r) => r === "ADMIN" || r === "OPERATOR");
