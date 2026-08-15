import { PRESENCA_MINIMA } from "./aprovacao.ts";
import { AULAS_POR_ENCONTRO } from "./aulas-do-dia.ts";
import {
  riscoDeFrequencia,
  type LinhaFrequencia,
  type RiscoDeFrequencia,
} from "./relatorios.ts";

/**
 * O panorama da escola, para o coordenador não andar sala por sala.
 *
 * Todo aviso que o sistema sabe dar vivia dentro de UMA turma escolhida num
 * dropdown: chamada em atraso, aluno que já não alcança os 70%, aluno
 * esperando decisão. Com 12 turmas possíveis, saber o estado da escola custava
 * abrir doze vezes três abas diferentes — então na prática ninguém sabia.
 *
 * As somas vêm prontas do banco (`vw_frequencia_turma`, `vw_chamadas_pendentes`,
 * Fase 20). Aqui só se organiza e se decide o que merece aparecer: um resumo
 * que mostra tudo sempre vira papel de parede, e aí ninguém mais olha.
 */

// ── O que chega do banco ─────────────────────────────────────────────────────

/** Uma linha de `vw_frequencia_turma`. Já em AULAS: cada dia vale 2. */
export interface FrequenciaDaEscola {
  turma_id: string;
  aluno_id: string;
  aluno: string;
  modulo: number;
  disciplina_id: string;
  disciplina: string;
  aulas_previstas: number;
  aulas_dadas: number;
  presencas: number;
  faltas_abonadas: number;
}

/** Uma linha de `vw_chamadas_pendentes`. Inclui as de HOJE — ver `separarPendentes`. */
export interface ChamadaPendente {
  aula_id: string;
  turma_id: string;
  curso: string;
  turno: string;
  entrada: string;
  disciplina_id: string;
  disciplina: string;
  numero: number;
  data_aula: string;
  professor: string | null;
  dias_atras: number;
}

export interface TurmaDoResumo {
  id: string;
  curso: string;
  turno: string;
  entrada: string;
}

// ── Chamadas ─────────────────────────────────────────────────────────────────

/**
 * A aula de hoje não está atrasada — ainda vai acontecer, ou acabou de
 * acabar. A view devolve as duas porque a pergunta dela é "data <= hoje";
 * misturá-las na tela acusaria o professor antes de ele ter tido chance.
 */
export function separarPendentes(pendentes: readonly ChamadaPendente[]) {
  return {
    atrasadas: pendentes
      .filter(p => p.dias_atras > 0)
      // A mais antiga primeiro: é a que corre risco de ninguém mais lembrar.
      .sort((a, b) => a.data_aula.localeCompare(b.data_aula)
        || a.disciplina.localeCompare(b.disciplina, "pt-BR")),
    deHoje: pendentes
      .filter(p => p.dias_atras === 0)
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR")),
  };
}

export interface AtrasoDoProfessor {
  professor: string;
  quantidade: number;
  /** Há quantos dias está a mais antiga — é o número que dói. */
  diasDaMaisAntiga: number;
  turmas: string[];
}

/**
 * Quem deve chamada, e há quanto tempo.
 *
 * Agrupado por professor e não por turma de propósito: a conversa que resolve
 * isto é com uma pessoa, não com uma turma. "A Camila deve 6 chamadas, a mais
 * velha de 12 dias" é acionável; seis linhas espalhadas por três turmas não.
 */
export function atrasosPorProfessor(
  atrasadas: readonly ChamadaPendente[],
  rotuloDaTurma: (turmaId: string) => string,
): AtrasoDoProfessor[] {
  const por = new Map<string, AtrasoDoProfessor>();

  for (const a of atrasadas) {
    const nome = a.professor ?? "Sem professor definido";
    const atual = por.get(nome);
    if (atual) {
      atual.quantidade++;
      atual.diasDaMaisAntiga = Math.max(atual.diasDaMaisAntiga, a.dias_atras);
      const turma = rotuloDaTurma(a.turma_id);
      if (!atual.turmas.includes(turma)) atual.turmas.push(turma);
    } else {
      por.set(nome, {
        professor: nome,
        quantidade: 1,
        diasDaMaisAntiga: a.dias_atras,
        turmas: [rotuloDaTurma(a.turma_id)],
      });
    }
  }

  return [...por.values()].sort(
    (a, b) => b.diasDaMaisAntiga - a.diasDaMaisAntiga
      || b.quantidade - a.quantidade
      || a.professor.localeCompare(b.professor, "pt-BR"),
  );
}

// ── Frequência ───────────────────────────────────────────────────────────────

/**
 * Traduz a linha da view para o formato que o cálculo de risco já conhece.
 *
 * Reaproveitar `riscoDeFrequencia` em vez de repetir a fórmula aqui é o que
 * garante que o Resumo e os Relatórios nunca discordem sobre quem está
 * rodando — duas contas do mesmo número acabam divergindo, sempre.
 */
function comoLinhaDeFrequencia(v: FrequenciaDaEscola): LinhaFrequencia {
  const faltas = Math.max(0, v.aulas_dadas - v.presencas);
  const percentual = v.aulas_dadas === 0
    ? null
    : Math.round((v.presencas * 1000) / v.aulas_dadas) / 10;
  const comAbono = v.aulas_dadas === 0
    ? null
    : Math.round(((v.presencas + v.faltas_abonadas) * 1000) / v.aulas_dadas) / 10;

  return {
    alunoId: v.aluno_id,
    aluno: v.aluno,
    disciplinaId: v.disciplina_id,
    disciplina: v.disciplina,
    aulasDadas: v.aulas_dadas,
    presencas: v.presencas,
    faltas,
    faltasAbonadas: v.faltas_abonadas,
    percentual,
    percentualComAbono: comAbono,
    abaixoDoMinimo: percentual !== null && percentual < PRESENCA_MINIMA,
    salvoPeloAbono:
      percentual !== null && percentual < PRESENCA_MINIMA &&
      comAbono !== null && comAbono >= PRESENCA_MINIMA,
  };
}

export interface RiscoNaEscola extends RiscoDeFrequencia {
  turmaId: string;
  turma: string;
  modulo: number;
}

/**
 * Quem corre risco de rodar por falta, em toda a escola.
 *
 * Calcula turma a turma porque o mesmo aluno pode cursar duas ao mesmo tempo —
 * e porque `riscoDeFrequencia` devolve linhas sem turma, que precisariam ser
 * reatribuídas por adivinhação depois.
 */
export function riscoDaEscola(
  frequencia: readonly FrequenciaDaEscola[],
  rotuloDaTurma: (turmaId: string) => string,
): RiscoNaEscola[] {
  const porTurma = new Map<string, FrequenciaDaEscola[]>();
  for (const f of frequencia) {
    const lista = porTurma.get(f.turma_id);
    if (lista) lista.push(f); else porTurma.set(f.turma_id, [f]);
  }

  const saida: RiscoNaEscola[] = [];

  for (const [turmaId, linhas] of porTurma) {
    // `riscoDeFrequencia` pensa em ENCONTROS previstos e multiplica por 2 lá
    // dentro; a view já entrega em aulas. Dividir aqui é o preço de ter uma
    // fórmula só — e é melhor que ter duas.
    const encontrosPrevistos: Record<string, number> = {};
    for (const l of linhas) {
      encontrosPrevistos[l.disciplina_id] = l.aulas_previstas / AULAS_POR_ENCONTRO;
    }

    const moduloPorAluno = new Map(linhas.map(l => [l.aluno_id, l.modulo]));

    for (const r of riscoDeFrequencia(linhas.map(comoLinhaDeFrequencia), encontrosPrevistos)) {
      saida.push({
        ...r,
        turmaId,
        turma: rotuloDaTurma(turmaId),
        modulo: moduloPorAluno.get(r.alunoId) ?? 0,
      });
    }
  }

  // Os casos perdidos primeiro; entre eles, quem tem menos margem.
  return saida.sort(
    (a, b) => Number(b.jaNaoAlcanca) - Number(a.jaNaoAlcanca)
      || a.faltasQueAindaCabem - b.faltasQueAindaCabem
      || a.aluno.localeCompare(b.aluno, "pt-BR"),
  );
}

/** Divide o risco nos dois grupos que pedem ações diferentes. */
export function separarRisco(riscos: readonly RiscoNaEscola[]) {
  return {
    // Nem vindo a todas as aulas restantes ele chega ao mínimo. Aqui só cabe
    // conversar, e quanto antes.
    semRecuperacao: riscos.filter(r => r.jaNaoAlcanca),
    // Ainda dá para evitar: um telefonema resolve.
    porUmFio: riscos.filter(r => !r.jaNaoAlcanca),
  };
}

// ── Andamento do semestre ────────────────────────────────────────────────────

export interface AndamentoDoSemestre {
  aulasDadas: number;
  aulasPrevistas: number;
  percentual: number;
}

/**
 * O quanto do semestre já aconteceu.
 *
 * É o único lugar do sistema que responde "estamos no meio ou no fim?" — e é
 * essa resposta que diz se a hora é de corrigir frequência ou de fechar notas.
 *
 * Conta cada par (turma, disciplina) uma vez: a view repete a mesma disciplina
 * em cada aluno matriculado, e somar tudo multiplicaria o semestre pelo número
 * de alunos.
 */
export function andamentoDoSemestre(
  frequencia: readonly FrequenciaDaEscola[],
): AndamentoDoSemestre {
  const vistos = new Set<string>();
  let dadas = 0;
  let previstas = 0;

  for (const f of frequencia) {
    const chave = `${f.turma_id}|${f.disciplina_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    dadas += f.aulas_dadas;
    previstas += f.aulas_previstas;
  }

  return {
    aulasDadas: dadas,
    aulasPrevistas: previstas,
    percentual: previstas === 0 ? 0 : Math.round((dadas * 100) / previstas),
  };
}

// ── Quanto o resumo tem para mostrar ─────────────────────────────────────────

/**
 * Bloco vazio não aparece na tela, e quando NADA aparece é preciso dizer isso
 * com todas as letras — senão a tela em branco lê como "não carregou".
 */
export function estaTudoEmOrdem(contagens: readonly number[]): boolean {
  return contagens.every(n => n === 0);
}
