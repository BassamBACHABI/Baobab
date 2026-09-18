import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, isStaff } from "@/context/AuthContext";
import { BrandLoader } from "@/components/common/BrandLoader";

export default function AuthCallback() {
  const { handleGoogleCallback } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");

    (async () => {
      try {
        const user = await handleGoogleCallback(sessionId);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(isStaff(user) ? "/admin" : "/client", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [handleGoogleCallback, navigate]);

  return <BrandLoader label="Connexion en cours…" />;
}
