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
    // Retour d'OAuth Google -> AuthCallback fait l'échange, on ne vérifie pas ici.
    if (window.location.hash?.includes("session_id=")) return;
    // Vérifie la session via /auth/me (jeton Bearer localStorage OU cookie de session).
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

  const loginWithApple = async () => {
    const { data } = await api.get("/auth/apple/start");
    window.location.href = data.authorization_url;
  };

  const forgotPassword = (email) => api.post("/auth/forgot-password", { email });
  const resetPassword = (token, new_password) =>
    api.post("/auth/reset-password", { token, new_password });

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
      value={{ user, setUser, login, register, logout, loginWithGoogle, loginWithApple, forgotPassword, resetPassword, handleGoogleCallback }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const isStaff = (user) =>
  !!user && user.roles?.some((r) => r === "ADMIN" || r === "OPERATOR");
