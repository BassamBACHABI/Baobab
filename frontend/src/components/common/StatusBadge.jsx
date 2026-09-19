import { cn } from "@/lib/utils";

// Codes de statut en anglais en base, libellés français à l'affichage.
const PACKAGE = {
  EXPECTED: "Attendu",
  UNIDENTIFIED: "Non identifié",
  RECEIVED: "Reçu au hub",
  INSPECTED: "Inspecté",
  STORED: "Stocké",
  READY_TO_SHIP: "Prêt à expédier",
  SHIPPED: "Expédié",
  ARRIVED_BENIN: "Arrivé au Bénin",
  DELIVERED: "Livré",
  DAMAGED: "Endommagé",
  REFUSED: "Refusé",
  RETURNED: "Retourné",
};

const SHIPMENT = {
  DRAFT: "Brouillon",
  AWAITING_PAYMENT: "En attente de paiement",
  PAID: "Payé",
  PREPARING: "En préparation",
  SHIPPED: "Expédié",
  IN_TRANSIT: "En transit",
  ARRIVED_BENIN: "Arrivé au Bénin",
  OUT_FOR_DELIVERY: "En cours de livraison",
  DELIVERED: "Livré",
  INCIDENT: "Incident",
};

const PAYMENT = {
  PENDING: "En attente",
  AUTHORIZED: "Autorisé",
  PAID: "Payé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
  CANCELLED: "Annulé",
};

// Accès à plat (STATUS_LABELS["DRAFT"]) ET imbriqué (STATUS_LABELS.SHIPMENT["DRAFT"]).
export const STATUS_LABELS = { ...PACKAGE, ...SHIPMENT, ...PAYMENT, PACKAGE, SHIPMENT, PAYMENT };

const STATUS_STYLES = {
  amber:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900/60",
  sky:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900/60",
  violet:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900/60",
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900/60",
  red:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900/60",
  slate:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const STATUS_COLOR = {
  // Colis
  EXPECTED: "amber",
  UNIDENTIFIED: "red",
  RECEIVED: "sky",
  INSPECTED: "sky",
  STORED: "violet",
  READY_TO_SHIP: "amber",
  DAMAGED: "red",
  REFUSED: "red",
  RETURNED: "slate",
  // Expéditions
  DRAFT: "slate",
  AWAITING_PAYMENT: "amber",
  PREPARING: "violet",
  IN_TRANSIT: "sky",
  OUT_FOR_DELIVERY: "sky",
  INCIDENT: "red",
  // Communs
  SHIPPED: "sky",
  ARRIVED_BENIN: "violet",
  DELIVERED: "emerald",
  PAID: "emerald",
  // Paiements
  PENDING: "amber",
  AUTHORIZED: "sky",
  FAILED: "red",
  REFUNDED: "slate",
  CANCELLED: "slate",
};

export function StatusBadge({ status, className }) {
  const raw = STATUS_LABELS[status];
  const label = typeof raw === "string" ? raw : status;
  const color = STATUS_COLOR[status] || "slate";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[color],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
