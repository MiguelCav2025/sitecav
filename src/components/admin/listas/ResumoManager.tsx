"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo, MODULOS_DO_CURSO } from "@/lib/calendario-escolar";
import { PRESENCA_MINIMA } from "@/lib/aprovacao";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { rotuloDoTurno, HORARIOS } from "@/lib/aulas-do-dia";
import { conflitosDeSala, descreverConflito, type Conflito, type DisciplinaNaGrade } from "@/lib/conflitos-grade";
import {
  separarPendentes, atrasosPorProfessor, riscoDaEscola, separarRisco,
  andamentoDoSemestre, estaTudoEmOrdem, lacunasDeConfiguracao,
  indexarAlunos, buscarAluno, matrizDeTurmas, agruparTurmasDoProfessor,
  type ChamadaPendente, type FrequenciaDaEscola, type AtrasoDoProfessor,
  type RiscoNaEscola, type AndamentoDoSemestre, type Lacuna,
  type DisciplinaConfigurada, type AlunoNaBusca, type CursoNaMatriz,
} from "@/lib/resumo-da-escola";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, CalendarCheck, CheckCircle2, ClipboardX, DoorOpen, Loader2,
  Search, TrendingDown, Users, Wrench,
} from "lucide-react";

/**
 * O panorama da escola — a tela que faltava.
 *
 * O coordenador entrava no painel e caía numa navegação de áreas: nenhuma tela
 * dizia "olhe isto hoje". Cada aviso que o sistema sabe dar vivia dentro de uma
 * turma escolhida num dropdown, e com 12 turmas isso custava doze visitas a
 * três abas — então na prática ninguém olhava.
 *
 * Regras da tela, que valem mais que qualquer card individual:
 *
 *   1. Bloco sem conteúdo NÃO aparece. Um resumo que mostra tudo sempre vira
 *      papel de parede.
 *   2. Quando nada aparece, dizer isso com todas as letras — tela em branco
 *      lê como "não carregou".
 *   3. Peso visual = urgência. Vermelho para o que já passou do ponto, âmbar
 *      para o que ainda dá para evitar, cinza para configuração.
 */

interface Turma { id: string; curso: string; turno: string; entrada: string; }

interface AulaDeHoje {
  id: string;
  turma: string;
  turno: string;
  disciplina: string;
  professor: string | null;
  sala: string | null;
  numero: number;
  finalizada: boolean;
}

interface EsperandoDecisao {
  turmaId: string; turma: string; curso: string; turno: string;
  modulo: number; quantidade: number;
}

/** Quantos itens cabem antes da lista virar parede. */
const LIMITE_DA_LISTA = 8;

/** "8 chamadas", "1 chamada" — o "(s)" nunca ajudou ninguém a ler. */
const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

const formatarData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
};

export default function ResumoManager({
  aoNavegar,
}: {
  /** Leva à aba onde o problema se resolve — resumo que só informa faz procurar de novo. */
  aoNavegar?: (secao: string) => void;
}) {
  const supabase = createClient();
  const { semestre } = useSemestreVigente();

  const [carregando, setCarregando] = useState(true);
  const [atrasos, setAtrasos] = useState<AtrasoDoProfessor[]>([]);
  const [totalAtrasadas, setTotalAtrasadas] = useState(0);
  const [maisAntiga, setMaisAntiga] = useState<ChamadaPendente | null>(null);
  const [semRecuperacao, setSemRecuperacao] = useState<RiscoNaEscola[]>([]);
  const [porUmFio, setPorUmFio] = useState<RiscoNaEscola[]>([]);
  const [aulasDeHoje, setAulasDeHoje] = useState<AulaDeHoje[]>([]);
  const [esperando, setEsperando] = useState<EsperandoDecisao[]>([]);
  const [conflitos, setConflitos] = useState<Conflito[]>([]);
  const [andamento, setAndamento] = useState<AndamentoDoSemestre | null>(null);
  const [lacunas, setLacunas] = useState<Lacuna[]>([]);
  const [indice, setIndice] = useState<AlunoNaBusca[]>([]);
  const [termo, setTermo] = useState("");
  const [verTodosAtrasos, setVerTodosAtrasos] = useState(false);
  const [totais, setTotais] = useState({ turmas: 0, alunos: 0, professores: 0 });

  const carregar = useCallback(async () => {
    setCarregando(true);
    // A data vem do relógio de quem olha, não do servidor: o banco roda em UTC
    // e depois das 21h a aula da noite já seria "amanhã".
    const hoje = new Date().toLocaleDateString("sv-SE");

    const [
      { data: turmasData }, { data: pendentesData }, { data: freqData },
      { data: matriculasData }, { data: aulasHojeData }, { data: discData },
      { data: alunosData }, { count: totalProfs },
    ] = await Promise.all([
      supabase.from("turmas").select("id, curso, turno, entrada"),
      supabase.from("vw_chamadas_pendentes").select("*"),
      supabase.from("vw_frequencia_turma").select("*"),
      supabase.from("matriculas").select("turma_id, modulo").eq("situacao", "cursando"),
      supabase.from("aulas")
        .select("id, numero, turma_id, chamada_finalizada, professor:professores(nome), disciplina:disciplinas(nome, sala:salas(nome))")
        .eq("data_aula", hoje),
      supabase.from("disciplinas").select("id, nome, curso, modulo, dia_da_semana, sala_id, professor_id, sala:salas(nome)"),
      supabase.from("alunos").select("id, nome"),
      supabase.from("professores").select("id", { count: "exact", head: true }),
    ]);

    const turmas = (turmasData ?? []) as Turma[];
    const porId = new Map(turmas.map(t => [t.id, t]));
    const rotuloDaTurma = (id: string) => {
      const t = porId.get(id);
      if (!t) return "turma removida";
      return `${t.curso} · ${t.turno} · ${rotuloModulo(moduloAtual(t.entrada, semestre))}`;
    };

    // ── Chamadas ──
    const { atrasadas } = separarPendentes((pendentesData ?? []) as ChamadaPendente[]);
    setAtrasos(atrasosPorProfessor(atrasadas, id => {
      const t = porId.get(id);
      return t ? moduloAtual(t.entrada, semestre) : null;
    }));
    setTotalAtrasadas(atrasadas.length);
    setMaisAntiga(atrasadas[0] ?? null);

    // ── Frequência ──
    const frequencia = (freqData ?? []) as FrequenciaDaEscola[];
    const { semRecuperacao, porUmFio } = separarRisco(riscoDaEscola(frequencia, rotuloDaTurma));
    setSemRecuperacao(semRecuperacao);
    setPorUmFio(porUmFio);
    setAndamento(andamentoDoSemestre(frequencia));

    // ── Esperando decisão ──
    const contagem = new Map<string, EsperandoDecisao>();
    for (const m of (matriculasData ?? []) as { turma_id: string; modulo: number }[]) {
      const chave = `${m.turma_id}|${m.modulo}`;
      const atual = contagem.get(chave);
      if (atual) atual.quantidade++;
      else contagem.set(chave, {
        turmaId: m.turma_id, turma: rotuloDaTurma(m.turma_id),
        curso: porId.get(m.turma_id)?.curso ?? "—",
        turno: porId.get(m.turma_id)?.turno ?? "—",
        modulo: m.modulo, quantidade: 1,
      });
    }
    setEsperando([...contagem.values()].sort((a, b) => b.quantidade - a.quantidade));

    // ── Aulas de hoje ──
    setAulasDeHoje(((aulasHojeData ?? []) as unknown as {
      id: string; numero: number; turma_id: string; chamada_finalizada: boolean;
      professor: { nome: string } | null;
      disciplina: { nome: string; sala: { nome: string } | null } | null;
    }[]).map(a => ({
      id: a.id,
      turma: rotuloDaTurma(a.turma_id),
      turno: porId.get(a.turma_id)?.turno ?? "",
      disciplina: a.disciplina?.nome ?? "—",
      professor: a.professor?.nome ?? null,
      sala: a.disciplina?.sala?.nome ?? null,
      numero: a.numero,
      finalizada: a.chamada_finalizada,
    })).sort((x, y) => x.turno.localeCompare(y.turno) || x.disciplina.localeCompare(y.disciplina, "pt-BR")));

    // ── Conflito de sala ──
    // Os turnos saem das turmas que cursam a disciplina: a mesma matéria pode
    // acontecer de manhã e à noite, e só colide dentro do mesmo turno.
    const turnosPorCursoModulo = new Map<string, string[]>();
    for (const t of turmas) {
      const modulo = moduloAtual(t.entrada, semestre);
      if (modulo === null) continue;
      const chave = `${t.curso}|${modulo}`;
      const lista = turnosPorCursoModulo.get(chave) ?? [];
      if (!lista.includes(t.turno)) lista.push(t.turno);
      turnosPorCursoModulo.set(chave, lista);
    }
    const disciplinas: DisciplinaNaGrade[] = ((discData ?? []) as unknown as {
      id: string; nome: string; curso: string; modulo: number;
      dia_da_semana: number | null; sala_id: string | null; sala: { nome: string } | null;
    }[]).map(d => ({
      id: d.id, nome: d.nome, curso: d.curso, modulo: d.modulo,
      dia_da_semana: d.dia_da_semana, sala_id: d.sala_id,
      sala: d.sala?.nome ?? null,
      turnos: turnosPorCursoModulo.get(`${d.curso}|${d.modulo}`) ?? [],
    }));
    setConflitos(conflitosDeSala(disciplinas));

    // ── Lacunas de configuração ──
    const turmasComAluno = new Set(
      ((matriculasData ?? []) as { turma_id: string }[]).map(m => m.turma_id),
    );
    setLacunas(lacunasDeConfiguracao({
      disciplinas: (discData ?? []) as unknown as DisciplinaConfigurada[],
      cursoModuloEmUso: new Set(turnosPorCursoModulo.keys()),
      turmas,
      turmasComAluno,
      // `semestre` sai do cronograma que cobre hoje: null significa que não há.
      temCalendario: semestre !== null,
    }));

    // ── Busca ──
    const alunos = (alunosData ?? []) as { id: string; nome: string }[];
    setIndice(indexarAlunos(alunos, frequencia, rotuloDaTurma));

    setTotais({
      turmas: turmas.length,
      alunos: alunos.length,
      professores: totalProfs ?? 0,
    });
    setCarregando(false);
  }, [supabase, semestre]);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-12 text-blue-200">
        <Loader2 className="h-5 w-5 animate-spin" /> Lendo a escola inteira...
      </div>
    );
  }

  const achados = buscarAluno(indice, termo);

  // As lacunas entram na conta: "Nada pendente" acima de uma lista de quatro
  // buracos de configuração seria o resumo se contradizendo na mesma tela.
  const tudoEmOrdem = estaTudoEmOrdem([
    totalAtrasadas, semRecuperacao.length, porUmFio.length,
    conflitos.length, lacunas.length,
  ]);

  const Ir = ({ para, children }: { para: string; children: React.ReactNode }) => (
    <button
      onClick={() => aoNavegar?.(para)}
      className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
    >
      {children} →
    </button>
  );

  return (
    <div className="space-y-5">
      {/* ── Onde a escola está ─────────────────────────────────────────── */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
          <Numero rotulo="Semestre" valor={semestre ?? "—"} />
          <Numero rotulo="Turmas" valor={totais.turmas} />
          <Numero rotulo="Alunos" valor={totais.alunos} />
          <Numero rotulo="Professores" valor={totais.professores} />
          {andamento && andamento.aulasPrevistas > 0 && (
            <div className="min-w-45 flex-1">
              <p className="text-xs text-gray-500">
                Chamadas fechadas —{" "}
                <strong className="text-gray-800">{andamento.aulasDadas}</strong>{" "}
                de {andamento.aulasPrevistas} aulas
                {andamento.aulasDadas === 0 && (
                  <span className="text-amber-700"> · nenhuma ainda</span>
                )}
              </p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${andamento.percentual}%` }}
                />
              </div>
              {/* A aula ACONTECEU; o que falta e a chamada. Dizer "aulas dadas"
                  aqui era contar as 110 pendencias ao contrario e chamar isso
                  de andamento do semestre. */}
              <p className="mt-0.5 text-[11px] text-gray-400">
                Mede o registro, não o semestre: a aula acontece mesmo sem a chamada.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* A pergunta mais frequente de qualquer secretaria — e que hoje exige
          acertar a turma no dropdown ANTES de poder procurar. */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Procurar aluno pelo nome..."
            className="bg-white pl-9"
          />
        </div>
        {termo.trim().length >= 2 && (
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {achados.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                Ninguém com esse nome. A busca ignora acento e maiúscula.
              </li>
            ) : achados.map(a => (
              <li key={a.id} className="px-3 py-2 text-sm">
                <strong className="text-gray-800">{a.nome}</strong>
                {a.matriculas.length === 0 ? (
                  <span className="ml-2 text-xs text-gray-500">
                    sem turma — cadastrado, mas não está cursando
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-gray-600">
                    {a.matriculas.map(m => (
                      <span key={m.turmaId} className="mr-3">
                        {m.turma} ·{" "}
                        {m.percentual === null ? (
                          <span className="text-gray-400">sem chamada fechada</span>
                        ) : (
                          <strong className={m.percentual < PRESENCA_MINIMA ? "text-red-600" : "text-green-700"}>
                            {m.percentual}%
                          </strong>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {tudoEmOrdem && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="flex items-start gap-3 py-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Nada pendente hoje.</p>
              <p className="text-sm text-green-800">
                Nenhuma chamada em atraso, nenhum aluno em risco de frequência e
                nenhum conflito de sala. O que aparecer aqui é o que precisa de você.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Precisa de você ─────────────────────────────────────────────── */}
      {totalAtrasadas > 0 && (
        <Bloco
          nivel="urgente"
          numero={totalAtrasadas}
          icone={<ClipboardX className="h-4 w-4 text-red-600" />}
          titulo={`${plural(totalAtrasadas, "chamada", "chamadas")} em atraso`}
          // "8 chamadas" lia como "8 chamadas de alunos". Cada uma e um DIA de
          // uma disciplina numa turma — dizer isso na tela evita a conta errada
          // de cabeca que qualquer um faria.
          ajuda={
            <>
              Uma por dia de aula de cada disciplina — não é por aluno.
              {maisAntiga && (
                <> A mais antiga é de <strong>{formatarData(maisAntiga.data_aula)}</strong>,
                  há {maisAntiga.dias_atras} dias.</>
              )}
            </>
          }
          acao={<Ir para="relatorios">Ver nos relatórios</Ir>}
        >
          {/* Agrupado por professor, e não por turma: a conversa que resolve
              isto é com uma pessoa. Seis linhas espalhadas por três turmas
              não dizem a quem ligar. */}
          {/* Vinte professores empilhados viram parede. Os piores primeiro, o
              resto a um clique — a ordem ja poe no topo quem tem a chamada
              mais velha, que e por onde se comeca. */}
          <ul className="divide-y divide-red-100">
            {(verTodosAtrasos ? atrasos : atrasos.slice(0, LIMITE_DA_LISTA)).map(a => (
              // Duas linhas em vez de uma fileira de coisas soltas: os nomes
              // formam uma coluna que se lê de cima a baixo, e a gravidade
              // forma outra, alinhada a direita. Antes tudo tinha o mesmo peso
              // e o olho nao tinha por onde comecar.
              <li key={a.professor} className="py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900">{a.professor}</span>
                  <span className="shrink-0 text-xs font-medium text-red-700">
                    há {a.diasDaMaisAntiga} dias
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-red-800">
                    {a.quantidade} {plural(a.quantidade, "aula", "aulas")}
                  </span>
                  {agruparTurmasDoProfessor(a.turmas).map(g => (
                    <span key={g.curso}
                          className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-500">
                      <strong className="font-medium text-gray-700">{g.curso}</strong>
                      {g.porTurno.map(t => (
                        <span key={t.turno} className="ml-1.5">
                          {t.turno}{" "}
                          <span className="tabular-nums">
                            {t.modulos.map(m => (m === null ? "?" : m)).join("·")}
                          </span>
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {atrasos.length > LIMITE_DA_LISTA && (
            <button
              onClick={() => setVerTodosAtrasos(v => !v)}
              className="mt-2 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
            >
              {verTodosAtrasos
                ? "Mostrar menos"
                : `Ver os outros ${atrasos.length - LIMITE_DA_LISTA} professores`}
            </button>
          )}
        </Bloco>
      )}

      {conflitos.length > 0 && (
        <Bloco
          nivel="urgente"
          numero={conflitos.length}
          icone={<DoorOpen className="h-4 w-4 text-red-600" />}
          titulo={`${plural(conflitos.length, "conflito", "conflitos")} de sala`}
          ajuda="Duas disciplinas no mesmo espaço, no mesmo dia e turno."
          acao={<Ir para="disciplinas">Ajustar a grade</Ir>}
        >
          <ul className="space-y-1 text-sm text-gray-700">
            {conflitos.map((c, i) => <li key={i}>{descreverConflito(c)}</li>)}
          </ul>
        </Bloco>
      )}

      {/* ── Hoje ────────────────────────────────────────────────────────── */}
      {/* Sábado não merece um card do tamanho de uma emergência. Sem aula, isto
          vira uma linha; com aula, vira bloco. */}
      {aulasDeHoje.length === 0 ? (
        <p className="flex items-center gap-2 px-1 text-sm text-blue-200">
          <CalendarCheck className="h-4 w-4 shrink-0 opacity-60" />
          Nenhuma aula hoje — fim de semana, feriado, ou o semestre ainda não começou.
        </p>
      ) : (
      <Bloco
        nivel="panorama"
        numero={aulasDeHoje.length}
        icone={<CalendarCheck className="h-4 w-4 text-blue-500" />}
        titulo={`${plural(aulasDeHoje.length, "aula", "aulas")} hoje`}
        ajuda="O que acontece hoje, e quem já fechou a chamada."
      >
        {aulasDeHoje.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {aulasDeHoje.map(a => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
                <span className="font-mono text-xs text-gray-500">
                  {HORARIOS[a.turno]?.[0]?.inicio ?? rotuloDoTurno(a.turno)}
                </span>
                <strong className="text-gray-800">{a.disciplina}</strong>
                <span className="text-gray-600">{a.turma}</span>
                {a.professor && <span className="text-xs text-gray-500">{a.professor}</span>}
                {a.sala && <span className="text-xs text-gray-400">sala {a.sala}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                  a.finalizada
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"}`}>
                  {a.finalizada ? "chamada feita" : "aguardando chamada"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
      )}

      {esperando.length > 0 && (
        <Bloco
          nivel="panorama"
          icone={<Users className="h-4 w-4 text-gray-400" />}
          titulo={`${esperando.reduce((s, e) => s + e.quantidade, 0)} alunos cursando, por turma`}
          ajuda="Retrato de quem está matriculado agora. Vira decisão no fim do módulo."
          acao={<Ir para="fechamento">Ir ao fechamento</Ir>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {matrizDeTurmas(esperando, MODULOS_DO_CURSO).map(c => (
              <MatrizDoCurso key={c.curso} curso={c} />
            ))}
          </div>
        </Bloco>
      )}

      {/* ── Vigiar ──────────────────────────────────────────────────────── */}
      {semRecuperacao.length > 0 && (
        <Bloco
          nivel="urgente"
          numero={semRecuperacao.length}
          icone={<AlertTriangle className="h-4 w-4 text-red-600" />}
          titulo={`${plural(semRecuperacao.length, "aluno", "alunos")} já não alcançam os 70%`}
          ajuda="Nem vindo a todas as aulas restantes. Aqui só cabe conversar — e quanto antes."
          acao={<Ir para="relatorios">Ver frequência</Ir>}
        >
          <ListaDeRisco itens={semRecuperacao} />
        </Bloco>
      )}

      {porUmFio.length > 0 && (
        <Bloco
          nivel="atencao"
          numero={porUmFio.length}
          icone={<TrendingDown className="h-4 w-4 text-amber-600" />}
          titulo={`${plural(porUmFio.length, "aluno", "alunos")} por um fio`}
          ajuda="Ainda cabem uma ou duas faltas. É onde um telefonema resolve."
          acao={<Ir para="relatorios">Ver frequência</Ir>}
        >
          <ListaDeRisco itens={porUmFio} />
        </Bloco>
      )}

      {/* ── Configuração ─────────────────────────────────────────────────
          Por último e em cinza: é o que se olha em fevereiro, montando o
          semestre, não em maio no meio das aulas. */}
      {lacunas.length > 0 && (
        <Bloco
          nivel="atencao"
          numero={lacunas.length}
          icone={<Wrench className="h-4 w-4 text-amber-600" />}
          titulo={`${plural(lacunas.length, "ponto", "pontos")} da configuração pela metade`}
          ajuda="Nada quebra por causa disso — a coisa só não acontece, em silêncio."
        >
          <ul className="space-y-1.5">
            {lacunas.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm text-gray-700">
                <span>{l.texto}</span>
                <Ir para={l.onde}>Corrigir</Ir>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="text-xl font-bold text-gray-800">{valor}</p>
    </div>
  );
}

type Nivel = "urgente" | "atencao" | "panorama";

/**
 * O peso visual vem da urgência, não da moldura.
 *
 * Antes todo bloco era o mesmo retângulo com o mesmo título: uma emergência de
 * 110 chamadas atrasadas e o fato de 113 alunos estarem matriculados liam
 * igual. Sem hierarquia, o olho não sabe onde pousar e a tela vira lista.
 *
 * Agora o número é o herói do bloco urgente — grande, colorido, à esquerda —
 * e a faixa lateral repete a cor. O panorama fica sem faixa e com título
 * menor: ele informa, não chama.
 */
const NIVEIS: Record<Nivel, {
  faixa: string; borda: string; fundo: string; numero: string; titulo: string;
}> = {
  // Fundo SOLIDO, nunca translucido. O painel tem fundo azul-escuro, e
  // `bg-red-50/60` nao compoe sobre branco — compoe sobre o azul, e o vermelho
  // claro vira um roxo sujo. Mesma familia do branco-sobre-branco: a cor sai
  // errada sem erro de build e sem aviso.
  urgente:  { faixa: "bg-red-500",   borda: "border-red-200",   fundo: "bg-red-50",   numero: "text-red-600",   titulo: "text-lg font-bold text-gray-900" },
  atencao:  { faixa: "bg-amber-500", borda: "border-amber-200", fundo: "bg-amber-50", numero: "text-amber-600", titulo: "text-base font-semibold text-gray-900" },
  panorama: { faixa: "bg-transparent", borda: "border-gray-200", fundo: "bg-white",      numero: "text-gray-400",  titulo: "text-base font-semibold text-gray-700" },
};

function Bloco({
  nivel, numero, icone, titulo, ajuda, acao, children,
}: {
  nivel: Nivel;
  /** O número que dói. Vira o elemento de maior peso do bloco. */
  numero?: number;
  icone: React.ReactNode;
  titulo: string;
  ajuda?: React.ReactNode;
  acao?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const e = NIVEIS[nivel];
  return (
    <Card className={`relative overflow-hidden ${e.borda} ${e.fundo}`}>
      {nivel !== "panorama" && (
        <span className={`absolute inset-y-0 left-0 w-1 ${e.faixa}`} aria-hidden />
      )}
      <CardHeader className="pb-2 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {numero !== undefined && (
              <span className={`text-3xl font-bold leading-none tabular-nums ${e.numero}`}>
                {numero}
              </span>
            )}
            <div>
              <CardTitle className={`flex items-center gap-2 ${e.titulo}`}>
                {icone}{titulo}
              </CardTitle>
              {ajuda && <p className="mt-0.5 text-sm text-gray-600">{ajuda}</p>}
            </div>
          </div>
          {acao}
        </div>
      </CardHeader>
      {children && <CardContent className="pt-0 pl-5">{children}</CardContent>}
    </Card>
  );
}

/**
 * Um curso desenhado como ele é: turnos nas linhas, módulos nas colunas.
 *
 * A fila de etiquetas ordenada por tamanho repetia "Cine/TV" seis vezes e
 * transformava o módulo em texto no meio da frase. Pior: turma que não existe
 * simplesmente não tinha etiqueta, então o buraco era invisível — e num
 * desenho de 2 cursos × 3 módulos × 2 turnos, o buraco é justamente o que se
 * quer ver.
 */
function MatrizDoCurso({ curso }: { curso: CursoNaMatriz }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-800">{curso.curso}</h4>
        <span className="text-xs text-gray-500">
          <strong className="text-gray-800 tabular-nums">{curso.total}</strong> alunos
        </span>
      </div>

      {/* Sem `w-full`: esticada, cada numero ficava numa caixa de 190px por
          24px. A tabela agora tem o tamanho do conteudo. */}
      <table className="border-collapse text-center">
        <thead>
          <tr>
            <th className="w-12" />
            {Array.from({ length: MODULOS_DO_CURSO }, (_, i) => (
              <th key={i} className="w-14 pb-1 text-[11px] font-medium text-gray-500">
                Mód. {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {curso.linhas.map(l => (
            <tr key={l.turno}>
              <th className="py-1 text-left text-[11px] font-medium text-gray-500">{l.turno}</th>
              {l.celulas.map((c, i) => (
                <td key={i} className="p-0.5">
                  {c === null ? (
                    // O buraco precisa ler como buraco, e não como zero aluno.
                    <span
                      title="Não há turma neste módulo e turno"
                      className="block rounded border border-dashed border-gray-300 py-1.5 text-xs text-gray-400"
                    >
                      —
                    </span>
                  ) : (
                    <span className="block rounded border border-gray-200 bg-white py-1.5 text-base font-bold tabular-nums text-gray-800">
                      {c.quantidade}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {curso.vazias > 0 && (
        <p className="mt-2 text-[11px] text-amber-700">
          {curso.vazias === 1 ? "1 combinação sem turma" : `${curso.vazias} combinações sem turma`}
        </p>
      )}
    </div>
  );
}

function ListaDeRisco({ itens }: { itens: readonly RiscoNaEscola[] }) {
  const [tudo, setTudo] = useState(false);
  const visiveis = tudo ? itens : itens.slice(0, LIMITE_DA_LISTA);
  return (
    <>
    <ul className="divide-y divide-black/5">
      {visiveis.map(r => (
        <li key={`${r.alunoId}|${r.turmaId}|${r.disciplinaId}`}
            className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
          <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <strong className="text-gray-800">{r.aluno}</strong>
          <span className="text-gray-600">{r.disciplina}</span>
          <span className="text-xs text-gray-500">{r.turma}</span>
          <span className="ml-auto text-xs text-gray-600">
            {r.jaNaoAlcanca
              ? <>chega no máximo a <strong>{r.melhorPercentualPossivel}%</strong></>
              : <>ainda cabem <strong>{r.faltasQueAindaCabem}</strong> falta(s)</>}
          </span>
        </li>
      ))}
    </ul>
    {itens.length > LIMITE_DA_LISTA && (
      <button
        onClick={() => setTudo(v => !v)}
        className="mt-2 text-xs font-medium text-gray-700 underline-offset-2 hover:underline"
      >
        {tudo ? "Mostrar menos" : `Ver os outros ${itens.length - LIMITE_DA_LISTA}`}
      </button>
    )}
    </>
  );
}
