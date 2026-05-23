"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BookOpen, LogOut, ChevronRight, CheckCircle, XCircle,
  Loader2, GraduationCap, Users, ArrowLeft
} from "lucide-react";

interface Turma { id: string; nome: string; turno: string; semestre: string; curso: string; }
interface Disciplina { id: string; nome: string; emoji: string | null; }
interface Aula {
  id: string;
  numero: number;
  semana: number | null;
  chamada_aberta: boolean;
  data_aula: string | null;
  turma: Turma;
  disciplina: Disciplina | null;
}
interface Aluno { id: string; nome: string; }
interface Presenca { aluno_id: string; presente: boolean; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function semDocurso(semestreEntrada: string): string {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const semAtual = hoje.getMonth() < 6 ? 1 : 2;
  const [ano, sem] = semestreEntrada.split("/").map(Number);
  if (!ano || !sem) return "";
  const n = (anoAtual - ano) * 2 + (semAtual - sem) + 1;
  if (n <= 0) return "Ainda não iniciou";
  if (n === 1) return "1º semestre";
  if (n === 2) return "2º semestre";
  if (n === 3) return "3º semestre";
  return "Concluído";
}

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
  const [loading, setLoading] = useState(true);
  const [todasAulas, setTodasAulas] = useState<Aula[]>([]);
  const [tela, setTela] = useState<Tela>({ tipo: "disciplinas" });

  // Chamada
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [salvandoPresenca, setSalvandoPresenca] = useState<string | null>(null);
  const [chamadaFinalizada, setChamadaFinalizada] = useState(false);
  const [carregandoChamada, setCarregandoChamada] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/professor/login"); return; }

      const { data: prof } = await supabase
        .from("professores").select("nome, id, senha_alterada").eq("id", user.id).single();
      if (!prof) { router.push("/professor/login"); return; }
      if (!prof.senha_alterada) { router.push("/professor/alterar-senha"); return; }

      setNomeProfessor(prof.nome);

      const { data: aulasData } = await supabase
        .from("aulas")
        .select("id, numero, semana, chamada_aberta, data_aula, turma:turmas(id, nome, turno, semestre, curso), disciplina:disciplinas(id, nome, emoji)")
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
    setCarregandoChamada(true);
    setTela({ tipo: "chamada", aula });
    setChamadaFinalizada(aula.chamada_aberta);

    const { data: alunosData } = await supabase
      .from("alunos").select("id, nome")
      .eq("turma_id", aula.turma.id).eq("ativo", true).order("nome");
    setAlunos((alunosData ?? []) as Aluno[]);

    const { data: presData } = await supabase
      .from("presencas").select("aluno_id, presente").eq("aula_id", aula.id);
    const mapa: Record<string, boolean> = {};
    (presData ?? []).forEach((p: Presenca) => { mapa[p.aluno_id] = p.presente; });
    setPresencas(mapa);
    setCarregandoChamada(false);
  };

  const togglePresenca = async (alunoId: string) => {
    if (chamadaFinalizada || tela.tipo !== "chamada") return;
    const novoValor = !presencas[alunoId];
    setSalvandoPresenca(alunoId);
    setPresencas(prev => ({ ...prev, [alunoId]: novoValor }));
    await supabase.from("presencas").upsert(
      { aula_id: tela.aula.id, aluno_id: alunoId, presente: novoValor },
      { onConflict: "aula_id,aluno_id" }
    );
    setSalvandoPresenca(null);
  };

  const finalizarChamada = async () => {
    if (tela.tipo !== "chamada") return;
    const semPresenca = alunos.filter(a => presencas[a.id] === undefined);
    if (semPresenca.length > 0) {
      await supabase.from("presencas").upsert(
        semPresenca.map(a => ({ aula_id: tela.aula.id, aluno_id: a.id, presente: false })),
        { onConflict: "aula_id,aluno_id" }
      );
    }
    await supabase.from("aulas")
      .update({ chamada_aberta: true, data_aula: new Date().toISOString().split("T")[0] })
      .eq("id", tela.aula.id);
    setChamadaFinalizada(true);
    setTodasAulas(prev => prev.map(a => a.id === tela.aula.id ? { ...a, chamada_aberta: true } : a));
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

          {!chamadaFinalizada && alunos.length > 0 && (
            <Button
              onClick={finalizarChamada}
              className="w-full py-6 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white"
            >
              Finalizar e Registrar Chamada
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Tela: Aulas ───────────────────────────────────────────────────────────────
  if (tela.tipo === "aulas") {
    const { disciplinaId, disciplinaNome, turma } = tela;
    const aulas = aulasDaTurma(disciplinaId, turma.id);

    return (
      <div className="min-h-screen bg-blue-900 flex flex-col">
        <AppHeader
          titulo={disciplinaNome}
          subtitulo={labelTurma(turma)}
          onVoltar={() => setTela({ tipo: "turmas", disciplinaId, disciplinaNome })}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
          <p className="text-white/50 text-xs mb-3">Selecione a aula para abrir a chamada</p>
          {aulas.map(aula => (
            <button
              key={aula.id}
              onClick={() => abrirChamada(aula)}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${aula.chamada_aberta ? "bg-green-500" : "bg-blue-600"}`}>
                <span className="text-white font-bold text-sm">{aula.numero}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">Aula {aula.numero}</p>
                <p className="text-white/50 text-xs">
                  {formatarData(aula.data_aula)}
                  {aula.chamada_aberta ? " · ✅ Chamada feita" : " · Pendente"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/30 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Tela: Turmas ──────────────────────────────────────────────────────────────
  if (tela.tipo === "turmas") {
    const { disciplinaId, disciplinaNome } = tela;
    const turmas = turmasDaDisciplina(disciplinaId);

    return (
      <div className="min-h-screen bg-blue-900 flex flex-col">
        <AppHeader
          titulo={disciplinaNome}
          subtitulo="Selecione a turma"
          onVoltar={() => setTela({ tipo: "disciplinas" })}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
          {turmas.map(turma => {
            const aulasT = aulasDaTurma(disciplinaId, turma.id);
            const feitas = aulasT.filter(a => a.chamada_aberta).length;
            return (
              <button
                key={turma.id}
                onClick={() => setTela({ tipo: "aulas", disciplinaId, disciplinaNome, turma })}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{turma.curso} {turma.turno}</p>
                  <p className="text-white/50 text-xs">{semDocurso(turma.semestre)} · {feitas}/{aulasT.length} chamadas feitas</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Tela: Disciplinas ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-900 flex flex-col">
      <AppHeader
        titulo={`Olá, ${nomeProfessor.split(" ")[0]}`}
        subtitulo="Suas disciplinas"
        onSair={handleSair}
      />
      <div className="flex-1 px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
        {disciplinas.length === 0 ? (
          <div className="bg-white/10 rounded-2xl p-8 text-center text-white/60 mt-8">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhuma disciplina vinculada ao seu perfil.</p>
            <p className="text-xs mt-1">Peça ao administrador para atribuir suas disciplinas.</p>
          </div>
        ) : (
          disciplinas.map(disc => {
            const todasAulasDaDisc = todasAulas.filter(a => a.disciplina?.id === disc.id);
            const feitas = todasAulasDaDisc.filter(a => a.chamada_aberta).length;
            const turmas = turmasDaDisciplina(disc.id);
            return (
              <button
                key={disc.id}
                onClick={() =>
                  turmas.length === 1
                    ? setTela({ tipo: "aulas", disciplinaId: disc.id, disciplinaNome: disc.nome, turma: turmas[0] })
                    : setTela({ tipo: "turmas", disciplinaId: disc.id, disciplinaNome: disc.nome })
                }
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-700/50 flex items-center justify-center shrink-0 text-2xl">
                  {disc.emoji ?? "📚"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{disc.nome}</p>
                  <p className="text-white/50 text-xs">
                    {turmas.length} turma{turmas.length !== 1 ? "s" : ""} · {feitas}/{todasAulasDaDisc.length} chamadas feitas
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
