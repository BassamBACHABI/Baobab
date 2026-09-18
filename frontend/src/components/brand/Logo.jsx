import { cn } from "@/lib/utils";

export function LogoMark({ className }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label="Baobab Cargo"
    >
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <ellipse cx="20" cy="14.5" rx="11" ry="6.5" fill="#E56B3D" />
      <path
        d="M17 14 C16 22 14.5 27 12.5 31 L27.5 31 C25.5 27 24 22 23 14 Z"
        fill="#F0895F"
      />
      <circle cx="20" cy="34.5" r="1.6" fill="#E56B3D" />
    </svg>
  );
}

export function Logo({ className, showText = true, textClassName }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} data-testid="brand-logo">
      <LogoMark />
      {showText && (
        <div className={cn("leading-none", textClassName)}>
          <span className="block text-base font-extrabold tracking-tight">
            Baobab
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Cargo
          </span>
        </div>
      )}
    </div>
  );
}
