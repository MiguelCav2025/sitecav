/**
 * Choques na grade: mesma sala, ou mesmo professor, no mesmo dia.
 *
 * O sistema deixava montar a grade livremente e nunca conferia. Hoje não há
 * nenhum choque no banco — mas isso é sorte de quem montou, não garantia do
 * sistema. E um choque de sala só aparece no dia da aula, com duas turmas na
 * porta da mesma sala.
 *
 * Sem horário cadastrado (só temos turno), o critério possível é o dia da
 * semana. Duas disciplinas do mesmo turno no mesmo dia e na mesma sala é
 * choque certo; de turnos diferentes, não. Por isso o turno entra na chave.
 */

export interface DisciplinaNaGrade {
  id: string;
  nome: string;
  curso: string;
  modulo: number;
  dia_da_semana: number | null;
  sala_id: string | null;
  /** Nome da sala, só para a mensagem. */
  sala?: string | null;
  /** Turnos em que esta disciplina acontece — vem das turmas que a cursam. */
  turnos: readonly string[];
}

export interface Conflito {
  tipo: "sala" | "professor";
  /** O que colide: nome da sala ou do professor. */
  recurso: string;
  diaDaSemana: number;
  turno: string;
  /** As disciplinas que disputam o mesmo espaço, em ordem de nome. */
  disciplinas: { id: string; nome: string; curso: string; modulo: number }[];
}

const DIAS = ["", "segunda", "terça", "quarta", "quinta", "sexta"];

export const nomeDoDia = (n: number) => DIAS[n] ?? `dia ${n}`;

/**
 * Duas disciplinas na mesma sala, no mesmo dia e turno.
 *
 * Disciplina sem sala ou sem dia não entra: não há como colidir com o que não
 * tem lugar nem hora marcada.
 */
export function conflitosDeSala(disciplinas: readonly DisciplinaNaGrade[]): Conflito[] {
  const porChave = new Map<string, { sala: string; dia: number; turno: string; discs: DisciplinaNaGrade[] }>();

  for (const d of disciplinas) {
    if (!d.sala_id || d.dia_da_semana === null) continue;
    for (const turno of d.turnos) {
      const chave = `${d.sala_id}|${d.dia_da_semana}|${turno}`;
      if (!porChave.has(chave)) {
        porChave.set(chave, {
          sala: d.sala ?? "Sala sem nome",
          dia: d.dia_da_semana,
          turno,
          discs: [],
        });
      }
      porChave.get(chave)!.discs.push(d);
    }
  }

  const saida: Conflito[] = [];
  for (const { sala, dia, turno, discs } of porChave.values()) {
    if (discs.length < 2) continue;
    saida.push({
      tipo: "sala",
      recurso: sala,
      diaDaSemana: dia,
      turno,
      disciplinas: discs
        .map(d => ({ id: d.id, nome: d.nome, curso: d.curso, modulo: d.modulo }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  }

  return saida.sort((a, b) => a.diaDaSemana - b.diaDaSemana || a.recurso.localeCompare(b.recurso, "pt-BR"));
}

/** Uma frase que diz o problema inteiro, para a tela não ter que montá-la. */
export function descreverConflito(c: Conflito): string {
  const quais = c.disciplinas.map(d => `${d.nome} (${d.curso}, módulo ${d.modulo})`).join(" e ");
  return `${c.recurso}, ${nomeDoDia(c.diaDaSemana)} de ${c.turno.toLowerCase()}: ${quais}.`;
}
