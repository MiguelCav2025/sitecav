import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Onde o link do e-mail cai.
 *
 * O Supabase devolve um `token_hash` de uso único; aqui ele vira sessão. Fazemos
 * a verificação no servidor de propósito — o link chega por e-mail, sem nada
 * guardado no navegador de quem clica, e o fluxo com PKCE exigiria justamente
 * isso. Assim o professor pode abrir o e-mail no celular e entrar direto.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tipo = request.nextUrl.searchParams.get("type");

  const falhar = (motivo: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/professor/login";
    url.search = `?erro=${motivo}`;
    return NextResponse.redirect(url);
  };

  if (!tokenHash || (tipo !== "invite" && tipo !== "recovery")) {
    return falhar("link_invalido");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.verifyOtp({
    type: tipo,
    token_hash: tokenHash,
  });

  // Link já usado, expirado ou adulterado. Sem detalhes na tela: quem clicou
  // não tem o que fazer com eles, e detalhar ajudaria quem tentasse adivinhar.
  if (error || !data.user) {
    return falhar("link_expirado");
  }

  // Administrador que pediu nova senha volta para o painel, onde existe o
  // formulário de troca. Professor vai para a tela que exige definir a senha.
  const { data: admin } = await createSupabaseAdminClient()
    .from("administradores")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();

  const url = request.nextUrl.clone();
  url.pathname = admin ? "/admin/dashboard" : "/professor/alterar-senha";
  url.search = "";
  return NextResponse.redirect(url);
}
