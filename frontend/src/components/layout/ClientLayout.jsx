import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, Package, Truck, ShoppingBag, LifeBuoy, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

const NAV = [
  { label: "Accueil", icon: Home, to: "/client", end: true, id: "home" },
  { label: "Colis", icon: Package, to: "/client/parcels", id: "parcels" },
  { label: "Envois", icon: Truck, to: "/client/shipments", id: "shipments" },
  { label: "Achats", icon: ShoppingBag, to: "/client/proxy", id: "proxy" },
  { label: "Support", icon: LifeBuoy, to: "/client/support", id: "support" },
  { label: "Profil", icon: User, to: "/client/profile", id: "profile" },
];

export default function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [badges, setBadges] = useState({});

  useEffect(() => {
    api.get("/me/badges").then(({ data }) => setBadges(data)).catch(() => {});
  }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="px-2 py-3">
          <Logo />
        </div>
        <nav className="mt-6 flex-1 space-y-1" data-testid="client-sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              data-testid={`client-nav-${item.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {badges[item.id] > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white" data-testid={`client-badge-${item.id}`}>{badges[item.id]}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border p-2">
            <span className="px-2 text-xs text-muted-foreground">Apparence</span>
            <ThemeToggle />
          </div>
          <button
            onClick={doLogout}
            data-testid="client-logout-btn"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="truncate">Déconnexion{user?.name ? ` · ${user.name}` : ""}</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={doLogout} aria-label="Déconnexion" data-testid="client-logout-btn-mobile">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:px-6 md:py-10 md:pb-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/90 px-2 backdrop-blur-md md:hidden"
        data-testid="client-bottom-nav"
      >
        {NAV.map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              data-testid={`client-bottom-nav-${item.id}`}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                isActive ? "text-accent" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon
                  className={cn("h-5 w-5", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {badges[item.id] > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white" data-testid={`client-bottom-badge-${item.id}`}>{badges[item.id]}</span>
                )}
              </span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
