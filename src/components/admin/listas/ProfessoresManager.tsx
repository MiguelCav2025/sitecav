"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, UserCheck } from "lucide-react";

interface Professor {
  id: string;
  nome: string;
  email: string;
  senha_alterada: boolean;
}

export default function ProfessoresManager() {
  const supabase = createClient();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });

  const fetchDados = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("professores")
      .select("id, nome, email, senha_alterada")
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

      await supabase.from("professores").insert([{
        id: json.userId,
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha_alterada: false,
      }]);

      showMsg("ok", `Professor ${form.nome} criado! Senha provisória enviada.`);
      setForm({ nome: "", email: "", senha: "" });
      fetchDados();
    } catch {
      showMsg("erro", "Erro inesperado ao criar professor.");
    }
    setSalvando(false);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir professor? O acesso dele será removido.")) return;
    await supabase.from("professor_turmas").delete().eq("professor_id", id);
    await supabase.from("professores").delete().eq("id", id);
    await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    fetchDados();
  };

  return (
    <div className="space-y-6">
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
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {professores.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-gray-800">
                        <UserCheck className="h-4 w-4 text-blue-500 shrink-0" />
                        {p.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.email}</td>
                    <td className="px-4 py-3">
                      {p.senha_alterada
                        ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Alterada</span>
                        : <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Provisória</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleExcluir(p.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
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
