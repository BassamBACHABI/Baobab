import { Ship } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function ClientShipments() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mes expéditions"
        subtitle="Suivez vos demandes d'expédition et l'acheminement de vos colis jusqu'au Bénin."
      />
      <EmptyState
        icon={Ship}
        testId="client-shipments-empty"
        title="Aucune expédition en cours"
        description="Dès que vos colis seront prêts, vous pourrez demander une expédition. Elle apparaîtra ici avec son suivi détaillé."
      />
    </div>
  );
}
