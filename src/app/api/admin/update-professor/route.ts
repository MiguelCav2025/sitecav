import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabaseServer = await createSupabaseServerClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { professorId, email, nome } = await req.json();
  if (!professorId) return NextResponse.json({ error: "professorId obrigatório." }, { status: 400 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const updates: Record<string, string> = {};
  if (email) updates.email = email;
  if (nome) updates.user_metadata = JSON.stringify({ nome, role: "professor" });

  if (email || nome) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(professorId, {
      ...(email ? { email } : {}),
      ...(nome ? { user_metadata: { nome, role: "professor" } } : {}),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Atualiza tabela professores
  const dbUpdates: Record<string, string> = {};
  if (email) dbUpdates.email = email;
  if (nome) dbUpdates.nome = nome;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabaseAdmin
      .from("professores")
      .update(dbUpdates)
      .eq("id", professorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
