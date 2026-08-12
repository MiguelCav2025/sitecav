"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  semestreDoCurso,
  semestreLetivo,
  contarDiasLetivos,
  gerarDatasAulas,
} from "@/lib/calendario-escolar";
import RecalcularGrade from "./RecalcularGrade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, Loader2, BookOpen, CheckCircle, AlertCircle,
  GraduationCap, UserCheck, Calendar, ChevronDown, ChevronUp
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
  emoji: string | null;
  created_at: string;
}

const EMOJIS_DISCIPLINA = [
  "📚","🎬","🎥","📽️","🎞️","🎭","🎨","🖼️","✏️","📝",
  "🎵","🎶","🎸","🎹","🎤","🎙️","📸","🖥️","💡","🔬",
  "📐","📏","🗂️","📊","🎯","🏆","🌟","💫","🔆","🎓",
];

interface Cronograma {
  id: string;
  semestre: string;
  data_inicio: string;
  data_fim: string;
  feriados: string[];
}

interface AulaDaDisciplina {
  id: string;
  numero: number;
  chamada_aberta: boolean;
  data_aula: string | null;
  turma: { id: string; turno: string; semestre: string };
  // A consulta pede professores(id, nome); o tipo declarava so o nome, o que
  // obrigava a contornar com `as any` na hora de ler o id.
  professor: { id: string; nome: string } | null;
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

// As regras de calendário vivem em @/lib/calendario-escolar, com testes.
// Estavam duplicadas aqui e em outros três componentes.
const calcularSemestreDoCurso = (semestreEntrada: string) =>
  semestreDoCurso(semestreEntrada) ?? 0;

const semestreLetivoParaTurma = semestreLetivo;

const contarOcorrencias = (inicio: string, fim: string, feriados: string[]) =>
  contarDiasLetivos({ data_inicio: inicio, data_fim: fim, feriados });

// ── Modal de aulas por disciplina ─────────────────────────────────────────────

function AulasDaDisciplinaModal({
  disciplina,
  professores,
  cronogramas,
  onClose,
  onChangeEmoji,
}: {
  disciplina: Disciplina;
  professores: Professor[];
  cronogramas: Cronograma[];
  onClose: () => void;
  onChangeEmoji: (emoji: string) => void;
}) {
  const supabase = createClient();
  const [aulas, setAulas] = useState<AulaDaDisciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [emojiAtual, setEmojiAtual] = useState(disciplina.emoji ?? "📚");
  const [emojiAberto, setEmojiAberto] = useState(false);
  // professor atual por turma_id
  const [profPorTurma, setProfPorTurma] = useState<Record<string, string>>({});
  const [salvandoProf, setSalvandoProf] = useState<Record<string, boolean>>({});

  const handleSalvarEmoji = async (e: string) => {
    setEmojiAtual(e);
    setEmojiAberto(false);
    await supabase.from("disciplinas").update({ emoji: e }).eq("id", disciplina.id);
    onChangeEmoji(e);
  };

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
          if (!mapa[a.turma.id] && a.professor?.id) {
            mapa[a.turma.id] = a.professor.id;
          }
        });
        setProfPorTurma(mapa);
        setLoading(false);
      });
  };

  useEffect(() => { carregarAulas(); }, [disciplina.id]);

  // Reatribui o regente apenas das aulas AINDA NÃO DADAS.
  // Aula fechada guarda quem de fato lecionou e escreveu o diário de sala —
  // reescrevê-la trocaria a autoria do que já aconteceu. O banco também barra.
  const handleChangeProfTurma = async (turmaId: string, professorId: string) => {
    setSalvandoProf(prev => ({ ...prev, [turmaId]: true }));
    const pid = professorId === "none" ? null : professorId;

    const { error } = await supabase
      .from("aulas")
      .update({ professor_id: pid })
      .eq("disciplina_id", disciplina.id)
      .eq("turma_id", turmaId)
      .eq("chamada_aberta", false);

    if (error) {
      setSalvandoProf(prev => ({ ...prev, [turmaId]: false }));
      alert(`Não foi possível trocar o professor: ${error.message}`);
      return;
    }

    setProfPorTurma(prev => ({ ...prev, [turmaId]: professorId }));
    setSalvandoProf(prev => ({ ...prev, [turmaId]: false }));
    carregarAulas();
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
          {/* Emoji clicável */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiAberto(v => !v)}
              className="text-2xl w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Trocar emoji"
            >
              {emojiAtual}
            </button>
            {emojiAberto && (
              <div className="absolute left-0 top-10 z-50 bg-white border border-gray-200 rounded-xl p-2 shadow-xl flex flex-wrap gap-1 w-56">
                <p className="w-full text-xs text-gray-400 mb-1 px-1">Escolha um emoji</p>
                {EMOJIS_DISCIPLINA.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => handleSalvarEmoji(e)}
                    className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors ${emojiAtual === e ? "bg-blue-100 ring-2 ring-blue-400" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
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

        {!loading && aulas.length > 0 && (
          <RecalcularGrade
            disciplina={disciplina}
            aulas={aulas}
            cronogramas={cronogramas}
            onAplicado={carregarAulas}
          />
        )}

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
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-20">Aula</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-24">Chamada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aulasT.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">Aula {a.numero}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            defaultValue={a.data_aula ?? ""}
                            onChange={async e => {
                              const val = e.target.value || null;
                              await supabase.from("aulas").update({ data_aula: val }).eq("id", a.id);
                            }}
                            className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 w-full cursor-pointer hover:border-blue-400 focus:outline-none focus:border-blue-500"
                          />
                        </td>
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
  onChangeEmoji,
}: {
  disciplina: Disciplina;
  professores: Professor[];
  onVerAulas: () => void;
  onExcluir: () => void;
  onChangeDia: (dia: number | null) => void;
  onChangeEmoji: (emoji: string) => void;
}) {
  const [emojiAberto, setEmojiAberto] = useState(false);

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setEmojiAberto(v => !v)}
              className="text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
              title="Trocar emoji"
            >
              {disciplina.emoji ?? "📚"}
            </button>
            {emojiAberto && (
              <div className="absolute left-0 top-8 z-20 bg-white border border-gray-200 rounded-xl p-2 shadow-lg flex flex-wrap gap-1 w-52">
                {EMOJIS_DISCIPLINA.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { onChangeEmoji(e); setEmojiAberto(false); }}
                    className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center hover:bg-gray-100 ${disciplina.emoji === e ? "bg-blue-100" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{disciplina.nome}</p>
        </div>
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
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<Disciplina | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    curso: "",
    semestre_do_curso: "",
    total_aulas: "16",
    dia_da_semana: "",
    emoji: "📚",
    professores_por_turma: {} as Record<string, string>,
  });

  const turmasAfetadas = turmas.filter(t => {
    if (!form.curso || !form.semestre_do_curso) return false;
    return t.curso === form.curso && calcularSemestreDoCurso(t.semestre) === parseInt(form.semestre_do_curso);
  });

  // Calcula quantas aulas o cronograma oferece para o dia selecionado (usa a primeira turma afetada como referência)
  const aulasNoCronograma: number | null = (() => {
    if (!form.dia_da_semana || turmasAfetadas.length === 0 || !form.semestre_do_curso) return null;
    const turmaRef = turmasAfetadas[0];
    const semLetivo = semestreLetivoParaTurma(turmaRef.semestre, parseInt(form.semestre_do_curso));
    const cron = cronogramas.find(c => c.semestre === semLetivo);
    if (!cron) return null;
    const oc = contarOcorrencias(cron.data_inicio, cron.data_fim, cron.feriados);
    return oc[parseInt(form.dia_da_semana)] ?? null;
  })();

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const [{ data: discs }, { data: ts }, { data: ps }, { data: crons }] = await Promise.all([
      supabase.from("disciplinas").select("*").order("curso").order("semestre_do_curso").order("dia_da_semana", { ascending: true, nullsFirst: false }).order("nome"),
      supabase.from("turmas").select("id, nome, semestre, curso, turno").order("semestre", { ascending: false }),
      // Só professores ativos podem receber novas atribuições
      supabase.from("professores").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("cronogramas").select("*").order("data_inicio", { ascending: false }),
    ]);
    setDisciplinas(discs ?? []);
    setTurmas(ts ?? []);
    setProfessores(ps ?? []);
    setCronogramas(crons ?? []);
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
        emoji: form.emoji || "📚",
      }])
      .select()
      .single();

    if (errDisc || !novaDisc) {
      showMsg("erro", "Erro ao criar disciplina.");
      setSalvando(false);
      return;
    }

    const totalAulasNum = parseInt(form.total_aulas);
    const diaSemanaNum = form.dia_da_semana ? parseInt(form.dia_da_semana) : null;

    const aulasParaInserir: object[] = [];
    turmasAfetadas.forEach(turma => {
      const professorId = form.professores_por_turma[turma.id] || null;

      // Tenta encontrar cronograma correspondente ao semestre letivo desta turma
      let datas: (string | null)[] = Array(totalAulasNum).fill(null);
      if (diaSemanaNum) {
        const semLetivo = semestreLetivoParaTurma(turma.semestre, parseInt(form.semestre_do_curso));
        const cron = cronogramas.find(c => c.semestre === semLetivo);
        if (cron) {
          datas = gerarDatasAulas(cron, diaSemanaNum, totalAulasNum);
        }
      }

      for (let i = 1; i <= totalAulasNum; i++) {
        aulasParaInserir.push({
          turma_id: turma.id,
          disciplina_id: novaDisc.id,
          numero: i,
          professor_id: professorId || null,
          semana: Math.ceil(i / 3),
          data_aula: datas[i - 1] ?? null,
        });
      }
    });

    const { error: errAulas } = await supabase.from("aulas").insert(aulasParaInserir);
    if (errAulas) {
      showMsg("erro", `Disciplina criada mas erro ao gerar aulas: ${errAulas.message}`);
    } else {
      const total = turmasAfetadas.length * totalAulasNum;
      const temDatas = diaSemanaNum && aulasParaInserir.some((a) => (a as { data_aula: string | null }).data_aula);
      const sufixo = temDatas ? " com datas preenchidas pelo cronograma." : " (sem datas — defina o cronograma do semestre).";
      showMsg("ok", `"${form.nome}" criada! ${total} aulas geradas para ${turmasAfetadas.length} turma(s)${sufixo}`);
      setForm({ nome: "", curso: "", semestre_do_curso: "", total_aulas: "16", dia_da_semana: "", emoji: "📚", professores_por_turma: {} });
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

  const handleChangeEmoji = async (id: string, emoji: string) => {
    await supabase.from("disciplinas").update({ emoji }).eq("id", id);
    setDisciplinas(prev => prev.map(d => d.id === id ? { ...d, emoji } : d));
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

      {/* Criar disciplina — accordion fechado por default */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormAberto(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Disciplina
          </span>
          {formAberto ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {formAberto && (
        <div className="px-6 pb-6 space-y-5 border-t">
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label className="text-gray-700">Nome da disciplina *</Label>
              <div className="flex gap-2">
                <div className="relative">
                  <div
                    className="w-12 h-10 text-xl bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center"
                    title="Emoji selecionado"
                  >
                    {form.emoji}
                  </div>
                </div>
                <Input className="flex-1 text-gray-800" placeholder="ex: Direção de Fotografia III" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              {/* Grid de emojis */}
              <div className="flex flex-wrap gap-1 bg-gray-50 border border-gray-200 rounded-xl p-2">
                {EMOJIS_DISCIPLINA.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`w-9 h-9 text-xl rounded-lg flex items-center justify-center transition-all hover:scale-110 ${form.emoji === e ? "bg-blue-100 ring-2 ring-blue-400" : "hover:bg-gray-200"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Curso *</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v, semestre_do_curso: "", professores_por_turma: {} }))}>
                <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Semestre do curso *</Label>
              <Select value={form.semestre_do_curso} onValueChange={v => setForm(f => ({ ...f, semestre_do_curso: v, professores_por_turma: {} }))}>
                <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o semestre" /></SelectTrigger>
                <SelectContent>{SEMESTRES_CURSO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-gray-700">Dia da semana</Label>
                <Select
                  value={form.dia_da_semana || "none"}
                  onValueChange={v => {
                    const novoDia = v === "none" ? "" : v;
                    // Auto-preenche total_aulas com o cronograma se possível
                    if (novoDia && turmasAfetadas.length > 0 && form.semestre_do_curso) {
                      const semLetivo = semestreLetivoParaTurma(turmasAfetadas[0].semestre, parseInt(form.semestre_do_curso));
                      const cron = cronogramas.find(c => c.semestre === semLetivo);
                      if (cron) {
                        const oc = contarOcorrencias(cron.data_inicio, cron.data_fim, cron.feriados);
                        const qtd = oc[parseInt(novoDia)];
                        if (qtd) {
                          setForm(f => ({ ...f, dia_da_semana: novoDia, total_aulas: String(qtd) }));
                          return;
                        }
                      }
                    }
                    setForm(f => ({ ...f, dia_da_semana: novoDia }));
                  }}
                >
                  <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Não definido (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-700">Qtd. de aulas *</Label>
                <Input className="w-full text-gray-800" type="number" min="1" max="200" value={form.total_aulas} onChange={e => setForm(f => ({ ...f, total_aulas: e.target.value }))} />
                {aulasNoCronograma !== null ? (
                  <p className={`text-xs flex items-center gap-1 ${parseInt(form.total_aulas) === aulasNoCronograma ? "text-green-600" : "text-amber-600"}`}>
                    <Calendar className="h-3 w-3" />
                    Cronograma prevê <strong>{aulasNoCronograma}</strong> aulas neste dia
                    {parseInt(form.total_aulas) !== aulasNoCronograma && (
                      <button
                        type="button"
                        className="underline ml-1 font-semibold"
                        onClick={() => setForm(f => ({ ...f, total_aulas: String(aulasNoCronograma) }))}
                      >
                        usar {aulasNoCronograma}
                      </button>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Geradas automaticamente por turma</p>
                )}
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
                            <SelectTrigger className="w-44 h-8 text-xs text-gray-700"><SelectValue placeholder="Professor (opcional)" /></SelectTrigger>
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
        </div>
        )}
      </div>

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
                                  onChangeEmoji={emoji => handleChangeEmoji(d.id, emoji)}
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
                                  onChangeEmoji={emoji => handleChangeEmoji(d.id, emoji)}
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
            cronogramas={cronogramas}
            onClose={() => setDisciplinaSelecionada(null)}
            onChangeEmoji={emoji => {
              setDisciplinas(prev => prev.map(d => d.id === disciplinaSelecionada.id ? { ...d, emoji } : d));
              setDisciplinaSelecionada(prev => prev ? { ...prev, emoji } : prev);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
