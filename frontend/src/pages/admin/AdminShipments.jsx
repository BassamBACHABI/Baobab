import { Ship } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function AdminShipments() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Expéditions"
        subtitle="Traitez les demandes d'expédition par avion, calculez les frais et suivez l'acheminement jusqu'au Bénin (2 à 3 jours)."
      />
      <EmptyState
        icon={Ship}
        testId="admin-shipments-empty"
        title="Aucune expédition à traiter"
        description="Les demandes d'expédition des clients apparaîtront ici. Vous pourrez confirmer les frais, les paiements et les statuts d'acheminement."
      />
    </div>
  );
}
