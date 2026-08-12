import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Somente administradores autenticados podem criar usuários
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { email, password, nome } = await req.json();
  if (!email || !password || !nome) return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });

  // Usa a service_role key para criar usuários no Auth sem confirmação de e-mail
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, role: "professor" },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ userId: data.user?.id });
}
