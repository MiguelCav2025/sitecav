import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Somente administradores autenticados podem apagar usuários
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId ausente." }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
