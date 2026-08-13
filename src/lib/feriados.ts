/**
 * Feriados do calendário letivo.
 *
 * Antes o coordenador digitava cada feriado à mão, data por data, semestre a
 * semestre. Errar um dia aqui desloca a contagem de aulas da disciplina
 * inteira — e o erro só aparece meses depois, quando a frequência de alguém
 * não fecha.
 *
 * Aqui só se calcula. Quais feriados de fato valem para o CAV é decisão da
 * coordenação: a tela sugere, ela confirma.
 */

export type TipoDeFeriado =
  /** Feriado nacional — não tem aula em lugar nenhum do país. */
  | "nacional"
  /** Feriado de São Bernardo do Campo. */
  | "municipal"
  /** Ponto facultativo: costuma não ter aula, mas quem decide é a prefeitura. */
  | "facultativo";

export interface Feriado {
  /** ISO, `AAAA-MM-DD`. */
  data: string;
  nome: string;
  tipo: TipoDeFeriado;
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Soma dias a uma data ISO sem passar por fuso horário. */
function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Domingo de Páscoa, pelo algoritmo gregoriano anônimo (Meeus/Butcher).
 *
 * Dele saem Carnaval, Sexta-feira Santa e Corpus Christi, que mudam de data
 * todo ano — justamente os que mais escapam de quem preenche à mão.
 */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

/** Feriados de data fixa. */
const FIXOS: ReadonlyArray<{ mes: number; dia: number; nome: string; tipo: TipoDeFeriado }> = [
  { mes: 1,  dia: 1,  nome: "Confraternização Universal",   tipo: "nacional" },
  { mes: 4,  dia: 21, nome: "Tiradentes",                   tipo: "nacional" },
  { mes: 5,  dia: 1,  nome: "Dia do Trabalho",              tipo: "nacional" },
  { mes: 8,  dia: 20, nome: "Aniversário de São Bernardo do Campo", tipo: "municipal" },
  { mes: 9,  dia: 7,  nome: "Independência",                tipo: "nacional" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida",      tipo: "nacional" },
  { mes: 10, dia: 28, nome: "Dia do Servidor Público",      tipo: "facultativo" },
  { mes: 11, dia: 2,  nome: "Finados",                      tipo: "nacional" },
  { mes: 11, dia: 15, nome: "Proclamação da República",     tipo: "nacional" },
  // Nacional desde a Lei 14.759/2023.
  { mes: 11, dia: 20, nome: "Consciência Negra",            tipo: "nacional" },
  { mes: 12, dia: 25, nome: "Natal",                        tipo: "nacional" },
];

/** Feriados que se contam a partir da Páscoa. */
const MOVEIS: ReadonlyArray<{ desloca: number; nome: string; tipo: TipoDeFeriado }> = [
  { desloca: -48, nome: "Carnaval (segunda)",     tipo: "facultativo" },
  { desloca: -47, nome: "Carnaval",               tipo: "facultativo" },
  { desloca: -46, nome: "Quarta-feira de Cinzas", tipo: "facultativo" },
  { desloca: -2,  nome: "Sexta-feira Santa",      tipo: "nacional" },
  { desloca: 60,  nome: "Corpus Christi",         tipo: "facultativo" },
];

/** Todos os feriados de um ano, em ordem de data. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano);

  const lista: Feriado[] = [
    ...FIXOS.map(f => ({ data: iso(ano, f.mes, f.dia), nome: f.nome, tipo: f.tipo })),
    ...MOVEIS.map(f => ({ data: somarDias(pascoa, f.desloca), nome: f.nome, tipo: f.tipo })),
  ];

  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Dia da semana em UTC: 0 domingo … 6 sábado. */
function diaDaSemana(dataIso: string): number {
  const [a, m, d] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Feriados que caem dentro do período letivo **e em dia de aula**.
 *
 * Feriado no fim de semana não interessa: não tira aula de ninguém. Listá-lo
 * só encheria a tela e faria o coordenador marcar dia à toa — o que, aí sim,
 * bagunçaria a contagem.
 */
export function feriadosNoPeriodo(inicio: string, fim: string): Feriado[] {
  if (!inicio || !fim || inicio > fim) return [];

  const anoInicial = Number(inicio.slice(0, 4));
  const anoFinal = Number(fim.slice(0, 4));

  const todos: Feriado[] = [];
  for (let ano = anoInicial; ano <= anoFinal; ano++) todos.push(...feriadosDoAno(ano));

  return todos
    .filter(f => f.data >= inicio && f.data <= fim)
    .filter(f => {
      const dia = diaDaSemana(f.data);
      return dia >= 1 && dia <= 5;
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Separa o que a tela precisa mostrar: o que já está marcado, o que é sugestão
 * nova, e o que o coordenador marcou à mão (emenda, recesso, evento da escola)
 * e portanto nenhuma lista automática conhece.
 */
export function conciliarFeriados(
  marcados: readonly string[],
  inicio: string,
  fim: string
): {
  jaMarcados: Feriado[];
  sugestoes: Feriado[];
  personalizados: string[];
} {
  const doPeriodo = feriadosNoPeriodo(inicio, fim);
  const conhecidos = new Set(doPeriodo.map(f => f.data));
  const marcadosSet = new Set(marcados);

  return {
    jaMarcados: doPeriodo.filter(f => marcadosSet.has(f.data)),
    sugestoes: doPeriodo.filter(f => !marcadosSet.has(f.data)),
    personalizados: [...marcadosSet].filter(d => !conhecidos.has(d)).sort(),
  };
}
