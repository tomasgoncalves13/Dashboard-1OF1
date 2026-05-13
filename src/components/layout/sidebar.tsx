"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Warehouse,
  Users,
  Megaphone,
  Receipt,
  Store,
  Upload,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/products", label: "Catalog", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/influencers", label: "Influencers", icon: Sparkles },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/manual-sales", label: "Manual sales", icon: Store },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/40 backdrop-blur">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-foreground text-background grid place-items-center font-bold text-xs">
            1
          </div>
          <span className="font-semibold tracking-tight">1OF1</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 scrollbar-thin overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-muted-foreground border-t">v0.1 · Phase 0</div>
    </aside>
  );
}
