import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientPackageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(null);
  const [history, setHistory] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, h, ph, it] = await Promise.all([
          api.get(`/me/packages/${id}`), api.get(`/me/packages/${id}/history`),
          api.get(`/me/packages/${id}/photos`), api.get(`/me/packages/${id}/items`),
        ]);
        setPkg(p.data); setHistory(h.data); setPhotos(ph.data); setItems(it.data);
      } catch {
        toast.error("Colis introuvable."); navigate("/client/parcels");
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  if (!pkg) return null;

  const specs = [
    ["Poids réel", pkg.weight_kg ? `${pkg.weight_kg} kg` : "—"],
    ["Dimensions", pkg.length_cm ? `${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm` : "—"],
    ["Poids volumétrique", pkg.volumetric_weight_kg ? `${pkg.volumetric_weight_kg} kg` : "—"],
    ["Poids facturable", pkg.billable_weight_kg ? `${pkg.billable_weight_kg} kg` : "—"],
    ["Valeur déclarée", pkg.declared_value ? `${pkg.declared_value} €` : "—"],
    ["Contenu", pkg.content_category || "—"],
  ];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/client/parcels")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="detail-back">
        <ArrowLeft className="h-4 w-4" /> Mes colis
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-foreground">{pkg.reference}</h1>
          <p className="text-sm text-muted-foreground">{pkg.merchant_name || "—"}</p>
        </div>
        <StatusBadge status={pkg.status} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" data-testid="detail-photos">
          {photos.map((ph) => (<img key={ph.id} src={ph.url} alt="colis" className="aspect-square w-full rounded-xl border border-border object-cover" />))}
        </div>
      )}

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        {specs.map(([k, v]) => (<div key={k}><p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p><p className="mt-1 text-sm font-semibold text-foreground">{v}</p></div>))}
      </CardContent></Card>

      {items.length > 0 && (
        <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Contenu déclaré</h3>
          {items.map((it) => (<div key={it.id} className="flex justify-between border-t border-border py-2 text-sm first:border-0"><span>{it.description} × {it.quantity}</span><span className="text-muted-foreground">{it.declared_unit_value} €</span></div>))}
        </CardContent></Card>
      )}

      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Historique des statuts</h3>
        <ol className="relative space-y-4 border-l-2 border-border pl-5" data-testid="status-timeline">
          {history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" />
              <p className="text-sm font-medium text-foreground">{STATUS_LABELS[h.to_status] || h.to_status}</p>
              <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}{h.reason ? ` · ${h.reason}` : ""}</p>
            </li>
          ))}
        </ol>
      </CardContent></Card>
    </div>
  );
}
