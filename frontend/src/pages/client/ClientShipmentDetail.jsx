import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ship, setShip] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, t] = await Promise.all([api.get(`/me/shipments/${id}`), api.get(`/me/shipments/${id}/tracking`)]);
      setShip(s.data); setTracking(t.data);
    } catch { toast.error("Expédition introuvable."); navigate("/client/shipments"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const startPay = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/me/shipments/${id}/pay`); setPayment(data); }
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

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  if (!ship) return null;
  const snap = ship.tariff_snapshot || {};

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/client/shipments")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Expéditions</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-mono text-2xl font-bold text-foreground">{ship.reference}</h1><p className="text-sm text-muted-foreground">{ship.destination_city} · {ship.transport_mode === "AIR" ? "Aérien" : "Maritime"}</p></div>
        <StatusBadge status={ship.status} />
      </div>

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Montant</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Transport</span><span>{snap.transport_eur} €</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Livraison locale</span><span>{snap.delivery_fee_xof} FCFA</span></div>
          <div className="my-2 h-px bg-border" />
          <div className="flex justify-between text-base font-bold"><span>Total</span><span>{ship.cost_eur} € · {ship.cost_xof} FCFA</span></div>
        </div>
        {ship.status === "AWAITING_PAYMENT" && !payment && (
          <Button onClick={startPay} disabled={busy} data-testid="pay-btn" className="mt-4 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]"><CreditCard className="mr-1.5 h-4 w-4" /> Payer</Button>
        )}
        {payment && (
          <div className="mt-4 rounded-xl border border-border p-4" data-testid="payment-sim">
            <p className="mb-3 text-sm text-muted-foreground">Paiement simulé — {payment.amount} {payment.currency}</p>
            <div className="flex gap-2">
              <Button onClick={() => simulate("success")} disabled={busy} data-testid="sim-success" className="flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Simuler succès</Button>
              <Button onClick={() => simulate("failure")} disabled={busy} data-testid="sim-failure" variant="outline" className="flex-1 rounded-xl"><XCircle className="mr-1.5 h-4 w-4" /> Simuler échec</Button>
            </div>
          </div>
        )}
      </CardContent></Card>

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Suivi</h3>
        {tracking.length === 0 ? <p className="text-sm text-muted-foreground">Aucun événement de suivi pour l'instant.</p> : (
          <ol className="relative space-y-4 border-l-2 border-border pl-5" data-testid="tracking-timeline">
            {tracking.map((e, i) => (<li key={i} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" /><p className="text-sm font-medium text-foreground">{STATUS_LABELS[e.status] || e.message || e.status}</p><p className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString("fr-FR")}</p></li>))}
          </ol>
        )}
      </CardContent></Card>
    </div>
  );
}
