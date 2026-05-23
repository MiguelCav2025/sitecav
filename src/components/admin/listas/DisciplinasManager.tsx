"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, Loader2, BookOpen, CheckCircle, AlertCircle,
  GraduationCap, Users, ChevronDown, ChevronUp, UserCheck
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Turma {
  id: string;
  nome: string;
  semestre: string;
  curso: string;
  turno: string;
}

interface Professor {
  id: string;
  nome: string;
}

interface Disciplina {
  id: string;
  nome: string;
  curso: string;
  semestre_do_curso: number;
  total_aulas: number;
  created_at: string;
}

interface AulaDaDisciplina {
  id: string;
  numero: number;
  chamada_aberta: boolean;
  data_aula: string | null;
  turma: { id: string; turno: string; semestre: string };
  professor: { nome: string } | null;
}

const CURSOS = ["Animação", "Cine/TV"];
const SEMESTRES_CURSO = [
  { value: "1", label: "1º semestre do curso" },
  { value: "2", label: "2º semestre do curso" },
  { value: "3", label: "3º semestre do curso" },
];

// Calcula em qual semestre do curso uma turma está agora
function calcularSemestreDoCurso(semestreEntrada: string): number {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const semestreAtual = hoje.getMonth() < 6 ? 1 : 2;
  const [anoEntrada, semEntrada] = semestreEntrada.split("/").map(Number);
  if (!anoEntrada || !semEntrada) return 0;
  const total = (anoAtual - anoEntrada) * 2 + (semestreAtual - semEntrada) + 1;
  return total;
}

// ── Modal de aulas por turma ──────────────────────────────────────────────────

function AulasDaDisciplinaModal({
  disciplina,
  onClose,
}: {
  disciplina: Disciplina;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [aulas, setAulas] = useState<AulaDaDisciplina[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("aulas")
      .select("id, numero, chamada_aberta, data_aula, turma:turmas(id, turno, semestre), professor:professores(nome)")
      .eq("disciplina_id", disciplina.id)
      .order("numero")
      .then(({ data }) => {
        setAulas((data ?? []) as AulaDaDisciplina[]);
        setLoading(false);
      });
  }, [disciplina.id]);

  // Agrupa por turma
  const porTurma: Record<string, AulaDaDisciplina[]> = {};
  aulas.forEach(a => {
    const key = `${a.turma.turno} — Entrada ${a.turma.semestre}`;
    if (!porTurma[key]) porTurma[key] = [];
    porTurma[key].push(a);
  });

  const totalFeitas = aulas.filter(a => a.chamada_aberta).length;

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          {disciplina.nome}
          <span className="text-sm font-normal text-gray-500 ml-1">
            · {disciplina.curso} · {disciplina.semestre_do_curso}º semestre
          </span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        <div className="flex gap-3 text-sm">
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
            {disciplina.total_aulas} aulas/turma
          </span>
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
            {totalFeitas} chamadas feitas
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
            {aulas.length - totalFeitas} pendentes
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : Object.keys(porTurma).length === 0 ? (
          <p className="text-sm text-gray-400 italic py-6 text-center">Nenhuma aula gerada ainda.</p>
        ) : (
          Object.entries(porTurma).map(([turmaLabel, aulasT]) => (
            <div key={turmaLabel}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{turmaLabel}</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aula</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Professor</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Chamada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aulasT.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">Aula {a.numero}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.professor?.nome ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.data_aula ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.chamada_aberta ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {a.chamada_aberta ? "Feita" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </DialogContent>
  );
}

// ── DisciplinasManager principal ──────────────────────────────────────────────

export default function DisciplinasManager() {
  const supabase = createClient();

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<Disciplina | null>(null);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    nome: "",
    curso: "",
    semestre_do_curso: "",
    total_aulas: "16",
    professores_por_turma: {} as Record<string, string>, // turma_id → professor_id
  });

  // Turmas que correspondem ao curso + semestre selecionados no form
  const turmasAfetadas = turmas.filter(t => {
    if (!form.curso || !form.semestre_do_curso) return false;
    return t.curso === form.curso && calcularSemestreDoCurso(t.semestre) === parseInt(form.semestre_do_curso);
  });

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const [{ data: discs }, { data: ts }, { data: ps }] = await Promise.all([
      supabase.from("disciplinas").select("*").order("curso").order("semestre_do_curso").order("nome"),
      supabase.from("turmas").select("id, nome, semestre, curso, turno").order("semestre", { ascending: false }),
      supabase.from("professores").select("id, nome").order("nome"),
    ]);
    setDisciplinas(discs ?? []);
    setTurmas(ts ?? []);
    setProfessores(ps ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCriar = async () => {
    if (!form.nome.trim() || !form.curso || !form.semestre_do_curso || !form.total_aulas) {
      return showMsg("erro", "Preencha nome, curso, semestre e quantidade de aulas.");
    }
    if (turmasAfetadas.length === 0) {
      return showMsg("erro", "Nenhuma turma ativa encontrada para esse curso/semestre. Crie as turmas primeiro.");
    }

    setSalvando(true);

    // 1. Cria a disciplina
    const { data: novaDisc, error: errDisc } = await supabase
      .from("disciplinas")
      .insert([{
        nome: form.nome.trim(),
        curso: form.curso,
        semestre_do_curso: parseInt(form.semestre_do_curso),
        total_aulas: parseInt(form.total_aulas),
      }])
      .select()
      .single();

    if (errDisc || !novaDisc) {
      showMsg("erro", "Erro ao criar disciplina.");
      setSalvando(false);
      return;
    }

    // 2. Gera as aulas para cada turma afetada
    const aulasParaInserir: object[] = [];
    turmasAfetadas.forEach(turma => {
      const professorId = form.professores_por_turma[turma.id] || null;
      for (let i = 1; i <= parseInt(form.total_aulas); i++) {
        aulasParaInserir.push({
          turma_id: turma.id,
          disciplina_id: novaDisc.id,
          numero: i,
          professor_id: professorId || null,
          semana: Math.ceil(i / 3),
        });
      }
    });

    const { error: errAulas } = await supabase.from("aulas").insert(aulasParaInserir);
    if (errAulas) {
      showMsg("erro", `Disciplina criada mas erro ao gerar aulas: ${errAulas.message}`);
    } else {
      const total = turmasAfetadas.length * parseInt(form.total_aulas);
      showMsg("ok", `"${form.nome}" criada! ${total} aulas geradas para ${turmasAfetadas.length} turma(s).`);
      setForm({ nome: "", curso: "", semestre_do_curso: "", total_aulas: "16", professores_por_turma: {} });
    }

    fetchDados();
    setSalvando(false);
  };

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"? Todas as aulas e presenças vinculadas serão removidas.`)) return;
    await supabase.from("aulas").delete().eq("disciplina_id", id);
    await supabase.from("disciplinas").delete().eq("id", id);
    fetchDados();
  };

  const toggleExpandida = (id: string) =>
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }));

  // Agrupa disciplinas por curso para exibição
  const disciplinasPorCurso = CURSOS.reduce<Record<string, Disciplina[]>>((acc, curso) => {
    acc[curso] = disciplinas.filter(d => d.curso === curso);
    return acc;
  }, {});

  const badgeSem = (s: number) => {
    if (s === 1) return "bg-green-100 text-green-700";
    if (s === 2) return "bg-blue-100 text-blue-700";
    return "bg-purple-100 text-purple-700";
  };

  return (
    <div className="space-y-6">

      {/* Criar disciplina */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Disciplina
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Campos principais */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1 lg:col-span-2">
              <Label>Nome da disciplina *</Label>
              <Input
                placeholder="ex: Direção de Fotografia III"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Curso *</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v, semestre_do_curso: "", professores_por_turma: {} }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Semestre do curso *</Label>
              <Select value={form.semestre_do_curso} onValueChange={v => setForm(f => ({ ...f, semestre_do_curso: v, professores_por_turma: {} }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SEMESTRES_CURSO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1">
              <Label>Quantidade de aulas no semestre *</Label>
              <Input
                type="number"
                min="1"
                max="200"
                value={form.total_aulas}
                onChange={e => setForm(f => ({ ...f, total_aulas: e.target.value }))}
              />
              <p className="text-xs text-gray-400">Serão geradas automaticamente para cada turma</p>
            </div>
          </div>

          {/* Preview das turmas afetadas + seletor de professor por turma */}
          {form.curso && form.semestre_do_curso && (
            <div className={`rounded-xl p-4 border ${turmasAfetadas.length > 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              {turmasAfetadas.length === 0 ? (
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Nenhuma turma de <strong>{form.curso}</strong> está no <strong>{form.semestre_do_curso}º semestre</strong> agora.
                  Verifique se as turmas foram criadas com a data de entrada correta.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {turmasAfetadas.length} turma{turmasAfetadas.length !== 1 ? "s" : ""} afetada{turmasAfetadas.length !== 1 ? "s" : ""} — serão geradas {turmasAfetadas.length * parseInt(form.total_aulas || "0")} aulas no total
                  </p>
                  <div className="space-y-2">
                    {turmasAfetadas.map(t => (
                      <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-blue-100">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{t.turno}</p>
                          <p className="text-xs text-gray-400">Entrada {t.semestre}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-gray-400" />
                          <Select
                            value={form.professores_por_turma[t.id] || "none"}
                            onValueChange={v => setForm(f => ({
                              ...f,
                              professores_por_turma: { ...f.professores_por_turma, [t.id]: v === "none" ? "" : v }
                            }))}
                          >
                            <SelectTrigger className="w-44 h-8 text-xs">
                              <SelectValue placeholder="Professor (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem professor</SelectItem>
                              {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            Criar Disciplina e Gerar Aulas
          </Button>
        </CardContent>
      </Card>

      {/* Lista de disciplinas */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : disciplinas.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhuma disciplina cadastrada.</p>
      ) : (
        <div className="space-y-6">
          {CURSOS.map(curso => {
            const lista = disciplinasPorCurso[curso];
            if (!lista || lista.length === 0) return null;

            // Agrupa por semestre dentro do curso
            const porSemestre: Record<number, Disciplina[]> = {};
            lista.forEach(d => {
              if (!porSemestre[d.semestre_do_curso]) porSemestre[d.semestre_do_curso] = [];
              porSemestre[d.semestre_do_curso].push(d);
            });

            return (
              <div key={curso}>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">{curso}</p>
                <div className="space-y-4">
                  {[1, 2, 3].map(sem => {
                    const discs = porSemestre[sem];
                    if (!discs || discs.length === 0) return null;
                    return (
                      <div key={sem}>
                        <p className="text-white/50 text-xs mb-2 flex items-center gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badgeSem(sem)}`}>
                            {sem}º semestre
                          </span>
                        </p>
                        <div className="space-y-2">
                          {discs.map(d => (
                            <div key={d.id} className="bg-white rounded-xl overflow-hidden">
                              <div
                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleExpandida(d.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                                  <div>
                                    <p className="font-semibold text-gray-800">{d.nome}</p>
                                    <p className="text-xs text-gray-400">{d.total_aulas} aulas por turma</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={e => { e.stopPropagation(); setDisciplinaSelecionada(d); }}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                  >
                                    Ver aulas
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleExcluir(d.id, d.nome); }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  {expandidas[d.id] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de aulas */}
      <Dialog open={!!disciplinaSelecionada} onOpenChange={open => { if (!open) setDisciplinaSelecionada(null); }}>
        {disciplinaSelecionada && (
          <AulasDaDisciplinaModal disciplina={disciplinaSelecionada} onClose={() => setDisciplinaSelecionada(null)} />
        )}
      </Dialog>
    </div>
  );
}
