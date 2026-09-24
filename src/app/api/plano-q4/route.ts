import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getQ4PlanLive } from "@/lib/dashboard/q4-plan-live";

export const dynamic = "force-dynamic";

// Serve o simulador do Plano Q4 (HTML autónomo) com os dados atuais injetados.
// É mostrado num iframe em /plano-q4.
export async function GET() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return new Response("Unauthorized", { status: 401 });

  const [html, live] = await Promise.all([
    readFile(path.join(process.cwd(), "src/lib/dashboard/plano-q4.html"), "utf8"),
    getQ4PlanLive(store.id),
  ]);
  const inject = `<script>window.__LIVE__=${JSON.stringify(live).replace(/</g, "\\u003c")}</script>\n<script>`;

  return new Response(html.replace("<script>", inject), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
