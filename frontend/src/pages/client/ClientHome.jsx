import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Truck, CheckCircle2, MapPin, Copy, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = [
  "Copiez l'adresse du hub et ajoutez votre référence client sur la ligne « nom » ou « complément d'adresse ».",
  "Faites livrer vos achats à cette adresse en Europe.",
  "Nous réceptionnons, pesons et expédions vos colis par avion vers le Bénin.",
];

export default function ClientHome() {
  const [fwd, setFwd] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [f, p] = await Promise.all([api.get("/me/forwarding-address"), api.get("/me/packages")]);
        setFwd(f.data?.[0] || null);
        setPackages(p.data || []);
      } catch {
        toast.error("Impossible de charger vos données.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = {
    pending: packages.filter((p) => p.status === "EXPECTED").length,
    received: packages.filter((p) => ["RECEIVED", "INSPECTED", "STORED"].includes(p.status)).length,
    ready: packages.filter((p) => p.status === "READY_TO_SHIP").length,
  };

  const addressText = fwd?.hub
    ? `${fwd.hub.name}\n${fwd.customer_reference}\n${fwd.hub.address_line}\n${fwd.hub.postal_code} ${fwd.hub.city}`
    : "";

  const copy = () => {
    navigator.clipboard?.writeText(addressText);
    setCopied(true);
    toast.success("Adresse copiée");
    setTimeout(() => setCopied(false), 1500);
  };

  const stats = [
    { label: "En attente", value: counts.pending, icon: Package },
    { label: "Reçus au hub", value: counts.received, icon: Truck },
    { label: "Prêts à expédier", value: counts.ready, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Bonjour 👋" title="Mon espace" subtitle="Votre adresse de réception et le suivi de vos colis." />

      <Card className="overflow-hidden rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="reception-address-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">Mon adresse de réception</h3>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={copy} data-testid="copy-address-btn">
                  {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} Copier l'adresse
                </Button>
              </div>
              {loading ? (
                <Skeleton className="mt-3 h-24 w-full rounded-xl" />
              ) : fwd?.hub ? (
                <div className="mt-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
                  <p className="font-semibold text-foreground">{fwd.hub.name}</p>
                  <p className="my-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Nom / réf. :</span>
                    <span className="rounded-lg bg-accent px-2 py-0.5 font-mono text-sm font-bold text-white" data-testid="reception-reference">{fwd.customer_reference}</span>
                  </p>
                  <p className="text-muted-foreground">{fwd.hub.address_line}</p>
                  <p className="text-muted-foreground">{fwd.hub.postal_code} {fwd.hub.city}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Votre adresse arrive bientôt.</p>
              )}
              <ol className="mt-4 space-y-2">
                {STEPS.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border shadow-card">
            <CardContent className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-foreground">Frais à régler</p>
            <p className="text-xs text-muted-foreground">Aucun montant à régler pour l'instant.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-lg font-bold text-foreground">0,00 €</p><p className="text-[10px] uppercase text-muted-foreground">EUR</p></div>
            <div className="text-right"><p className="text-lg font-bold text-foreground">0 FCFA</p><p className="text-[10px] uppercase text-muted-foreground">XOF</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button asChild variant="outline" className="rounded-xl" data-testid="home-view-parcels">
          <Link to="/client/parcels"><ShoppingBag className="mr-1.5 h-4 w-4" /> Voir mes colis</Link>
        </Button>
      </div>
    </div>
  );
}
