import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Barreira de autenticação server-side para as áreas restritas.
 *
 * Antes disso a proteção era só client-side (redirect dentro de um useEffect),
 * o que significa que o HTML da área restrita era servido a qualquer visitante
 * e o bloqueio dependia do JavaScript carregar.
 *
 * Aqui só verificamos SE existe sessão. A distinção entre admin e professor
 * continua no client (e, para dados, no RLS + nas rotas de /api/admin).
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const ehAreaDoProfessor = request.nextUrl.pathname.startsWith("/professor");

  /**
   * Manda para o login, dizendo por quê.
   *
   * `conexao` existe porque antes havia um caso só: "não tem sessão". Se o
   * `getUser()` LANÇASSE — Supabase fora do ar, rede instável, timeout — o
   * desfecho era idêntico ao de quem nunca logou, e a pessoa voltava ao
   * formulário sem uma palavra. Ela tenta a senha de novo, acha que errou,
   * pede para redefinir. Falhar fechado está certo; falhar calado, não.
   */
  const paraOLogin = (motivo?: "conexao") => {
    const url = request.nextUrl.clone();
    url.pathname = ehAreaDoProfessor ? "/professor/login" : "/admin/login";
    url.search = motivo ? `?erro=${motivo}` : "";
    return NextResponse.redirect(url);
  };

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Sem conseguir perguntar, não se conclui nada — e não concluir nada
    // significa negar. Nunca deixar passar por não ter tido resposta.
    return paraOLogin("conexao");
  }

  if (!user) return paraOLogin();

  // O painel exige ser administrador, não apenas estar autenticado. Sem esta
  // checagem, um professor logado recebia o HTML do painel e só era mandado
  // embora depois que o JavaScript rodasse — os dados ficavam protegidos pelo
  // RLS, mas a casca aparecia.
  if (!ehAreaDoProfessor) {
    let admin = null;
    try {
      const { data } = await supabase
        .from("administradores")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      admin = data;
    } catch {
      // Mesma regra de cima: sem resposta, nega. Mandar para a área do
      // professor aqui seria pior — a pessoa É admin, e cairia numa tela que
      // não é dela por causa de uma falha de rede.
      return paraOLogin("conexao");
    }

    if (!admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/professor/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Apenas as páginas restritas. As telas de login ficam de fora de proposito.
  matcher: [
    "/admin/dashboard/:path*",
    "/professor/dashboard/:path*",
    "/professor/alterar-senha/:path*",
  ],
};
