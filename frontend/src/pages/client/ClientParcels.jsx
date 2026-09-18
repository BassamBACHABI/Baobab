import { PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function ClientParcels() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mes colis"
        subtitle="Retrouvez ici tous les colis reçus à notre hub européen, avec leur poids et leur statut."
      />
      <EmptyState
        icon={PackageOpen}
        testId="client-parcels-empty"
        title="Aucun colis enregistré pour le moment"
        description="Lorsque vous ferez livrer vos achats à votre adresse de réception en Europe, ils apparaîtront ici après réception et pesée au hub."
      />
    </div>
  );
}
