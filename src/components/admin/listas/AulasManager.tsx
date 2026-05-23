"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, BookOpen, Wand2 } from "lucide-react";

interface Aula {
  id: string;
  numero: number;
  semana: number | null;
  descricao: string | null;
  chamada_aberta: boolean;
  professor?: { nome: string } | null;
}

interface Turma { id: string; nome: string; }
interface Professor { id: string; nome: string; }

export default function AulasManager() {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmaSel, setTurmaSel] = useState("");
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerandoAulas, setGerandoAulas] = useState(false);
  const [form, setForm] = useState({ numero: "", semana: "", descricao: "", professor_id: "" });

  useEffect(() => {
    Promise.all([
      supabase.from("turmas").select("id, nome").order("nome"),
      supabase.from("professores").select("id, nome").order("nome"),
    ]).then(([{ data: ts }, { data: ps }]) => {
      setTurmas(ts ?? []);
      setProfessores(ps ?? []);
    });
  }, []);

  const fetchAulas = async (turmaId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("aulas")
      .select("*, professor:professores(nome)")
      .eq("turma_id", turmaId)
      .order("numero");
    setAulas((data ?? []) as Aula[]);
    setLoading(false);
  };

  const handleSelectTurma = (id: string) => { setTurmaSel(id); fetchAulas(id); };

  const handleAdicionar = async () => {
    if (!turmaSel || !form.numero) return;
    const { error } = await supabase.from("aulas").insert([{
      turma_id: turmaSel,
      numero: parseInt(form.numero),
      semana: form.semana ? parseInt(form.semana) : null,
      descricao: form.descricao || null,
      professor_id: form.professor_id || null,
    }]);
    if (!error) { setForm({ numero: "", semana: "", descricao: "", professor_id: "" }); fetchAulas(turmaSel); }
  };

  // Gera automaticamente N aulas para a turma
  const handleGerarAulas = async () => {
    const qtd = parseInt(prompt("Quantas aulas gerar para esta turma?") ?? "0");
    if (!qtd || qtd < 1) return;
    setGerandoAulas(true);
    const proxNumero = aulas.length > 0 ? Math.max(...aulas.map(a => a.numero)) + 1 : 1;
    const novas = Array.from({ length: qtd }, (_, i) => ({
      turma_id: turmaSel,
      numero: proxNumero + i,
      semana: Math.ceil((proxNumero + i) / 3), // estimativa: ~3 aulas/semana
    }));
    await supabase.from("aulas").insert(novas);
    fetchAulas(turmaSel);
    setGerandoAulas(false);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir aula? As presenças vinculadas serão removidas.")) return;
    await supabase.from("aulas").delete().eq("id", id);
    setAulas(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Selecionar Turma</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label>Turma</Label>
            <Select value={turmaSel} onValueChange={handleSelectTurma}>
              <SelectTrigger><SelectValue placeholder="Selecione uma turma..." /></SelectTrigger>
              <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {turmaSel && (
        <>
          {/* Adicionar aula */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Aula</CardTitle>
                <Button size="sm" variant="outline" onClick={handleGerarAulas} disabled={gerandoAulas}>
                  {gerandoAulas ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                  Gerar várias
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>Nº da Aula *</Label>
                  <Input type="number" min="1" placeholder="ex: 1" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Semana</Label>
                  <Input type="number" min="1" placeholder="ex: 1" value={form.semana} onChange={e => setForm(f => ({ ...f, semana: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Professor</Label>
                  <Select value={form.professor_id || "none"} onValueChange={v => setForm(f => ({ ...f, professor_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem professor</SelectItem>
                      {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input placeholder="Opcional" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleAdicionar} disabled={!form.numero}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Aula
              </Button>
            </CardContent>
          </Card>

          {/* Lista de aulas */}
          {loading ? (
            <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : aulas.length === 0 ? (
            <p className="text-sm text-white/50 italic">Nenhuma aula cadastrada. Use "Gerar várias" para criar as aulas do semestre de uma vez.</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Aula</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Semana</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Professor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Descrição</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Chamada</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aulas.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium text-gray-800">
                            <BookOpen className="h-4 w-4 text-blue-400 shrink-0" /> Aula {a.numero}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{a.semana ? `Semana ${a.semana}` : "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{a.professor?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.descricao ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.chamada_aberta ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {a.chamada_aberta ? "Feita" : "Pendente"}
                          </span>
                        </td>
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
        </>
      )}
    </div>
  );
}
