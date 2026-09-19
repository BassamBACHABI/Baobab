import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, PackageCheck, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const BLANK = { customer_reference: "", merchant_name: "", tracking_in: "", weight_kg: "", length_cm: "", width_cm: "", height_cm: "", storage_location: "", declared_value: "", content_category: "", notes: "" };

export default function AdminParcels() {
  const [tab, setTab] = useState("all");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [unidentified, setUnidentified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachRef, setAttachRef] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/packages${tab === "unident" ? "?unidentified=true" : ""}`);
      setList(data);
    } catch { toast.error("Erreur de chargement."); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const receive = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { auto_store: true };
      if (!unidentified && form.customer_reference) payload.customer_reference = form.customer_reference;
      ["merchant_name", "tracking_in", "storage_location", "content_category"].forEach((k) => { if (form[k]) payload[k] = form[k]; });
      ["weight_kg", "length_cm", "width_cm", "height_cm", "declared_value"].forEach((k) => { if (form[k]) payload[k] = Number(form[k]); });
      const { data } = await api.post("/admin/packages/receive", payload);
      toast.success(`Colis ${data.reference} — ${data.status}`);
      setForm(BLANK);
      load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setSaving(false); }
  };

  const attach = async (pid) => {
    const ref = attachRef[pid];
    if (!ref) return;
    try {
      await api.post(`/admin/packages/${pid}/attach`, { customer_reference: ref });
      toast.success("Colis rattaché");
      load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Back-office" title="Colis" subtitle="Réceptionnez, pesez et gérez les colis du hub." />

      {/* Réception */}
      <Card className="rounded-2xl border-border shadow-card"><CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-accent" />
          <h3 className="text-base font-semibold">Réceptionner un colis</h3>
        </div>
        <form onSubmit={receive} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input data-testid="receive-reference" disabled={unidentified} value={form.customer_reference} onChange={(e) => setForm((f) => ({ ...f, customer_reference: e.target.value.toUpperCase() }))} className="h-11 rounded-xl pl-10" placeholder="Référence client (CLB-XXXXXX)" />
            </div>
            <Button type="button" variant={unidentified ? "default" : "outline"} data-testid="toggle-unidentified" onClick={() => setUnidentified((v) => !v)} className={cn("rounded-xl", unidentified && "bg-accent text-white hover:bg-[#D45A2C]")}>Colis non identifié</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Marchand</Label><Input data-testid="receive-merchant" value={form.merchant_name} onChange={(e) => setForm((f) => ({ ...f, merchant_name: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>N° de suivi</Label><Input value={form.tracking_in} onChange={(e) => setForm((f) => ({ ...f, tracking_in: e.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>Poids (kg)</Label><Input type="number" step="0.01" data-testid="receive-weight" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>L (cm)</Label><Input type="number" step="0.1" value={form.length_cm} onChange={(e) => setForm((f) => ({ ...f, length_cm: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>l (cm)</Label><Input type="number" step="0.1" value={form.width_cm} onChange={(e) => setForm((f) => ({ ...f, width_cm: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>H (cm)</Label><Input type="number" step="0.1" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Emplacement</Label><Input value={form.storage_location} onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))} className="h-11 rounded-xl" placeholder="A-12" /></div>
            <div className="space-y-1.5"><Label>Contenu</Label><Input value={form.content_category} onChange={(e) => setForm((f) => ({ ...f, content_category: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Valeur (€)</Label><Input type="number" step="0.01" value={form.declared_value} onChange={(e) => setForm((f) => ({ ...f, declared_value: e.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
          <p className="text-xs text-muted-foreground">Le poids volumétrique et le poids facturable sont calculés automatiquement côté serveur.</p>
          <Button type="submit" disabled={saving} data-testid="receive-submit" className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réceptionner"}</Button>
        </form>
      </CardContent></Card>

      {/* Tabs + list */}
      <div className="flex gap-2">
        <button data-testid="tab-all" onClick={() => setTab("all")} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", tab === "all" ? "border-accent bg-accent text-white" : "border-border text-muted-foreground")}>Tous les colis</button>
        <button data-testid="tab-unident" onClick={() => setTab("unident")} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", tab === "unident" ? "border-accent bg-accent text-white" : "border-border text-muted-foreground")}>Colis à identifier</button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : list.length === 0 ? (
        <EmptyState icon={PackageCheck} testId="admin-parcels-empty" title="Aucun colis" description="Réceptionnez un colis via le formulaire ci-dessus." />
      ) : (
        <div className="space-y-3" data-testid="admin-parcels-list">
          {list.map((p) => (
            <Card key={p.id} className="rounded-2xl border-border"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><span className="font-mono font-semibold">{p.reference}</span><StatusBadge status={p.status} /></div>
                <p className="text-sm text-muted-foreground">{p.merchant_name || "—"} · {p.billable_weight_kg ? `${p.billable_weight_kg} kg` : "non pesé"}</p>
              </div>
              {p.status === "UNIDENTIFIED" && (
                <div className="flex items-center gap-2">
                  <Input data-testid={`attach-input-${p.reference}`} value={attachRef[p.id] || ""} onChange={(e) => setAttachRef((s) => ({ ...s, [p.id]: e.target.value.toUpperCase() }))} className="h-9 w-40 rounded-xl" placeholder="CLB-XXXXXX" />
                  <Button size="sm" variant="outline" className="rounded-xl" data-testid={`attach-btn-${p.reference}`} onClick={() => attach(p.id)}><Link2 className="mr-1 h-4 w-4" /> Rattacher</Button>
                </div>
              )}
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
