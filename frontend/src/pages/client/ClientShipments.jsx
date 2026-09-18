import { Ship } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function ClientShipments() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mes expéditions"
        subtitle="Suivez vos expéditions par avion et l'acheminement de vos colis jusqu'au Bénin, avec une livraison en 2 à 3 jours."
      />
      <EmptyState
        icon={Ship}
        testId="client-shipments-empty"
        title="Aucune expédition en cours"
        description="Dès que vos colis seront prêts, vous pourrez demander une expédition par avion (réception en 2 à 3 jours). Elle apparaîtra ici avec son suivi détaillé."
      />
    </div>
  );
}
