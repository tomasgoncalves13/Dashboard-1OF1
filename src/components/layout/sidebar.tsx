"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Package, Warehouse, Users,
  Receipt, Upload, Settings, Sparkles,
  Calculator, Landmark, Trophy, X, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finance", label: "Finanças", icon: Landmark },
  { href: "/orders", label: "Encomendas Site", icon: ShoppingBag },
  { href: "/clubs", label: "Vendas Físicas", icon: Trophy },
  { href: "/influencers", label: "Influencers", icon: Sparkles },
  { href: "/inventory", label: "Inventário", icon: Warehouse },
  { href: "/products", label: "Catálogo", icon: Package },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/costs", label: "Custos", icon: Calculator },
  { href: "/encomendas", label: "Importações", icon: ShoppingCart },
  { href: "/expenses", label: "Despesas Mensais", icon: Receipt },
  { href: "/imports", label: "Importar", icon: Upload },
  { href: "/settings", label: "Definições", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <div className="px-5 py-5">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="size-7 rounded-md bg-foreground text-background grid place-items-center font-bold text-xs">
          1
        </div>
        <span className="font-semibold tracking-tight">1OF1</span>
      </Link>
    </div>
  );
}

// Desktop sidebar
export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/40 backdrop-blur">
      <Logo />
      <NavLinks />
      <div className="px-5 py-4 text-xs text-muted-foreground border-t">v0.2 · Phase 1–6</div>
    </aside>
  );
}

// Mobile drawer (controlled externally)
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-background border-r md:hidden">
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-foreground text-background grid place-items-center font-bold text-xs">
              1
            </div>
            <span className="font-semibold tracking-tight">1OF1</span>
          </Link>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
        <div className="px-5 py-4 text-xs text-muted-foreground border-t">v0.2 · Phase 1–6</div>
      </div>
    </>
  );
}
