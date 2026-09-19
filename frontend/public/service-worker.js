/* Baobab Cargo — service worker
   Met en cache les ressources statiques et fournit une page hors-ligne.
   Ne met JAMAIS en cache les données privées des clients (/api). */

const CACHE = "baobab-static-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/", OFFLINE_URL, "/manifest.json"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE)
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Ne jamais mettre en cache les appels API / données privées.
    if (url.pathname.startsWith("/api")) return;
    if (url.origin !== self.location.origin) return;

    // Navigation : réseau d'abord, page hors-ligne en secours.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(() => caches.match(OFFLINE_URL)),
        );
        return;
    }

    // Ressources statiques : cache d'abord, puis réseau.
    if (["style", "script", "image", "font"].includes(request.destination)) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ||
                    fetch(request).then((response) => {
                        const copy = response.clone();
                        caches
                            .open(CACHE)
                            .then((cache) => cache.put(request, copy));
                        return response;
                    }),
            ),
        );
    }
});

// ---- Web Push : afficher une notification (Apple exige showNotification) ----
self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: "Baobab Cargo", body: event.data ? event.data.text() : "" };
    }
    const title = data.title || "Baobab Cargo";
    const options = {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: data.url || "/client" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url =
        (event.notification.data && event.notification.data.url) || "/client";
    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((list) => {
                for (const c of list) {
                    if (c.url.includes(url) && "focus" in c) return c.focus();
                }
                if (self.clients.openWindow) return self.clients.openWindow(url);
            }),
    );
});
