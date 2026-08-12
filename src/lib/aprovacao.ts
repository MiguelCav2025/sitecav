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

export interface AvaliacaoDoSemestre {
  situacao: Situacao;
  /** Percentual sobre todas as aulas dadas do semestre. Null se não houve aula. */
  presencaGeral: number | null;
  /** Nomes das disciplinas em que o aluno ficou abaixo da nota mínima. */
  reprovadasPorNota: string[];
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
 * `indefinido` não é um detalhe: significa que falta lançar alguma nota ou a
 * banca. Tratar isso como reprovação transformaria esquecimento administrativo
 * em retenção de aluno.
 */
export function avaliarSemestre(disciplinas: DesempenhoDisciplina[]): AvaliacaoDoSemestre {
  const reprovadasPorNota: string[] = [];
  const pendencias: string[] = [];
  const motivos: string[] = [];

  let totalAulas = 0;
  let totalPresencas = 0;
  let houveAula = false;

  for (const d of disciplinas) {
    if (d.nota_professor === null) {
      pendencias.push(`${d.disciplina}: o professor ainda não lançou a nota.`);
    } else if (d.nota_banca === null) {
      pendencias.push(`${d.disciplina}: a nota da banca ainda não foi lançada.`);
    } else if (d.nota_final === null) {
      pendencias.push(`${d.disciplina}: nota final indisponível.`);
    } else if (arredondar(d.nota_final) < NOTA_MINIMA) {
      reprovadasPorNota.push(d.disciplina);
    }

    if (d.aulas_dadas !== null && d.aulas_dadas > 0) {
      houveAula = true;
      totalAulas += d.aulas_dadas;
      totalPresencas += d.presencas ?? 0;
    }
  }

  const presencaGeral = houveAula
    ? arredondar((totalPresencas * 100) / totalAulas)
    : null;

  if (disciplinas.length === 0) {
    return {
      situacao: "indefinido",
      presencaGeral: null,
      reprovadasPorNota: [],
      pendencias: ["Nenhuma disciplina cursada neste semestre."],
      motivos: [],
    };
  }

  if (presencaGeral === null) {
    pendencias.push("Nenhuma chamada foi fechada ainda — não há como medir a frequência.");
  }

  if (reprovadasPorNota.length > 0) {
    motivos.push(
      `Abaixo de ${NOTA_MINIMA} em ${reprovadasPorNota.length} ` +
      `${plural(reprovadasPorNota.length, "disciplina", "disciplinas")}: ${reprovadasPorNota.join(", ")}.`,
    );
  }

  const presencaInsuficiente = presencaGeral !== null && presencaGeral < PRESENCA_MINIMA;
  if (presencaInsuficiente) {
    motivos.push(`Frequência de ${presencaGeral}%, abaixo do mínimo de ${PRESENCA_MINIMA}%.`);
  }

  // Reprovar não depende de estar tudo lançado: quem já ficou abaixo da nota
  // ou da frequência está retido, mesmo com outra disciplina pendente.
  if (reprovadasPorNota.length > 0 || presencaInsuficiente) {
    return { situacao: "retido", presencaGeral, reprovadasPorNota, pendencias, motivos };
  }

  if (pendencias.length > 0) {
    return { situacao: "indefinido", presencaGeral, reprovadasPorNota, pendencias, motivos };
  }

  motivos.push(
    `Nota mínima atingida em todas as ${disciplinas.length} ` +
    `${plural(disciplinas.length, "disciplina", "disciplinas")} e frequência de ${presencaGeral}%.`,
  );
  return { situacao: "aprovado", presencaGeral, reprovadasPorNota, pendencias, motivos };
}
