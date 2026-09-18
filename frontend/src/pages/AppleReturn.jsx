import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BrandLoader } from "@/components/common/BrandLoader";

export default function AppleReturn() {
  const [params] = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = params.get("token");
    const dest = params.get("dest") || "/client";
    if (token) localStorage.setItem("baobab_token", token);
    // Rechargement complet pour que le contexte d'auth relise la session.
    window.location.replace(dest);
  }, [params]);

  return <BrandLoader label="Connexion Apple en cours…" />;
}
