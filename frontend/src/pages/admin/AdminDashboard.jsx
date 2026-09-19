import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PackageCheck, PackageSearch, Warehouse, Ship, Wallet, TrendingUp, AlertTriangle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SHIP_LABELS = {
  DRAFT: "Brouillon", AWAITING_PAYMENT: "En attente de paiement", PAID: "Payé",
  PREPARING: "En préparation", SHIPPED: "Expédié", IN_TRANSIT: "En transit",
  ARRIVED_BENIN: "Arrivé au Bénin", OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livré", INCIDENT: "Incident",
};

function MetricCard({ icon: Icon, label, value, testId }) {
  return (
    <Card className="rounded-2xl border-border shadow-card" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes("ADMIN");

  const [metrics, setMetrics] = useState(null);
  const [finance, setFinance] = useState(null);
  const [todo, setTodo] = useState(null);
  const [margin, setMargin] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const [range, setRange] = useState({ from: firstOfMonth, to: today });
  const [loadingMargin, setLoadingMargin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const reqs = [api.get("/admin/dashboard/metrics"), api.get("/admin/dashboard/todo")];
        if (isAdmin) reqs.push(api.get("/admin/dashboard/finance"));
        const [m, t, f] = await Promise.all(reqs);
        setMetrics(m.data);
        setTodo(t.data);
        if (f) setFinance(f.data);
      } catch {
        toast.error("Erreur de chargement du tableau de bord.");
      }
    })();
    if (isAdmin) loadMargin(firstOfMonth, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMargin = async (from, to) => {
    setLoadingMargin(true);
    try {
      const { data } = await api.get("/admin/dashboard/margin", { params: { date_from: from, date_to: to } });
      setMargin(data);
    } catch {
      toast.error("Erreur de chargement de la marge.");
    } finally {
      setLoadingMargin(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <PageHeader
        eyebrow="Back-office"
        title="Tableau de bord"
        subtitle="Vue d'ensemble : colis, expéditions, paiements et marge."
      />

      {/* Indicateurs opérationnels */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={PackageCheck} label="Colis reçus cette semaine" value={metrics?.received_this_week ?? "—"} testId="metric-received-week" />
        <MetricCard icon={PackageSearch} label="Colis à identifier" value={metrics?.to_identify ?? "—"} testId="metric-to-identify" />
        <MetricCard icon={Warehouse} label="Colis en stock" value={metrics?.in_stock ?? "—"} testId="metric-in-stock" />
        <MetricCard
          icon={Ship}
          label="Expéditions actives"
          value={metrics ? Object.entries(metrics.shipments_by_status).filter(([k]) => k !== "DELIVERED").reduce((a, [, v]) => a + v, 0) : "—"}
          testId="metric-shipments-active"
        />
      </div>

      {/* Expéditions par statut */}
      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Expéditions par statut</h3>
          {metrics && Object.keys(metrics.shipments_by_status).length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid="shipments-by-status">
              {Object.entries(metrics.shipments_by_status).map(([st, n]) => (
                <span key={st} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium">
                  {SHIP_LABELS[st] || st}
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{n}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune expédition.</p>
          )}
        </CardContent>
      </Card>

      {/* Finance — ADMIN uniquement */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={Wallet} label="Paiements reçus" value={finance?.payments_received ?? "—"} testId="metric-payments" />
          <Card className="rounded-2xl border-accent/40 bg-accent/5 shadow-card" data-testid="metric-revenue">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Chiffre d'affaires du mois</p>
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{finance ? `${finance.revenue_month_eur} €` : "—"}</p>
              <p className="text-sm text-muted-foreground">{finance ? `${finance.revenue_month_xof} FCFA` : ""}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* À traiter aujourd'hui */}
      <Card className="rounded-2xl border-border shadow-card">
        <CardContent className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-accent" /> À traiter aujourd'hui
          </h3>
          <div className="grid gap-5 md:grid-cols-3" data-testid="todo-lists">
            <TodoBlock title="Colis à identifier" items={todo?.unidentified} render={(p) => p.reference} onClick={() => navigate("/admin/parcels")} testId="todo-unidentified" />
            <TodoBlock title="Expéditions à préparer" items={todo?.awaiting_preparation} render={(s) => `${s.reference}`} onClick={(s) => navigate(`/admin/shipments/${s.id}`)} testId="todo-awaiting" />
            <TodoBlock title="Incidents" items={todo?.incidents} icon={AlertTriangle} render={(s) => s.reference} onClick={(s) => navigate(`/admin/shipments/${s.id}`)} testId="todo-incidents" />
          </div>
        </CardContent>
      </Card>

      {/* Marge — ADMIN uniquement */}
      {isAdmin && (
        <Card className="rounded-2xl border-border shadow-card" data-testid="margin-section">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Marge brute (revenus − coûts réels)</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="from" className="text-xs">Du</Label>
                <Input id="from" type="date" data-testid="margin-from" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-10 w-40 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to" className="text-xs">Au</Label>
                <Input id="to" type="date" data-testid="margin-to" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-10 w-40 rounded-xl" />
              </div>
              <Button onClick={() => loadMargin(range.from, range.to)} disabled={loadingMargin} data-testid="margin-apply" className="h-10 rounded-xl bg-accent text-white hover:bg-[#D45A2C]">
                Appliquer
              </Button>
            </div>

            {margin && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MiniStat label="Revenus" value={`${margin.total_revenue_eur} €`} testId="margin-revenue" />
                  <MiniStat label="Coûts réels" value={`${margin.total_cost_eur} €`} testId="margin-cost" />
                  <MiniStat label="Marge brute" value={`${margin.total_margin_eur} €`} sub={`${margin.total_margin_xof} FCFA`} testId="margin-total" />
                  <MiniStat label="Coût moyen / kg" value={`${margin.cost_per_kg_eur} €`} sub={`Marge moy. ${margin.average_margin_eur} €`} testId="margin-per-kg" />
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="margin-table">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4">Référence</th><th className="py-2 pr-4">Statut</th>
                        <th className="py-2 pr-4 text-right">Revenus</th><th className="py-2 pr-4 text-right">Coûts</th>
                        <th className="py-2 pr-4 text-right">Marge</th><th className="py-2 text-right">Poids fact.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {margin.rows.length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Aucune expédition sur la période.</td></tr>
                      ) : margin.rows.map((r) => (
                        <tr key={r.shipment_id} className="border-b border-border/60">
                          <td className="py-2 pr-4 font-mono">{r.reference}</td>
                          <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
                          <td className="py-2 pr-4 text-right">{r.revenue_eur} €</td>
                          <td className="py-2 pr-4 text-right">{r.cost_eur} €</td>
                          <td className="py-2 pr-4 text-right font-semibold">{r.margin_eur} €</td>
                          <td className="py-2 text-right">{r.billable_weight_kg} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, testId }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TodoBlock({ title, items, render, onClick, icon: Icon, testId }) {
  return (
    <div data-testid={testId}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title} ({items?.length ?? 0})
      </p>
      {!items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien à traiter.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((it) => (
            <li key={it.id}>
              <button onClick={() => onClick(it)} className="w-full truncate rounded-lg border border-border bg-card px-3 py-2 text-left font-mono text-xs hover:bg-secondary/50">
                {render(it)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
