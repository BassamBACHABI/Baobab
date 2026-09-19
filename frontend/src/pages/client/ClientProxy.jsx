import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyItem = { product_url: "", name: "", variant: "", quantity: 1, unit_price_est: "", store: "", notes: "" };

export default function ClientProxy() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [notes, setNotes] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/me/proxy-orders"); setList(data); }
    catch { toast.error("Erreur de chargement."); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((arr) => [...arr, { ...emptyItem }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const submit = async () => {
    const clean = items.filter((it) => it.name.trim());
    if (!clean.length) { toast.error("Renseignez au moins un article (nom)."); return; }
    setBusy(true);
    try {
      await api.post("/me/proxy-orders", {
        notes,
        items: clean.map((it) => ({
          product_url: it.product_url || null, name: it.name, variant: it.variant || null,
          quantity: Number(it.quantity) || 1, unit_price_est: Number(it.unit_price_est) || 0,
          store: it.store || null, notes: it.notes || null,
        })),
      });
      toast.success("Demande envoyée");
      setCreating(false); setItems([{ ...emptyItem }]); setNotes("");
      await load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achats pour moi"
        subtitle="Demandez à Baobab d'acheter vos articles en Europe et de vous les livrer au Bénin."
        action={
          <Button className="rounded-xl bg-accent text-white hover:bg-[#D45A2C]" data-testid="new-proxy-btn" onClick={() => setCreating((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nouvelle demande
          </Button>
        }
      />

      {creating && (
        <Card className="rounded-2xl border-accent/40 bg-accent/5 shadow-none" data-testid="proxy-create-form">
          <CardContent className="space-y-4 p-5">
            <h3 className="text-sm font-semibold">Articles à acheter</h3>
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4" data-testid={`proxy-item-${i}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs">Nom de l'article *</Label><Input data-testid={`item-name-${i}`} value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} className="h-10 rounded-xl" /></div>
                  <div className="space-y-1"><Label className="text-xs">Lien produit</Label><Input value={it.product_url} onChange={(e) => setItem(i, "product_url", e.target.value)} className="h-10 rounded-xl" placeholder="https://…" /></div>
                  <div className="space-y-1"><Label className="text-xs">Variante (taille/couleur)</Label><Input value={it.variant} onChange={(e) => setItem(i, "variant", e.target.value)} className="h-10 rounded-xl" /></div>
                  <div className="space-y-1"><Label className="text-xs">Boutique</Label><Input value={it.store} onChange={(e) => setItem(i, "store", e.target.value)} className="h-10 rounded-xl" /></div>
                  <div className="space-y-1"><Label className="text-xs">Quantité</Label><Input type="number" min="1" data-testid={`item-qty-${i}`} value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} className="h-10 rounded-xl" /></div>
                  <div className="space-y-1"><Label className="text-xs">Prix unitaire estimé (€)</Label><Input type="number" step="0.01" data-testid={`item-price-${i}`} value={it.unit_price_est} onChange={(e) => setItem(i, "unit_price_est", e.target.value)} className="h-10 rounded-xl" /></div>
                </div>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:underline" data-testid={`remove-item-${i}`}><Trash2 className="h-3.5 w-3.5" /> Retirer</button>
                )}
              </div>
            ))}
            <Button onClick={addItem} variant="outline" className="rounded-xl" data-testid="add-item-btn"><Plus className="mr-1.5 h-4 w-4" /> Ajouter un article</Button>
            <div className="space-y-1"><Label className="text-xs">Notes (facultatif)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 rounded-xl" /></div>
            <Button onClick={submit} disabled={busy} data-testid="submit-proxy-btn" className="w-full rounded-xl bg-accent text-white hover:bg-[#D45A2C]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer la demande"}</Button>
          </CardContent>
        </Card>
      )}

      {loading ? <ListSkeleton rows={3} /> : list.length === 0 ? (
        <EmptyState icon={ShoppingBag} testId="proxy-empty" title="Aucune demande d'achat" description="Créez une demande : nous établissons un devis (articles + commission), vous payez, nous achetons." />
      ) : (
        <div className="space-y-3" data-testid="proxy-list">
          {list.map((o) => (
            <button key={o.id} data-testid={`proxy-${o.reference}`} onClick={() => navigate(`/client/proxy/${o.id}`)} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/40">
              <div className="flex items-center justify-between"><span className="font-mono font-semibold">{o.reference}</span><StatusBadge status={o.status} /></div>
              <p className="mt-1 text-sm text-muted-foreground">{o.items?.length || 0} article(s){o.total_eur ? ` · ${o.total_eur} € · ${o.total_xof} FCFA` : ""}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
