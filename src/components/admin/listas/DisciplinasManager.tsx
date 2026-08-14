"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  moduloAtual,
  semestreLetivo,
  contarDiasLetivos,
  gerarDatasAulas,
} from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { emojiDaDisciplina } from "@/lib/emoji-disciplina";
import { conflitosDeSala, descreverConflito } from "@/lib/conflitos-grade";
import { AULAS_POR_ENCONTRO, rotuloDoTurno } from "@/lib/aulas-do-dia";
import { useConfirmacao } from "@/components/ui/confirmar";
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
  /** Semestre do calendário em que a turma começou. Dele sai o módulo atual. */
  entrada: string;
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
  modulo: number;
  total_aulas: number;
  dia_da_semana: number | null;
  emoji: string | null;
  sala_id: string | null;
  created_at: string;
}

const EMOJIS_DISCIPLINA = [
  "📚","🎬","🎥","📽️","🎞️","🎭","🎨","🖼️","✏️","📝",
  "🎵","🎶","🎸","🎹","🎤","🎙️","📸","🖥️","💡","🔬",
  "📐","📏","🗂️","📊","🎯","🏆","🌟","💫","🔆","🎓",
];

interface Sala {
  id: string;
  nome: string;
}

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
  chamada_finalizada: boolean;
  data_aula: string | null;
  turma: { id: string; turno: string; entrada: string };
  // A consulta pede professores(id, nome); o tipo declarava so o nome, o que
  // obrigava a contornar com `as any` na hora de ler o id.
  professor: { id: string; nome: string } | null;
}

const CURSOS = ["Animação", "Cine/TV"];
const SEMESTRES_CURSO = [
  { value: "1", label: "Módulo 1" },
  { value: "2", label: "Módulo 2" },
  { value: "3", label: "Módulo 3" },
];
const DIAS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
];

// `header` é o fundo do card da disciplina. O verde funciona no tom mais claro;
// azul e roxo somem contra o fundo azul-escuro da página, então sobem um passo.
const badgeSem = (s: number) => {
  if (s === 1) return { badge: "bg-green-100 text-green-700", border: "border-green-200", header: "bg-green-50" };
  if (s === 2) return { badge: "bg-blue-100 text-blue-700", border: "border-blue-300", header: "bg-blue-100" };
  return { badge: "bg-purple-100 text-purple-700", border: "border-purple-300", header: "bg-purple-100" };
};

// As regras de calendário vivem em @/lib/calendario-escolar, com testes.
// Estavam duplicadas aqui e em outros três componentes.
const moduloDaTurma = (entrada: string, semestreAtual: string | null) =>
  moduloAtual(entrada, semestreAtual) ?? 0;

/**
 * Turnos em que cada disciplina realmente acontece.
 *
 * A disciplina não guarda turno: quem tem turno é a turma. Duas disciplinas na
 * mesma sala e dia só colidem se houver turma dos dois lados no mesmo turno.
 */
function turnosPorDisciplina(
  disciplinas: readonly Disciplina[],
  turmas: readonly Turma[],
  semestreAtual: string | null,
): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const d of disciplinas) {
    const turnos = new Set<string>();
    for (const t of turmas) {
      if (t.curso === d.curso && moduloDaTurma(t.entrada, semestreAtual) === d.modulo) {
        turnos.add(t.turno);
      }
    }
    saida[d.id] = [...turnos];
  }
  return saida;
}

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
      .select("id, numero, chamada_finalizada, data_aula, turma:turmas(id, turno, entrada), professor:professores(id, nome)")
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
      .eq("chamada_finalizada", false);

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
        label: `${a.turma.turno} — Entrada ${a.turma.entrada}`,
        turmaId: a.turma.id,
        aulas: [],
      };
    }
    porTurma[a.turma.id].aulas.push(a);
  });

  const totalFeitas = aulas.filter(a => a.chamada_finalizada).length;

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
            · {disciplina.curso} · {disciplina.modulo}º semestre
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
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.chamada_finalizada ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {a.chamada_finalizada ? "Feita" : "Pendente"}
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
  sala,
  professor,
  tom,
  onVerAulas,
  onExcluir,
  onChangeDia,
  onChangeEmoji,
}: {
  disciplina: Disciplina;
  professores: Professor[];
  /** Nome da sala já resolvido — o card só recebe o id da sala, não a lista. */
  sala: string | null;
  /** Quem leciona. Vem das aulas, não da disciplina: o mesmo nome pode ter
      professor diferente na turma da manhã e na da noite. */
  professor: { nome: string; varios: boolean } | null;
  /** Classes de fundo e borda do módulo, para o card carregar a cor da linha. */
  tom: { fundo: string; borda: string };
  onVerAulas: () => void;
  onExcluir: () => void;
  onChangeDia: (dia: number | null) => void;
  onChangeEmoji: (emoji: string) => void;
}) {
  const [emojiAberto, setEmojiAberto] = useState(false);

  return (
    // O card leva a cor do módulo bem diluída. É o que liga o card à faixa
    // "1º semestre" à esquerda sem repetir o rótulo em cada um deles.
    <div className={`${tom.fundo} ${tom.borda} rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow group`}>
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setEmojiAberto(v => !v)}
              className="text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
              title="Trocar emoji"
            >
              {emojiDaDisciplina(disciplina.nome, disciplina.emoji)}
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
      {/* Sala e professor no card: são as duas perguntas que se faz olhando uma
          grade — onde é, e com quem. Antes exigiam abrir cada disciplina. */}
      {/* `total_aulas` guarda ENCONTROS; o Guia do CAV conta aulas, e cada dia
          vale duas. Mostrar só um dos dois números já confundiu — a grade dizia
          17 e o Guia, 34. */}
      <p className="text-xs text-gray-400 mb-1 truncate" title={sala ?? undefined}>
        {disciplina.total_aulas} dias · {disciplina.total_aulas * AULAS_POR_ENCONTRO} aulas
        {sala
          ? <> · <span className="text-gray-500">{sala}</span></>
          : <> · <span className="text-amber-600">sem sala</span></>}
      </p>
      <p className="text-xs mb-2 truncate flex items-center gap-1" title={professor?.nome}>
        <UserCheck className="h-3 w-3 shrink-0 text-gray-300" />
        {professor
          ? <span className="text-gray-500">
              {professor.nome}
              {professor.varios && <span className="text-gray-400"> e outro</span>}
            </span>
          : <span className="text-amber-600">sem professor</span>}
      </p>
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
  const { semestre: semestreAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [professorPorDisciplina, setProfessorPorDisciplina] =
    useState<Record<string, { nome: string; varios: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<Disciplina | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    curso: "",
    modulo: "",
    // Vazio de propósito. O número certo depende do dia da semana e dos
    // feriados — escolher o dia preenche este campo pelo cronograma. Um valor
    // fixo aqui já custou caro: 16 entrou como se fosse regra e desmentia a
    // grade real, que vai de 17 a 19.
    total_aulas: "",
    dia_da_semana: "",
    emoji: "📚",
    sala_id: "",
    professores_por_turma: {} as Record<string, string>,
  });

  const turmasAfetadas = turmas.filter(t => {
    if (!form.curso || !form.modulo) return false;
    return t.curso === form.curso && moduloDaTurma(t.entrada, semestreAtual) === parseInt(form.modulo);
  });

  // Calcula quantas aulas o cronograma oferece para o dia selecionado (usa a primeira turma afetada como referência)
  const aulasNoCronograma: number | null = (() => {
    if (!form.dia_da_semana || turmasAfetadas.length === 0 || !form.modulo) return null;
    const turmaRef = turmasAfetadas[0];
    const semLetivo = semestreLetivoParaTurma(turmaRef.entrada, parseInt(form.modulo));
    const cron = cronogramas.find(c => c.semestre === semLetivo);
    if (!cron) return null;
    const oc = contarOcorrencias(cron.data_inicio, cron.data_fim, cron.feriados);
    return oc[parseInt(form.dia_da_semana)] ?? null;
  })();

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const [{ data: discs }, { data: ts }, { data: ps }, { data: crons }, { data: sls }] = await Promise.all([
      supabase.from("disciplinas").select("*").order("curso").order("modulo").order("dia_da_semana", { ascending: true, nullsFirst: false }).order("nome"),
      supabase.from("turmas").select("id, nome, entrada, curso, turno").order("entrada", { ascending: false }),
      // Só professores ativos podem receber novas atribuições
      supabase.from("professores").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("cronogramas").select("*").order("data_inicio", { ascending: false }),
      supabase.from("salas").select("id, nome").eq("ativa", true).order("nome"),
    ]);
    setDisciplinas(discs ?? []);
    setTurmas(ts ?? []);
    setProfessores(ps ?? []);
    setCronogramas(crons ?? []);
    setSalas((sls ?? []) as Sala[]);

    // Quem leciona cada disciplina vem das AULAS, não da disciplina: a mesma
    // matéria pode ter professor diferente na turma da manhã e na da noite.
    // Quando forem dois, o card mostra um e avisa "e outro".
    const { data: aulas } = await supabase
      .from("aulas")
      .select("disciplina_id, professor:professores(nome)");

    const nomesPorDisciplina = new Map<string, Set<string>>();
    for (const a of ((aulas ?? []) as unknown as
      { disciplina_id: string; professor: { nome: string } | null }[])) {
      if (!a.professor) continue;
      if (!nomesPorDisciplina.has(a.disciplina_id)) nomesPorDisciplina.set(a.disciplina_id, new Set());
      nomesPorDisciplina.get(a.disciplina_id)!.add(a.professor.nome);
    }
    setProfessorPorDisciplina(
      Object.fromEntries(
        [...nomesPorDisciplina].map(([id, nomes]) => {
          const lista = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
          return [id, { nome: lista[0], varios: lista.length > 1 }];
        }),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCriar = async () => {
    if (!form.nome.trim() || !form.curso || !form.modulo || !form.total_aulas) {
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
        modulo: parseInt(form.modulo),
        total_aulas: parseInt(form.total_aulas),
        dia_da_semana: form.dia_da_semana ? parseInt(form.dia_da_semana) : null,
        emoji: form.emoji || "📚",
        sala_id: form.sala_id || null,
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
        const semLetivo = semestreLetivoParaTurma(turma.entrada, parseInt(form.modulo));
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
          // `semana` saiu: guardava `numero ÷ 3`, e como a disciplina encontra a
          // turma uma vez por semana, a aula 12 É a semana 12. A conta era
          // errada e o valor não era lido em lugar nenhum (P22).
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
      setForm({ nome: "", curso: "", modulo: "", total_aulas: "", dia_da_semana: "", emoji: "📚", sala_id: "", professores_por_turma: {} });
    }

    fetchDados();
    setSalvando(false);
  };

  const handleExcluir = async (id: string, nome: string) => {
    const ok = await confirmar({
      titulo: `Excluir "${nome}"?`,
      perigo: true,
      rotuloConfirmar: "Excluir disciplina",
      descricao: (
        <>
          <p>Vão junto <strong>todas as aulas</strong> dela, em todas as turmas, e <strong>as presenças e o diário</strong> de cada uma.</p>
          <p className="text-red-700">Não há como desfazer.</p>
          <p className="text-gray-500">O banco recusa se alguma chamada já estiver fechada — nesse caso, desative a disciplina em vez de excluir.</p>
        </>
      ),
    });
    if (!ok) return;
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

  const turnosDe = turnosPorDisciplina(disciplinas, turmas, semestreAtual);
  const conflitos = conflitosDeSala(disciplinas.map(d => ({
    id: d.id,
    nome: d.nome,
    curso: d.curso,
    modulo: d.modulo,
    dia_da_semana: d.dia_da_semana,
    sala_id: d.sala_id,
    sala: salas.find(s => s.id === d.sala_id)?.nome ?? null,
    turnos: turnosDe[d.id] ?? [],
  })));

  // Agrupa disciplinas: curso → semestre → dia_da_semana
  const porCursoSemestre = CURSOS.reduce<Record<string, Record<number, Disciplina[]>>>((acc, curso) => {
    acc[curso] = {};
    [1, 2, 3].forEach(sem => {
      acc[curso][sem] = disciplinas.filter(d => d.curso === curso && d.modulo === sem);
    });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {dialogo}

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
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v, modulo: "", professores_por_turma: {} }))}>
                <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Semestre do curso *</Label>
              <Select value={form.modulo} onValueChange={v => setForm(f => ({ ...f, modulo: v, professores_por_turma: {} }))}>
                <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o semestre" /></SelectTrigger>
                <SelectContent>{SEMESTRES_CURSO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">
                Sala
                <span className="ml-2 text-xs font-normal text-gray-400">
                  criar e renomear em Sistema → Salas
                </span>
              </Label>
              <Select
                value={form.sala_id || "none"}
                onValueChange={v => setForm(f => ({ ...f, sala_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="w-full text-gray-800">
                  <SelectValue placeholder="Onde a aula acontece" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">A definir</SelectItem>
                  {salas.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
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
                    if (novoDia && turmasAfetadas.length > 0 && form.modulo) {
                      const semLetivo = semestreLetivoParaTurma(turmasAfetadas[0].entrada, parseInt(form.modulo));
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

          {form.curso && form.modulo && (
            <div className={`rounded-xl p-4 border ${turmasAfetadas.length > 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              {turmasAfetadas.length === 0 ? (
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Nenhuma turma de <strong>{form.curso}</strong> está no <strong>{form.modulo}º semestre</strong> agora.
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
                          <p className="text-xs text-gray-400">Entrada {t.entrada}</p>
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
          {/* Choque de sala só apareceria no dia da aula, com duas turmas na
              porta. Hoje não há nenhum — mas isso é sorte de quem montou a
              grade, e nada impedia o próximo de criar um. */}
          {conflitos.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                {conflitos.length === 1
                  ? "1 choque de sala na grade"
                  : `${conflitos.length} choques de sala na grade`}
              </p>
              <ul className="space-y-1 text-sm text-red-700">
                {conflitos.map(c => (
                  <li key={`${c.recurso}-${c.diaDaSemana}-${c.turno}`} className="flex gap-2">
                    <span className="text-red-400">•</span>
                    {descreverConflito(c)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-600">
                Duas turmas na mesma sala, no mesmo dia e turno. Mude a sala de uma delas
                pelo formulário, ou o dia da semana.
              </p>
            </div>
          )}

          {CURSOS.map(curso => {
            const temAlguma = [1, 2, 3].some(sem => porCursoSemestre[curso][sem].length > 0);
            if (!temAlguma) return null;
            return (
              <div key={curso} className="space-y-3">
                <p className="text-white font-bold text-lg border-b border-white/20 pb-2">{curso}</p>

                {/* Os dias aparecem UMA vez por curso, com o mesmo desenho que
                    tinham em cada linha — repeti-los nos três módulos dobrava a
                    altura sem dizer nada novo: a coluna da terça é a terça nos
                    três. Em cinza porque agora valem para todos, e não para o
                    módulo de baixo. */}
                <div className="grid grid-cols-5 gap-2">
                  {DIAS.map(dia => (
                    <div
                      key={dia.value}
                      className="text-center text-xs font-semibold py-1.5 rounded-lg bg-white/10 text-white/75 border border-white/10"
                      title={`Manhã ${rotuloDoTurno("Manhã")} · Noite ${rotuloDoTurno("Noite")}`}
                    >
                      <Calendar className="h-3 w-3 mx-auto mb-0.5" />
                      {dia.label}
                    </div>
                  ))}
                </div>

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
                                  sala={salas.find(s => s.id === d.sala_id)?.nome ?? null}
                                  professor={professorPorDisciplina[d.id] ?? null}
                                  tom={{ fundo: cores.header, borda: cores.border }}
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
                                  sala={salas.find(s => s.id === d.sala_id)?.nome ?? null}
                                  professor={professorPorDisciplina[d.id] ?? null}
                                  tom={{ fundo: cores.header, borda: cores.border }}
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
