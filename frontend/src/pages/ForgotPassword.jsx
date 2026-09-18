import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Connexion
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo showText={false} className="mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Mot de passe oublié</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saisissez votre e-mail : nous vous enverrons un lien de réinitialisation.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="forgot-sent">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm text-muted-foreground">
                  Si un compte existe pour <span className="font-semibold text-foreground">{email}</span>,
                  un lien de réinitialisation vient d'être envoyé.
                </p>
                <Button asChild variant="outline" className="mt-2 rounded-xl">
                  <Link to="/login">Retour à la connexion</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" required data-testid="forgot-email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl pl-10" placeholder="vous@exemple.com" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="forgot-submit" className="h-11 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
