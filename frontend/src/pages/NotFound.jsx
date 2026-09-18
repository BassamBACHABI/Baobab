import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Logo className="mb-8" />
      <p className="text-6xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Button
        asChild
        className="mt-8 rounded-xl bg-accent text-white hover:bg-[#D45A2C]"
        data-testid="notfound-home-btn"
      >
        <Link to="/">
          <Home className="mr-1.5 h-4 w-4" /> Retour à l'accueil
        </Link>
      </Button>
    </div>
  );
}
