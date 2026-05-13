"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runShopifyFullSync, testShopifyConnection } from "./actions";
import { toast } from "sonner";
import { Loader2, RefreshCw, PlugZap } from "lucide-react";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
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

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onTest} disabled={testing}>
        {testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
      </Button>
      <Button onClick={onSync} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run full sync
      </Button>
    </div>
  );
}
