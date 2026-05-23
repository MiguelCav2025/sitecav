"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, Download, Users } from "lucide-react";

interface Aluno {
  id: string;
  nome: string;
  email: string | null;
  turma_id: string | null;
  ativo: boolean;
}

interface Turma {
  id: string;
  nome: string;
  semestre: string;
}

interface ResultadoProcesso {
  id: string;
  nome: string;
  curso: string;
  periodo: string;
  semestre: string;
}

export default function AlunosManager() {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState("");
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "" });

  useEffect(() => {
    supabase.from("turmas").select("id, nome, semestre").order("created_at", { ascending: false })
      .then(({ data }) => setTurmas(data ?? []));
  }, []);

  useEffect(() => {
    if (!turmaSelecionada) { setAlunos([]); return; }
    setLoading(true);
    supabase.from("alunos").select("*").eq("turma_id", turmaSelecionada).eq("ativo", true).order("nome")
      .then(({ data }) => { setAlunos(data ?? []); setLoading(false); });
  }, [turmaSelecionada]);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleAdicionar = async () => {
    if (!form.nome.trim()) return showMsg("erro", "Nome é obrigatório.");
    if (!turmaSelecionada) return showMsg("erro", "Selecione uma turma.");
    setSalvando(true);
    const { error } = await supabase.from("alunos").insert([{ nome: form.nome.trim(), email: form.email.trim() || null, turma_id: turmaSelecionada }]);
    if (error) showMsg("erro", "Erro ao adicionar aluno.");
    else {
      showMsg("ok", `${form.nome} adicionado!`);
      setForm({ nome: "", email: "" });
      const { data } = await supabase.from("alunos").select("*").eq("turma_id", turmaSelecionada).eq("ativo", true).order("nome");
      setAlunos(data ?? []);
    }
    setSalvando(false);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Remover aluno da turma?")) return;
    await supabase.from("alunos").update({ ativo: false }).eq("id", id);
    setAlunos(prev => prev.filter(a => a.id !== id));
  };

  // Importar aprovados do processo seletivo para a turma selecionada
  const handleImportarDoProcesso = async () => {
    if (!turmaSelecionada) return showMsg("erro", "Selecione uma turma primeiro.");
    const turma = turmas.find(t => t.id === turmaSelecionada);
    if (!turma) return;

    setImportando(true);
    // Busca resultados ativos do processo
    const { data: resultados } = await supabase
      .from("resultados_processo")
      .select("*")
      .eq("is_active", true)
      .eq("semestre", turma.semestre);

    if (!resultados || resultados.length === 0) {
      showMsg("erro", `Nenhum resultado encontrado para o semestre ${turma.semestre}. Verifique se publicou os resultados neste semestre.`);
      setImportando(false);
      return;
    }

    // Filtra por curso e turno da turma selecionada
    const turmaNome = turma.nome; // ex: "Animação Manhã 2026/1"
    const curso = turmaNome.includes("Animação") ? "Animação" : "Cine/TV";
    const periodo = turmaNome.includes("Manhã") ? "Manhã" : "Noite";

    const filtrados = (resultados as ResultadoProcesso[]).filter(r => r.curso === curso && r.periodo === periodo);

    if (filtrados.length === 0) {
      showMsg("erro", `Nenhum aprovado encontrado para ${curso} / ${periodo} no semestre ${turma.semestre}.`);
      setImportando(false);
      return;
    }

    // Evita duplicatas — busca quem já está
    const { data: existentes } = await supabase.from("alunos").select("nome").eq("turma_id", turmaSelecionada);
    const nomesExistentes = new Set((existentes ?? []).map((a: any) => a.nome.toLowerCase()));
    const novos = filtrados.filter(r => !nomesExistentes.has(r.nome.toLowerCase()));

    if (novos.length === 0) {
      showMsg("ok", "Todos os aprovados já estão cadastrados nesta turma.");
      setImportando(false);
      return;
    }

    const { error } = await supabase.from("alunos").insert(
      novos.map(r => ({ nome: r.nome, turma_id: turmaSelecionada }))
    );

    if (error) showMsg("erro", "Erro ao importar alunos.");
    else {
      showMsg("ok", `${novos.length} aluno(s) importado(s) do processo seletivo!`);
      const { data } = await supabase.from("alunos").select("*").eq("turma_id", turmaSelecionada).eq("ativo", true).order("nome");
      setAlunos(data ?? []);
    }
    setImportando(false);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de turma */}
      <Card>
        <CardHeader><CardTitle className="text-base">Selecionar Turma</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Turma</Label>
            <Select value={turmaSelecionada} onValueChange={setTurmaSelecionada}>
              <SelectTrigger><SelectValue placeholder="Selecione uma turma..." /></SelectTrigger>
              <SelectContent>
                {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {turmaSelecionada && (
            <Button variant="outline" size="sm" onClick={handleImportarDoProcesso} disabled={importando}>
              {importando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Importar aprovados do Processo Seletivo
            </Button>
          )}
        </CardContent>
      </Card>

      {turmaSelecionada && (
        <>
          {/* Adicionar aluno */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar Aluno</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAdicionar()} />
                </div>
                <div className="space-y-1">
                  <Label>E-mail (opcional)</Label>
                  <Input placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                  {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {msg.texto}
                </div>
              )}
              <Button onClick={handleAdicionar} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar
              </Button>
            </CardContent>
          </Card>

          {/* Lista de alunos */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" /> {alunos.length} aluno{alunos.length !== 1 ? "s" : ""} na turma
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : alunos.length === 0 ? (
              <p className="text-sm text-white/50 italic">Nenhum aluno cadastrado nesta turma.</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">E-mail</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {alunos.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{a.nome}</td>
                          <td className="px-4 py-3 text-gray-500">{a.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleExcluir(a.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
