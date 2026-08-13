/**
 * Regra de aprovação do CAV.
 *
 * A aprovação existe em **dois níveis**:
 *
 *   1. Por disciplina — o aluno passa ou não naquela matéria, pela nota final
 *      (média com a banca) e pela frequência daquela matéria.
 *   2. Por módulo — só avança quem passou em **todas** as disciplinas.
 *      Ficar retido em uma única matéria retém o aluno no módulo (D35/N21).
 *
 * Fica aqui, e não no banco, para o critério poder mudar sem migração.
 */

export const NOTA_MINIMA = 6;
export const PRESENCA_MINIMA = 70;

/** Casas decimais usadas ao arredondar a nota final antes de comparar (D34). */
export const CASAS_DECIMAIS = 1;

/** Uma linha de `vw_desempenho_aluno`. */
export interface DesempenhoDisciplina {
  disciplina_id: string;
  disciplina: string;
  /** 1, 2 ou 3. O 1º módulo não tem banca. */
  modulo: number;
  nota_professor: number | null;
  nota_banca: number | null;
  nota_final: number | null;
  aulas_dadas: number | null;
  presencas: number | null;
}

/**
 * A banca só existe a partir do 2º módulo. No 1º, a nota final da disciplina
 * é a do professor — não há com o que fazer média.
 */
export function moduloTemBanca(modulo: number): boolean {
  return modulo >= 2;
}

export type Situacao = "aprovado" | "retido" | "indefinido";

export interface AvaliacaoDaDisciplina {
  disciplinaId: string;
  disciplina: string;
  /** Nota atribuída pelo professor desta disciplina. */
  notaProfessor: number | null;
  /** Nota da banca. É a mesma em todas as disciplinas do módulo. */
  notaBanca: number | null;
  /** Média com a banca, já arredondada. Null enquanto faltar nota ou banca. */
  notaFinal: number | null;
  /** Frequência nesta matéria. Null enquanto nenhuma chamada tiver sido fechada. */
  percentual: number | null;
  situacao: Situacao;
  /** Por que reprovou, ou o que falta para decidir. */
  motivos: string[];
}

export interface AvaliacaoDoModulo {
  situacao: Situacao;
  /** O resultado de cada matéria, na ordem recebida. */
  disciplinas: AvaliacaoDaDisciplina[];
  /** Frequência somada do módulo. Informativa — a regra é por disciplina (D38). */
  presencaGeral: number | null;
  /** Nomes das disciplinas em que ficou abaixo da nota. */
  reprovadasPorNota: string[];
  /** Disciplinas em que ficou abaixo da frequência, com o percentual. */
  reprovadasPorFrequencia: { disciplina: string; percentual: number }[];
  /** O que impede fechar o módulo agora. */
  pendencias: string[];
  /** Explicação pronta para a tela. */
  motivos: string[];
}

export function arredondar(valor: number, casas = CASAS_DECIMAIS): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * Resultado do aluno numa disciplina.
 *
 * `indefinido` quando falta lançar algo. Tratar ausência como reprovação
 * transformaria esquecimento administrativo em retenção de aluno.
 */
export function avaliarDisciplina(d: DesempenhoDisciplina): AvaliacaoDaDisciplina {
  const motivos: string[] = [];
  let reprovado = false;
  let indefinido = false;

  // ── Nota ──────────────────────────────────────────────────────────────────
  const notaFinal = d.nota_final === null ? null : arredondar(d.nota_final);

  if (d.nota_professor === null) {
    motivos.push("O professor ainda não lançou a nota.");
    indefinido = true;
  } else if (moduloTemBanca(d.modulo) && d.nota_banca === null) {
    // No 1º módulo não há banca, então a ausência dela não é pendência —
    // tratá-la como tal travaria a decisão de toda a turma de entrada.
    motivos.push("A nota da banca ainda não foi lançada.");
    indefinido = true;
  } else if (notaFinal === null) {
    motivos.push("Nota final indisponível.");
    indefinido = true;
  } else if (notaFinal < NOTA_MINIMA) {
    motivos.push(`Nota ${notaFinal}, abaixo de ${NOTA_MINIMA}.`);
    reprovado = true;
  }

  // ── Frequência ────────────────────────────────────────────────────────────
  let percentual: number | null = null;

  if (d.aulas_dadas === null || d.aulas_dadas === 0) {
    motivos.push("Nenhuma chamada fechada — não há como medir a frequência.");
    indefinido = true;
  } else {
    percentual = arredondar(((d.presencas ?? 0) * 100) / d.aulas_dadas);
    if (percentual < PRESENCA_MINIMA) {
      motivos.push(`Frequência de ${percentual}%, abaixo de ${PRESENCA_MINIMA}%.`);
      reprovado = true;
    }
  }

  // Reprovado tem precedência sobre indefinido: se já ficou abaixo da nota ou
  // da frequência, nenhum lançamento futuro reverte isso.
  const situacao: Situacao = reprovado ? "retido" : indefinido ? "indefinido" : "aprovado";

  if (situacao === "aprovado") {
    motivos.push(`Nota ${notaFinal} e frequência de ${percentual}%.`);
  }

  return {
    disciplinaId: d.disciplina_id,
    disciplina: d.disciplina,
    notaProfessor: d.nota_professor,
    notaBanca: d.nota_banca,
    notaFinal,
    percentual,
    situacao,
    motivos,
  };
}

/**
 * Situação do aluno no módulo, a partir do resultado de cada disciplina.
 *
 * Só avança quem foi aprovado em **todas**. Basta uma retida para reter o
 * aluno, mesmo que outras ainda estejam pendentes — não há o que esperar.
 */
export function avaliarModulo(disciplinas: DesempenhoDisciplina[]): AvaliacaoDoModulo {
  if (disciplinas.length === 0) {
    return {
      situacao: "indefinido",
      disciplinas: [],
      presencaGeral: null,
      reprovadasPorNota: [],
      reprovadasPorFrequencia: [],
      pendencias: ["Nenhuma disciplina cursada neste módulo."],
      motivos: [],
    };
  }

  const avaliadas = disciplinas.map(avaliarDisciplina);

  const totalAulas = disciplinas.reduce((s, d) => s + (d.aulas_dadas ?? 0), 0);
  const totalPresencas = disciplinas.reduce(
    (s, d) => s + (d.aulas_dadas ? d.presencas ?? 0 : 0), 0,
  );
  const presencaGeral = totalAulas > 0 ? arredondar((totalPresencas * 100) / totalAulas) : null;

  const reprovadasPorNota = avaliadas
    .filter(a => a.notaFinal !== null && a.notaFinal < NOTA_MINIMA)
    .map(a => a.disciplina);

  const reprovadasPorFrequencia = avaliadas
    .filter(a => a.percentual !== null && a.percentual < PRESENCA_MINIMA)
    .map(a => ({ disciplina: a.disciplina, percentual: a.percentual as number }));

  const pendencias = avaliadas
    .filter(a => a.situacao === "indefinido")
    .flatMap(a => a.motivos.map(m => `${a.disciplina}: ${m}`));

  const motivos: string[] = [];
  if (reprovadasPorNota.length > 0) {
    motivos.push(
      `Abaixo de ${NOTA_MINIMA} em ${reprovadasPorNota.length} ` +
      `${plural(reprovadasPorNota.length, "disciplina", "disciplinas")}: ${reprovadasPorNota.join(", ")}.`,
    );
  }
  if (reprovadasPorFrequencia.length > 0) {
    const detalhe = reprovadasPorFrequencia.map(f => `${f.disciplina} (${f.percentual}%)`).join(", ");
    motivos.push(`Frequência abaixo de ${PRESENCA_MINIMA}% em ${detalhe}.`);
  }

  const temRetida = avaliadas.some(a => a.situacao === "retido");
  const temIndefinida = avaliadas.some(a => a.situacao === "indefinido");

  const situacao: Situacao = temRetida ? "retido" : temIndefinida ? "indefinido" : "aprovado";

  if (situacao === "aprovado") {
    motivos.push(
      `Aprovado nas ${avaliadas.length} ` +
      `${plural(avaliadas.length, "disciplina", "disciplinas")} do módulo.`,
    );
  }

  return {
    situacao,
    disciplinas: avaliadas,
    presencaGeral,
    reprovadasPorNota,
    reprovadasPorFrequencia,
    pendencias,
    motivos,
  };
}
