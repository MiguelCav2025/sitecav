"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Loader2, CheckCircle, AlertCircle, Info, GraduationCap } from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  semestre: string;
  curso: string;
  turno: string;
  ativa: boolean;
  _alunos_count?: number;
}

const CURSOS = ["Animação", "Cine/TV"];
const TURNOS = ["Manhã", "Noite"];

// Calcula em qual semestre do curso uma turma está, dado o semestre atual
function calcularSemestreDoCurso(semestreEntrada: string): string {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const semestreAtual = hoje.getMonth() < 6 ? 1 : 2;

  const [anoEntrada, semEntrada] = semestreEntrada.split("/").map(Number);
  if (!anoEntrada || !semEntrada) return "";

  const totalSemestresPassados =
    (anoAtual - anoEntrada) * 2 + (semestreAtual - semEntrada);
  const semCurso = totalSemestresPassados + 1;

  if (semCurso <= 0) return "Ainda não iniciou";
  if (semCurso === 1) return "1º semestre do curso";
  if (semCurso === 2) return "2º semestre do curso";
  if (semCurso === 3) return "3º semestre do curso";
  return "Curso concluído";
}

function badgeSemestre(semCurso: string) {
  if (semCurso.includes("1º")) return "bg-green-100 text-green-700";
  if (semCurso.includes("2º")) return "bg-blue-100 text-blue-700";
  if (semCurso.includes("3º")) return "bg-purple-100 text-purple-700";
  if (semCurso.includes("concluído")) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-700";
}

export default function TurmasManager({ onSelectTurma }: { onSelectTurma?: (id: string, nome: string) => void }) {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ semestre: "", curso: "", turno: "" });

  const preview = form.curso && form.turno && form.semestre
    ? `${form.curso} · ${form.turno} · Entrada ${form.semestre}`
    : null;

  const fetchTurmas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("turmas")
      .select("*, alunos(count)")
      .order("semestre", { ascending: false });
    if (data) {
      setTurmas(data.map((t: any) => ({ ...t, _alunos_count: t.alunos?.[0]?.count ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTurmas(); }, []);

  const handleCriar = async () => {
    if (!form.semestre || !form.curso || !form.turno) return setMsg({ tipo: "erro", texto: "Preencha todos os campos." });
    setSalvando(true);
    const nome = `${form.curso} ${form.turno} ${form.semestre}`;
    const { error } = await supabase.from("turmas").insert([{ nome, semestre: form.semestre, curso: form.curso, turno: form.turno }]);
    if (error) setMsg({ tipo: "erro", texto: "Erro ao criar turma." });
    else {
      setMsg({ tipo: "ok", texto: `Turma criada: ${nome}` });
      setForm({ semestre: "", curso: "", turno: "" });
      fetchTurmas();
    }
    setSalvando(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir turma? Os alunos vinculados perderão o vínculo.")) return;
    await supabase.from("turmas").delete().eq("id", id);
    fetchTurmas();
  };

  // Agrupa turmas por curso para exibição organizada
  const turmasPorCurso = CURSOS.reduce<Record<string, Turma[]>>((acc, curso) => {
    acc[curso] = turmas.filter(t => t.curso === curso);
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* Explicação do conceito */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>Cada turma representa um <strong>grupo de entrada</strong> — os alunos que ingressaram juntos num mesmo semestre. Como o curso tem 3 semestres, em qualquer período letivo você pode ter até 3 turmas ativas por curso/turno ao mesmo tempo.</p>
          <p className="text-blue-600 text-xs">Ex: em 2026/2 coexistem a turma que entrou em 2025/2 (3º semestre), a de 2026/1 (2º semestre) e a de 2026/2 (1º semestre).</p>
        </div>
      </div>

      {/* Criar turma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Turma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Semestre de entrada</Label>
              <Input
                placeholder="ex: 2026/2"
                value={form.semestre}
                onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))}
              />
              <p className="text-xs text-gray-400">Quando este grupo começou o curso</p>
            </div>
            <div className="space-y-1">
              <Label>Curso</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview do nome */}
          {preview && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
              <GraduationCap className="h-4 w-4 text-gray-400 shrink-0" />
              <span>Esta turma ficará identificada como: <strong>{preview}</strong></span>
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
            Criar Turma
          </Button>
        </CardContent>
      </Card>

      {/* Lista de turmas */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : turmas.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhuma turma cadastrada.</p>
      ) : (
        <div className="space-y-6">
          {CURSOS.map(curso => {
            const lista = turmasPorCurso[curso];
            if (!lista || lista.length === 0) return null;
            return (
              <div key={curso}>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">{curso}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lista.map(t => {
                    const semCurso = calcularSemestreDoCurso(t.semestre);
                    return (
                      <div key={t.id} className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div>
                              <p className="font-semibold text-gray-800">{t.turno}</p>
                              <p className="text-xs text-gray-400">Entrada: {t.semestre}</p>
                            </div>
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badgeSemestre(semCurso)}`}>
                              {semCurso}
                            </span>
                            <p className="text-xs text-gray-400 flex items-center gap-1 pt-1">
                              <Users className="h-3 w-3" />
                              {t._alunos_count} aluno{t._alunos_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <button onClick={() => handleExcluir(t.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {onSelectTurma && (
                          <Button size="sm" variant="outline" className="mt-3 w-full text-xs" onClick={() => onSelectTurma(t.id, t.nome)}>
                            Ver alunos
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
