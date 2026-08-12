import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Somente administradores autenticados podem editar professores
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { professorId, email, nome } = await req.json();
  if (!professorId) return NextResponse.json({ error: "professorId obrigatório." }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();

  // `professorId` é o id do registro em `professores`, que desde a fase 2 não é
  // mais o id do login. O Auth precisa do `user_id`.
  const { data: professor, error: errBusca } = await supabaseAdmin
    .from("professores")
    .select("user_id")
    .eq("id", professorId)
    .maybeSingle();

  if (errBusca) return NextResponse.json({ error: errBusca.message }, { status: 400 });
  if (!professor) return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });

  // Professor sem login (saiu do edital) só tem os dados da tabela atualizados.
  if (professor.user_id && (email || nome)) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(professor.user_id, {
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
