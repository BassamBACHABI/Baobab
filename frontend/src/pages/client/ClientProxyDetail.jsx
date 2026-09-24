import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, ExternalLink, Ship, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientProxyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [transport, setTransport] = useState("AIR");
  const [shipQuote, setShipQuote] = useState(null);
  const [shipment, setShipment] = useState(null);

  const load = async () => {
    try {
      const [o, z] = await Promise.all([api.get(`/me/proxy-orders/${id}`), api.get("/delivery-zones")]);
      setOrder(o.data);
      setZones((z.data || []).filter((x) => x.active !== false));
      if (o.data.shipment_id) {
        try { const sh = await api.get(`/me/shipments/${o.data.shipment_id}`); setShipment(sh.data); } catch (e) { /* ignore */ }
      } else { setShipment(null); }
    }
    catch { toast.error("Commande introuvable."); navigate("/client/proxy"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const startPay = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/me/proxy-orders/${id}/pay`); setPayment(data); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };
  const simulate = async (result) => {
    setBusy(true);
    try {
      await api.post(`/me/payments/${payment.id}/simulate`, { result });
      toast[result === "success" ? "success" : "error"](result === "success" ? "Paiement confirmé" : "Paiement échoué");
      setPayment(null); await load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  const getShipQuote = async () => {
    if (!zoneId) { toast.error("Choisissez une zone."); return; }
    const zone = zones.find((z) => z.id === zoneId);
    setBusy(true);
    try { const { data } = await api.post(`/me/proxy-orders/${id}/ship-quote`, { delivery_zone_id: zoneId, delivery_mode: zone?.delivery_mode || "PICKUP_POINT", transport_mode: transport }); setShipQuote(data); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };
  const confirmShip = async () => {
    const zone = zones.find((z) => z.id === zoneId);
    setBusy(true);
    try { const { data } = await api.post(`/me/proxy-orders/${id}/ship`, { delivery_zone_id: zoneId, delivery_mode: zone?.delivery_mode || "PICKUP_POINT", transport_mode: transport }); toast.success("Expédition créée"); navigate(`/client/shipments/${data.id}`); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  if (!order) return null;
  const q = order.quote || {};

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/client/proxy")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Achats pour moi</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-mono text-2xl font-bold text-foreground">{order.reference}</h1><p className="text-sm text-muted-foreground">{order.items?.length || 0} article(s)</p></div>
        <StatusBadge status={order.status} />
      </div>

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Articles</h3>
        <div className="space-y-2" data-testid="proxy-items">
          {(order.items || []).map((it, i) => (
            <div key={i} className="flex items-start justify-between border-t border-border py-2 text-sm first:border-0">
              <div>
                <p className="font-medium text-foreground">{it.name} {it.variant ? <span className="text-muted-foreground">· {it.variant}</span> : null}</p>
                <p className="text-xs text-muted-foreground">{it.store ? `${it.store} · ` : ""}Qté {it.quantity} · {it.unit_price_est} € / u
                  {it.product_url ? <a href={it.product_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-accent hover:underline">lien <ExternalLink className="h-3 w-3" /></a> : null}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {order.quote && (
        <Card className="rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="proxy-quote"><CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Devis</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Articles</span><span>{q.items_total_eur} €</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Commission ({q.commission_percent}% · min {q.commission_min_eur} €)</span><span>{q.commission_eur} €</span></div>
            <div className="my-2 h-px bg-border" />
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{q.total_eur} € · {q.total_xof} FCFA</span></div>
            <p className="text-xs text-muted-foreground">Taux : 1 € = {q.eur_xof_rate} FCFA</p>
          </div>
          {order.status === "QUOTED" && !payment && (
            <Button onClick={startPay} disabled={busy} data-testid="proxy-pay-btn" className="mt-4 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]"><CreditCard className="mr-1.5 h-4 w-4" /> Payer</Button>
          )}
          {payment && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="proxy-payment-sim">
              <p className="mb-3 text-sm text-muted-foreground">Paiement simulé — {payment.amount} {payment.currency}</p>
              <div className="flex gap-2">
                <Button onClick={() => simulate("success")} disabled={busy} data-testid="proxy-sim-success" className="flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Simuler succès</Button>
                <Button onClick={() => simulate("failure")} disabled={busy} data-testid="proxy-sim-failure" variant="outline" className="flex-1 rounded-xl"><XCircle className="mr-1.5 h-4 w-4" /> Simuler échec</Button>
              </div>
            </div>
          )}
        </CardContent></Card>
      )}

      {order.received_weight_kg && (
        <Card className="rounded-2xl border-border shadow-card" data-testid="proxy-hub-card"><CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Réception au hub</h3>
          <p className="text-sm text-muted-foreground">Poids reçu : <span className="font-semibold text-foreground">{order.received_weight_kg} kg</span></p>
          {order.received_photo && <img src={order.received_photo} alt="Commande reçue au hub" className="mt-3 max-h-56 rounded-xl border border-border object-cover" />}
          {order.shipment_id ? (
            <div className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="proxy-shipment-box">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{shipment?.reference || "Expédition"}</span>
                {shipment && <StatusBadge status={shipment.status} />}
              </div>
              {shipment && <p className="mt-1 text-sm text-muted-foreground">{shipment.cost_eur} € · {shipment.cost_xof} FCFA</p>}
              {shipment?.status === "AWAITING_PAYMENT" ? (
                <>
                  <p className="mt-2 text-xs font-medium text-amber-600">Réglez la facture d'expédition pour lancer l'envoi vers le Bénin.</p>
                  <Button onClick={() => navigate(`/client/shipments/${order.shipment_id}`)} data-testid="proxy-pay-shipment" className="mt-3 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]"><CreditCard className="mr-1.5 h-4 w-4" /> Payer l'expédition</Button>
                </>
              ) : (
                <Button onClick={() => navigate(`/client/shipments/${order.shipment_id}`)} data-testid="proxy-view-shipment" variant="outline" className="mt-3 w-full rounded-xl"><Ship className="mr-1.5 h-4 w-4" /> Voir l'expédition</Button>
              )}
            </div>
          ) : order.status === "RECEIVED" ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold">Valider l'expédition vers le Bénin</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <select data-testid="proxy-zone-select" value={zoneId} onChange={(e) => { setZoneId(e.target.value); setShipQuote(null); }} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">Zone de livraison…</option>
                  {zones.map((z) => (<option key={z.id} value={z.id}>{z.name} ({z.delivery_mode === "HOME" ? "Domicile" : "Point relais"})</option>))}
                </select>
                <select data-testid="proxy-transport-select" value={transport} onChange={(e) => { setTransport(e.target.value); setShipQuote(null); }} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="AIR">Aérien (2–3 jours)</option><option value="SEA">Maritime</option>
                </select>
              </div>
              {!shipQuote ? (
                <Button onClick={getShipQuote} disabled={busy} data-testid="proxy-ship-quote-btn" variant="outline" className="rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Obtenir un devis"}</Button>
              ) : (
                <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm" data-testid="proxy-ship-quote">
                  <div className="flex justify-between"><span className="text-muted-foreground">Transport ({shipQuote.total_billable_weight_kg} kg)</span><span>{shipQuote.transport_eur} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Livraison locale</span><span>{shipQuote.delivery_fee_xof} FCFA</span></div>
                  <div className="my-2 h-px bg-border" />
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span>{shipQuote.total_eur} € · {shipQuote.total_xof} FCFA</span></div>
                  <Button onClick={confirmShip} disabled={busy} data-testid="proxy-confirm-ship-btn" className="mt-3 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">Valider et créer l'expédition</Button>
                </div>
              )}
            </div>
          ) : null}
        </CardContent></Card>
      )}

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Suivi</h3>
        <ol className="relative space-y-4 border-l-2 border-border pl-5" data-testid="proxy-history">
          {(order.history || []).map((e, i) => (
            <li key={i} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" /><p className="text-sm font-medium text-foreground">{STATUS_LABELS[e.to_status] || e.to_status}</p><p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</p></li>
          ))}
        </ol>
      </CardContent></Card>
    </div>
  );
}
