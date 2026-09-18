// N'enregistre le service worker qu'en PRODUCTION, jamais dans l'aperçu ni dans une iframe.
export function registerServiceWorker() {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    // Ne pas enregistrer dans une iframe (aperçu / éditeur).
    try {
        if (window.self !== window.top) return;
    } catch (e) {
        return;
    }

    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .catch(() => {
                /* silencieux : l'app fonctionne sans service worker */
            });
    });
}
