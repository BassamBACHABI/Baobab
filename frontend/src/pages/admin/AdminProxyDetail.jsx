import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Calculator, PackageCheck, Ban, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminProxyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const { data } = await api.get(`/admin/proxy-orders/${id}`); setOrder(data); }
    catch { toast.error("Introuvable."); navigate("/admin/proxy"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  if (!order) return null;
  const q = order.quote || {};

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/admin/proxy")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Achats proxy</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{order.reference}</h1>
          <p className="text-sm text-muted-foreground">{order.client ? `${order.client.first_name} ${order.client.last_name}` : "—"}{order.customer_reference ? ` · ${order.customer_reference}` : ""}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border"><CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Articles demandés</h3>
          {(order.items || []).map((it, i) => (
            <div key={i} className="border-t border-border py-2 text-sm first:border-0">
              <p className="font-medium">{it.name} {it.variant ? <span className="text-muted-foreground">· {it.variant}</span> : null}</p>
              <p className="text-xs text-muted-foreground">{it.store ? `${it.store} · ` : ""}Qté {it.quantity} · {it.unit_price_est} € / u
                {it.product_url ? <a href={it.product_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-accent hover:underline">lien <ExternalLink className="h-3 w-3" /></a> : null}</p>
              {it.notes ? <p className="text-xs text-muted-foreground">Note : {it.notes}</p> : null}
            </div>
          ))}
          {order.notes ? <p className="mt-3 rounded-lg bg-secondary/50 p-2 text-xs text-muted-foreground">Note client : {order.notes}</p> : null}
        </CardContent></Card>

        <Card className="rounded-2xl border-border"><CardContent className="space-y-4 p-5">
          <h3 className="text-sm font-semibold">Devis & actions</h3>
          {order.quote ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Articles</span><span>{q.items_total_eur} €</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Commission ({q.commission_percent}% · min {q.commission_min_eur} €)</span><span>{q.commission_eur} €</span></div>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{q.total_eur} € · {q.total_xof} FCFA</span></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Aucun devis. Calculez le devis (articles + commission).</p>}

          <div className="flex flex-wrap gap-2">
            {["REQUESTED", "QUOTED"].includes(order.status) && (
              <Button onClick={() => act(() => api.post(`/admin/proxy-orders/${id}/quote`), "Devis établi")} disabled={busy} data-testid="proxy-quote-btn" className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="mr-1.5 h-4 w-4" /> {order.quote ? "Recalculer" : "Calculer le devis"}</>}
              </Button>
            )}
            {order.status === "PAID" && (
              <Button onClick={() => act(() => api.post(`/admin/proxy-orders/${id}/receive`, {}), "Marqué reçu au hub")} disabled={busy} data-testid="proxy-receive-btn" variant="outline" className="rounded-xl">
                <PackageCheck className="mr-1.5 h-4 w-4" /> Marquer reçu au hub
              </Button>
            )}
            {!["RECEIVED", "CANCELLED"].includes(order.status) && (
              <Button onClick={() => act(() => api.post(`/admin/proxy-orders/${id}/cancel`), "Annulée")} disabled={busy} data-testid="proxy-cancel-btn" variant="outline" className="rounded-xl text-red-600">
                <Ban className="mr-1.5 h-4 w-4" /> Annuler
              </Button>
            )}
          </div>
          {order.status === "PAID" && (
            <p className="text-xs text-muted-foreground">Astuce : réceptionnez les articles comme un colis normal (référence {order.customer_reference || "client"}) dans « Colis », puis marquez la commande reçue.</p>
          )}
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl border-border"><CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Suivi</h3>
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {(order.history || []).map((e, i) => (<li key={i} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" /><p className="text-sm font-medium">{STATUS_LABELS[e.to_status] || e.to_status}</p><p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</p></li>))}
        </ol>
      </CardContent></Card>
    </div>
  );
}
