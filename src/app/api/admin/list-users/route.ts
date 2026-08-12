import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  // Somente administradores autenticados podem listar usuários
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Retornar apenas campos relevantes
    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: u.role,
      email_confirmed_at: u.email_confirmed_at,
      phone: u.phone,
      is_confirmed: u.email_confirmed_at !== null,
    }));
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
