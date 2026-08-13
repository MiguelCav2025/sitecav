// Extensão explícita: o runner de testes do Node exige, e o bundler do Next
// resolve igual. Sem ela, `npm test` não consegue carregar este módulo.
import { gerarDatasAulas, type PeriodoLetivo } from "./calendario-escolar.ts";

export interface AulaExistente {
  id: string;
  numero: number;
  data_aula: string | null;
  /** ATENÇÃO: true significa chamada FINALIZADA (nome legado, ver P6). */
  chamada_finalizada: boolean;
}

export interface PlanoRecalculo {
  /** Aulas abertas cuja data muda. */
  atualizar: { id: string; numero: number; de: string | null; para: string | null }[];
  /** Números que ainda não existem e passam a existir. */
  criar: { numero: number; data_aula: string | null }[];
  /** Aulas abertas que sobram além do novo total. */
  remover: { id: string; numero: number }[];
  /** Aulas com chamada fechada: nunca tocadas. */
  preservadas: { id: string; numero: number }[];
  /** O que o coordenador precisa saber antes de confirmar. */
  avisos: string[];
}

export interface ParametrosGrade {
  periodo: PeriodoLetivo;
  diaDaSemana: number;
  totalAulas: number;
}

const plural = (n: number, singular: string, plural_: string) =>
  `${n} ${n === 1 ? singular : plural_}`;

/**
 * Calcula o que muda na grade de uma disciplina quando o coordenador edita
 * feriados, dia da semana ou total de aulas.
 *
 * A regra inegociável é o D23: **aula com chamada fechada nunca é tocada**.
 * Ela é o registro do que de fato aconteceu — presença lançada e diário de
 * sala escrito — então mantém id, número e data, mesmo que a data deixe de
 * bater com o cronograma novo.
 *
 * As aulas ainda abertas recebem a data correspondente ao seu número na grade
 * recalculada. Nada é gravado aqui: esta função só descreve o plano, para a
 * tela poder mostrar um resumo antes de confirmar.
 */
export function planejarRecalculoDaGrade(
  aulas: AulaExistente[],
  { periodo, diaDaSemana, totalAulas }: ParametrosGrade,
): PlanoRecalculo {
  const plano: PlanoRecalculo = {
    atualizar: [],
    criar: [],
    remover: [],
    preservadas: [],
    avisos: [],
  };

  if (!Number.isInteger(totalAulas) || totalAulas < 1) {
    plano.avisos.push("O total de aulas precisa ser pelo menos 1.");
    return plano;
  }

  const datas = gerarDatasAulas(periodo, diaDaSemana, totalAulas);
  const porNumero = new Map(aulas.map(a => [a.numero, a]));

  // 1. Aulas dentro do novo total
  for (let numero = 1; numero <= totalAulas; numero++) {
    const existente = porNumero.get(numero);
    const novaData = datas[numero - 1] ?? null;

    if (!existente) {
      plano.criar.push({ numero, data_aula: novaData });
      continue;
    }
    if (existente.chamada_finalizada) {
      plano.preservadas.push({ id: existente.id, numero });
      continue;
    }
    if (existente.data_aula !== novaData) {
      plano.atualizar.push({ id: existente.id, numero, de: existente.data_aula, para: novaData });
    }
  }

  // 2. Aulas que sobram além do novo total
  for (const aula of aulas) {
    if (aula.numero <= totalAulas) continue;

    if (aula.chamada_finalizada) {
      plano.preservadas.push({ id: aula.id, numero: aula.numero });
      plano.avisos.push(
        `A aula ${aula.numero} passa do novo total, mas já teve a chamada fechada — ela é mantida.`,
      );
    } else {
      plano.remover.push({ id: aula.id, numero: aula.numero });
    }
  }

  // 3. Avisos sobre aulas que não cabem no semestre
  const semData = plano.criar.filter(c => c.data_aula === null).length
    + plano.atualizar.filter(a => a.para === null).length;
  if (semData > 0) {
    plano.avisos.push(
      `${plural(semData, "aula fica", "aulas ficam")} sem data: ` +
      `não ${semData === 1 ? "cabe" : "cabem"} no período do cronograma. ` +
      `Reduza o total de aulas ou estenda o semestre.`,
    );
  }

  return plano;
}

/** Frase única resumindo o plano, para o texto de confirmação. */
export function resumirPlano(plano: PlanoRecalculo): string {
  const partes: string[] = [];
  if (plano.atualizar.length) partes.push(`${plural(plano.atualizar.length, "aula muda", "aulas mudam")} de data`);
  if (plano.criar.length) partes.push(`${plural(plano.criar.length, "aula será criada", "aulas serão criadas")}`);
  if (plano.remover.length) partes.push(`${plural(plano.remover.length, "aula será removida", "aulas serão removidas")}`);
  if (plano.preservadas.length) partes.push(`${plural(plano.preservadas.length, "aula fechada fica", "aulas fechadas ficam")} intocada${plano.preservadas.length === 1 ? "" : "s"}`);

  if (partes.length === 0) return "Nada muda na grade.";
  return partes.join(", ") + ".";
}

/** Se não há nada a fazer, a tela não precisa pedir confirmação. */
export function planoVazio(plano: PlanoRecalculo): boolean {
  return plano.atualizar.length === 0 && plano.criar.length === 0 && plano.remover.length === 0;
}
