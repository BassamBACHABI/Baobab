import { Package, Truck, CheckCircle2, MapPin, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

const STATS = [
  { label: "Colis reçus", value: "—", icon: Package },
  { label: "En transit", value: "—", icon: Truck },
  { label: "Livrés", value: "—", icon: CheckCircle2 },
];

export default function ClientHome() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bonjour 👋"
        title="Bienvenue sur votre espace"
        subtitle="Suivez la réception, l'expédition et la livraison de vos colis, de l'Europe jusqu'au Bénin."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border-dashed border-accent/40 bg-accent/5 shadow-none">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Votre adresse de réception arrive bientôt
              </h3>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Dès que votre compte sera activé, vous obtiendrez une adresse en
                Europe avec votre référence client unique à utiliser pour vos
                achats.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">
          Vos colis récents
        </h2>
        <EmptyState
          icon={Package}
          testId="client-home-empty"
          title="Aucun colis enregistré pour le moment"
          description="Lorsque vos paquets arriveront à notre entrepôt en Europe, ils apparaîtront ici avec leur statut en direct."
        />
      </div>
    </div>
  );
}
