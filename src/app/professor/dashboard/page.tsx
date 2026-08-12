"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BookOpen, LogOut, ChevronRight, CheckCircle, XCircle,
  Loader2, GraduationCap, Users, ArrowLeft, ClipboardList
} from "lucide-react";
import { semestreDoCurso, rotuloSemestreDoCurso } from "@/lib/calendario-escolar";
import LancarNotas from "@/components/professor/LancarNotas";
import { buscarAlunosDaTurma } from "@/lib/matriculas";

interface Turma { id: string; nome: string; turno: string; semestre: string; curso: string; }
interface Disciplina { id: string; nome: string; emoji: string | null; }
interface Aula {
  id: string;
  numero: number;
  semana: number | null;
  chamada_aberta: boolean;
  data_aula: string | null;
  conteudo_ministrado: string | null;
  turma: Turma;
  disciplina: Disciplina | null;
}

// Mínimo exigido no diário de sala para fechar a chamada (D4).
// O banco também garante isso, via constraint.
const MIN_CONTEUDO = 30;
interface Aluno { id: string; nome: string; }
interface Presenca { aluno_id: string; presente: boolean; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const semDocurso = (semestreEntrada: string) =>
  rotuloSemestreDoCurso(semestreDoCurso(semestreEntrada));

function labelTurma(turma: Turma): string {
  return `${semDocurso(turma.semestre)} · ${turma.curso} ${turma.turno}`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "Sem data definida";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Tipos de tela ──────────────────────────────────────────────────────────────
type Tela =
  | { tipo: "disciplinas" }
  | { tipo: "turmas"; disciplinaId: string; disciplinaNome: string }
  | { tipo: "aulas"; disciplinaId: string; disciplinaNome: string; turma: Turma }
  | { tipo: "notas"; disciplinaId: string; disciplinaNome: string; turma: Turma }
  | { tipo: "chamada"; aula: Aula };

// ── Header PWA ─────────────────────────────────────────────────────────────────
function AppHeader({
  titulo,
  subtitulo,
  onVoltar,
  onSair,
}: {
  titulo: string;
  subtitulo?: string;
  onVoltar?: () => void;
  onSair: () => void;
}) {
  return (
    <header className="bg-blue-950 border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
      {onVoltar ? (
        <button onClick={onVoltar} className="text-white/70 hover:text-white p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-base leading-tight truncate">{titulo}</p>
        {subtitulo && <p className="text-white/50 text-xs truncate">{subtitulo}</p>}
      </div>
      <button
        onClick={onSair}
        className="text-white/50 hover:text-white flex items-center gap-1 text-xs shrink-0"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </header>
  );
}

// ── Dashboard principal ─────────────────────────────────────────────────────────
export default function ProfessorDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [nomeProfessor, setNomeProfessor] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [todasAulas, setTodasAulas] = useState<Aula[]>([]);
  const [tela, setTela] = useState<Tela>({ tipo: "disciplinas" });

  // Chamada
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [salvandoPresenca, setSalvandoPresenca] = useState<string | null>(null);
  const [chamadaFinalizada, setChamadaFinalizada] = useState(false);
  const [carregandoChamada, setCarregandoChamada] = useState(false);
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/professor/login"); return; }

      // O professor é identificado pelo login (user_id), não pelo id do
      // registro — os dois deixaram de ser a mesma coisa na fase 2.
      const { data: prof } = await supabase
        .from("professores")
        .select("id, nome, senha_alterada, ativo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof) { router.push("/professor/login"); return; }
      if (!prof.senha_alterada) { router.push("/professor/alterar-senha"); return; }

      setNomeProfessor(prof.nome);
      setProfessorId(prof.id);

      const { data: aulasData } = await supabase
        .from("aulas")
        .select("id, numero, semana, chamada_aberta, data_aula, conteudo_ministrado, turma:turmas(id, nome, turno, semestre, curso), disciplina:disciplinas(id, nome, emoji)")
        .eq("professor_id", prof.id)
        .order("numero", { ascending: true });

      setTodasAulas((aulasData ?? []) as unknown as Aula[]);
      setLoading(false);
    };
    init();
  }, []);

  const handleSair = async () => {
    await supabase.auth.signOut();
    router.push("/professor/login");
  };

  // ── Derivações ────────────────────────────────────────────────────────────────

  // Disciplinas únicas do professor
  const disciplinas = Array.from(
    new Map(todasAulas.filter(a => a.disciplina).map(a => [a.disciplina!.id, a.disciplina!])).values()
  );

  // Turmas de uma disciplina específica
  const turmasDaDisciplina = (disciplinaId: string) =>
    Array.from(
      new Map(
        todasAulas
          .filter(a => a.disciplina?.id === disciplinaId)
          .map(a => [a.turma.id, a.turma])
      ).values()
    );

  // Aulas de uma disciplina + turma
  const aulasDaTurma = (disciplinaId: string, turmaId: string) =>
    todasAulas.filter(a => a.disciplina?.id === disciplinaId && a.turma.id === turmaId);

  // ── Abrir chamada ─────────────────────────────────────────────────────────────
  const abrirChamada = async (aula: Aula) => {
    // D22 — aula fechada é definitiva e não se abre mais.
    if (aula.chamada_aberta) return;

    setCarregandoChamada(true);
    setTela({ tipo: "chamada", aula });
    setChamadaFinalizada(false);
    setErro(null);
    setConteudo("");

    // A lista sai das matrículas em andamento, não de um campo no aluno:
    // quem cursa duas turmas precisa aparecer na chamada das duas.
    const { alunos: daTurma } = await buscarAlunosDaTurma(supabase, aula.turma.id);
    setAlunos(daTurma.map(a => ({ id: a.id, nome: a.nome })));

    const { data: presData } = await supabase
      .from("presencas").select("aluno_id, presente").eq("aula_id", aula.id);
    const mapa: Record<string, boolean> = {};
    (presData ?? []).forEach((p: Presenca) => { mapa[p.aluno_id] = p.presente; });
    setPresencas(mapa);
    setCarregandoChamada(false);
  };

  const togglePresenca = async (alunoId: string) => {
    if (chamadaFinalizada || tela.tipo !== "chamada") return;
    const aulaId = tela.aula.id;
    const valorAnterior = presencas[alunoId];
    const novoValor = !valorAnterior;

    setErro(null);
    setSalvandoPresenca(alunoId);
    setPresencas(prev => ({ ...prev, [alunoId]: novoValor }));

    const { error } = await supabase.from("presencas").upsert(
      { aula_id: aulaId, aluno_id: alunoId, presente: novoValor },
      { onConflict: "aula_id,aluno_id" }
    );

    // Sem isto o botão ficava verde mesmo quando o banco recusava a gravação,
    // e o professor saía achando que tinha registrado a presença.
    if (error) {
      setPresencas(prev => {
        const copia = { ...prev };
        if (valorAnterior === undefined) delete copia[alunoId];
        else copia[alunoId] = valorAnterior;
        return copia;
      });
      setErro("Não foi possível salvar a presença. Verifique a conexão e tente de novo.");
    }
    setSalvandoPresenca(null);
  };

  const finalizarChamada = async () => {
    if (tela.tipo !== "chamada") return;
    const aula = tela.aula;
    const texto = conteudo.trim();

    if (texto.length < MIN_CONTEUDO) {
      setErro(`Descreva o conteúdo da aula com pelo menos ${MIN_CONTEUDO} caracteres.`);
      return;
    }
    if (!confirm("Fechar a chamada? Depois de fechada não é possível reabrir nem corrigir.")) return;

    setErro(null);
    setFinalizando(true);

    // Quem não foi marcado entra como ausente
    const semPresenca = alunos.filter(a => presencas[a.id] === undefined);
    if (semPresenca.length > 0) {
      const { error } = await supabase.from("presencas").upsert(
        semPresenca.map(a => ({ aula_id: aula.id, aluno_id: a.id, presente: false })),
        { onConflict: "aula_id,aluno_id" }
      );
      if (error) {
        setErro("Não foi possível registrar as faltas. Tente de novo.");
        setFinalizando(false);
        return;
      }
    }

    // `data_aula` é a data PLANEJADA pelo cronograma e não pode ser
    // sobrescrita. O momento real do fechamento vai em `chamada_fechada_em`.
    const { error } = await supabase.from("aulas")
      .update({
        chamada_aberta: true,
        chamada_fechada_em: new Date().toISOString(),
        conteudo_ministrado: texto,
      })
      .eq("id", aula.id);

    if (error) {
      setErro("Não foi possível fechar a chamada. Tente de novo.");
      setFinalizando(false);
      return;
    }

    setChamadaFinalizada(true);
    setFinalizando(false);
    setTodasAulas(prev => prev.map(a =>
      a.id === aula.id ? { ...a, chamada_aberta: true, conteudo_ministrado: texto } : a
    ));
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  // ── Tela: Chamada ─────────────────────────────────────────────────────────────
  if (tela.tipo === "chamada") {
    const { aula } = tela;
    const presentes = Object.values(presencas).filter(Boolean).length;
    const ausentes = alunos.length - presentes;

    return (
      <div className="min-h-screen bg-blue-900 flex flex-col">
        <AppHeader
          titulo={`${aula.disciplina?.nome ?? "Aula"} — Aula ${aula.numero}`}
          subtitulo={labelTurma(aula.turma)}
          onVoltar={() => {
            if (tela.tipo === "chamada")
              setTela({ tipo: "aulas", disciplinaId: aula.disciplina!.id, disciplinaNome: aula.disciplina!.nome, turma: aula.turma });
          }}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{presentes}</p>
              <p className="text-xs text-green-300">Presentes</p>
            </div>
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{ausentes}</p>
              <p className="text-xs text-red-300">Ausentes</p>
            </div>
          </div>

          {chamadaFinalizada && (
            <div className="bg-green-500 text-white rounded-xl p-3 text-center text-sm font-semibold">
              ✅ Chamada finalizada e registrada
            </div>
          )}

          {erro && (
            <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-xl p-3 text-sm">
              {erro}
            </div>
          )}

          {carregandoChamada ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : alunos.length === 0 ? (
            <div className="bg-white/10 rounded-xl p-6 text-center text-white/60">
              Nenhum aluno cadastrado nesta turma.
            </div>
          ) : (
            <div className="space-y-2">
              {alunos.map(aluno => {
                const presente = presencas[aluno.id] ?? false;
                const salvando = salvandoPresenca === aluno.id;
                return (
                  <button
                    key={aluno.id}
                    onClick={() => togglePresenca(aluno.id)}
                    disabled={chamadaFinalizada || salvando}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all text-left
                      ${presente ? "bg-green-500 hover:bg-green-600 text-white shadow-lg" : "bg-white/10 hover:bg-white/20 text-white border border-white/20"}
                      ${chamadaFinalizada ? "cursor-default" : "cursor-pointer active:scale-[0.98]"}`}
                  >
                    <span className="font-medium">{aluno.nome}</span>
                    {salvando
                      ? <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                      : presente
                        ? <CheckCircle className="h-6 w-6 shrink-0" />
                        : <XCircle className="h-6 w-6 text-white/30 shrink-0" />
                    }
                  </button>
                );
              })}
            </div>
          )}

          {/* Diário de sala — só o professor preenche (D5) */}
          {!carregandoChamada && (
            chamadaFinalizada ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                <p className="text-white/50 text-xs mb-1">Conteúdo registrado</p>
                <p className="text-white text-sm whitespace-pre-wrap">{conteudo.trim()}</p>
              </div>
            ) : (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 space-y-2">
                <label htmlFor="conteudo" className="block text-white text-sm font-semibold">
                  Conteúdo da aula
                </label>
                <textarea
                  id="conteudo"
                  value={conteudo}
                  onChange={e => setConteudo(e.target.value)}
                  rows={4}
                  placeholder="Descreva o que foi trabalhado nesta aula."
                  className="w-full rounded-lg bg-white/95 text-gray-900 text-sm p-3 resize-y focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className={`text-xs ${conteudo.trim().length >= MIN_CONTEUDO ? "text-green-300" : "text-white/50"}`}>
                  {conteudo.trim().length} / {MIN_CONTEUDO} caracteres mínimos
                </p>
              </div>
            )
          )}

          {!chamadaFinalizada && alunos.length > 0 && (
            <Button
              onClick={finalizarChamada}
              disabled={finalizando}
              className="w-full py-6 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white"
            >
              {finalizando ? "Salvando..." : "Fechar Chamada"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Tela: Notas ───────────────────────────────────────────────────────────────
  if (tela.tipo === "notas") {
    const { disciplinaId, disciplinaNome, turma } = tela;
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col">
        <AppHeader
          titulo={`Notas — ${disciplinaNome}`}
          subtitulo={labelTurma(turma)}
          onVoltar={() => setTela({ tipo: "aulas", disciplinaId, disciplinaNome, turma })}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
          <LancarNotas disciplinaId={disciplinaId} turmaId={turma.id} professorId={professorId} />
        </div>
      </div>
    );
  }

  // ── Tela: Aulas ───────────────────────────────────────────────────────────────
  if (tela.tipo === "aulas") {
    const { disciplinaId, disciplinaNome, turma } = tela;
    const aulas = aulasDaTurma(disciplinaId, turma.id);
    const feitas = aulas.filter(a => a.chamada_aberta).length;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <AppHeader
          titulo={disciplinaNome}
          subtitulo={labelTurma(turma)}
          onVoltar={() => setTela({ tipo: "turmas", disciplinaId, disciplinaNome })}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
          {/* Progresso */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Chamadas realizadas</span>
              <span className="font-semibold text-gray-700">{feitas} / {aulas.length}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500 rounded-full transition-all"
                style={{ width: aulas.length ? `${(feitas / aulas.length) * 100}%` : "0%" }}
              />
            </div>
          </div>

          <button
            onClick={() => setTela({ tipo: "notas", disciplinaId, disciplinaNome, turma })}
            className="w-full rounded-2xl bg-blue-950 p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98] shadow-sm hover:bg-blue-900"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">Lançar notas</p>
              <p className="text-xs text-white/60 mt-0.5">Nota desta disciplina para cada aluno</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/40" />
          </button>

          <p className="text-xs text-gray-400 font-medium px-1 mb-1 pt-2">Selecione a aula para abrir a chamada</p>
          {aulas.map(aula => {
            // D22 — chamada fechada é definitiva: o card vira registro, não botão.
            const fechada = aula.chamada_aberta;
            return (
              <button
                key={aula.id}
                onClick={() => abrirChamada(aula)}
                disabled={fechada}
                title={fechada ? "Chamada fechada — não pode mais ser alterada" : undefined}
                className={`w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all shadow-sm
                  ${fechada
                    ? "bg-green-500 cursor-default"
                    : "bg-white hover:bg-gray-50 active:scale-[0.98]"
                  }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-base
                  ${fechada ? "bg-white/20 text-white" : "bg-blue-950 text-white"}`}>
                  {aula.numero}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${fechada ? "text-white" : "text-gray-900"}`}>
                    Aula {aula.numero}
                  </p>
                  <p className={`text-xs mt-0.5 ${fechada ? "text-white/70" : "text-gray-400"}`}>
                    {formatarData(aula.data_aula)}
                    {fechada ? " · Chamada fechada" : " · Pendente"}
                  </p>
                  {fechada && aula.conteudo_ministrado && (
                    <p className="text-xs text-white/80 mt-1.5 line-clamp-2">
                      {aula.conteudo_ministrado}
                    </p>
                  )}
                </div>
                {fechada
                  ? <CheckCircle className="h-5 w-5 shrink-0 text-white" />
                  : <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                }
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Tela: Turmas ──────────────────────────────────────────────────────────────
  if (tela.tipo === "turmas") {
    const { disciplinaId, disciplinaNome } = tela;
    const turmas = turmasDaDisciplina(disciplinaId);

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <AppHeader
          titulo={disciplinaNome}
          subtitulo="Selecione a turma"
          onVoltar={() => setTela({ tipo: "disciplinas" })}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-6 space-y-3 max-w-lg mx-auto w-full">
          {turmas.map(turma => {
            const aulasT = aulasDaTurma(disciplinaId, turma.id);
            const feitas = aulasT.filter(a => a.chamada_aberta).length;
            const pct = aulasT.length ? Math.round((feitas / aulasT.length) * 100) : 0;
            return (
              <button
                key={turma.id}
                onClick={() => setTela({ tipo: "aulas", disciplinaId, disciplinaNome, turma })}
                className="w-full bg-white hover:bg-gray-50 rounded-2xl p-4 flex items-center gap-4 text-left transition-all active:scale-[0.98] shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold">{turma.curso} {turma.turno}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{semDocurso(turma.semestre)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{feitas}/{aulasT.length}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Tela: Disciplinas ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AppHeader
        titulo={`Olá, ${nomeProfessor.split(" ")[0]}`}
        subtitulo="Suas disciplinas"
        onSair={handleSair}
      />
      <div className="flex-1 px-4 py-6 space-y-3 max-w-lg mx-auto w-full">
        {disciplinas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 mt-8 shadow-sm">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-gray-600">Nenhuma disciplina vinculada.</p>
            <p className="text-xs mt-1">Peça ao administrador para atribuir suas disciplinas.</p>
          </div>
        ) : (
          disciplinas.map(disc => {
            const todasAulasDaDisc = todasAulas.filter(a => a.disciplina?.id === disc.id);
            const feitas = todasAulasDaDisc.filter(a => a.chamada_aberta).length;
            const turmas = turmasDaDisciplina(disc.id);
            const pct = todasAulasDaDisc.length ? Math.round((feitas / todasAulasDaDisc.length) * 100) : 0;
            return (
              <button
                key={disc.id}
                onClick={() =>
                  turmas.length === 1
                    ? setTela({ tipo: "aulas", disciplinaId: disc.id, disciplinaNome: disc.nome, turma: turmas[0] })
                    : setTela({ tipo: "turmas", disciplinaId: disc.id, disciplinaNome: disc.nome })
                }
                className="w-full bg-white hover:bg-gray-50 rounded-2xl p-4 flex items-center gap-4 text-left transition-all active:scale-[0.98] shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 text-3xl">
                  {disc.emoji ?? "📚"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold truncate">{disc.nome}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {turmas.length} turma{turmas.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{feitas}/{todasAulasDaDisc.length}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
