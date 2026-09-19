import { useEffect, useState } from "react";
import { Coins, Warehouse, Truck, MapPin, Boxes, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const SETTING_LABELS = {
  eur_xof_rate: "Taux de change EUR → XOF",
  volumetric_divisor: "Diviseur volumétrique",
  storage_free_days: "Franchise de stockage (jours)",
  air_delivery_days_min: "Délai aérien min (jours)",
  air_delivery_days_max: "Délai aérien max (jours)",
  default_transport_mode: "Mode de transport par défaut",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [zones, setZones] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [countries, setCountries] = useState([]);
  const [drafts, setDrafts] = useState({});

  const load = async () => {
    try {
      const [s, h, c, z, t, co] = await Promise.all([
        api.get("/settings"), api.get("/hubs"), api.get("/carriers"),
        api.get("/delivery-zones"), api.get("/tariffs"), api.get("/countries"),
      ]);
      setSettings(s.data); setHubs(h.data); setCarriers(c.data);
      setZones(z.data); setTariffs(t.data); setCountries(co.data);
      setDrafts(Object.fromEntries(s.data.map((x) => [x.key, String(x.value)])));
    } catch {
      toast.error("Erreur de chargement des paramètres.");
    }
  };
  useEffect(() => { load(); }, []);

  const saveSetting = async (key) => {
    try {
      const { data } = await api.put(`/settings/${key}`, { value: drafts[key] });
      setSettings((prev) => prev.map((s) => (s.key === key ? data : s)));
      toast.success("Paramètre enregistré");
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); }
  };

  return (
    <div className="space-y-8" data-testid="admin-settings">
      <PageHeader eyebrow="Configuration" title="Paramètres"
        subtitle="Taux de change, diviseur volumétrique, hubs, transporteurs, zones et tarifs. Chaque modification est journalisée." />

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap gap-1 rounded-xl">
          <TabsTrigger value="general" data-testid="tab-general"><Coins className="mr-1.5 h-4 w-4" />Général</TabsTrigger>
          <TabsTrigger value="hubs" data-testid="tab-hubs"><Warehouse className="mr-1.5 h-4 w-4" />Hubs</TabsTrigger>
          <TabsTrigger value="carriers" data-testid="tab-carriers"><Truck className="mr-1.5 h-4 w-4" />Transporteurs</TabsTrigger>
          <TabsTrigger value="zones" data-testid="tab-zones"><MapPin className="mr-1.5 h-4 w-4" />Zones</TabsTrigger>
          <TabsTrigger value="tariffs" data-testid="tab-tariffs"><Boxes className="mr-1.5 h-4 w-4" />Tarifs</TabsTrigger>
        </TabsList>

        {/* Général — réglages */}
        <TabsContent value="general" className="mt-4 space-y-3">
          {settings.map((s) => (
            <Card key={s.key} className="rounded-2xl border-border">
              <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
                <div className="min-w-[220px] flex-1">
                  <Label className="text-xs text-muted-foreground">{SETTING_LABELS[s.key] || s.key}</Label>
                  <Input data-testid={`setting-${s.key}`} value={drafts[s.key] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))} className="mt-1 h-11 rounded-xl" />
                </div>
                <Button onClick={() => saveSetting(s.key)} data-testid={`save-setting-${s.key}`} className="h-11 rounded-xl bg-accent text-white hover:bg-[#D45A2C]">Enregistrer</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Hubs */}
        <TabsContent value="hubs" className="mt-4 space-y-4">
          <ListCards items={hubs} render={(h) => <><p className="font-semibold">{h.name}</p><p className="text-sm text-muted-foreground">{h.address_line}, {h.postal_code} {h.city}</p></>} testId="hubs-list" />
          <CreateForm title="Nouveau hub" testId="hub"
            fields={[
              { name: "country_id", label: "Pays", type: "select", options: countries.map((c) => ({ value: c.id, label: c.name })) },
              { name: "name", label: "Nom" }, { name: "address_line", label: "Adresse" },
              { name: "city", label: "Ville" }, { name: "postal_code", label: "Code postal" },
            ]}
            onSubmit={async (v) => { const { data } = await api.post("/hubs", v); setHubs((p) => [...p, data]); }} />
        </TabsContent>

        {/* Transporteurs */}
        <TabsContent value="carriers" className="mt-4 space-y-4">
          <ListCards items={carriers} render={(c) => <p className="font-semibold">{c.name}</p>} testId="carriers-list" />
          <CreateForm title="Nouveau transporteur" testId="carrier"
            fields={[{ name: "name", label: "Nom" }]}
            onSubmit={async (v) => { const { data } = await api.post("/carriers", v); setCarriers((p) => [...p, data]); }} />
        </TabsContent>

        {/* Zones */}
        <TabsContent value="zones" className="mt-4 space-y-4">
          <ListCards items={zones} render={(z) => <><p className="font-semibold">{z.name}</p><p className="text-sm text-muted-foreground">{z.city} · {z.delivery_mode === "HOME" ? "Domicile" : "Point relais"} · {z.fee_xof} FCFA</p></>} testId="zones-list" />
          <CreateForm title="Nouvelle zone de livraison" testId="zone"
            fields={[
              { name: "name", label: "Nom" }, { name: "city", label: "Ville" },
              { name: "delivery_mode", label: "Mode", type: "select", options: [{ value: "PICKUP_POINT", label: "Point relais" }, { value: "HOME", label: "Domicile" }] },
              { name: "fee_xof", label: "Frais (XOF)", type: "number" },
            ]}
            onSubmit={async (v) => { const { data } = await api.post("/delivery-zones", v); setZones((p) => [...p, data]); }} />
        </TabsContent>

        {/* Tarifs */}
        <TabsContent value="tariffs" className="mt-4 space-y-4">
          <ListCards items={tariffs} render={(t) => <><p className="font-semibold">{t.min_weight_kg} – {t.max_weight_kg} kg</p><p className="text-sm text-muted-foreground">{t.transport_mode} · {t.price_per_kg} €/kg + {t.fixed_fee} € · {t.destination_country_code}</p></>} testId="tariffs-list" />
          <CreateForm title="Nouvelle tranche tarifaire" testId="tariff"
            fields={[
              { name: "origin_country_id", label: "Pays d'origine", type: "select", options: countries.map((c) => ({ value: c.id, label: c.name })) },
              { name: "destination_country_code", label: "Destination (code)", default: "BJ" },
              { name: "transport_mode", label: "Mode", type: "select", options: [{ value: "AIR", label: "Aérien" }, { value: "SEA", label: "Maritime" }] },
              { name: "min_weight_kg", label: "Poids min (kg)", type: "number" },
              { name: "max_weight_kg", label: "Poids max (kg)", type: "number" },
              { name: "price_per_kg", label: "Prix / kg (€)", type: "number" },
              { name: "fixed_fee", label: "Frais fixes (€)", type: "number", default: "0" },
            ]}
            onSubmit={async (v) => { const { data } = await api.post("/tariffs", v); setTariffs((p) => [...p, data]); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListCards({ items, render, testId }) {
  if (!items || items.length === 0)
    return <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>Aucun élément.</p>;
  return (
    <div className="space-y-2" data-testid={testId}>
      {items.map((it) => (
        <Card key={it.id} className="rounded-xl border-border"><CardContent className="p-4">{render(it)}</CardContent></Card>
      ))}
    </div>
  );
}

function CreateForm({ title, fields, onSubmit, testId }) {
  const init = Object.fromEntries(fields.map((f) => [f.name, f.default || (f.type === "select" ? (f.options?.[0]?.value || "") : "")]));
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      setForm(init);
      toast.success("Ajouté");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4" data-testid={`create-${testId}-form`}>
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            {f.type === "select" ? (
              <select value={form[f.name]} data-testid={`${testId}-${f.name}`} onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <Input type={f.type === "number" ? "number" : "text"} step="any" value={form[f.name]} data-testid={`${testId}-${f.name}`} onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))} className="h-11 rounded-xl bg-background" />
            )}
          </div>
        ))}
      </div>
      <Button type="submit" disabled={saving} data-testid={`submit-${testId}`} className="mt-4 rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
        <Plus className="mr-1.5 h-4 w-4" /> Ajouter
      </Button>
    </form>
  );
}
