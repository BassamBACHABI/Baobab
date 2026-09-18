import { Users, PackageCheck, Ship, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

const STATS = [
  { label: "Clients actifs", value: "—", icon: Users },
  { label: "Colis au hub", value: "—", icon: PackageCheck },
  { label: "Expéditions en cours", value: "—", icon: Ship },
  { label: "Encaissé (EUR)", value: "—", icon: Wallet },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Back-office"
        title="Tableau de bord"
        subtitle="Vue d'ensemble de l'activité : clients, colis reçus, expéditions et paiements."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
                <s.icon className="h-4 w-4 text-accent" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={PackageCheck}
        testId="admin-dashboard-empty"
        title="Aucune activité à afficher"
        description="Les réceptions de colis, pesées et expéditions saisies au back-office apparaîtront ici sous forme de synthèse."
      />
    </div>
  );
}
