import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ship } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminShipments() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/admin/shipments"); setList(data); }
      catch { toast.error("Erreur de chargement."); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Back-office" title="Expéditions" subtitle="Gérez les expéditions, transporteurs, statuts et coûts." />
      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : list.length === 0 ? (
        <EmptyState icon={Ship} testId="admin-shipments-empty" title="Aucune expédition" description="Les expéditions créées par les clients apparaîtront ici." />
      ) : (
        <div className="space-y-3" data-testid="admin-shipments-list">
          {list.map((s) => (
            <Card key={s.id} className="cursor-pointer rounded-2xl border-border hover:bg-secondary/40" onClick={() => navigate(`/admin/shipments/${s.id}`)} data-testid={`admin-shipment-${s.reference}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div><div className="flex items-center gap-2"><span className="font-mono font-semibold">{s.reference}</span><StatusBadge status={s.status} /></div><p className="text-sm text-muted-foreground">{s.destination_city} · {s.cost_eur} € · {s.cost_xof} FCFA</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
