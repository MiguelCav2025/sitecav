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
 * Regra de admin do projeto: usuario autenticado que NAO consta na tabela
 * `professores`. A consulta usa a service_role key de proposito — checar o
 * papel com a chave anon dependeria das policies de RLS da tabela
 * `professores`, e uma policy restritiva faria um professor passar por admin.
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

  const { data: professor, error } = await createSupabaseAdminClient()
    .from("professores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Falha ao verificar permissões." },
        { status: 500 }
      ),
    };
  }

  if (professor) {
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
