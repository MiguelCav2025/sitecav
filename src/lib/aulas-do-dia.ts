/**
 * O dia de uma disciplina são duas aulas.
 *
 * Do Guia de Funcionamento do CAV, aprovado para este semestre: 9h00–10h20 e
 * 10h35–12h00 pela manhã, 19h00–20h20 e 20h35–22h00 à noite, com 15 minutos de
 * intervalo. São ~18 dias por disciplina, ou 36 aulas — e a aprovação exige
 * 70% **das aulas**, não dos dias.
 *
 * Enquanto todo dia valer 2 aulas para todo mundo, 70% de 36 é idêntico a 70%
 * de 18. O que muda a conta é o aluno que assiste a primeira e vai embora no
 * intervalo: ele leva 1 de 2, e é por isso que a presença conta aulas.
 */

/** Quantas aulas cabem num dia de disciplina. */
export const AULAS_POR_ENCONTRO = 2;

export interface HorarioDaAula {
  inicio: string;
  fim: string;
}

/** Os horários fixos de cada turno, na ordem das aulas. */
export const HORARIOS: Readonly<Record<string, readonly HorarioDaAula[]>> = {
  "Manhã": [
    { inicio: "09:00", fim: "10:20" },
    { inicio: "10:35", fim: "12:00" },
  ],
  "Noite": [
    { inicio: "19:00", fim: "20:20" },
    { inicio: "20:35", fim: "22:00" },
  ],
};

/** "09:00–10:20 e 10:35–12:00". Vazio para turno desconhecido. */
export function rotuloDoTurno(turno: string): string {
  const h = HORARIOS[turno];
  if (!h) return "";
  return h.map(a => `${a.inicio}–${a.fim}`).join(" e ");
}

/** O horário da 1ª ou 2ª aula do dia. `null` se o turno não for conhecido. */
export function horarioDaAula(turno: string, numero: 1 | 2): HorarioDaAula | null {
  return HORARIOS[turno]?.[numero - 1] ?? null;
}

/** Quantas aulas foram dadas em N encontros com a chamada fechada. */
export const aulasDadas = (encontrosFechados: number) =>
  encontrosFechados * AULAS_POR_ENCONTRO;

export type PresencaNoDia = 0 | 1 | 2;

/**
 * O ciclo do toque na chamada: ausente → presente → só a 1ª aula → ausente.
 *
 * O caminho normal é um toque, que marca o dia inteiro — igual à lista de
 * papel, e é o que acontece com quase todo aluno. O "só a 1ª" fica um toque
 * adiante, para quem saiu no intervalo, em vez de exigir dois controles por
 * aluno numa tela de celular.
 */
export function proximaPresenca(atual: PresencaNoDia | undefined): PresencaNoDia {
  if (atual === undefined || atual === 0) return 2;
  if (atual === 2) return 1;
  return 0;
}

/** Como a marcação aparece para o professor. */
export function rotuloDaPresenca(valor: PresencaNoDia | undefined): string {
  if (valor === 2) return "Presente";
  if (valor === 1) return "Só a 1ª aula";
  return "Ausente";
}
