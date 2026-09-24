import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ArrowRight,
  MapPin,
  Scale,
  Plane,
  ShieldCheck,
  Package,
  Wallet,
  BellRing,
  Camera,
  Clock,
  Calculator,
  CheckCircle2,
  Quote,
  Plus,
  Minus,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const IMG = {
  hero: "https://images.unsplash.com/photo-1774698078446-59299e016718?crop=entropy&cs=srgb&fm=jpg&q=85&w=1040&h=760&fit=crop",
  warehouse: "https://images.unsplash.com/photo-1781559818983-c32838ee3d55?crop=entropy&cs=srgb&fm=jpg&q=85&w=900&h=700&fit=crop",
  boxes: "https://images.unsplash.com/photo-1624137527136-66e631bdaa0e?crop=entropy&cs=srgb&fm=jpg&q=85&w=900&h=700&fit=crop",
  phone: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?crop=entropy&cs=srgb&fm=jpg&q=85&w=900&h=700&fit=crop",
  customer: "https://images.pexels.com/photos/6868624/pexels-photo-6868624.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=760&w=1040",
  proxy: "https://images.unsplash.com/photo-1733503747506-773e56e4078f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1040&h=760&fit=crop",
};

const STATS = [
  { value: "2–3 jours", label: "Livraison par avion après envoi" },
  { value: "655,957", label: "FCFA pour 1 € (parité affichée)" },
  { value: "Temps réel", label: "Suivi de chaque colis + notifications" },
  { value: "EUR & FCFA", label: "Devis transparent dans les deux devises" },
];

const FEATURES = [
  { icon: MapPin, title: "Une adresse en Europe", text: "Recevez une adresse de réception avec votre référence client unique et faites-y livrer tous vos achats." },
  { icon: Calculator, title: "Tarif transparent", text: "Coût calculé au poids facturable (réel ou volumétrique), affiché en euros et en francs CFA avant paiement." },
  { icon: BellRing, title: "Suivi & notifications", text: "Frise de suivi en temps réel, e-mails et notifications push à chaque étape jusqu'à la livraison." },
  { icon: Camera, title: "Sécurité & photos", text: "Photos de vos colis au hub, pesée officielle et historique complet des statuts, isolés et privés." },
];

const STEPS = [
  { icon: MapPin, title: "Votre adresse en Europe", text: "Créez votre espace et obtenez une adresse de réception avec votre référence client. Commandez où vous voulez." },
  { icon: Scale, title: "Réception & pesée au hub", text: "À l'arrivée, nous enregistrons, pesons et prenons en photo vos colis dans notre entrepôt en France." },
  { icon: Plane, title: "Expédition & livraison au Bénin", text: "Validez le devis, payez, et recevez vos colis par avion en 2 à 3 jours, au point relais ou à domicile." },
];

const SERVICES = [
  {
    img: IMG.boxes,
    eyebrow: "Consolidation",
    title: "Regroupez vos achats en un seul envoi",
    text: "Faites livrer plusieurs commandes à votre adresse de réception : nous les regroupons pour optimiser le poids et réduire vos frais d'expédition vers le Bénin.",
    points: ["Achats multi-boutiques", "Poids facturable optimisé", "Un seul règlement"],
  },
  {
    img: IMG.warehouse,
    eyebrow: "Réception & pesée",
    title: "Un hub qui prend soin de vos colis",
    text: "Chaque colis est enregistré, pesé (poids réel et volumétrique) et photographié. Vous savez exactement ce qui est arrivé et ce que vous payez.",
    points: ["Pesée officielle", "Photos privées au hub", "Historique des statuts"],
    reverse: true,
  },
  {
    img: IMG.phone,
    eyebrow: "Suivi en temps réel",
    title: "Suivez tout depuis votre téléphone",
    text: "Application installable (PWA) : suivez vos colis et expéditions, recevez des notifications push et payez en ligne — même hors connexion pour consulter l'essentiel.",
    points: ["Notifications push", "Devis EUR / FCFA", "Installable sur mobile"],
  },
];

const REVIEWS = [
  { name: "Awa S.", city: "Cotonou", rating: 5, text: "Je commande sur mes boutiques européennes et je reçois tout à Cotonou en quelques jours. Le suivi et les prix en FCFA me rassurent." },
  { name: "Koffi A.", city: "Porto-Novo", rating: 5, text: "Service impeccable : mes colis sont pesés, pris en photo, et j'ai payé en ligne sans souci. Je recommande vivement." },
  { name: "Rachidatou B.", city: "Parakou", rating: 4, text: "Très bonne expérience. Livraison rapide par avion. J'aurais aimé encore plus d'options de paiement, ça arrive bientôt paraît-il." },
  { name: "Marius H.", city: "Abomey-Calavi", rating: 5, text: "Ils ont acheté mes articles pour moi en Europe puis tout expédié. Un vrai gain de temps, tout était transparent." },
  { name: "Grâce D.", city: "Cotonou", rating: 4, text: "Interface claire et notifications à chaque étape. Mes colis sont arrivés en parfait état." },
  { name: "Ismaël T.", city: "Bohicon", rating: 5, text: "Enfin un service fiable pour recevoir mes achats d'Europe au Bénin. Les tarifs sont clairs dès le départ." },
];

const FAQ = [
  { q: "Comment obtenir mon adresse de réception en Europe ?", a: "Créez votre espace client : une adresse de réception et une référence client unique vous sont attribuées immédiatement. Ajoutez cette référence au nom du destinataire lors de vos achats." },
  { q: "Comment le coût d'expédition est-il calculé ?", a: "Nous appliquons le poids facturable, c'est-à-dire le plus élevé entre le poids réel et le poids volumétrique (L×l×H ÷ diviseur). Le devis s'affiche en euros et en francs CFA avant tout paiement, et reste figé une fois validé." },
  { q: "Quels sont les délais de livraison ?", a: "L'acheminement se fait principalement par avion : comptez 2 à 3 jours après l'envoi depuis notre hub, puis la livraison au point relais ou à domicile au Bénin." },
  { q: "Comment se passe le paiement ?", a: "Vous réglez votre expédition en ligne. Le paiement par Mobile Money (MTN, Moov) et carte arrive prochainement ; la confirmation est traitée de manière sécurisée côté serveur." },
  { q: "Mes colis et mes données sont-ils protégés ?", a: "Oui. Chaque client ne voit que ses propres colis et expéditions. Les photos et informations sont privées, et l'accès est strictement contrôlé côté serveur." },
];

function FaqItem({ item, open, onToggle, index }) {
  return (
    <div className="border-b border-border" data-testid={`faq-item-${index}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        data-testid={`faq-toggle-${index}`}
      >
        <span className="text-base font-semibold text-foreground">{item.q}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <p className="pb-5 pr-10 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
      )}
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(0);
  const [tariffs, setTariffs] = useState([]);

  useEffect(() => {
    api.get("/public/tariffs").then(({ data }) => setTariffs(data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]" data-testid="landing-client-cta">
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
                <span className="text-accent"> jusqu'au Bénin</span>, en toute confiance.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                Achetez où vous voulez en Europe, livrez à votre adresse de réception, et
                laissez-nous acheminer vos colis
                <span className="font-semibold text-foreground"> par avion, en 2 à 3 jours</span>.
                Réception, pesée, expédition et suivi — tout au même endroit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-accent px-7 text-base text-white shadow-cta hover:bg-[#D45A2C]" data-testid="hero-client-cta">
                  <Link to="/login">Commencer <ArrowRight className="ml-1.5 h-5 w-5" /></Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Colis assurés & photographiés</span>
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> 2–3 jours par avion</span>
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-accent" /> Tarifs EUR & FCFA</span>
              </div>
            </div>

            <div className="relative animate-fade-up">
              <div className="overflow-hidden rounded-3xl border border-border shadow-card">
                <img src={IMG.hero} alt="Avion cargo en cours de chargement sur le tarmac" className="h-full max-h-[440px] w-full object-cover" loading="eager" />
              </div>
              <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-border bg-card px-5 py-3 shadow-floating sm:block">
                <p className="text-xs text-muted-foreground">Colis suivi</p>
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Arrivé au Bénin
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card p-6 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-accent sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pourquoi */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Pourquoi Baobab Transit</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tout pour recevoir vos colis sereinement
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} data-testid={`landing-feature-${f.title}`} className="rounded-2xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Comment ça marche</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Trois étapes simples, de l'Europe à votre porte
              </h2>
            </div>
            <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} data-testid={`landing-step-${i}`} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-accent">0{i + 1}</span>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services illustrés (image + texte) */}
        <section className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6 sm:py-20">
          {SERVICES.map((s) => (
            <div key={s.title} className="grid items-center gap-8 lg:grid-cols-2" data-testid={`landing-service-${s.eyebrow}`}>
              <div className={`overflow-hidden rounded-3xl border border-border shadow-card ${s.reverse ? "lg:order-2" : ""}`}>
                <img src={s.img} alt={s.title} className="h-full max-h-[380px] w-full object-cover" loading="lazy" />
              </div>
              <div className={s.reverse ? "lg:order-1" : ""}>
                <p className="text-xs font-bold uppercase tracking-widest text-accent">{s.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{s.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{s.text}</p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>

        {/* Service Achats pour moi (Proxy Shopping) */}
        <section className="border-y border-border bg-[#0B2046] text-white" data-testid="landing-proxy-section">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="overflow-hidden rounded-3xl border border-white/10 shadow-card">
                <img src={IMG.proxy} alt="Achats en ligne en Europe livrés au Bénin" className="h-full max-h-[400px] w-full object-cover" loading="lazy" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-accent">Nouveau service</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Achats pour moi : nous achetons en Europe pour vous</h2>
                <p className="mt-3 text-base leading-relaxed text-white/70">
                  Pas de carte bancaire européenne ? Un vendeur qui ne livre qu'en Europe ? Envoyez-nous les
                  liens de vos articles : <span className="font-semibold text-white">Baobab Transit</span> les achète,
                  les réceptionne à son hub, puis vous les expédie au Bénin.
                </p>
                <ul className="mt-5 space-y-2">
                  {["Envoyez simplement les liens produits", "Devis clair : articles + commission", "Paiement en ligne sécurisé", "Réception, photo et expédition vers le Bénin"].map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-accent" /> {p}</li>
                  ))}
                </ul>
                <Button asChild size="lg" className="mt-6 h-12 rounded-xl bg-accent px-7 text-base text-white shadow-cta hover:bg-[#D45A2C]" data-testid="landing-proxy-cta">
                  <Link to="/login">Demander un achat <ArrowRight className="ml-1.5 h-5 w-5" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Tarifs indicatifs */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Tarifs indicatifs</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Un prix clair, au poids facturable
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Exemple de grille aérienne France → Bénin. Le devis exact (transport + livraison locale)
                s'affiche en euros et en francs CFA avant paiement.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="landing-tariffs">
              {tariffs.map((t, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.min_weight_kg} – {t.max_weight_kg} kg</p>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{t.price_per_kg} €/kg</p>
                  <p className="mt-1 text-xs text-muted-foreground">{Number(t.fixed_fee) > 0 ? `+ ${t.fixed_fee} € fixes` : "sans frais fixes"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Témoignage */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-border shadow-card">
              <img src={IMG.customer} alt="Cliente recevant son colis au Bénin" className="h-full max-h-[400px] w-full object-cover" loading="lazy" />
            </div>
            <div>
              <Quote className="h-10 w-10 text-accent/30" />
              <p className="mt-3 text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
                « Je commande sur mes boutiques européennes préférées et je reçois tout à Cotonou en
                quelques jours. Le suivi et les prix en FCFA me rassurent vraiment. »
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-bold text-accent">A</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Awa S.</p>
                  <p className="text-xs text-muted-foreground">Cliente à Cotonou</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Avis clients */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Avis clients</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Ils reçoivent leurs colis au Bénin</h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-reviews">
              {REVIEWS.map((r, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((s) => (<Star key={s} className={`h-4 w-4 ${s < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">« {r.text} »</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{r.name[0]}</div>
                    <div><p className="text-sm font-semibold text-foreground">{r.name}</p><p className="text-xs text-muted-foreground">{r.city}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Questions fréquentes</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">On répond à vos questions</h2>
            </div>
            <div className="mt-8" data-testid="landing-faq">
              {FAQ.map((item, i) => (
                <FaqItem key={i} item={item} index={i} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-[#0B2046] p-8 text-white sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Prêt à recevoir vos colis au Bénin ?</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Créez votre espace client et obtenez votre adresse de réception en Europe en quelques secondes.
                </p>
              </div>
              <Button asChild size="lg" className="h-12 rounded-xl bg-accent px-8 text-base text-white shadow-cta hover:bg-[#D45A2C]" data-testid="cta-band-client">
                <Link to="/login"><Package className="mr-1.5 h-5 w-5" /> Accéder à mon espace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Service de transit de colis Europe → Bénin : adresse de réception, pesée au hub, expédition par avion et suivi jusqu'à votre porte.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-accent">Espace client</Link>
            <p className="mt-2 text-xs text-muted-foreground">© {new Date().getFullYear()} Baobab Transit · Transit Europe → Bénin</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
