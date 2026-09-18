import { Link } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Scale,
  Plane,
  ShieldCheck,
  Package,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const STEPS = [
  {
    icon: MapPin,
    title: "Votre adresse en Europe",
    text: "Recevez une adresse de réception avec votre référence client unique. Faites-y livrer tous vos achats.",
  },
  {
    icon: Scale,
    title: "Réception & pesée au hub",
    text: "Dès l'arrivée de vos colis, nous les enregistrons et les pesons dans notre entrepôt en France.",
  },
  {
    icon: Plane,
    title: "Livraison par avion",
    text: "Réglez les frais d'expédition et recevez vos colis au Bénin par avion, en seulement 2 à 3 jours après l'envoi.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              asChild
              variant="ghost"
              className="hidden rounded-xl sm:inline-flex"
              data-testid="landing-admin-link"
            >
              <Link to="/login">Back-office</Link>
            </Button>
            <Button
              asChild
              className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]"
              data-testid="landing-client-cta"
            >
              <Link to="/login">Espace client</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Transit de colis · Europe → Bénin
              </p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Faites venir vos achats d'Europe
                <span className="text-accent"> jusqu'au Bénin</span>, en toute
                confiance.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                Achetez où vous voulez en Europe, livrez à votre adresse de
                réception, et laissez-nous acheminer vos colis
                <span className="font-semibold text-foreground"> par avion, en 2 à 3 jours</span>.
                Réception, pesée, expédition et suivi — tout au même endroit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl bg-accent px-7 text-base text-white shadow-cta hover:bg-[#D45A2C]"
                  data-testid="hero-client-cta"
                >
                  <Link to="/login">
                    Commencer <ArrowRight className="ml-1.5 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-7 text-base"
                  data-testid="hero-admin-cta"
                >
                  <Link to="/login">
                    <LayoutDashboard className="mr-1.5 h-5 w-5" /> Back-office
                  </Link>
                </Button>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Livraison par avion en 2–3 jours · Tarifs en EUR et FCFA
              </div>
            </div>

            <div className="relative animate-fade-up">
              <div className="overflow-hidden rounded-3xl border border-border shadow-card">
                <img
                  src="https://images.unsplash.com/photo-1774698078446-59299e016718?crop=entropy&cs=srgb&fm=jpg&q=85&w=940&h=650&fit=crop"
                  alt="Avion cargo en cours de chargement sur le tarmac"
                  className="h-full max-h-[420px] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Comment ça marche
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Trois étapes simples, de l'Europe à votre porte
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                data-testid={`landing-step-${i}`}
                className="rounded-2xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-bold text-accent">
                    0{i + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-[#0B2046] p-8 text-white sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Prêt à recevoir vos colis au Bénin ?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Créez votre espace client et obtenez votre adresse de
                  réception en Europe.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-accent px-8 text-base text-white shadow-cta hover:bg-[#D45A2C]"
                data-testid="cta-band-client"
              >
                <Link to="/login">
                  <Package className="mr-1.5 h-5 w-5" /> Accéder à mon espace
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Baobab Cargo · Transit Europe → Bénin
          </p>
        </div>
      </footer>
    </div>
  );
}
