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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.startsWith("/professor")
      ? "/professor/login"
      : "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
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
