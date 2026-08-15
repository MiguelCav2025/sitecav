"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { rotuloDoTurno, HORARIOS } from "@/lib/aulas-do-dia";
import { conflitosDeSala, descreverConflito, type Conflito, type DisciplinaNaGrade } from "@/lib/conflitos-grade";
import {
  separarPendentes, atrasosPorProfessor, riscoDaEscola, separarRisco,
  andamentoDoSemestre, estaTudoEmOrdem,
  type ChamadaPendente, type FrequenciaDaEscola, type AtrasoDoProfessor,
  type RiscoNaEscola, type AndamentoDoSemestre,
} from "@/lib/resumo-da-escola";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, CalendarCheck, CheckCircle2, ClipboardX, DoorOpen, Loader2,
  Scale, TrendingDown, Users,
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

interface EsperandoDecisao { turmaId: string; turma: string; modulo: number; quantidade: number; }

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
  const [totais, setTotais] = useState({ turmas: 0, alunos: 0, professores: 0 });

  const carregar = useCallback(async () => {
    setCarregando(true);
    // A data vem do relógio de quem olha, não do servidor: o banco roda em UTC
    // e depois das 21h a aula da noite já seria "amanhã".
    const hoje = new Date().toLocaleDateString("sv-SE");

    const [
      { data: turmasData }, { data: pendentesData }, { data: freqData },
      { data: matriculasData }, { data: aulasHojeData }, { data: discData },
      { count: totalAlunos }, { count: totalProfs },
    ] = await Promise.all([
      supabase.from("turmas").select("id, curso, turno, entrada"),
      supabase.from("vw_chamadas_pendentes").select("*"),
      supabase.from("vw_frequencia_turma").select("*"),
      supabase.from("matriculas").select("turma_id, modulo").eq("situacao", "cursando"),
      supabase.from("aulas")
        .select("id, numero, turma_id, chamada_finalizada, professor:professores(nome), disciplina:disciplinas(nome, sala:salas(nome))")
        .eq("data_aula", hoje),
      supabase.from("disciplinas").select("id, nome, curso, modulo, dia_da_semana, sala_id, sala:salas(nome)"),
      supabase.from("alunos").select("id", { count: "exact", head: true }),
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
    setAtrasos(atrasosPorProfessor(atrasadas, rotuloDaTurma));
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

    setTotais({
      turmas: turmas.length,
      alunos: totalAlunos ?? 0,
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

  const tudoEmOrdem = estaTudoEmOrdem([
    totalAtrasadas, semRecuperacao.length, porUmFio.length, conflitos.length,
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
      <Card className="border-blue-200 bg-blue-50/70">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
          <Numero rotulo="Semestre" valor={semestre ?? "—"} />
          <Numero rotulo="Turmas" valor={totais.turmas} />
          <Numero rotulo="Alunos" valor={totais.alunos} />
          <Numero rotulo="Professores" valor={totais.professores} />
          {andamento && andamento.aulasPrevistas > 0 && (
            <div className="min-w-45 flex-1">
              <p className="text-xs text-gray-500">
                Andamento — <strong className="text-gray-800">{andamento.aulasDadas}</strong>{" "}
                de {andamento.aulasPrevistas} aulas dadas
              </p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-blue-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${andamento.percentual}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
          icone={<ClipboardX className="h-4 w-4 text-red-600" />}
          titulo={`${totalAtrasadas} chamada(s) em atraso`}
          borda="border-red-300"
          fundo="bg-red-50"
          ajuda={maisAntiga
            ? `A mais antiga é de ${formatarData(maisAntiga.data_aula)} — ${maisAntiga.dias_atras} dias.`
            : undefined}
          acao={<Ir para="relatorios">Ver nos relatórios</Ir>}
        >
          {/* Agrupado por professor, e não por turma: a conversa que resolve
              isto é com uma pessoa. Seis linhas espalhadas por três turmas
              não dizem a quem ligar. */}
          <ul className="divide-y divide-red-100">
            {atrasos.map(a => (
              <li key={a.professor} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
                <strong className="text-gray-800">{a.professor}</strong>
                <span className="text-gray-600">
                  {a.quantidade} chamada{a.quantidade > 1 ? "s" : ""}
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  a mais antiga há {a.diasDaMaisAntiga} dias
                </span>
                <span className="text-xs text-gray-500">{a.turmas.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {conflitos.length > 0 && (
        <Bloco
          icone={<DoorOpen className="h-4 w-4 text-red-600" />}
          titulo={`${conflitos.length} conflito(s) de sala`}
          borda="border-red-300"
          fundo="bg-red-50"
          ajuda="Duas disciplinas no mesmo espaço, no mesmo dia e turno."
          acao={<Ir para="disciplinas">Ajustar a grade</Ir>}
        >
          <ul className="space-y-1 text-sm text-gray-700">
            {conflitos.map((c, i) => <li key={i}>{descreverConflito(c)}</li>)}
          </ul>
        </Bloco>
      )}

      {esperando.length > 0 && (
        <Bloco
          icone={<Scale className="h-4 w-4 text-amber-600" />}
          titulo={`${esperando.reduce((s, e) => s + e.quantidade, 0)} aluno(s) com matrícula em aberto`}
          borda="border-amber-300"
          fundo="bg-amber-50"
          ajuda="Só vira decisão no fim do módulo — até lá, é só o retrato de quem está cursando."
          acao={<Ir para="fechamento">Ir ao fechamento</Ir>}
        >
          <ul className="flex flex-wrap gap-2">
            {esperando.map(e => (
              <li key={`${e.turmaId}|${e.modulo}`}
                  className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                {e.turma} · <strong>{e.quantidade}</strong>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {/* ── Hoje ────────────────────────────────────────────────────────── */}
      <Bloco
        icone={<CalendarCheck className="h-4 w-4 text-blue-600" />}
        titulo={aulasDeHoje.length === 0 ? "Nenhuma aula hoje" : `${aulasDeHoje.length} aula(s) hoje`}
        borda="border-gray-200"
        fundo="bg-white"
        ajuda={aulasDeHoje.length === 0
          ? "Fim de semana, feriado, ou o semestre ainda não começou."
          : "O que acontece hoje, e quem já fechou a chamada."}
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

      {/* ── Vigiar ──────────────────────────────────────────────────────── */}
      {semRecuperacao.length > 0 && (
        <Bloco
          icone={<AlertTriangle className="h-4 w-4 text-red-600" />}
          titulo={`${semRecuperacao.length} aluno(s) já não alcançam os 70%`}
          borda="border-red-300"
          fundo="bg-red-50"
          ajuda="Nem vindo a todas as aulas restantes. Aqui só cabe conversar — e quanto antes."
          acao={<Ir para="relatorios">Ver frequência</Ir>}
        >
          <ListaDeRisco itens={semRecuperacao} />
        </Bloco>
      )}

      {porUmFio.length > 0 && (
        <Bloco
          icone={<TrendingDown className="h-4 w-4 text-amber-600" />}
          titulo={`${porUmFio.length} aluno(s) por um fio`}
          borda="border-amber-300"
          fundo="bg-amber-50"
          ajuda="Ainda cabem uma ou duas faltas. É onde um telefonema resolve."
          acao={<Ir para="relatorios">Ver frequência</Ir>}
        >
          <ListaDeRisco itens={porUmFio} />
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

function Bloco({
  icone, titulo, ajuda, borda, fundo, acao, children,
}: {
  icone: React.ReactNode;
  titulo: string;
  ajuda?: string;
  borda: string;
  fundo: string;
  acao?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className={`${borda} ${fundo}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">{icone}{titulo}</CardTitle>
          {acao}
        </div>
        {ajuda && <p className="text-sm text-gray-600">{ajuda}</p>}
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function ListaDeRisco({ itens }: { itens: readonly RiscoNaEscola[] }) {
  return (
    <ul className="divide-y divide-black/5">
      {itens.map(r => (
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
  );
}
