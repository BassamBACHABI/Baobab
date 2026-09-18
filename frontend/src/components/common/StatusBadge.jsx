import { cn } from "@/lib/utils";

// Codes de statut en anglais en base, libellés français à l'affichage.
export const STATUS_LABELS = {
  created: "Créé",
  pending: "En attente",
  received: "Reçu au hub",
  weighed: "Pesé",
  ready: "Prêt à expédier",
  paid: "Payé",
  in_transit: "En transit",
  customs: "En douane",
  delivered: "Livré",
  cancelled: "Annulé",
};

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
  created: "slate",
  pending: "amber",
  received: "sky",
  weighed: "sky",
  ready: "amber",
  paid: "emerald",
  in_transit: "sky",
  customs: "violet",
  delivered: "emerald",
  cancelled: "red",
};

export function StatusBadge({ status, className }) {
  const label = STATUS_LABELS[status] || status;
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
