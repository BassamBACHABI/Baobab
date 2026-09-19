import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FLOW = ["PREPARING", "SHIPPED", "IN_TRANSIT", "ARRIVED_BENIN", "OUT_FOR_DELIVERY", "DELIVERED", "INCIDENT"];

export default function AdminShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ship, setShip] = useState(null);
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("PREPARING");
  const [form, setForm] = useState({ carrier_id: "", transport_mode: "", tracking_number: "" });
  const [cost, setCost] = useState({ type: "CARRIER", amount: "", currency: "EUR", notes: "" });

  const load = async () => {
    try {
      const [s, c] = await Promise.all([api.get(`/admin/shipments/${id}`), api.get("/carriers")]);
      setShip(s.data); setCarriers(c.data);
      setForm({ carrier_id: s.data.carrier_id || "", transport_mode: s.data.transport_mode || "AIR", tracking_number: s.data.tracking_number || "" });
    } catch { toast.error("Introuvable."); navigate("/admin/shipments"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const doTransition = async () => {
    setBusy(true);
    try { await api.post(`/admin/shipments/${id}/transition`, { to_status: target }); toast.success(`Statut → ${STATUS_LABELS.SHIPMENT?.[target] || target}`); await load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };
  const saveInfo = async () => {
    setBusy(true);
    try { await api.put(`/admin/shipments/${id}`, form); toast.success("Enregistré"); await load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };
  const addCost = async () => {
    if (!cost.amount) return;
    setBusy(true);
    try { await api.post("/admin/cost-records", { ...cost, amount: Number(cost.amount), shipment_id: id }); toast.success("Coût ajouté"); setCost({ type: "CARRIER", amount: "", currency: "EUR", notes: "" }); await load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  if (!ship) return null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/admin/shipments")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Expéditions</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-mono text-2xl font-bold">{ship.reference}</h1><p className="text-sm text-muted-foreground">{ship.client ? `${ship.client.first_name} ${ship.client.last_name}` : "—"} · {ship.cost_eur} € · {ship.cost_xof} FCFA</p></div>
        <StatusBadge status={ship.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border"><CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Colis inclus</h3>
          {(ship.packages || []).map((p) => (<div key={p.id} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-0"><span className="font-mono">{p.reference}</span><StatusBadge status={p.status} /></div>))}
          {(ship.payments || []).length > 0 && (<><h3 className="mb-2 mt-4 text-sm font-semibold">Paiements</h3>{ship.payments.map((p) => (<div key={p.id} className="flex justify-between py-1 text-sm"><span>{p.amount} {p.currency}</span><StatusBadge status={p.status} /></div>))}</>)}
        </CardContent></Card>

        <Card className="rounded-2xl border-border"><CardContent className="space-y-4 p-5">
          <h3 className="text-sm font-semibold">Transporteur & suivi</h3>
          <div className="space-y-1.5"><Label>Transporteur</Label>
            <select data-testid="carrier-select" value={form.carrier_id} onChange={(e) => setForm((f) => ({ ...f, carrier_id: e.target.value }))} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">—</option>{carriers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Mode</Label><select value={form.transport_mode} onChange={(e) => setForm((f) => ({ ...f, transport_mode: e.target.value }))} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="AIR">Aérien</option><option value="SEA">Maritime</option></select></div>
            <div className="space-y-1.5"><Label>N° de suivi</Label><Input data-testid="tracking-number" value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
          <Button onClick={saveInfo} disabled={busy} variant="outline" className="rounded-xl" data-testid="save-shipment-info">Enregistrer</Button>
          <div className="h-px bg-border" />
          <h3 className="text-sm font-semibold">Faire évoluer le statut</h3>
          <div className="flex gap-2">
            <select data-testid="transition-select" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm">
              {FLOW.map((s) => (<option key={s} value={s}>{STATUS_LABELS.SHIPMENT?.[s] || s}</option>))}
            </select>
            <Button onClick={doTransition} disabled={busy} data-testid="apply-transition" className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Appliquer"}</Button>
          </div>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl border-border"><CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Coûts réels</h3>
        {(ship.costs || []).map((c) => (<div key={c.id} className="flex justify-between border-t border-border py-2 text-sm first:border-0"><span>{c.type}{c.notes ? ` · ${c.notes}` : ""}</span><span>{c.amount} {c.currency}</span></div>))}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select value={cost.type} onChange={(e) => setCost((c) => ({ ...c, type: e.target.value }))} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">{["CARRIER", "PAYMENT_FEE", "LOCAL_DELIVERY", "INSURANCE", "STORAGE", "OTHER"].map((t) => (<option key={t}>{t}</option>))}</select>
          <Input type="number" step="0.01" placeholder="Montant" value={cost.amount} onChange={(e) => setCost((c) => ({ ...c, amount: e.target.value }))} className="h-10 w-28 rounded-xl" data-testid="cost-amount" />
          <select value={cost.currency} onChange={(e) => setCost((c) => ({ ...c, currency: e.target.value }))} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option>EUR</option><option>XOF</option></select>
          <Button onClick={addCost} disabled={busy} variant="outline" className="h-10 rounded-xl" data-testid="add-cost-btn"><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
        </div>
      </CardContent></Card>

      <Card className="rounded-2xl border-border"><CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Suivi (tracking_events)</h3>
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {(ship.tracking || []).map((e, i) => (<li key={i} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" /><p className="text-sm font-medium">{STATUS_LABELS.SHIPMENT?.[e.status] || e.status}</p><p className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString("fr-FR")}</p></li>))}
        </ol>
      </CardContent></Card>
    </div>
  );
}
