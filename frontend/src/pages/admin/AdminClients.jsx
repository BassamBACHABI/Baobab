import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function AdminClients() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Clients"
        subtitle="Gérez les clients du service de transit et leurs références de réception."
      />
      <EmptyState
        icon={UserPlus}
        testId="admin-clients-empty"
        title="Aucun client enregistré"
        description="Les nouveaux inscrits au service de transit s'afficheront ici avec leurs coordonnées et leur historique."
      />
    </div>
  );
}
