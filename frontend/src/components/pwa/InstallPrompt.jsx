import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/Logo";

const DISMISS_KEY = "baobab-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS ne déclenche pas beforeinstallprompt : afficher l'aide manuelle.
    let iosTimer;
    if (isIOS()) {
      iosTimer = setTimeout(() => setVisible(true), 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } else if (isIOS()) {
      setShowIosHelp((v) => !v);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md md:bottom-5 md:left-5 md:right-auto md:mx-0"
      data-testid="pwa-install-banner"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0B2046] to-[#122A56] p-4 text-white shadow-floating">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <LogoMark className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Installer Baobab Transit</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/70">
              Ajoutez l'application à votre écran d'accueil pour suivre vos
              colis plus rapidement.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            data-testid="pwa-install-dismiss"
            className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showIosHelp && (
          <div
            className="mt-3 space-y-2 rounded-xl bg-white/5 p-3 text-xs text-white/80"
            data-testid="pwa-ios-help"
          >
            <p className="flex items-center gap-2">
              <Share className="h-4 w-4 text-accent" /> 1. Appuyez sur le bouton
              <span className="font-semibold">Partager</span>
            </p>
            <p className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent" /> 2. Choisissez
              <span className="font-semibold">Sur l'écran d'accueil</span>
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={install}
            className="h-9 flex-1 rounded-xl bg-accent text-white hover:bg-[#D45A2C]"
            data-testid="install-pwa-btn"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Installer l'application
          </Button>
          <Button
            onClick={dismiss}
            variant="ghost"
            className="h-9 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            data-testid="pwa-install-later"
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}
