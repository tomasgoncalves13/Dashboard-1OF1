"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runShopifyFullSync, testShopifyConnection, runProfitRecalculate, runShopifyRecentSync } from "./actions";
import { toast } from "sonner";
import { Loader2, RefreshCw, PlugZap, Calculator } from "lucide-react";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [recentPending, startRecentTransition] = useTransition();
  const [recalcPending, startRecalcTransition] = useTransition();
  const [testing, setTesting] = useState(false);

  function onTest() {
    setTesting(true);
    testShopifyConnection()
      .then((shop) => toast.success(`Connected to ${shop.name} (${shop.myshopifyDomain})`))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setTesting(false));
  }

  function onSync() {
    startTransition(async () => {
      try {
        const r = await runShopifyFullSync();
        toast.success(`Synced — ${r.variantsSynced} variants, ${r.customersSynced} customers, ${r.ordersSynced} orders`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function onRecentSync() {
    startRecentTransition(async () => {
      try {
        const r = await runShopifyRecentSync();
        toast.success(`Encomendas recentes sincronizadas — ${r.ordersSynced} encomendas, ${r.payoutsSynced ?? 0} payouts`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function onRecalculate() {
    startRecalcTransition(async () => {
      try {
        const r = await runProfitRecalculate();
        toast.success(`Profit recalculado — ${r.updated} encomendas atualizadas`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onTest} disabled={testing}>
        {testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
      </Button>
      <Button onClick={onRecentSync} disabled={recentPending}>
        {recentPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync encomendas recentes
      </Button>
      <Button variant="outline" onClick={onSync} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run full sync
      </Button>
      <Button variant="outline" onClick={onRecalculate} disabled={recalcPending}>
        {recalcPending ? <Loader2 className="animate-spin" /> : <Calculator />} Recalcular profits
      </Button>
    </div>
  );
}
