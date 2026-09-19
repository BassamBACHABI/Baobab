import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminProxy() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/admin/proxy-orders"); setList(data); }
      catch { toast.error("Erreur de chargement."); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Back-office" title="Achats proxy" subtitle="Demandes d'achat des clients : devis, paiement et réception." />
      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : list.length === 0 ? (
        <EmptyState icon={ShoppingBag} testId="admin-proxy-empty" title="Aucune demande d'achat" description="Les demandes proxy des clients apparaîtront ici." />
      ) : (
        <div className="space-y-3" data-testid="admin-proxy-list">
          {list.map((o) => (
            <Card key={o.id} className="cursor-pointer rounded-2xl border-border hover:bg-secondary/40" onClick={() => navigate(`/admin/proxy/${o.id}`)} data-testid={`admin-proxy-${o.reference}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2"><span className="font-mono font-semibold">{o.reference}</span><StatusBadge status={o.status} /></div>
                  <p className="text-sm text-muted-foreground">{o.client_name || "—"} · {o.items?.length || 0} article(s){o.total_eur ? ` · ${o.total_eur} €` : ""}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
