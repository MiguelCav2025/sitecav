import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro desconhecido.' }, { status: 500 });
  }
} 