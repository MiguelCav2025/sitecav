/**
 * Regras de calendário do CAV.
 *
 * Estavam duplicadas dentro de dois componentes React (a tela de Disciplinas e
 * o app do professor), o que as tornava intestáveis e sujeitas a divergir. Aqui
 * elas ficam puras e com a data "hoje" injetável, para poderem ser verificadas.
 *
 * Há três conceitos distintos de semestre neste sistema:
 *
 *   turmas.semestre               entrada da turma (a coorte). Ex.: "2025/1"
 *   disciplinas.semestre_do_curso qual dos 3 semestres do curso. Ex.: 2
 *   cronogramas.semestre          semestre letivo do calendário. Ex.: "2026/1"
 */

/** Quantidade de semestres que um curso do CAV tem. */
export const SEMESTRES_DO_CURSO = 3;

/** Segunda a sexta, no padrão de `Date.getDay()`. */
export const DIAS_LETIVOS = [1, 2, 3, 4, 5] as const;

export interface PeriodoLetivo {
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  feriados: string[];  // YYYY-MM-DD
}

/**
 * Converte "2025/1" em números. Retorna null se o formato não bater.
 */
export function lerSemestre(valor: string): { ano: number; semestre: number } | null {
  const partes = String(valor ?? "").split("/");
  if (partes.length !== 2) return null;
  const ano = Number(partes[0]);
  const semestre = Number(partes[1]);
  if (!Number.isInteger(ano) || ano < 1) return null;
  if (semestre !== 1 && semestre !== 2) return null;
  return { ano, semestre };
}

/** Conta semestres desde o ano zero, para permitir aritmética simples. */
function emSemestres(ano: number, semestre: number): number {
  return ano * 2 + (semestre - 1);
}

function deSemestres(total: number): string {
  return `${Math.floor(total / 2)}/${(total % 2) + 1}`;
}

/**
 * Em qual semestre do curso uma turma está numa data qualquer.
 *
 * Retorna 1, 2 ou 3 enquanto o curso corre; acima de 3 significa concluído;
 * zero ou negativo significa que a turma ainda não começou. Retorna `null`
 * quando a entrada é inválida — distinguir os dois casos importa, porque
 * "ainda não começou" é uma resposta legítima e "não sei" não é.
 *
 * ATENÇÃO: a virada de semestre está fixada em 1º de julho. O calendário letivo
 * real vive em `cronogramas`, então os dois podem discordar em julho.
 * Ver P11 no plano de ajustes.
 */
export function semestreDoCurso(entrada: string, hoje: Date = new Date()): number | null {
  const inicio = lerSemestre(entrada);
  if (!inicio) return null;
  const semestreAtual = hoje.getMonth() < 6 ? 1 : 2;
  return emSemestres(hoje.getFullYear(), semestreAtual) - emSemestres(inicio.ano, inicio.semestre) + 1;
}

/**
 * Rótulo curto: "2º semestre".
 * @param sufixo texto acrescentado ao número, ex.: " do curso"
 */
export function rotuloSemestreDoCurso(n: number | null, sufixo = ""): string {
  if (n === null) return "";
  if (n <= 0) return "Ainda não iniciou";
  if (n > SEMESTRES_DO_CURSO) return sufixo ? "Curso concluído" : "Concluído";
  return `${n}º semestre${sufixo}`;
}

/**
 * Em que semestre letivo uma turma cursa uma disciplina.
 *
 * Turma que entrou em 2025/2, disciplina do 2º semestre do curso → 2026/1.
 * Devolve "" se a entrada for inválida.
 */
export function semestreLetivo(entrada: string, semestreDoCursoAlvo: number): string {
  const inicio = lerSemestre(entrada);
  if (!inicio) return "";
  if (!Number.isInteger(semestreDoCursoAlvo) || semestreDoCursoAlvo < 1) return "";
  return deSemestres(emSemestres(inicio.ano, inicio.semestre) + (semestreDoCursoAlvo - 1));
}

/**
 * Percorre um período dia a dia. Usa meio-dia para que fuso horário nunca
 * empurre a data para o dia anterior ou seguinte.
 */
function* diasDoPeriodo(inicio: string, fim: string): Generator<{ iso: string; diaDaSemana: number }> {
  const d = new Date(`${inicio}T12:00:00`);
  const fimData = new Date(`${fim}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(fimData.getTime())) return;

  while (d <= fimData) {
    yield { iso: d.toISOString().split("T")[0], diaDaSemana: d.getDay() };
    d.setDate(d.getDate() + 1);
  }
}

/**
 * Quantas vezes cada dia útil ocorre no período, descontando feriados.
 * Serve para o coordenador saber quantas aulas cabem numa disciplina.
 */
export function contarDiasLetivos(periodo: PeriodoLetivo): Record<number, number> {
  const total: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const feriados = new Set(periodo.feriados ?? []);

  for (const dia of diasDoPeriodo(periodo.data_inicio, periodo.data_fim)) {
    if (dia.diaDaSemana >= 1 && dia.diaDaSemana <= 5 && !feriados.has(dia.iso)) {
      total[dia.diaDaSemana] += 1;
    }
  }
  return total;
}

/**
 * Datas das aulas de uma disciplina.
 *
 * A aula tem dia fixo na semana. Se cai feriado, aquela aula NÃO acontece — a
 * grade não desliza, a disciplina simplesmente tem menos aulas. Quando o
 * período acaba antes de completar `totalAulas`, as aulas restantes ficam com
 * data `null`, sinalizando que não cabem no semestre.
 */
export function gerarDatasAulas(
  periodo: PeriodoLetivo,
  diaDaSemana: number,
  totalAulas: number,
): (string | null)[] {
  const datas: (string | null)[] = [];
  if (!Number.isInteger(totalAulas) || totalAulas < 1) return datas;

  const feriados = new Set(periodo.feriados ?? []);
  for (const dia of diasDoPeriodo(periodo.data_inicio, periodo.data_fim)) {
    if (datas.length >= totalAulas) break;
    if (dia.diaDaSemana === diaDaSemana && !feriados.has(dia.iso)) {
      datas.push(dia.iso);
    }
  }

  while (datas.length < totalAulas) datas.push(null);
  return datas;
}
