import { api } from "@/lib/api";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Le service worker n'est actif qu'en PWA installée / production.
async function getRegistration() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.getRegistration();
}

export async function getPushSubscription() {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("unsupported");
  const reg = await getRegistration();
  if (!reg) throw new Error("no-sw"); // app non installée / hors production
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const { data } = await api.get("/push/vapid-public-key");
  if (!data.public_key) throw new Error("no-key");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(data.public_key),
  });
  await api.post("/me/push/subscribe", { subscription: sub.toJSON() });
  return sub;
}

export async function disablePush() {
  const sub = await getPushSubscription();
  if (sub) {
    try { await api.post("/me/push/unsubscribe", { endpoint: sub.endpoint }); } catch (e) { /* ignore */ }
    await sub.unsubscribe();
  }
}
