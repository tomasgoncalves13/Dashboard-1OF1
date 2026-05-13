"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Topbar({ email }: { email?: string | null }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur px-6">
      <div className="flex-1 flex items-center gap-2 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            placeholder="Search orders, products, customers…  (⌘K)"
            className="w-full h-9 rounded-md border border-input bg-card/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <Sun className="size-4 dark:hidden" />
        <Moon className="size-4 hidden dark:block" />
      </Button>
      <div className="flex items-center gap-3 pl-2 border-l">
        <div className="text-xs text-muted-foreground hidden md:block">{email}</div>
        <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
      </div>
    </header>
  );
}
