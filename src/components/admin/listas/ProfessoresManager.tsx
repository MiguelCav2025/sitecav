"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, UserCheck, Pencil, X, Check, Info, KeyRound, Power } from "lucide-react";

interface Professor {
  id: string;
  nome: string;
  email: string;
  senha_alterada: boolean;
  ativo: boolean;
  /** Login do professor. NULL = acesso revogado, histórico preservado. */
  user_id: string | null;
}

export default function ProfessoresManager() {
  const supabase = createClient();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });

  // edição inline
  const [editando, setEditando] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const fetchDados = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("professores")
      .select("id, nome, email, senha_alterada, ativo, user_id")
      .order("ativo", { ascending: false })
      .order("nome");
    setProfessores(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCriar = async () => {
    if (!form.nome.trim() || !form.email.trim() || !form.senha.trim())
      return showMsg("erro", "Nome, e-mail e senha são obrigatórios.");
    if (form.senha.length < 6)
      return showMsg("erro", "Senha deve ter pelo menos 6 caracteres.");

    setSalvando(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.senha, role: "professor", nome: form.nome }),
      });
      const json = await res.json();
      if (!res.ok) { showMsg("erro", json.error ?? "Erro ao criar professor."); setSalvando(false); return; }

      // O registro tem id próprio; o login entra como `user_id`. Assim revogar
      // o acesso depois não apaga o professor nem o histórico de aulas dele.
      const { error: errInsert } = await supabase.from("professores").insert([{
        user_id: json.userId,
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha_alterada: false,
      }]);

      if (errInsert) {
        showMsg("erro", `Login criado, mas houve falha ao cadastrar o professor: ${errInsert.message}`);
        setSalvando(false);
        return;
      }

      showMsg("ok", `Professor ${form.nome} criado!`);
      setForm({ nome: "", email: "", senha: "" });
      fetchDados();
    } catch {
      showMsg("erro", "Erro inesperado ao criar professor.");
    }
    setSalvando(false);
  };

  /**
   * Desativar é a operação normal: o professor sai da grade e perde o acesso,
   * mas o registro e todo o histórico de aulas continuam intactos.
   */
  const handleAlternarAtivo = async (p: Professor) => {
    const desativando = p.ativo;
    if (desativando && !confirm(
      `Desativar ${p.nome}? Ele deixa de aparecer para novas atribuições e perde o acesso ao app, ` +
      `mas o histórico de aulas dele é preservado.`
    )) return;

    const { error } = await supabase
      .from("professores")
      .update({ ativo: !p.ativo })
      .eq("id", p.id);

    if (error) return showMsg("erro", `Erro ao alterar situação: ${error.message}`);
    showMsg("ok", desativando ? `${p.nome} foi desativado.` : `${p.nome} foi reativado.`);
    fetchDados();
  };

  /**
   * Exclusão de verdade. Só funciona para professor que nunca foi vinculado a
   * uma aula — a FK está como RESTRICT justamente para proteger o histórico.
   */
  const handleExcluir = async (p: Professor) => {
    if (!confirm(
      `Excluir ${p.nome} definitivamente? Isto só é possível se ele nunca teve aula atribuída. ` +
      `Se já lecionou, use Desativar.`
    )) return;

    const { error } = await supabase.from("professores").delete().eq("id", p.id);

    if (error) {
      return showMsg("erro",
        `Não é possível excluir: ${p.nome} já tem aulas atribuídas. Use Desativar para preservar o histórico.`
      );
    }

    // Só remove o login depois que o registro saiu sem erro
    if (p.user_id) {
      await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.user_id }),
      });
    }
    showMsg("ok", `${p.nome} foi excluído.`);
    fetchDados();
  };

  const iniciarEdicao = (p: Professor) => {
    setEditando(p.id);
    setEditForm({ nome: p.nome, email: p.email });
  };

  const cancelarEdicao = () => { setEditando(null); };

  const salvarEdicao = async (id: string) => {
    if (!editForm.nome.trim() || !editForm.email.trim()) return;
    setSalvandoEdit(true);
    const res = await fetch("/api/admin/update-professor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professorId: id, nome: editForm.nome.trim(), email: editForm.email.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      showMsg("erro", json.error ?? "Erro ao atualizar professor.");
    } else {
      setProfessores(prev => prev.map(p => p.id === id ? { ...p, nome: editForm.nome.trim(), email: editForm.email.trim() } : p));
      setEditando(null);
      showMsg("ok", "Professor atualizado!");
    }
    setSalvandoEdit(false);
  };

  return (
    <div className="space-y-6">
      {/* Card informativo sobre senha provisória */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 flex gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <KeyRound className="h-4 w-4 text-amber-600" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-800">Senha provisória dos professores</p>
          <p className="text-sm text-gray-600">
            Todos os professores foram cadastrados com a senha provisória{" "}
            <code className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-mono text-xs">Cav@2026</code>.
            No primeiro acesso, o sistema obriga a troca da senha.
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
            <Info className="h-3 w-3 shrink-0" />
            Para editar o e-mail de um professor, clique no ícone de lápis na tabela abaixo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Professor
          </CardTitle>
          <p className="text-sm text-gray-500">
            Crie a conta de acesso do professor. As disciplinas que ele leciona são definidas na aba <strong>Disciplinas</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-gray-700">Nome *</Label>
              <Input
                className="w-full text-gray-800"
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">E-mail *</Label>
              <Input
                className="w-full text-gray-800"
                type="email"
                placeholder="professor@cav.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Senha provisória *</Label>
              <Input
                className="w-full text-gray-800"
                type="password"
                placeholder="Mín. 6 caracteres"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              />
              <p className="text-xs text-gray-400">O professor será obrigado a trocar a senha no primeiro acesso.</p>
            </div>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {msg.texto}
            </div>
          )}

          <Button onClick={handleCriar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Professor
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : professores.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhum professor cadastrado.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Senha</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {professores.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    {editando === p.id ? (
                      <>
                        <td className="px-4 py-2">
                          <Input
                            className="h-8 text-xs text-gray-800 w-full"
                            value={editForm.nome}
                            onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            className="h-8 text-xs text-gray-800 w-full"
                            type="email"
                            value={editForm.email}
                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {p.senha_alterada
                            ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Alterada</span>
                            : <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Provisória</span>
                          }
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => salvarEdicao(p.id)}
                              disabled={salvandoEdit}
                              className="text-green-600 hover:text-green-800 p-1"
                            >
                              {salvandoEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button onClick={cancelarEdicao} className="text-gray-400 hover:text-gray-600 p-1">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-2 font-medium ${p.ativo ? "text-gray-800" : "text-gray-400"}`}>
                            <UserCheck className={`h-4 w-4 shrink-0 ${p.ativo ? "text-blue-500" : "text-gray-300"}`} />
                            {p.nome}
                            {!p.ativo && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${p.ativo ? "text-gray-500" : "text-gray-300"}`}>{p.email}</td>
                        <td className="px-4 py-3">
                          {p.senha_alterada
                            ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Alterada</span>
                            : <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Provisória</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => iniciarEdicao(p)} className="text-blue-400 hover:text-blue-600 p-1" title="Editar">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAlternarAtivo(p)}
                              className={`p-1 ${p.ativo ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}`}
                              title={p.ativo ? "Desativar (preserva o histórico)" : "Reativar"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleExcluir(p)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Excluir (só se nunca teve aula atribuída)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
