import { LogoMark } from "@/components/brand/Logo";

export function BrandLoader({ label = "Chargement…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="animate-pulse">
        <LogoMark className="h-12 w-12" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
