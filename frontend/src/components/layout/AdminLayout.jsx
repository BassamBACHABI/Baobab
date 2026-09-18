import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PackageCheck,
  Ship,
  Settings,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { label: "Tableau de bord", icon: LayoutDashboard, to: "/admin", end: true, id: "dashboard" },
  { label: "Clients", icon: Users, to: "/admin/clients", id: "clients" },
  { label: "Colis", icon: PackageCheck, to: "/admin/parcels", id: "parcels" },
  { label: "Expéditions", icon: Ship, to: "/admin/shipments", id: "shipments" },
  { label: "Paramètres", icon: Settings, to: "/admin/settings", id: "settings" },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1" data-testid="admin-nav">
      {NAV.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          data-testid={`admin-nav-${item.id}`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar (dark) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#0B2046] p-4 text-white lg:flex">
        <div className="flex items-center justify-between px-2 py-3">
          <Logo textClassName="text-white" />
        </div>
        <div className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/50">
          Back-office
        </div>
        <div className="mt-4 flex-1">
          <NavItems />
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 p-2">
            <span className="px-2 text-xs text-white/60">Apparence</span>
            <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
          </div>
          <NavLink
            to="/client"
            data-testid="admin-back-to-client"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à l'espace client
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar with drawer */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-[#0B2046] px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                aria-label="Ouvrir le menu"
                data-testid="admin-menu-trigger"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-none bg-[#0B2046] p-4 text-white"
            >
              <div className="mb-6 mt-2 px-2">
                <Logo textClassName="text-white" />
              </div>
              <NavItems onNavigate={() => setOpen(false)} />
              <NavLink
                to="/client"
                onClick={() => setOpen(false)}
                className="mt-6 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Retour à l'espace client
              </NavLink>
            </SheetContent>
          </Sheet>
          <Logo textClassName="text-white" />
        </div>
        <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
      </header>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
