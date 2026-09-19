import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Ship } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ClientShipmentNew() {
  const navigate = useNavigate();
  const [stored, setStored] = useState([]);
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [transport, setTransport] = useState("AIR");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, z] = await Promise.all([api.get("/me/packages"), api.get("/delivery-zones")]);
        setStored(p.data.filter((x) => x.status === "STORED"));
        setZones(z.data.filter((x) => x.active !== false));
      } finally { setLoading(false); }
    })();
  }, []);

  const zone = useMemo(() => zones.find((z) => z.id === zoneId), [zones, zoneId]);
  const toggle = (id) => { setQuote(null); setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); };

  const getQuote = async () => {
    if (!selected.length || !zoneId) { toast.error("Sélectionnez des colis et une zone."); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/me/shipments/quote", { package_ids: selected, delivery_zone_id: zoneId, delivery_mode: zone?.delivery_mode || "PICKUP_POINT", transport_mode: transport });
      setQuote(data);
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/me/shipments", { package_ids: selected, delivery_zone_id: zoneId, delivery_mode: zone?.delivery_mode || "PICKUP_POINT", transport_mode: transport });
      toast.success("Expédition créée");
      navigate(`/client/shipments/${data.id}`);
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/client/shipments")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Expéditions</button>
      <PageHeader title="Demander une expédition" subtitle="Sélectionnez vos colis stockés et choisissez la livraison au Bénin." />

      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : stored.length === 0 ? (
        <EmptyState icon={Ship} testId="no-stored" title="Aucun colis prêt" description="Vous n'avez pas de colis au statut STOCKÉ à expédier pour le moment." />
      ) : (
        <>
          <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Colis à expédier</h3>
            <div className="space-y-2" data-testid="stored-list">
              {stored.map((p) => (
                <label key={p.id} data-testid={`select-${p.reference}`} className={cn("flex cursor-pointer items-center justify-between rounded-xl border p-3", selected.includes(p.id) ? "border-accent bg-accent/5" : "border-border")}>
                  <span className="flex items-center gap-3"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[#E56B3D]" /><span className="font-mono text-sm font-semibold">{p.reference}</span><span className="text-sm text-muted-foreground">{p.merchant_name}</span></span>
                  <span className="text-sm text-muted-foreground">{p.billable_weight_kg ? `${p.billable_weight_kg} kg` : "—"}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Zone de livraison</Label>
                <select data-testid="zone-select" value={zoneId} onChange={(e) => { setZoneId(e.target.value); setQuote(null); }} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">Choisir…</option>
                  {zones.map((z) => (<option key={z.id} value={z.id}>{z.name} ({z.delivery_mode === "HOME" ? "Domicile" : "Point relais"})</option>))}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Mode de transport</Label>
                <select data-testid="transport-select" value={transport} onChange={(e) => { setTransport(e.target.value); setQuote(null); }} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="AIR">Aérien (2–3 jours)</option>
                  <option value="SEA">Maritime</option>
                </select>
              </div>
            </div>
            <Button onClick={getQuote} disabled={busy} data-testid="quote-btn" variant="outline" className="mt-4 rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Obtenir un devis"}</Button>
          </CardContent></Card>

          {quote && (
            <Card className="rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="quote-result"><CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Devis détaillé</h3>
              <div className="space-y-2 text-sm">
                <Row k={`Poids facturable total`} v={`${quote.total_billable_weight_kg} kg`} />
                <Row k="Transport" v={`${quote.transport_eur} €`} />
                <Row k="Livraison locale" v={`${quote.delivery_fee_xof} FCFA (${quote.delivery_fee_eur} €)`} />
                <div className="my-2 h-px bg-border" />
                <div className="flex items-center justify-between text-base font-bold"><span>Total</span><span>{quote.total_eur} € · {quote.total_xof} FCFA</span></div>
                <p className="text-xs text-muted-foreground">Taux figé : 1 € = {quote.eur_xof_rate} FCFA</p>
              </div>
              <Button onClick={confirm} disabled={busy} data-testid="confirm-shipment-btn" className="mt-4 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">Valider et créer l'expédition</Button>
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}

const Row = ({ k, v }) => (<div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium text-foreground">{v}</span></div>);
