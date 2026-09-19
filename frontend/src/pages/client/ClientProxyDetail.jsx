import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
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

  const load = async () => {
    try { const { data } = await api.get(`/me/proxy-orders/${id}`); setOrder(data); }
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
