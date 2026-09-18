import { User, Mail, Phone, MapPin } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const FIELDS = [
  { icon: User, label: "Nom complet" },
  { icon: Mail, label: "Adresse e-mail" },
  { icon: Phone, label: "Téléphone" },
  { icon: MapPin, label: "Adresse de livraison au Bénin" },
];

export default function ClientProfile() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mon profil"
        subtitle="Vos informations personnelles et votre référence client apparaîtront ici une fois votre compte activé."
      />
      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="divide-y divide-border p-0">
          {FIELDS.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-4 p-5"
              data-testid={`profile-field-${f.label}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </p>
                <Skeleton className="mt-2 h-4 w-40 rounded-md" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
