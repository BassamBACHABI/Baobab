import { useEffect, useMemo, useState } from "react";
import { UserPlus, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_FR = { ACTIVE: "Actif", SUSPENDED: "Suspendu", PENDING: "En attente" };

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/admin/clients"); setClients(data || []); }
      catch { toast.error("Erreur de chargement des clients."); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter((c) =>
      `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().includes(t) ||
      (c.email || "").toLowerCase().includes(t) ||
      (c.customer_reference || "").toLowerCase().includes(t),
    );
  }, [clients, q]);

  const copyRef = (ref) => { navigator.clipboard?.writeText(ref); toast.success("Référence copiée"); };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Back-office" title="Clients" subtitle="Clients du service de transit et leurs références de réception." />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid="clients-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom, e-mail ou référence…" className="h-11 rounded-xl pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserPlus} testId="admin-clients-empty" title={q ? "Aucun résultat" : "Aucun client enregistré"} description={q ? "Essayez une autre recherche." : "Les nouveaux inscrits au service de transit s'afficheront ici."} />
      ) : (
        <div className="space-y-2" data-testid="admin-clients-list">
          <p className="text-xs text-muted-foreground">{filtered.length} client(s)</p>
          {filtered.map((c) => (
            <Card key={c.id} className="rounded-2xl border-border" data-testid={`client-${c.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-bold text-accent">
                    {(c.first_name || c.email || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{`${c.first_name || ""} ${c.last_name || ""}`.trim() || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.customer_reference && (
                    <button onClick={() => copyRef(c.customer_reference)} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs font-semibold text-foreground hover:bg-secondary/70" data-testid={`client-ref-${c.id}`}>
                      {c.customer_reference} <Copy className="h-3 w-3" />
                    </button>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`} data-testid={`client-status-${c.id}`}>{STATUS_FR[c.status] || c.status}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
