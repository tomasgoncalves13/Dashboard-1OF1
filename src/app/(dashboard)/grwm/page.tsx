// Allow up to 5 min per server action call (large video uploads to Supabase)
export const maxDuration = 300;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GrwmScheduler } from "./grwm-scheduler";
import { GrwmAgendamentos } from "./grwm-agendamentos";
import { scanGrwmFolder, getIgId, getScheduledPosts } from "./actions";

export default async function GrwmPage() {
  const [groups, igId, scheduledPosts] = await Promise.all([
    scanGrwmFolder().catch(() => []),
    getIgId().catch(() => ""),
    getScheduledPosts().catch(() => []),
  ]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">GRWM Scheduler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publica diariamente às 18:00 (Lisboa) no Instagram, TikTok e Facebook via Vercel Cron.
        </p>
      </div>

      <Tabs defaultValue="agendamentos">
        <TabsList>
          <TabsTrigger value="agendamentos">
            Agendamentos
            {scheduledPosts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium">
                {scheduledPosts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="novo">Novo Agendamento</TabsTrigger>
        </TabsList>

        <TabsContent value="agendamentos" className="mt-4">
          <GrwmAgendamentos posts={scheduledPosts} />
        </TabsContent>

        <TabsContent value="novo" className="mt-4">
          <GrwmScheduler groups={groups} igId={igId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
