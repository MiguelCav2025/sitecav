import { lerSemestre } from "./calendario-escolar.ts";

/**
 * Para onde vai o aluno retido.
 *
 * As turmas do CAV avançam de módulo juntas: a que hoje cursa o módulo 2 estará
 * no 3 no semestre que vem. Então quem repete o módulo 2 **não pode ficar na
 * mesma turma** — ela já terá seguido adiante. Ele passa para a turma que
 * entrou um semestre depois, que é a que estará no módulo 2 quando ele
 * recomeçar (D52).
 *
 * A matrícula nova não nasce no fechamento. Se nascesse, o aluno apareceria já
 * na chamada de uma turma que ainda está num módulo anterior. Ele fica numa
 * lista de espera até o semestre seguinte começar.
 */

export interface TurmaSimples {
  id: string;
  nome: string;
  curso: string;
  turno: string;
  /** Semestre do calendário em que a turma começou. Ex.: "2026/1". */
  entrada: string;
  ativa?: boolean;
}

/** Soma semestres a "2026/1" e devolve "2026/2". */
export function somarSemestres(semestre: string, quantos: number): string | null {
  const s = lerSemestre(semestre);
  if (!s) return null;
  const total = s.ano * 2 + (s.semestre - 1) + quantos;
  if (total < 0) return null;
  return `${Math.floor(total / 2)}/${(total % 2) + 1}`;
}

/**
 * A turma em que o aluno refaz o módulo.
 *
 * Mesmo curso, mesmo turno, entrada um semestre depois. Devolve `null` quando
 * essa turma ainda não existe — o que é comum, porque ela costuma ser criada só
 * quando o processo seletivo fecha. Null aqui significa "espere", não "erro".
 */
export function turmaDaRepeticao(
  origem: TurmaSimples,
  turmas: readonly TurmaSimples[],
): TurmaSimples | null {
  const alvo = somarSemestres(origem.entrada, 1);
  if (!alvo) return null;

  return (
    turmas.find(
      t =>
        t.id !== origem.id &&
        t.curso === origem.curso &&
        t.turno === origem.turno &&
        t.entrada === alvo &&
        t.ativa !== false,
    ) ?? null
  );
}

export interface MatriculaHistorica {
  id: string;
  alunoId: string;
  aluno: string;
  turmaId: string;
  modulo: number;
  situacao: string;
}

export interface RetidoAguardando {
  alunoId: string;
  aluno: string;
  /** A matrícula que terminou em retenção. */
  matriculaId: string;
  turmaOrigemId: string;
  modulo: number;
}

/**
 * Quem foi retido e ainda não voltou.
 *
 * "Ainda não voltou" é não ter nenhuma matrícula em andamento em lugar nenhum.
 * Não precisa de tabela nova nem de um estado "aguardando" — o estado é a
 * ausência de matrícula ativa, e derivar evita que alguém volte a cursar e
 * continue marcado como pendente por esquecimento de atualizar a flag.
 */
export function retidosAguardandoRematricula(
  matriculas: readonly MatriculaHistorica[],
): RetidoAguardando[] {
  const temMatriculaAtiva = new Set(
    matriculas.filter(m => m.situacao === "cursando").map(m => m.alunoId),
  );

  const porAluno = new Map<string, RetidoAguardando>();
  for (const m of matriculas) {
    if (m.situacao !== "retido") continue;
    if (temMatriculaAtiva.has(m.alunoId)) continue;
    // Se foi retido mais de uma vez, vale a retenção mais recente da lista.
    porAluno.set(m.alunoId, {
      alunoId: m.alunoId,
      aluno: m.aluno,
      matriculaId: m.id,
      turmaOrigemId: m.turmaId,
      modulo: m.modulo,
    });
  }

  return [...porAluno.values()].sort((a, b) => a.aluno.localeCompare(b.aluno, "pt-BR"));
}
