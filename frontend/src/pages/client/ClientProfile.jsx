import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, LogOut, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientProfile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, f] = await Promise.all([
          api.get("/me/profile"),
          api.get("/me/forwarding-address"),
        ]);
        setProfile(p.data);
        setForwarding(f.data?.[0] || null);
      } catch {
        toast.error("Impossible de charger votre profil.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyRef = () => {
    if (!forwarding?.customer_reference) return;
    navigator.clipboard?.writeText(forwarding.customer_reference);
    setCopied(true);
    toast.success("Référence copiée");
    setTimeout(() => setCopied(false), 1500);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const fields = [
    { icon: User, label: "Nom complet", value: profile && `${profile.first_name || ""} ${profile.last_name || ""}`.trim() },
    { icon: Mail, label: "Adresse e-mail", value: profile?.email },
    { icon: Phone, label: "Téléphone", value: profile?.phone },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mon profil"
        subtitle="Vos informations personnelles et votre adresse de réception en Europe."
        action={
          <Button variant="outline" className="rounded-xl" onClick={doLogout} data-testid="logout-btn">
            <LogOut className="mr-1.5 h-4 w-4" /> Déconnexion
          </Button>
        }
      />

      {/* Adresse de réception + référence client */}
      <Card className="overflow-hidden rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="forwarding-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">Votre adresse de réception</h3>
              {loading ? (
                <Skeleton className="mt-3 h-20 w-full rounded-xl" />
              ) : forwarding ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Référence client :</span>
                    <span className="rounded-lg bg-accent px-2.5 py-1 font-mono text-sm font-bold text-white" data-testid="customer-reference">
                      {forwarding.customer_reference}
                    </span>
                    <button onClick={copyRef} className="text-muted-foreground hover:text-accent" aria-label="Copier la référence" data-testid="copy-reference-btn">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {forwarding.hub && (
                    <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
                      <p className="font-semibold text-foreground">{forwarding.hub.name}</p>
                      <p className="text-muted-foreground">{forwarding.hub.address_line}</p>
                      <p className="text-muted-foreground">
                        {forwarding.hub.postal_code} {forwarding.hub.city}
                      </p>
                      <p className="mt-2 text-xs text-accent">
                        Ajoutez votre référence {forwarding.customer_reference} au nom du destinataire lors de vos achats.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Votre adresse de réception sera disponible très bientôt.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="divide-y divide-border p-0">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-4 p-5" data-testid={`profile-field-${f.label}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</p>
                {loading ? (
                  <Skeleton className="mt-2 h-4 w-40 rounded-md" />
                ) : (
                  <p className="mt-1 text-sm font-medium text-foreground">{f.value || "—"}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
