"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BookOpen, LogOut, ChevronRight, CheckCircle, XCircle,
  Loader2, GraduationCap, Users, ArrowLeft, ClipboardList
} from "lucide-react";
import { moduloAtual, rotuloModulo } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import LancarNotas from "@/components/professor/LancarNotas";
import { buscarAlunosDaTurma } from "@/lib/matriculas";
import {
  salvarRascunho, lerRascunho, limparRascunho, mesclarPresencas,
} from "@/lib/rascunho-chamada";
import { useConfirmacao } from "@/components/ui/confirmar";
import {
  proximaPresenca, rotuloDaPresenca, rotuloDoTurno, type PresencaNoDia,
} from "@/lib/aulas-do-dia";

interface Turma { id: string; nome: string; turno: string; entrada: string; curso: string; }
interface Disciplina { id: string; nome: string; emoji: string | null; }
interface Aula {
  id: string;
  numero: number;
  chamada_finalizada: boolean;
  data_aula: string | null;
  conteudo_ministrado: string | null;
  turma: Turma;
  disciplina: Disciplina | null;
}

// Mínimo exigido no diário de sala para fechar a chamada (D4).
// O banco também garante isso, via constraint.
const MIN_CONTEUDO = 30;
interface Aluno { id: string; nome: string; }
interface Presenca { aluno_id: string; presente: boolean; aulas_presentes: number | null; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const rotuloDaTurma = (turma: Turma, semestreAtual: string | null) =>
  `${rotuloModulo(moduloAtual(turma.entrada, semestreAtual))} · ${turma.curso} ${turma.turno}`;

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
    // `safe-top` empurra o cabeçalho para baixo do relógio e do notch. Sem
    // isso o título nasce atrás deles no iPhone, e o botão Sair fica no canto
    // arredondado, difícil de acertar.
    <header className="bg-blue-950 border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 safe-top">
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
  const { semestre: semestreAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();

  const [nomeProfessor, setNomeProfessor] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [todasAulas, setTodasAulas] = useState<Aula[]>([]);
  const [tela, setTela] = useState<Tela>({ tipo: "disciplinas" });

  // Chamada
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, PresencaNoDia>>({});
  const [salvandoPresenca, setSalvandoPresenca] = useState<string | null>(null);
  const [chamadaFinalizada, setChamadaFinalizada] = useState(false);
  const [carregandoChamada, setCarregandoChamada] = useState(false);
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  /** Marcações que a rede recusou e estão guardadas no aparelho. */
  const [pendentesLocais, setPendentesLocais] = useState<Record<string, PresencaNoDia>>({});
  const [reenviando, setReenviando] = useState(false);

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
        .select("id, numero, chamada_finalizada, data_aula, conteudo_ministrado, turma:turmas(id, nome, turno, entrada, curso), disciplina:disciplinas(id, nome, emoji)")
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

  /**
   * Aulas que já aconteceram e ele não fechou. Da mais antiga para a mais
   * recente: é a de duas semanas atrás que ninguém lembra mais o que foi dado.
   */
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = todasAulas
    .filter(a => !a.chamada_finalizada && a.data_aula !== null && a.data_aula <= hoje)
    .sort((x, y) => (x.data_aula ?? "").localeCompare(y.data_aula ?? ""));

  // ── Abrir chamada ─────────────────────────────────────────────────────────────
  const abrirChamada = async (aula: Aula) => {
    // D22 — aula fechada é definitiva e não se abre mais.
    if (aula.chamada_finalizada) return;

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
      .from("presencas")
      .select("aluno_id, presente, aulas_presentes")
      .eq("aula_id", aula.id);

    // Registro anterior à Fase 19 não tem a contagem: ali `presente` valia o
    // dia inteiro, e é essa a leitura fiel do que foi marcado na época.
    const mapa: Record<string, PresencaNoDia> = {};
    (presData ?? []).forEach((p: Presenca) => {
      mapa[p.aluno_id] = (p.aulas_presentes ?? (p.presente ? 2 : 0)) as PresencaNoDia;
    });

    // O que ficou no aparelho vence: foi digitado depois do que o servidor
    // tem, e é justamente o que não conseguiu subir.
    const rascunho = lerRascunho(aula.id);
    setPendentesLocais(rascunho?.presencas ?? {});
    setPresencas(mesclarPresencas(mapa, rascunho?.presencas));
    if (rascunho?.conteudo) setConteudo(rascunho.conteudo);
    setCarregandoChamada(false);
  };

  const togglePresenca = async (alunoId: string) => {
    if (chamadaFinalizada || tela.tipo !== "chamada") return;
    const aulaId = tela.aula.id;
    // ausente → presente no dia → só a 1ª aula → ausente (D54)
    const novoValor = proximaPresenca(presencas[alunoId]);

    setErro(null);
    setSalvandoPresenca(alunoId);
    setPresencas(prev => ({ ...prev, [alunoId]: novoValor }));

    const { error } = await supabase.from("presencas").upsert(
      {
        aula_id: aulaId,
        aluno_id: alunoId,
        aulas_presentes: novoValor,
        // `presente` continua valendo como "esteve em pelo menos uma": é o que
        // as policies e os relatórios antigos leem.
        presente: novoValor > 0,
      },
      { onConflict: "aula_id,aluno_id" }
    );

    // Antes o toque era desfeito quando a rede falhava. Isso protegia contra a
    // mentira do botão verde, mas jogava fora o que o professor acabara de
    // fazer — e ele estava em pé, na frente da turma. Agora a marcação FICA na
    // tela e no aparelho, e sobe depois.
    if (error) {
      const naoSubiram = { ...pendentesLocais, [alunoId]: novoValor };
      setPendentesLocais(naoSubiram);
      salvarRascunho(aulaId, naoSubiram, conteudo);
      setErro(null);
    } else if (pendentesLocais[alunoId] !== undefined) {
      // Subiu: sai da fila.
      const restantes = { ...pendentesLocais };
      delete restantes[alunoId];
      setPendentesLocais(restantes);
      salvarRascunho(aulaId, restantes, conteudo);
    }
    setSalvandoPresenca(null);
  };

  /** Tenta subir de novo o que ficou para trás. */
  const reenviarPendentes = async () => {
    if (tela.tipo !== "chamada") return;
    const aulaId = tela.aula.id;
    const fila = Object.entries(pendentesLocais);
    if (fila.length === 0) return;

    setReenviando(true);
    const aindaFalta: Record<string, PresencaNoDia> = {};
    for (const [alunoId, aulas] of fila) {
      const { error } = await supabase.from("presencas").upsert(
        { aula_id: aulaId, aluno_id: alunoId, aulas_presentes: aulas, presente: aulas > 0 },
        { onConflict: "aula_id,aluno_id" },
      );
      if (error) aindaFalta[alunoId] = aulas;
    }
    setPendentesLocais(aindaFalta);
    salvarRascunho(aulaId, aindaFalta, conteudo);
    setReenviando(false);

    setErro(Object.keys(aindaFalta).length > 0
      ? "Ainda não consegui salvar tudo. As marcações continuam guardadas no aparelho."
      : null);
  };

  const finalizarChamada = async () => {
    if (tela.tipo !== "chamada") return;
    const aula = tela.aula;
    const texto = conteudo.trim();

    if (texto.length < MIN_CONTEUDO) {
      setErro(`Descreva o conteúdo da aula com pelo menos ${MIN_CONTEUDO} caracteres.`);
      return;
    }
    const ok = await confirmar({
      titulo: "Fechar a chamada desta aula?",
      perigo: true,
      rotuloConfirmar: "Fechar chamada",
      descricao: (
        <>
          <p>Depois de fechada, <strong>não dá para reabrir nem corrigir</strong> — nem por você, nem pela coordenação.</p>
          <p>Confira as presenças e o que você escreveu no diário antes de confirmar.</p>
        </>
      ),
    });
    if (!ok) return;

    setErro(null);
    setFinalizando(true);

    // Sobe primeiro o que ficou guardado no aparelho. Fechar a chamada com
    // marcação pendente gravaria falta em quem estava presente.
    if (Object.keys(pendentesLocais).length > 0) {
      const aindaFalta: Record<string, PresencaNoDia> = {};
      for (const [alunoId, aulas] of Object.entries(pendentesLocais)) {
        const { error } = await supabase.from("presencas").upsert(
          { aula_id: aula.id, aluno_id: alunoId, aulas_presentes: aulas, presente: aulas > 0 },
          { onConflict: "aula_id,aluno_id" },
        );
        if (error) aindaFalta[alunoId] = aulas;
      }
      if (Object.keys(aindaFalta).length > 0) {
        setPendentesLocais(aindaFalta);
        salvarRascunho(aula.id, aindaFalta, texto);
        setErro(
          `${Object.keys(aindaFalta).length} marcação(ões) ainda não subiram. ` +
          `Sem elas, fechar agora registraria falta em quem estava presente. ` +
          `Espere a conexão voltar e tente de novo — nada foi perdido.`,
        );
        setFinalizando(false);
        return;
      }
      setPendentesLocais({});
    }

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
        chamada_finalizada: true,
        chamada_fechada_em: new Date().toISOString(),
        conteudo_ministrado: texto,
      })
      .eq("id", aula.id);

    if (error) {
      setErro("Não foi possível fechar a chamada. Tente de novo.");
      setFinalizando(false);
      return;
    }

    // Fechou: o rascunho vira lixo que um dia reapareceria sobre dado bom.
    limparRascunho(aula.id);
    setChamadaFinalizada(true);
    setFinalizando(false);
    setTodasAulas(prev => prev.map(a =>
      a.id === aula.id ? { ...a, chamada_finalizada: true, conteudo_ministrado: texto } : a
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
    const presentes = Object.values(presencas).filter(v => v === 2).length;
    const parciais = Object.values(presencas).filter(v => v === 1).length;
    const ausentes = alunos.length - presentes - parciais;

    return (
      <div className="min-h-screen bg-blue-900 flex flex-col">
        {/* O diálogo mora aqui porque é esta a tela que confirma o fechamento
            da chamada — a única ação irreversível do app do professor. */}
        {dialogo}
        <AppHeader
          titulo={`${aula.disciplina?.nome ?? "Aula"} — Aula ${aula.numero}`}
          subtitulo={rotuloDaTurma(aula.turma, semestreAtual)}
          onVoltar={() => {
            if (tela.tipo === "chamada")
              setTela({ tipo: "aulas", disciplinaId: aula.disciplina!.id, disciplinaNome: aula.disciplina!.nome, turma: aula.turma });
          }}
          onSair={handleSair}
        />
        <div className="flex-1 px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
          {/* Sem este aviso, o professor não teria como saber que a rede caiu:
              a marcação continua na tela, verde, como se tivesse subido. */}
          {Object.keys(pendentesLocais).length > 0 && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/20 p-3 space-y-2">
              <p className="text-sm text-amber-50">
                <strong>{Object.keys(pendentesLocais).length} marcação(ões) ainda não salvaram.</strong>{" "}
                Estão guardadas no seu celular — não se perdem se você sair ou o app fechar.
              </p>
              <button
                onClick={reenviarPendentes}
                disabled={reenviando}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reenviando ? "Tentando..." : "Tentar salvar de novo"}
              </button>
            </div>
          )}

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
                const marcado = presencas[aluno.id] ?? 0;
                const salvando = salvandoPresenca === aluno.id;
                // Um toque marca o dia inteiro — é o que acontece com quase
                // todo aluno. O segundo toque é para quem saiu no intervalo.
                const fundo = marcado === 2
                  ? "bg-green-500 hover:bg-green-600 text-white shadow-lg"
                  : marcado === 1
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20";
                return (
                  <button
                    key={aluno.id}
                    onClick={() => togglePresenca(aluno.id)}
                    disabled={chamadaFinalizada || salvando}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all text-left
                      ${fundo}
                      ${chamadaFinalizada ? "cursor-default" : "cursor-pointer active:scale-[0.98]"}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{aluno.nome}</span>
                      <span className={`block text-xs ${marcado === 0 ? "text-white/40" : "text-white/80"}`}>
                        {rotuloDaPresenca(marcado)}
                      </span>
                    </span>
                    {salvando
                      ? <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                      : marcado === 2
                        ? <CheckCircle className="h-6 w-6 shrink-0" />
                        : marcado === 1
                          ? <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">1/2</span>
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
          subtitulo={rotuloDaTurma(turma, semestreAtual)}
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
    const feitas = aulas.filter(a => a.chamada_finalizada).length;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <AppHeader
          titulo={disciplinaNome}
          subtitulo={rotuloDaTurma(turma, semestreAtual)}
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
            const fechada = aula.chamada_finalizada;
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
            const feitas = aulasT.filter(a => a.chamada_finalizada).length;
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
                  <p className="text-gray-400 text-xs mt-0.5">{rotuloModulo(moduloAtual(turma.entrada, semestreAtual))}</p>
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
        {/* O que ele deve, antes de tudo. A coordenação já vê isso nos
            relatórios, mas quem faz a chamada é ele — e sem este aviso teria
            que abrir disciplina por disciplina para descobrir o que ficou. */}
        {atrasadas.length > 0 && (
          <button
            onClick={() => abrirChamada(atrasadas[0])}
            className="w-full rounded-2xl bg-amber-500 p-4 text-left text-white shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {atrasadas.length === 1
                    ? "1 chamada em atraso"
                    : `${atrasadas.length} chamadas em atraso`}
                </p>
                <p className="text-sm text-amber-50 truncate">
                  A mais antiga: {atrasadas[0].disciplina?.nome} · aula {atrasadas[0].numero} ·{" "}
                  {formatarData(atrasadas[0].data_aula)}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-80" />
            </div>
            <p className="mt-2 text-xs text-amber-50">
              Toque para fazer esta. O diário de uma aula antiga é o mais difícil de lembrar.
            </p>
          </button>
        )}

        {disciplinas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 mt-8 shadow-sm">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-gray-600">Nenhuma disciplina vinculada.</p>
            <p className="text-xs mt-1">Peça ao administrador para atribuir suas disciplinas.</p>
          </div>
        ) : (
          disciplinas.map(disc => {
            const todasAulasDaDisc = todasAulas.filter(a => a.disciplina?.id === disc.id);
            const feitas = todasAulasDaDisc.filter(a => a.chamada_finalizada).length;
            const turmas = turmasDaDisciplina(disc.id);
            const pct = todasAulasDaDisc.length ? Math.round((feitas / todasAulasDaDisc.length) * 100) : 0;
            const atrasadasDaDisc = atrasadas.filter(a => a.disciplina?.id === disc.id).length;
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
                    {atrasadasDaDisc > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        {atrasadasDaDisc} em atraso
                      </span>
                    )}
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
