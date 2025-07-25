import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminManager() {
  // Troca de senha do usuário logado
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Criação de novo usuário
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Listagem de usuários
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg('As senhas não coincidem.');
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      setPasswordMsg('Erro ao trocar senha: ' + error.message);
    } else {
      setPasswordMsg('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setCreateLoading(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail, password: newUserPassword }),
    });
    setCreateLoading(false);
    if (res.ok) {
      setCreateMsg('Usuário criado com sucesso!');
      setNewUserEmail('');
      setNewUserPassword('');
    } else {
      const data = await res.json();
      setCreateMsg('Erro ao criar usuário: ' + (data.error || 'Erro desconhecido.'));
    }
  }

  async function fetchUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/list-users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setUsersError(data.error || 'Erro ao buscar usuários.');
      }
    } catch (err: any) {
      setUsersError('Erro ao buscar usuários.');
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm('Tem certeza que deseja apagar este usuário?')) return;
    setDeleteMsg(null);
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setDeleteMsg('Usuário apagado com sucesso!');
      fetchUsers();
    } else {
      const data = await res.json();
      setDeleteMsg('Erro ao apagar usuário: ' + (data.error || 'Erro desconhecido.'));
    }
  }

  useEffect(() => {
    fetchUsers();
    // Buscar email do usuário logado
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const isSuperAdmin = userEmail === "suporte.cav.2025@gmail.com";

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Alterar minha senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleChangePassword}>
            {/* <Input type="password" placeholder="Senha atual" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /> */}
            <Input type="password" placeholder="Nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            <Input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full" disabled={passwordLoading}>{passwordLoading ? 'Salvando...' : 'Alterar Senha'}</Button>
            {passwordMsg && <div className="text-center text-sm mt-2 text-blue-900">{passwordMsg}</div>}
          </form>
        </CardContent>
      </Card>
      {isSuperAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Criar novo usuário admin</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleCreateUser}>
                <Input type="email" placeholder="Email do novo usuário" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
                <Input type="password" placeholder="Senha inicial" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required minLength={6} />
                <Button type="submit" className="w-full" disabled={createLoading}>{createLoading ? 'Criando...' : 'Criar Usuário'}</Button>
                {createMsg && <div className="text-center text-sm mt-2 text-blue-900">{createMsg}</div>}
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usuários cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center text-blue-900">Carregando usuários...</div>
              ) : usersError ? (
                <div className="text-center text-red-600">{usersError}</div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between border-b py-2">
                      <div className="font-semibold text-blue-900">{u.email}</div>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(u.id)}>
                        Apagar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {deleteMsg && <div className="text-center text-sm mt-2 text-blue-900">{deleteMsg}</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 