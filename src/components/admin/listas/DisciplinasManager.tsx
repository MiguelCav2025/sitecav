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
  GraduationCap, UserCheck, Calendar
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
  dia_da_semana: number | null;
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
const DIAS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
];

const badgeSem = (s: number) => {
  if (s === 1) return { badge: "bg-green-100 text-green-700", border: "border-green-200", header: "bg-green-50" };
  if (s === 2) return { badge: "bg-blue-100 text-blue-700", border: "border-blue-200", header: "bg-blue-50" };
  return { badge: "bg-purple-100 text-purple-700", border: "border-purple-200", header: "bg-purple-50" };
};

function calcularSemestreDoCurso(semestreEntrada: string): number {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const semestreAtual = hoje.getMonth() < 6 ? 1 : 2;
  const [anoEntrada, semEntrada] = semestreEntrada.split("/").map(Number);
  if (!anoEntrada || !semEntrada) return 0;
  return (anoAtual - anoEntrada) * 2 + (semestreAtual - semEntrada) + 1;
}

// ── Modal de aulas por disciplina ─────────────────────────────────────────────

function AulasDaDisciplinaModal({
  disciplina,
  professores,
  onClose,
}: {
  disciplina: Disciplina;
  professores: Professor[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const [aulas, setAulas] = useState<AulaDaDisciplina[]>([]);
  const [loading, setLoading] = useState(true);
  // professor atual por turma_id
  const [profPorTurma, setProfPorTurma] = useState<Record<string, string>>({});
  const [salvandoProf, setSalvandoProf] = useState<Record<string, boolean>>({});

  const carregarAulas = () => {
    supabase
      .from("aulas")
      .select("id, numero, chamada_aberta, data_aula, turma:turmas(id, turno, semestre), professor:professores(id, nome)")
      .eq("disciplina_id", disciplina.id)
      .order("numero")
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as AulaDaDisciplina[];
        setAulas(rows);
        // inicializa o professor por turma pegando o da primeira aula de cada turma
        const mapa: Record<string, string> = {};
        rows.forEach(a => {
          if (!mapa[a.turma.id] && (a.professor as any)?.id) {
            mapa[a.turma.id] = (a.professor as any).id;
          }
        });
        setProfPorTurma(mapa);
        setLoading(false);
      });
  };

  useEffect(() => { carregarAulas(); }, [disciplina.id]);

  // Atualiza todas as aulas da disciplina para uma turma com o novo professor
  const handleChangeProfTurma = async (turmaId: string, professorId: string) => {
    setSalvandoProf(prev => ({ ...prev, [turmaId]: true }));
    const pid = professorId === "none" ? null : professorId;
    await supabase
      .from("aulas")
      .update({ professor_id: pid })
      .eq("disciplina_id", disciplina.id)
      .eq("turma_id", turmaId);
    setProfPorTurma(prev => ({ ...prev, [turmaId]: professorId }));
    setSalvandoProf(prev => ({ ...prev, [turmaId]: false }));
  };

  // Agrupa por turma (chave = turma_id para poder atualizar)
  const porTurma: Record<string, { label: string; turmaId: string; aulas: AulaDaDisciplina[] }> = {};
  aulas.forEach(a => {
    if (!porTurma[a.turma.id]) {
      porTurma[a.turma.id] = {
        label: `${a.turma.turno} — Entrada ${a.turma.semestre}`,
        turmaId: a.turma.id,
        aulas: [],
      };
    }
    porTurma[a.turma.id].aulas.push(a);
  });

  const totalFeitas = aulas.filter(a => a.chamada_aberta).length;

  return (
    <DialogContent className="!max-w-3xl max-h-[85vh] flex flex-col">
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
        <div className="flex gap-3 text-sm flex-wrap">
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">{disciplina.total_aulas} aulas/turma</span>
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">{totalFeitas} chamadas feitas</span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">{aulas.length - totalFeitas} pendentes</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : Object.keys(porTurma).length === 0 ? (
          <p className="text-sm text-gray-400 italic py-6 text-center">Nenhuma aula gerada ainda.</p>
        ) : (
          Object.values(porTurma).map(({ label, turmaId, aulas: aulasT }) => (
            <div key={turmaId}>
              {/* Cabeçalho da turma com seletor de professor */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                  <Select
                    value={profPorTurma[turmaId] ?? "none"}
                    onValueChange={v => handleChangeProfTurma(turmaId, v)}
                    disabled={salvandoProf[turmaId]}
                  >
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue placeholder="Professor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem professor</SelectItem>
                      {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {salvandoProf[turmaId] && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aula</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Chamada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aulasT.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">Aula {a.numero}</td>
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

// ── Card compacto de disciplina na grade ──────────────────────────────────────

function DisciplinaCard({
  disciplina,
  professores,
  onVerAulas,
  onExcluir,
  onChangeDia,
}: {
  disciplina: Disciplina;
  professores: Professor[];
  onVerAulas: () => void;
  onExcluir: () => void;
  onChangeDia: (dia: number | null) => void;
}) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="font-semibold text-gray-800 text-sm leading-tight flex-1">{disciplina.nome}</p>
        <button
          onClick={onExcluir}
          className="text-red-300 hover:text-red-600 p-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">{disciplina.total_aulas} aulas</p>
      <div className="flex items-center gap-1 justify-between">
        <button
          onClick={onVerAulas}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          Ver aulas
        </button>
        {/* Seletor de dia inline */}
        <Select
          value={disciplina.dia_da_semana?.toString() ?? "none"}
          onValueChange={v => onChangeDia(v === "none" ? null : parseInt(v))}
        >
          <SelectTrigger className="h-6 text-xs w-24 border-dashed border-gray-300 text-gray-500">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem dia</SelectItem>
            {DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
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

  const [form, setForm] = useState({
    nome: "",
    curso: "",
    semestre_do_curso: "",
    total_aulas: "16",
    dia_da_semana: "",
    professores_por_turma: {} as Record<string, string>,
  });

  const turmasAfetadas = turmas.filter(t => {
    if (!form.curso || !form.semestre_do_curso) return false;
    return t.curso === form.curso && calcularSemestreDoCurso(t.semestre) === parseInt(form.semestre_do_curso);
  });

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const [{ data: discs }, { data: ts }, { data: ps }] = await Promise.all([
      supabase.from("disciplinas").select("*").order("curso").order("semestre_do_curso").order("dia_da_semana", { ascending: true, nullsFirst: false }).order("nome"),
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

    const { data: novaDisc, error: errDisc } = await supabase
      .from("disciplinas")
      .insert([{
        nome: form.nome.trim(),
        curso: form.curso,
        semestre_do_curso: parseInt(form.semestre_do_curso),
        total_aulas: parseInt(form.total_aulas),
        dia_da_semana: form.dia_da_semana ? parseInt(form.dia_da_semana) : null,
      }])
      .select()
      .single();

    if (errDisc || !novaDisc) {
      showMsg("erro", "Erro ao criar disciplina.");
      setSalvando(false);
      return;
    }

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
      setForm({ nome: "", curso: "", semestre_do_curso: "", total_aulas: "16", dia_da_semana: "", professores_por_turma: {} });
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

  const handleChangeDia = async (id: string, dia: number | null) => {
    await supabase.from("disciplinas").update({ dia_da_semana: dia }).eq("id", id);
    setDisciplinas(prev => prev.map(d => d.id === id ? { ...d, dia_da_semana: dia } : d));
  };

  // Agrupa disciplinas: curso → semestre → dia_da_semana
  const porCursoSemestre = CURSOS.reduce<Record<string, Record<number, Disciplina[]>>>((acc, curso) => {
    acc[curso] = {};
    [1, 2, 3].forEach(sem => {
      acc[curso][sem] = disciplinas.filter(d => d.curso === curso && d.semestre_do_curso === sem);
    });
    return acc;
  }, {});

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
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome da disciplina *</Label>
              <Input className="w-full" placeholder="ex: Direção de Fotografia III" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Curso *</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v, semestre_do_curso: "", professores_por_turma: {} }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Semestre do curso *</Label>
              <Select value={form.semestre_do_curso} onValueChange={v => setForm(f => ({ ...f, semestre_do_curso: v, professores_por_turma: {} }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{SEMESTRES_CURSO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Dia da semana</Label>
                <Select value={form.dia_da_semana || "none"} onValueChange={v => setForm(f => ({ ...f, dia_da_semana: v === "none" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Qtd. de aulas *</Label>
                <Input className="w-full" type="number" min="1" max="200" value={form.total_aulas} onChange={e => setForm(f => ({ ...f, total_aulas: e.target.value }))} />
                <p className="text-xs text-gray-400">Geradas automaticamente por turma</p>
              </div>
            </div>
          </div>

          {form.curso && form.semestre_do_curso && (
            <div className={`rounded-xl p-4 border ${turmasAfetadas.length > 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              {turmasAfetadas.length === 0 ? (
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Nenhuma turma de <strong>{form.curso}</strong> está no <strong>{form.semestre_do_curso}º semestre</strong> agora.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {turmasAfetadas.length} turma{turmasAfetadas.length !== 1 ? "s" : ""} · {turmasAfetadas.length * parseInt(form.total_aulas || "0")} aulas no total
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
                            onValueChange={v => setForm(f => ({ ...f, professores_por_turma: { ...f.professores_por_turma, [t.id]: v === "none" ? "" : v } }))}
                          >
                            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Professor (opcional)" /></SelectTrigger>
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

      {/* Grade semanal por curso e semestre */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : disciplinas.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhuma disciplina cadastrada.</p>
      ) : (
        <div className="space-y-8">
          {CURSOS.map(curso => {
            const temAlguma = [1, 2, 3].some(sem => porCursoSemestre[curso][sem].length > 0);
            if (!temAlguma) return null;
            return (
              <div key={curso} className="space-y-5">
                <p className="text-white font-bold text-lg border-b border-white/20 pb-2">{curso}</p>

                {[1, 2, 3].map(sem => {
                  const discs = porCursoSemestre[curso][sem];
                  if (discs.length === 0) return null;
                  const cores = badgeSem(sem);

                  // Agrupa por dia: 1-5 + null (sem dia)
                  const porDia: Record<string, Disciplina[]> = { "1": [], "2": [], "3": [], "4": [], "5": [], "none": [] };
                  discs.forEach(d => {
                    const key = d.dia_da_semana?.toString() ?? "none";
                    if (!porDia[key]) porDia[key] = [];
                    porDia[key].push(d);
                  });

                  const temSemDia = porDia["none"].length > 0;

                  return (
                    <div key={sem} className="space-y-2">
                      {/* Cabeçalho do semestre */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cores.badge}`}>{sem}º semestre</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      {/* Grade Mon-Fri */}
                      <div className="grid grid-cols-5 gap-2">
                        {DIAS.map(dia => (
                          <div key={dia.value} className="space-y-1.5">
                            {/* Cabeçalho do dia */}
                            <div className={`text-center text-xs font-semibold py-1.5 rounded-lg ${cores.header} ${cores.badge.split(" ")[1]}`}>
                              <Calendar className="h-3 w-3 mx-auto mb-0.5" />
                              {dia.label}
                            </div>
                            {/* Disciplinas do dia */}
                            {porDia[dia.value].length === 0 ? (
                              <div className="border-2 border-dashed border-white/10 rounded-xl h-16 flex items-center justify-center">
                                <span className="text-white/20 text-xs">—</span>
                              </div>
                            ) : (
                              porDia[dia.value].map(d => (
                                <DisciplinaCard
                                  key={d.id}
                                  disciplina={d}
                                  professores={professores}
                                  onVerAulas={() => setDisciplinaSelecionada(d)}
                                  onExcluir={() => handleExcluir(d.id, d.nome)}
                                  onChangeDia={dia => handleChangeDia(d.id, dia)}
                                />
                              ))
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Disciplinas sem dia definido */}
                      {temSemDia && (
                        <div className="mt-1">
                          <p className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Sem dia definido — clique em &quot;Dia&quot; no card para atribuir
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {porDia["none"].map(d => (
                              <div key={d.id} className="w-48">
                                <DisciplinaCard
                                  disciplina={d}
                                  professores={professores}
                                  onVerAulas={() => setDisciplinaSelecionada(d)}
                                  onExcluir={() => handleExcluir(d.id, d.nome)}
                                  onChangeDia={dia => handleChangeDia(d.id, dia)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de aulas */}
      <Dialog open={!!disciplinaSelecionada} onOpenChange={open => { if (!open) setDisciplinaSelecionada(null); }}>
        {disciplinaSelecionada && (
          <AulasDaDisciplinaModal
            disciplina={disciplinaSelecionada}
            professores={professores}
            onClose={() => setDisciplinaSelecionada(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
