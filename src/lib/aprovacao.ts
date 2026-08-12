/**
 * Regra de aprovação do CAV.
 *
 * A decisão é do **semestre inteiro**, não de cada disciplina: basta ficar
 * abaixo da nota em uma única matéria para o aluno ser retido no semestre
 * (D24/N21). Por isso a função recebe todas as disciplinas de uma vez.
 *
 * Fica aqui, e não no banco, para o critério poder mudar sem migração.
 */

export const NOTA_MINIMA = 6;
export const PRESENCA_MINIMA = 70;

/** Casas decimais usadas ao arredondar a nota final antes de comparar (N18). */
export const CASAS_DECIMAIS = 1;

/** Uma linha de `vw_desempenho_aluno`. */
export interface DesempenhoDisciplina {
  disciplina_id: string;
  disciplina: string;
  nota_professor: number | null;
  nota_banca: number | null;
  nota_final: number | null;
  aulas_dadas: number | null;
  presencas: number | null;
}

export type Situacao = "aprovado" | "retido" | "indefinido";

export interface FrequenciaDaDisciplina {
  disciplina: string;
  percentual: number;
}

export interface AvaliacaoDoSemestre {
  situacao: Situacao;
  /** Percentual somado do semestre. Informativo — a regra é por disciplina. */
  presencaGeral: number | null;
  /** Disciplinas em que o aluno ficou abaixo da nota mínima. */
  reprovadasPorNota: string[];
  /** Disciplinas em que ficou abaixo da frequência mínima. */
  reprovadasPorFrequencia: FrequenciaDaDisciplina[];
  /** O que impede decidir agora — nota ou banca ainda não lançada. */
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
 * Decide a situação do aluno no semestre.
 *
 * A frequência mínima é exigida **em cada disciplina**, não na média do
 * semestre (N22): faltar demais numa única matéria retém o aluno, ainda que a
 * presença somada passe de 70%.
 *
 * `indefinido` não é um detalhe: significa que falta lançar alguma nota ou a
 * banca. Tratar isso como reprovação transformaria esquecimento administrativo
 * em retenção de aluno.
 */
export function avaliarSemestre(disciplinas: DesempenhoDisciplina[]): AvaliacaoDoSemestre {
  const reprovadasPorNota: string[] = [];
  const reprovadasPorFrequencia: FrequenciaDaDisciplina[] = [];
  const pendencias: string[] = [];
  const motivos: string[] = [];

  if (disciplinas.length === 0) {
    return {
      situacao: "indefinido",
      presencaGeral: null,
      reprovadasPorNota: [],
      reprovadasPorFrequencia: [],
      pendencias: ["Nenhuma disciplina cursada neste semestre."],
      motivos: [],
    };
  }

  let totalAulas = 0;
  let totalPresencas = 0;

  for (const d of disciplinas) {
    // ── Nota ────────────────────────────────────────────────────────────────
    if (d.nota_professor === null) {
      pendencias.push(`${d.disciplina}: o professor ainda não lançou a nota.`);
    } else if (d.nota_banca === null) {
      pendencias.push(`${d.disciplina}: a nota da banca ainda não foi lançada.`);
    } else if (d.nota_final === null) {
      pendencias.push(`${d.disciplina}: nota final indisponível.`);
    } else if (arredondar(d.nota_final) < NOTA_MINIMA) {
      reprovadasPorNota.push(d.disciplina);
    }

    // ── Frequência, exigida disciplina a disciplina ─────────────────────────
    if (d.aulas_dadas === null || d.aulas_dadas === 0) {
      pendencias.push(`${d.disciplina}: nenhuma chamada fechada — não há como medir a frequência.`);
      continue;
    }

    totalAulas += d.aulas_dadas;
    totalPresencas += d.presencas ?? 0;

    const percentual = arredondar(((d.presencas ?? 0) * 100) / d.aulas_dadas);
    if (percentual < PRESENCA_MINIMA) {
      reprovadasPorFrequencia.push({ disciplina: d.disciplina, percentual });
    }
  }

  const presencaGeral = totalAulas > 0 ? arredondar((totalPresencas * 100) / totalAulas) : null;

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

  // Reprovar não depende de estar tudo lançado: quem já ficou abaixo da nota
  // ou da frequência está retido, mesmo com outra disciplina pendente.
  if (reprovadasPorNota.length > 0 || reprovadasPorFrequencia.length > 0) {
    return { situacao: "retido", presencaGeral, reprovadasPorNota, reprovadasPorFrequencia, pendencias, motivos };
  }

  if (pendencias.length > 0) {
    return { situacao: "indefinido", presencaGeral, reprovadasPorNota, reprovadasPorFrequencia, pendencias, motivos };
  }

  motivos.push(
    `Nota e frequência mínimas atingidas nas ${disciplinas.length} ` +
    `${plural(disciplinas.length, "disciplina", "disciplinas")} do semestre.`,
  );
  return { situacao: "aprovado", presencaGeral, reprovadasPorNota, reprovadasPorFrequencia, pendencias, motivos };
}
