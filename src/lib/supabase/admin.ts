import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service_role key. Ignora RLS por completo.
 * Uso EXCLUSIVO em rotas de API (server-side) — nunca importar em componentes client.
 */
export const createSupabaseAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
