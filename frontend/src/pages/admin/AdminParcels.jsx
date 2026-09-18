import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function AdminParcels() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Colis"
        subtitle="Enregistrez les réceptions et les pesées des colis arrivés au hub européen."
      />
      <EmptyState
        icon={PackageCheck}
        testId="admin-parcels-empty"
        title="Aucun colis enregistré"
        description="Les colis réceptionnés au hub apparaîtront ici. Vous pourrez saisir leur poids, leurs dimensions et les rattacher à un client."
      />
    </div>
  );
}
