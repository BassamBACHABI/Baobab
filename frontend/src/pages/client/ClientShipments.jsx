import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ship, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientShipments() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/me/shipments"); setList(data); }
      catch { toast.error("Erreur de chargement."); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Mes expéditions" subtitle="Vos expéditions par avion vers le Bénin (2–3 jours)." action={
        <Button className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]" data-testid="new-shipment-btn" onClick={() => navigate("/client/shipments/new")}><Plus className="mr-1.5 h-4 w-4" /> Nouvelle expédition</Button>
      } />
      {loading ? <ListSkeleton rows={3} /> : list.length === 0 ? (
        <EmptyState icon={Ship} testId="client-shipments-empty" title="Aucune expédition" description="Créez une expédition à partir de vos colis stockés." />
      ) : (
        <div className="space-y-3" data-testid="shipments-list">
          {list.map((s) => (
            <button key={s.id} data-testid={`shipment-${s.reference}`} onClick={() => navigate(`/client/shipments/${s.id}`)} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/40">
              <div className="flex items-center justify-between"><span className="font-mono font-semibold">{s.reference}</span><StatusBadge status={s.status} /></div>
              <p className="mt-1 text-sm text-muted-foreground">{s.destination_city} · {s.cost_eur} € · {s.cost_xof} FCFA</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
