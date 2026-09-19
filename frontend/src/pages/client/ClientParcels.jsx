import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Loader2, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, STATUS_LABELS } from "@/components/common/StatusBadge";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CHIPS = ["Tous", "EXPECTED", "RECEIVED", "INSPECTED", "STORED", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

export default function ClientParcels() {
  const navigate = useNavigate();
  const [pkgs, setPkgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Tous");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ merchant_name: "", tracking_in: "", content_category: "", declared_value: "" });

  const load = async () => {
    try {
      const { data } = await api.get("/me/packages");
      setPkgs(data);
    } catch {
      toast.error("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return pkgs.filter((p) => (filter === "Tous" || p.status === filter) &&
      (!q || `${p.reference} ${p.merchant_name || ""}`.toLowerCase().includes(q.toLowerCase())));
  }, [pkgs, filter, q]);

  const declare = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/me/packages/declare", {
        merchant_name: form.merchant_name, tracking_in: form.tracking_in || null,
        content_category: form.content_category || null,
        declared_value: form.declared_value ? Number(form.declared_value) : null,
      });
      toast.success("Colis déclaré");
      setOpen(false);
      setForm({ merchant_name: "", tracking_in: "", content_category: "", declared_value: "" });
      load();
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mes colis" subtitle="Vos colis reçus au hub et déclarés." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]" data-testid="declare-open-btn"><Plus className="mr-1.5 h-4 w-4" /> Déclarer un colis attendu</Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader><DialogTitle>Déclarer un colis attendu</DialogTitle></DialogHeader>
            <form onSubmit={declare} className="space-y-4">
              <div className="space-y-1.5"><Label>Marchand</Label><Input required data-testid="declare-merchant" value={form.merchant_name} onChange={(e) => setForm((f) => ({ ...f, merchant_name: e.target.value }))} className="h-11 rounded-xl" placeholder="Amazon, Zara..." /></div>
              <div className="space-y-1.5"><Label>N° de suivi du marchand</Label><Input data-testid="declare-tracking" value={form.tracking_in} onChange={(e) => setForm((f) => ({ ...f, tracking_in: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Contenu</Label><Input data-testid="declare-content" value={form.content_category} onChange={(e) => setForm((f) => ({ ...f, content_category: e.target.value }))} className="h-11 rounded-xl" placeholder="Vêtements..." /></div>
                <div className="space-y-1.5"><Label>Valeur (€)</Label><Input type="number" step="0.01" data-testid="declare-value" value={form.declared_value} onChange={(e) => setForm((f) => ({ ...f, declared_value: e.target.value }))} className="h-11 rounded-xl" /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={saving} data-testid="declare-submit" className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Déclarer"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid="parcels-search" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-xl pl-10" placeholder="Rechercher par référence ou marchand" />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="status-chips">
        {CHIPS.map((c) => (
          <button key={c} data-testid={`chip-${c}`} onClick={() => setFilter(c)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors", filter === c ? "border-accent bg-accent text-white" : "border-border text-muted-foreground hover:bg-secondary")}>
            {c === "Tous" ? "Tous" : STATUS_LABELS[c] || c}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={PackageOpen} testId="parcels-empty" title="Aucun colis" description="Déclarez un colis attendu ou faites livrer vos achats à votre adresse de réception." />
      ) : (
        <>
          {/* Table desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Référence</th><th className="p-3">Marchand</th><th className="p-3">Statut</th><th className="p-3">Poids</th><th className="p-3">Réception</th></tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} data-testid={`parcel-row-${p.reference}`} onClick={() => navigate(`/client/parcels/${p.id}`)} className="cursor-pointer border-t border-border hover:bg-secondary/40">
                    <td className="p-3 font-mono font-semibold">{p.reference}</td>
                    <td className="p-3">{p.merchant_name || "—"}</td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3">{p.billable_weight_kg ? `${p.billable_weight_kg} kg` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.received_at ? new Date(p.received_at).toLocaleDateString("fr-FR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <button key={p.id} data-testid={`parcel-card-${p.reference}`} onClick={() => navigate(`/client/parcels/${p.id}`)} className="w-full rounded-2xl border border-border bg-card p-4 text-left">
                <div className="flex items-center justify-between"><span className="font-mono font-semibold">{p.reference}</span><StatusBadge status={p.status} /></div>
                <p className="mt-1 text-sm text-muted-foreground">{p.merchant_name || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.billable_weight_kg ? `${p.billable_weight_kg} kg · ` : ""}{p.received_at ? new Date(p.received_at).toLocaleDateString("fr-FR") : "Non reçu"}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
