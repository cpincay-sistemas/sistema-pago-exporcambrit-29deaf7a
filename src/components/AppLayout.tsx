import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileDown,
  CalendarDays,
  CheckCircle2,
  BookOpen,
  Wallet,
  Building2,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/base-cxp", icon: FileDown, label: "Base CxP" },
  { to: "/programacion", icon: CalendarDays, label: "Programación" },
  { to: "/pagos-ejecutados", icon: CheckCircle2, label: "Pagos Ejecutados" },
  { to: "/historico", icon: BookOpen, label: "Histórico" },
  { to: "/saldo-facturas", icon: Wallet, label: "Saldo Facturas" },
  { to: "/proveedores", icon: Building2, label: "Proveedores" },
  { to: "/configuracion", icon: Settings, label: "Configuración" },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 inset-y-0 left-0 w-60 bg-sidebar flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">CP</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-primary-foreground leading-none">CamaroPay</h1>
            <p className="text-[11px] text-sidebar-muted mt-0.5">Gestión de Pagos</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <p className="text-[11px] text-sidebar-muted">v1.0 — Empresa Camaronera</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center px-4 lg:px-6 shrink-0">
          <button className="lg:hidden mr-3 text-foreground" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">MT</span>
            </div>
            <span className="text-sm font-medium hidden sm:block">María Torres</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Tesorero</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
