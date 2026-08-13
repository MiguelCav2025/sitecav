"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useConfirmacao } from "@/components/ui/confirmar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, CheckCircle, KeyRound, Loader2, Power, ShieldCheck, Trash2,
} from "lucide-react";

interface Administrador {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  created_at: string;
}

/**
 * Quem administra o painel.
 *
 * Antes esta tela listava contas pela API de administração do Auth, que está
 * fora do ar neste projeto, e decidia quem podia mexer comparando o e-mail com
 * uma string fixa no código do cliente — legível por qualquer visitante e
 * impossível de mudar sem novo deploy.
 *
 * Agora ela lê a tabela `administradores`, que é a mesma fonte usada pelo
 * `is_admin()` no banco. O que a tela mostra é exatamente o que vale.
 */
export default function AdminManager() {
  const supabase = createClient();
  // `confirmar` já é o campo de confirmação de senha nesta tela.
  const { confirmar: pedirConfirmacao, dialogo } = useConfirmacao();

  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [meuUserId, setMeuUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [trocando, setTrocando] = useState(false);

  const aviso = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 6000);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data }, { data: sessao }] = await Promise.all([
      supabase.from("administradores")
        .select("id, user_id, nome, email, ativo, created_at")
        .order("ativo", { ascending: false }).order("nome"),
      supabase.auth.getUser(),
    ]);
    setAdministradores((data ?? []) as Administrador[]);
    setMeuUserId(sessao.user?.id ?? null);
    setCarregando(false);
  }, [supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  const trocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 8) return aviso("erro", "A senha precisa ter ao menos 8 caracteres.");
    if (novaSenha !== confirmar) return aviso("erro", "As senhas não coincidem.");

    setTrocando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setTrocando(false);

    if (error) return aviso("erro", `Erro ao trocar a senha: ${error.message}`);
    setNovaSenha(""); setConfirmar("");
    aviso("ok", "Senha alterada.");
  };

  const alternarAtivo = async (a: Administrador) => {
    if (a.user_id === meuUserId && a.ativo) {
      return aviso("erro", "Você não pode remover o próprio acesso. Peça a outro administrador.");
    }
    const { error } = await supabase.from("administradores")
      .update({ ativo: !a.ativo }).eq("id", a.id);

    // O banco tem uma trava contra ficar sem nenhum administrador ativo
    if (error) return aviso("erro", error.message);
    aviso("ok", a.ativo ? `${a.nome} perdeu o acesso.` : `${a.nome} voltou a ter acesso.`);
    carregar();
  };

  const remover = async (a: Administrador) => {
    if (a.user_id === meuUserId) {
      return aviso("erro", "Você não pode remover o próprio acesso. Peça a outro administrador.");
    }
    const ok = await pedirConfirmacao({
      titulo: `Remover ${a.nome} do painel?`,
      perigo: true,
      rotuloConfirmar: "Remover acesso",
      descricao: (
        <>
          <p>Ele deixa de administrar o sistema imediatamente.</p>
          <p><strong>A conta de login continua existindo</strong> — só perde o poder de admin. Para devolver, é preciso cadastrá-lo de novo aqui.</p>
        </>
      ),
    });
    if (!ok) return;

    const { error } = await supabase.from("administradores").delete().eq("id", a.id);
    if (error) return aviso("erro", error.message);
    aviso("ok", `${a.nome} removido.`);
    carregar();
  };

  const ativos = administradores.filter(a => a.ativo).length;

  return (
    <div className="grid gap-6">
      {dialogo}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
          msg.tipo === "ok"
            ? "border border-green-200 bg-green-50 text-green-800"
            : "border border-red-200 bg-red-50 text-red-800"}`}>
          {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.texto}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Alterar minha senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-md gap-4" onSubmit={trocarSenha}>
            <div className="space-y-1">
              <Label className="text-gray-700">Nova senha</Label>
              <Input
                type="password" className="text-gray-800" placeholder="Mínimo 8 caracteres"
                value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required minLength={8}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Confirmar</Label>
              <Input
                type="password" className="text-gray-800"
                value={confirmar} onChange={e => setConfirmar(e.target.value)} required minLength={8}
              />
            </div>
            <Button type="submit" disabled={trocando} className="w-fit">
              {trocando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Quem administra o painel
          </CardTitle>
          <p className="text-sm text-gray-500">
            Acesso é concedido aqui, um a um. Quem não está nesta lista não administra nada —
            nem contas criadas por engano.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex items-center gap-2 p-4 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Situação</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {administradores.map(a => {
                  const souEu = a.user_id === meuUserId;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`font-medium ${a.ativo ? "text-gray-800" : "text-gray-400"}`}>
                          {a.nome}
                        </span>
                        {souEu && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">você</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 ${a.ativo ? "text-gray-500" : "text-gray-300"}`}>
                        {a.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.ativo
                          ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Ativo</span>
                          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Sem acesso</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!souEu && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => alternarAtivo(a)}
                              className={`p-1 ${a.ativo ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}`}
                              title={a.ativo ? "Retirar acesso" : "Devolver acesso"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => remover(a)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Remover da lista"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-blue-200">
        {ativos === 1
          ? "Há apenas um administrador ativo. O banco impede que ele seja removido — sem isso, o painel ficaria sem ninguém para entrar."
          : `${ativos} administradores ativos.`}
      </p>
    </div>
  );
}
