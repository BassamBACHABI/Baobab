import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, LogOut, Copy, Check, Plus, Home, Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { pushSupported, getPushSubscription, enablePush, disablePush } from "@/lib/push";

export default function ClientProfile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [addr, setAddr] = useState({ city: "", address_line: "", landmark: "" });
  const [addingAddr, setAddingAddr] = useState(false);
  const [notifyNonEssential, setNotifyNonEssential] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushReady, setPushReady] = useState(false); // service worker actif (PWA installée / prod)

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        setPushReady(!!reg);
        const sub = await getPushSubscription();
        setPushOn(!!sub);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const togglePush = async (value) => {
    setPushBusy(true);
    try {
      if (value) {
        await enablePush();
        setPushOn(true);
        toast.success("Notifications push activées");
      } else {
        await disablePush();
        setPushOn(false);
        toast.success("Notifications push désactivées");
      }
    } catch (err) {
      const map = {
        unsupported: "Votre navigateur ne prend pas en charge les notifications.",
        "no-sw": "Installez l'application (Ajouter à l'écran d'accueil) pour activer le push.",
        denied: "Autorisation refusée. Activez les notifications dans les réglages du navigateur.",
      };
      toast.error(map[err.message] || "Impossible d'activer les notifications push.");
      setPushOn(false);
    } finally {
      setPushBusy(false);
    }
  };

  const load = async () => {
    try {
      const [p, f, a, pref] = await Promise.all([
        api.get("/me/profile"),
        api.get("/me/forwarding-address"),
        api.get("/me/addresses"),
        api.get("/me/notification-preferences"),
      ]);
      setProfile(p.data);
      setForm({ first_name: p.data.first_name || "", last_name: p.data.last_name || "", phone: p.data.phone || "" });
      setForwarding(f.data?.[0] || null);
      setAddresses(a.data || []);
      setNotifyNonEssential(pref.data?.notify_non_essential ?? true);
    } catch {
      toast.error("Impossible de charger votre profil.");
    } finally {
      setLoading(false);
    }
  };

  const toggleNotify = async (value) => {
    setNotifyNonEssential(value);
    try {
      await api.put("/me/notification-preferences", { notify_non_essential: value });
      toast.success("Préférences enregistrées");
    } catch (err) {
      setNotifyNonEssential(!value);
      toast.error(apiError(err.response?.data?.detail) || err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const copyRef = () => {
    if (!forwarding?.customer_reference) return;
    navigator.clipboard?.writeText(forwarding.customer_reference);
    setCopied(true);
    toast.success("Référence copiée");
    setTimeout(() => setCopied(false), 1500);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put("/me/profile", form);
      setProfile(data);
      toast.success("Profil mis à jour");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const addAddress = async (e) => {
    e.preventDefault();
    if (!addr.city || !addr.address_line) {
      toast.error("Ville et adresse sont obligatoires.");
      return;
    }
    setAddingAddr(true);
    try {
      const { data } = await api.post("/me/addresses", {
        country: "Bénin", city: addr.city, address_line: addr.address_line,
        landmark: addr.landmark, type: "DELIVERY_BENIN",
      });
      setAddresses((prev) => [...prev, data]);
      setAddr({ city: "", address_line: "", landmark: "" });
      toast.success("Adresse ajoutée");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setAddingAddr(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mon profil"
        subtitle="Vos informations, votre adresse de réception en Europe et vos adresses de livraison au Bénin."
        action={
          <Button variant="outline" className="rounded-xl" onClick={doLogout} data-testid="logout-btn">
            <LogOut className="mr-1.5 h-4 w-4" /> Déconnexion
          </Button>
        }
      />

      {/* Adresse de réception + référence */}
      <Card className="overflow-hidden rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="forwarding-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">Votre adresse de réception (Europe)</h3>
              {loading ? (
                <Skeleton className="mt-3 h-20 w-full rounded-xl" />
              ) : forwarding ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Référence client :</span>
                    <span className="rounded-lg bg-accent px-2.5 py-1 font-mono text-sm font-bold text-white" data-testid="customer-reference">
                      {forwarding.customer_reference}
                    </span>
                    <button onClick={copyRef} className="text-muted-foreground hover:text-accent" aria-label="Copier" data-testid="copy-reference-btn">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {forwarding.hub && (
                    <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
                      <p className="font-semibold text-foreground">{forwarding.hub.name}</p>
                      <p className="text-muted-foreground">{forwarding.hub.address_line}</p>
                      <p className="text-muted-foreground">{forwarding.hub.postal_code} {forwarding.hub.city}</p>
                      <p className="mt-2 text-xs text-accent">Ajoutez votre référence {forwarding.customer_reference} au nom du destinataire.</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Votre adresse de réception sera disponible très bientôt.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations personnelles (éditables) */}
      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="p-6">
          <h3 className="mb-4 text-base font-semibold text-foreground">Informations personnelles</h3>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">Prénom</Label>
                <Input id="first_name" data-testid="profile-firstname" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Nom</Label>
                <Input id="last_name" data-testid="profile-lastname" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="phone" data-testid="profile-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="h-11 rounded-xl pl-10" placeholder="+229 ..." />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-2.5 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{loading ? "…" : profile?.email}</span>
            </div>
            <Button type="submit" disabled={savingProfile} data-testid="save-profile-btn" className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Adresses de livraison au Bénin */}
      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="p-6">
          <h3 className="mb-1 text-base font-semibold text-foreground">Mes adresses de livraison au Bénin</h3>
          <p className="mb-4 text-sm text-muted-foreground">Ville, quartier/adresse et repère pour la livraison finale.</p>

          {addresses.length > 0 && (
            <div className="mb-5 space-y-3" data-testid="addresses-list">
              {addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <Home className="mt-0.5 h-5 w-5 text-accent" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">{a.city}</p>
                    <p className="text-muted-foreground">{a.address_line}</p>
                    {a.landmark && <p className="text-xs text-muted-foreground">Repère : {a.landmark}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addAddress} className="space-y-4 rounded-xl bg-secondary/40 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" data-testid="address-city" value={addr.city} onChange={(e) => setAddr((s) => ({ ...s, city: e.target.value }))} className="h-11 rounded-xl bg-background" placeholder="Cotonou" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="landmark">Repère</Label>
                <Input id="landmark" data-testid="address-landmark" value={addr.landmark} onChange={(e) => setAddr((s) => ({ ...s, landmark: e.target.value }))} className="h-11 rounded-xl bg-background" placeholder="Près de..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address_line">Quartier / adresse</Label>
              <Input id="address_line" data-testid="address-line" value={addr.address_line} onChange={(e) => setAddr((s) => ({ ...s, address_line: e.target.value }))} className="h-11 rounded-xl bg-background" placeholder="Quartier, rue, numéro" />
            </div>
            <Button type="submit" disabled={addingAddr} data-testid="add-address-btn" variant="outline" className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter l'adresse
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Préférences de notification */}
      <Card className="rounded-2xl border-border shadow-card" data-testid="notification-prefs-card">
        <CardContent className="p-6">
          <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
            <Bell className="h-4 w-4 text-accent" /> Notifications par e-mail
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Les e-mails essentiels (paiement confirmé, expédition en route) sont toujours envoyés.
          </p>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="pr-4">
              <p className="text-sm font-medium text-foreground">E-mails d'information</p>
              <p className="text-xs text-muted-foreground">Colis reçu, devis disponible, arrivée au Bénin, livraison.</p>
            </div>
            <Switch
              checked={notifyNonEssential}
              onCheckedChange={toggleNotify}
              data-testid="notify-non-essential-switch"
              aria-label="Activer les e-mails non essentiels"
            />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-border p-4">
            <div className="pr-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <BellRing className="h-4 w-4 text-accent" /> Notifications push
              </p>
              <p className="text-xs text-muted-foreground">
                Alertes en temps réel sur cet appareil, même l'application fermée.
                {!pushReady && " Disponible une fois l'application installée sur l'écran d'accueil."}
              </p>
            </div>
            <Switch
              checked={pushOn}
              disabled={pushBusy || !pushSupported()}
              onCheckedChange={togglePush}
              data-testid="push-switch"
              aria-label="Activer les notifications push"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
