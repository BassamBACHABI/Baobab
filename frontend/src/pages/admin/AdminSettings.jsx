import { Settings, Coins, Boxes, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { icon: Coins, title: "Taux de change EUR / XOF", text: "Parité modifiable, stockée en base." },
  { icon: Boxes, title: "Tarifs & zones", text: "Grilles tarifaires par zone et par poids." },
  { icon: Warehouse, title: "Hubs de réception", text: "Adresses de réception par pays." },
];

export default function AdminSettings() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        subtitle="Configurez les taux de change, les tarifs, les zones et les hubs. Ces réglages seront disponibles prochainement."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="rounded-2xl border-border shadow-card">
            <CardContent className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {s.text}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={Settings}
        testId="admin-settings-empty"
        title="Paramètres à venir"
        description="Les réglages détaillés (taux de change, tarifs, zones, diviseur volumétrique) seront activés dans une prochaine étape."
      />
    </div>
  );
}
