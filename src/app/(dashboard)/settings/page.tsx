import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "./sync-button";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const store = user
    ? await prisma.store.findFirst({
        where: { ownerId: user.id },
        include: { integrations: true },
      })
    : null;

  const shopify = store?.integrations.find((i) => i.provider === "SHOPIFY");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Integrations, store, sync.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shopify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Row label="Domain" value={store?.shopifyDomain ?? process.env.SHOPIFY_STORE_DOMAIN ?? "—"} />
            <Row label="Status" value={shopify?.status ?? "DISCONNECTED"} />
            <Row label="Last sync" value={shopify?.lastSyncedAt ? new Date(shopify.lastSyncedAt).toLocaleString() : "Never"} />
            <Row label="Store currency" value={store?.currency ?? "EUR"} />
          </div>
          <div className="pt-2">
            <SyncButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta Ads</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          App approved — integration lands in Phase 4. Provide the Ad Account ID and access token in env.
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
