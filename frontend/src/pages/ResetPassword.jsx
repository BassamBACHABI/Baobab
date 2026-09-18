import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pwd !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, pwd);
      toast.success("Mot de passe mis à jour. Connectez-vous.");
      navigate("/login", { replace: true });
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Nouveau mot de passe</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choisissez un nouveau mot de passe sécurisé.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
            {!token ? (
              <p className="text-center text-sm text-muted-foreground" data-testid="reset-invalid">
                Lien invalide. Veuillez redemander un lien depuis « Mot de passe oublié ».
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pwd">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="pwd" type="password" required minLength={6} data-testid="reset-password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="h-11 rounded-xl pl-10" placeholder="••••••••" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="confirm" type="password" required minLength={6} data-testid="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl pl-10" placeholder="••••••••" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="reset-submit" className="h-11 w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réinitialiser"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
