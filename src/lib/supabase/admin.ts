import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Use ONLY in trusted server contexts
// (webhooks, background jobs, admin tooling). Never expose to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
