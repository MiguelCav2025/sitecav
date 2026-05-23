"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, UserCheck } from "lucide-react";

interface Professor {
  id: string;
  nome: string;
  email: string;
  turmas?: { turma_id: string }[];
}

interface Turma {
  id: string;
  nome: string;
}

export default function ProfessoresManager() {
  const supabase = createClient();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", turmas: [] as string[] });

  const fetchDados = async () => {
    setLoading(true);
    const [{ data: profs }, { data: ts }] = await Promise.all([
      supabase.from("professores").select("*, turmas:professor_turmas(turma_id)").order("nome"),
      supabase.from("turmas").select("id, nome").order("nome"),
    ]);
    setProfessores(profs ?? []);
    setTurmas(ts ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCriar = async () => {
    if (!form.nome.trim() || !form.email.trim() || !form.senha.trim()) return showMsg("erro", "Nome, e-mail e senha são obrigatórios.");
    if (form.senha.length < 6) return showMsg("erro", "Senha deve ter pelo menos 6 caracteres.");
    setSalvando(true);
    try {
      // Criar usuário no Supabase Auth via API admin (usa a API de admin do supabase)
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.senha, role: "professor", nome: form.nome }),
      });
      const json = await res.json();
      if (!res.ok) { showMsg("erro", json.error ?? "Erro ao criar professor."); setSalvando(false); return; }

      const userId = json.userId;

      // Inserir na tabela professores (senha_alterada = false força troca no primeiro acesso)
      await supabase.from("professores").insert([{ id: userId, nome: form.nome.trim(), email: form.email.trim(), senha_alterada: false }]);

      // Vincular turmas
      if (form.turmas.length > 0) {
        await supabase.from("professor_turmas").insert(form.turmas.map(tid => ({ professor_id: userId, turma_id: tid })));
      }

      showMsg("ok", `Professor ${form.nome} criado com sucesso!`);
      setForm({ nome: "", email: "", senha: "", turmas: [] });
      fetchDados();
    } catch {
      showMsg("erro", "Erro inesperado ao criar professor.");
    }
    setSalvando(false);
  };

  const toggleTurma = (tid: string) => {
    setForm(f => ({
      ...f,
      turmas: f.turmas.includes(tid) ? f.turmas.filter(t => t !== tid) : [...f.turmas, tid],
    }));
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir professor? O acesso dele será removido.")) return;
    await supabase.from("professor_turmas").delete().eq("professor_id", id);
    await supabase.from("professores").delete().eq("id", id);
    // Remove do Auth via API
    await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) });
    fetchDados();
  };

  const getTurmasDoProf = (prof: Professor) =>
    (prof.turmas ?? []).map(pt => turmas.find(t => t.id === pt.turma_id)?.nome).filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Novo Professor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input className="w-full" placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input className="w-full" type="email" placeholder="professor@cav.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Senha provisória *</Label>
              <Input className="w-full" type="password" placeholder="Mín. 6 caracteres" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
            </div>
          </div>

          {turmas.length > 0 && (
            <div className="space-y-2">
              <Label>Turmas vinculadas</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {turmas.map(t => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-gray-50">
                    <Checkbox checked={form.turmas.includes(t.id)} onCheckedChange={() => toggleTurma(t.id)} />
                    <span className="text-sm">{t.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Turmas</th>
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
                    <td className="px-4 py-3 text-gray-500 text-xs">{getTurmasDoProf(p) || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleExcluir(p.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
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
