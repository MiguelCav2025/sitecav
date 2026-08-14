import { feriadosNoPeriodo } from "./feriados.ts";

/**
 * Semestres letivos já montados, para o coordenador só conferir.
 *
 * Cadastrar semestre a semestre, digitando data de início, fim e cada feriado,
 * é trabalho repetitivo que se faz uma vez a cada seis meses — tempo suficiente
 * para esquecer como era e errar um dia. E errar um dia aqui desloca a contagem
 * de aulas de todas as disciplinas daquele dia da semana.
 *
 * As datas aqui são **sugestão**, não regra: o CAV decide quando começa. O que
 * o sistema faz bem é lembrar dos feriados e da forma do ano letivo.
 */

export interface SemestreSugerido {
  semestre: string;
  data_inicio: string;
  data_fim: string;
  feriados: string[];
  /** Quantos dos feriados vieram do calendário oficial. */
  feriadosConhecidos: number;
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Dia da semana em UTC, sem o fuso empurrar a data. */
function diaDaSemana(dataIso: string): number {
  const [a, m, d] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** A primeira segunda-feira do mês. É por ela que o semestre costuma começar. */
export function primeiraSegunda(ano: number, mes: number): string {
  for (let dia = 1; dia <= 7; dia++) {
    const d = iso(ano, mes, dia);
    if (diaDaSemana(d) === 1) return d;
  }
  return iso(ano, mes, 1);
}

/** A última sexta-feira do mês — o fim natural de um semestre. */
export function ultimaSexta(ano: number, mes: number): string {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let dia = ultimoDia; dia >= ultimoDia - 6; dia--) {
    const d = iso(ano, mes, dia);
    if (diaDaSemana(d) === 5) return d;
  }
  return iso(ano, mes, ultimoDia);
}

/**
 * A forma do ano letivo do CAV, apurada dos dois semestres reais:
 * 2026/1 correu de março a junho; 2026/2, de agosto a dezembro.
 *
 * O 2º semestre termina na segunda quinzena de dezembro, não no fim do mês —
 * a última sexta cairia depois do Natal.
 */
function janela(ano: number, metade: 1 | 2): { inicio: string; fim: string } {
  if (metade === 1) {
    return { inicio: primeiraSegunda(ano, 3), fim: ultimaSexta(ano, 6) };
  }
  // A SEGUNDA segunda-feira de dezembro — foi onde o 2026/2 real terminou
  // (14/12). Cai no máximo em 14, então nunca esbarra no Natal.
  const [a, m, d] = primeiraSegunda(ano, 12).split("-").map(Number);
  const fim = new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10);
  return { inicio: primeiraSegunda(ano, 8), fim };
}

/**
 * Os próximos semestres, com feriados já preenchidos.
 *
 * `jaExistentes` evita propor o que já está cadastrado — rodar isto duas vezes
 * não deve duplicar nada nem sobrescrever datas que o coordenador ajustou.
 */
export function semestresSugeridos(
  hoje: string,
  quantos: number,
  jaExistentes: readonly string[] = [],
): SemestreSugerido[] {
  const existentes = new Set(jaExistentes);
  const anoAtual = Number(hoje.slice(0, 4));
  const mesAtual = Number(hoje.slice(5, 7));

  // Começa pelo semestre em curso: se estamos em agosto, o próximo a propor é
  // o 2º deste ano, e não o 1º do ano que vem.
  let ano = anoAtual;
  let metade: 1 | 2 = mesAtual <= 6 ? 1 : 2;

  const saida: SemestreSugerido[] = [];
  // O limite de voltas evita laço infinito se tudo já existir.
  for (let i = 0; i < quantos * 3 && saida.length < quantos; i++) {
    const nome = `${ano}/${metade}`;

    if (!existentes.has(nome)) {
      const { inicio, fim } = janela(ano, metade);
      const doPeriodo = feriadosNoPeriodo(inicio, fim);
      saida.push({
        semestre: nome,
        data_inicio: inicio,
        data_fim: fim,
        feriados: doPeriodo.map(f => f.data),
        feriadosConhecidos: doPeriodo.length,
      });
    }

    if (metade === 1) metade = 2;
    else { metade = 1; ano++; }
  }

  return saida;
}
