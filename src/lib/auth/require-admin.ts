import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RequireAdminResult =
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: NextResponse };

/**
 * Garante que quem chamou a rota está autenticado E é administrador.
 *
 * Administrador é quem consta em `administradores` com `ativo = true` — a mesma
 * fonte que o `is_admin()` usa no banco. Antes a regra era por eliminação
 * ("autenticado e não é professor"), o que promovia a administrador qualquer
 * conta criada por engano, importada ou órfã.
 *
 * A consulta usa a service_role key de propósito: checar o papel com a chave
 * anon dependeria das policies de RLS de `administradores`, e uma policy
 * restritiva esconderia a linha do próprio admin, derrubando o acesso dele.
 *
 * Uso:
 *   const { user, errorResponse } = await requireAdmin();
 *   if (errorResponse) return errorResponse;
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }

  const { data: admin, error } = await createSupabaseAdminClient()
    .from("administradores")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  // Na dúvida, negar. Um erro de consulta não pode virar permissão concedida.
  if (error) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Falha ao verificar permissões." },
        { status: 500 }
      ),
    };
  }

  if (!admin) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
