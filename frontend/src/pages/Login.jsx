import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth, isStaff } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GoogleIcon = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
  </svg>
);

const AppleIcon = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
    <path d="M16.37 12.88c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13Zm-2.57-7.59c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z" />
  </svg>
);

export default function Login() {
  const { user, login, register, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });

  useEffect(() => {
    if (user) navigate(isStaff(user) ? "/admin" : "/client", { replace: true });
  }, [user, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u =
        mode === "login"
          ? await login(form.email, form.password)
          : await register(form);
      toast.success(mode === "login" ? "Connexion réussie" : "Compte créé avec succès");
      navigate(isStaff(u) ? "/admin" : "/client", { replace: true });
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo showText={false} className="mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "login" ? "Bon retour" : "Créez votre compte"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Connectez-vous pour suivre vos colis Europe → Bénin."
                : "Obtenez votre adresse de réception en Europe."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={loginWithGoogle}
                data-testid="google-login-btn"
                className="h-11 w-full rounded-xl border-border"
              >
                <GoogleIcon className="mr-2" /> Continuer avec Google
              </Button>
              <Button
                type="button"
                onClick={loginWithApple}
                data-testid="apple-login-btn"
                className="h-11 w-full rounded-xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                <AppleIcon className="mr-2" /> Continuer avec Apple
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Prénom</Label>
                    <Input id="first_name" data-testid="register-firstname" value={form.first_name} onChange={set("first_name")} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Nom</Label>
                    <Input id="last_name" data-testid="register-lastname" value={form.last_name} onChange={set("last_name")} className="h-11 rounded-xl" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" required data-testid="login-email" value={form.email} onChange={set("email")} className="h-11 rounded-xl pl-10" placeholder="vous@exemple.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" required data-testid="login-password" value={form.password} onChange={set("password")} className="h-11 rounded-xl pl-10" placeholder="••••••••" />
                </div>
              </div>

              {mode === "login" && (
                <div className="text-right">
                  <Link to="/forgot-password" data-testid="forgot-link" className="text-xs font-medium text-accent hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
              )}

              <Button type="submit" disabled={loading} data-testid="login-submit" className="h-11 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Se connecter" : "Créer mon compte"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Pas encore de compte ? " : "Vous avez déjà un compte ? "}
            <button
              type="button"
              data-testid="toggle-auth-mode"
              onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
              className="font-semibold text-accent hover:underline"
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
