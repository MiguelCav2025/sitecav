import { PRESENCA_MINIMA, arredondar } from "./aprovacao.ts";
import { AULAS_POR_ENCONTRO } from "./aulas-do-dia.ts";

/**
 * Relatórios de presença e diário de sala.
 *
 * Dois cuidados que a versão anterior não tinha:
 *
 *   1. A frequência é **por disciplina**, não a média da turma (D38). Um aluno
 *      pode ter 80% somando tudo e 50% numa única matéria — e é retido. A
 *      média escondia exatamente o caso que importa.
 *   2. O corte é `PRESENCA_MINIMA`, a mesma constante que decide a aprovação.
 *      O relatório pintava de vermelho abaixo de 75% enquanto a regra reprovava
 *      abaixo de 70%: quem estivesse em 72% aparecia em risco e passava.
 *
 * A contagem segue a mesma semântica de `vw_desempenho_aluno`: aula dada é aula
 * com chamada fechada, e ausência de registro conta como falta. Divergir dela
 * daria dois números diferentes para a mesma pergunta.
 */

export interface AulaFechada {
  id: string;
  disciplina_id: string;
  disciplina: string;
  numero: number;
  data_aula: string | null;
  conteudo_ministrado: string | null;
  professor: string | null;
}

export interface RegistroPresenca {
  aula_id: string;
  aluno_id: string;
  presente: boolean;
  /** Quantas das 2 aulas do dia ele assistiu (D54). Ausente = deriva de `presente`. */
  aulas_presentes?: number | null;
}

/**
 * Quantas aulas o aluno assistiu naquele dia.
 *
 * Registro anterior à Fase 19 não tem a contagem: ali `presente` valia o dia
 * inteiro, e é essa a leitura fiel do que foi marcado na época.
 */
export function aulasAssistidas(p: RegistroPresenca): number {
  if (p.aulas_presentes === null || p.aulas_presentes === undefined) {
    return p.presente ? AULAS_POR_ENCONTRO : 0;
  }
  return p.aulas_presentes;
}

export interface AlunoSimples {
  id: string;
  nome: string;
}

/** Falta perdoada pela coordenação. Não altera a presença — anda ao lado dela. */
export interface Abono {
  aula_id: string;
  aluno_id: string;
}

export interface LinhaFrequencia {
  alunoId: string;
  aluno: string;
  disciplinaId: string;
  disciplina: string;
  aulasDadas: number;
  presencas: number;
  faltas: number;
  /** Quantas dessas faltas foram abonadas pela coordenação. */
  faltasAbonadas: number;
  /** Null quando nenhuma chamada foi fechada — não é zero, é "não se sabe". */
  percentual: number | null;
  /** O mesmo cálculo contando as faltas abonadas como presença. */
  percentualComAbono: number | null;
  abaixoDoMinimo: boolean;
  /** Passaria dos 70% se o abono valesse. É o caso que exige olho humano. */
  salvoPeloAbono: boolean;
}

/**
 * Frequência de cada aluno em cada disciplina que já teve chamada fechada.
 *
 * Disciplina sem nenhuma chamada fechada não vira linha: mostrá-la com 0%
 * acusaria de faltoso um aluno cuja aula ainda não aconteceu.
 */
export function frequenciaPorDisciplina(
  alunos: readonly AlunoSimples[],
  aulas: readonly AulaFechada[],
  presencas: readonly RegistroPresenca[],
  abonos: readonly Abono[] = [],
): LinhaFrequencia[] {
  const porDisciplina = new Map<string, { nome: string; aulaIds: Set<string> }>();
  for (const a of aulas) {
    if (!porDisciplina.has(a.disciplina_id)) {
      porDisciplina.set(a.disciplina_id, { nome: a.disciplina, aulaIds: new Set() });
    }
    porDisciplina.get(a.disciplina_id)!.aulaIds.add(a.id);
  }

  // Quantas AULAS o aluno assistiu em cada dia — 0, 1 ou 2. Contar dias
  // esconderia quem assiste a primeira e vai embora no intervalo.
  const assistidasPorAluno = new Map<string, Map<string, number>>();
  for (const p of presencas) {
    const n = aulasAssistidas(p);
    if (n === 0) continue;
    if (!assistidasPorAluno.has(p.aluno_id)) assistidasPorAluno.set(p.aluno_id, new Map());
    assistidasPorAluno.get(p.aluno_id)!.set(p.aula_id, n);
  }

  const abonadasPorAluno = new Map<string, Set<string>>();
  for (const a of abonos) {
    if (!abonadasPorAluno.has(a.aluno_id)) abonadasPorAluno.set(a.aluno_id, new Set());
    abonadasPorAluno.get(a.aluno_id)!.add(a.aula_id);
  }

  const linhas: LinhaFrequencia[] = [];
  for (const aluno of alunos) {
    const assistidas = assistidasPorAluno.get(aluno.id) ?? new Map<string, number>();
    const abonadas = abonadasPorAluno.get(aluno.id) ?? new Set<string>();

    for (const [disciplinaId, d] of porDisciplina) {
      // Tudo em AULAS: cada encontro fechado vale duas (D54).
      const aulasDadas = d.aulaIds.size * AULAS_POR_ENCONTRO;
      if (aulasDadas === 0) continue;

      let comparecimentos = 0;
      let abonos = 0;
      for (const aulaId of d.aulaIds) {
        const n = assistidas.get(aulaId) ?? 0;
        comparecimentos += n;
        // O abono cobre só o que faltou daquele dia: abonar aula assistida
        // somaria a mesma duas vezes e passaria dos 100%.
        if (abonadas.has(aulaId)) abonos += AULAS_POR_ENCONTRO - n;
      }

      const percentual = arredondar((comparecimentos * 100) / aulasDadas);
      const percentualComAbono = arredondar(((comparecimentos + abonos) * 100) / aulasDadas);

      linhas.push({
        alunoId: aluno.id,
        aluno: aluno.nome,
        disciplinaId,
        disciplina: d.nome,
        aulasDadas,
        presencas: comparecimentos,
        faltas: aulasDadas - comparecimentos,
        faltasAbonadas: abonos,
        percentual,
        percentualComAbono,
        abaixoDoMinimo: percentual < PRESENCA_MINIMA,
        salvoPeloAbono:
          percentual < PRESENCA_MINIMA && percentualComAbono >= PRESENCA_MINIMA,
      });
    }
  }

  return linhas.sort(
    (a, b) =>
      a.aluno.localeCompare(b.aluno, "pt-BR") ||
      a.disciplina.localeCompare(b.disciplina, "pt-BR"),
  );
}

export interface ResumoDeFrequencia {
  alunos: number;
  disciplinas: number;
  /** Quantos alunos estão abaixo do mínimo em pelo menos uma disciplina. */
  emRisco: number;
  /** Nome dos alunos em risco, uma vez cada. */
  nomesEmRisco: string[];
  /** Alunos que só ficam acima do mínimo se o abono contar. */
  nomesSalvosPeloAbono: string[];
}

export function resumirFrequencia(linhas: readonly LinhaFrequencia[]): ResumoDeFrequencia {
  const emRisco = new Map<string, string>();
  const salvos = new Map<string, string>();
  for (const l of linhas) {
    if (l.abaixoDoMinimo) emRisco.set(l.alunoId, l.aluno);
    if (l.salvoPeloAbono) salvos.set(l.alunoId, l.aluno);
  }
  const ordenar = (m: Map<string, string>) =>
    [...m.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    alunos: new Set(linhas.map(l => l.alunoId)).size,
    disciplinas: new Set(linhas.map(l => l.disciplinaId)).size,
    emRisco: emRisco.size,
    nomesEmRisco: ordenar(emRisco),
    nomesSalvosPeloAbono: ordenar(salvos),
  };
}

export interface LinhaDoDiario {
  disciplina: string;
  numero: number;
  data: string | null;
  professor: string | null;
  conteudo: string | null;
  /** Chamada fechada sem escrever o que foi dado — o diário fica com buraco. */
  semConteudo: boolean;
}

/**
 * Diário de sala: o que foi ministrado em cada aula já fechada.
 *
 * O que a coordenação precisa ver aqui é o **buraco** — aula fechada sem
 * conteúdo escrito. É a única forma de cobrar o professor antes que o semestre
 * acabe e ninguém mais lembre o que aconteceu naquele dia.
 */
export function montarDiario(aulas: readonly AulaFechada[]): LinhaDoDiario[] {
  return aulas
    .map(a => ({
      disciplina: a.disciplina,
      numero: a.numero,
      data: a.data_aula,
      professor: a.professor,
      conteudo: a.conteudo_ministrado?.trim() || null,
      semConteudo: !a.conteudo_ministrado?.trim(),
    }))
    .sort(
      (x, y) =>
        x.disciplina.localeCompare(y.disciplina, "pt-BR") || x.numero - y.numero,
    );
}

export interface RiscoDeFrequencia {
  alunoId: string;
  aluno: string;
  disciplinaId: string;
  disciplina: string;
  aulasDadas: number;
  aulasPrevistas: number;
  presencas: number;
  /** O melhor cenário: vindo a todas as aulas que ainda faltam. */
  melhorPercentualPossivel: number;
  /** Quantas das restantes ele ainda pode perder e mesmo assim fechar em 70%. */
  faltasQueAindaCabem: number;
  /** Nem vindo a todas as restantes ele chega ao mínimo. */
  jaNaoAlcanca: boolean;
}

/**
 * Quem já não alcança os 70%, e quem está por um fio.
 *
 * O sistema só dizia que o aluno rodou por falta no fechamento — quando não há
 * mais o que fazer. Sabendo em outubro que alguém **não chega ao mínimo nem
 * vindo a todas as aulas restantes**, a coordenação ainda pode conversar,
 * entender o motivo, orientar. Depois de dezembro, só resta comunicar.
 *
 * `aulasPrevistas` é o total planejado da disciplina, não o já dado: é a
 * diferença entre os dois que diz quanto ainda dá para recuperar.
 */
export function riscoDeFrequencia(
  linhas: readonly LinhaFrequencia[],
  /** ENCONTROS previstos por disciplina — é o que `disciplinas.total_aulas` guarda. */
  encontrosPrevistosPorDisciplina: Readonly<Record<string, number>>,
): RiscoDeFrequencia[] {
  const saida: RiscoDeFrequencia[] = [];

  for (const l of linhas) {
    // A grade planeja encontros; a frequência mede aulas. Converter aqui evita
    // comparar 18 previstos com 36 dadas e concluir que a disciplina acabou.
    const encontros = encontrosPrevistosPorDisciplina[l.disciplinaId];
    const previstas = encontros === undefined
      ? l.aulasDadas
      : encontros * AULAS_POR_ENCONTRO;
    // Grade encolhida depois das aulas dadas: não há restantes negativas.
    const restantes = Math.max(0, previstas - l.aulasDadas);
    if (previstas === 0) continue;

    const melhor = arredondar(((l.presencas + restantes) * 100) / previstas);
    // Quantas faltas ainda cabem: quantas presenças faltam para o mínimo.
    const presencasNecessarias = Math.ceil((PRESENCA_MINIMA * previstas) / 100);
    const faltasQueAindaCabem = Math.max(0, restantes - (presencasNecessarias - l.presencas));

    const jaNaoAlcanca = melhor < PRESENCA_MINIMA;
    // Só interessa quem corre risco: quem tem folga não precisa de aviso.
    if (!jaNaoAlcanca && faltasQueAindaCabem > 2) continue;

    saida.push({
      alunoId: l.alunoId,
      aluno: l.aluno,
      disciplinaId: l.disciplinaId,
      disciplina: l.disciplina,
      aulasDadas: l.aulasDadas,
      aulasPrevistas: previstas,
      presencas: l.presencas,
      melhorPercentualPossivel: melhor,
      faltasQueAindaCabem,
      jaNaoAlcanca,
    });
  }

  // Os casos perdidos primeiro; entre eles, quem tem menos margem.
  return saida.sort(
    (a, b) =>
      Number(b.jaNaoAlcanca) - Number(a.jaNaoAlcanca) ||
      a.faltasQueAindaCabem - b.faltasQueAindaCabem ||
      a.aluno.localeCompare(b.aluno, "pt-BR"),
  );
}

export interface FaltaDoAluno {
  aulaId: string;
  numero: number;
  data: string | null;
  disciplina: string;
  abonada: boolean;
}

/**
 * As aulas em que o aluno faltou numa disciplina, para a tela de abono.
 *
 * Só entram aulas com chamada fechada: numa aula ainda aberta a ausência de
 * registro não é falta, é chamada que o professor não fez. Abonar isso seria
 * perdoar uma falta que talvez nem exista.
 */
export function faltasDoAluno(
  alunoId: string,
  disciplinaId: string,
  aulas: readonly AulaFechada[],
  presencas: readonly RegistroPresenca[],
  abonos: readonly Abono[] = [],
): FaltaDoAluno[] {
  const presenteEm = new Set(
    presencas.filter(p => p.aluno_id === alunoId && p.presente).map(p => p.aula_id),
  );
  const abonadas = new Set(
    abonos.filter(a => a.aluno_id === alunoId).map(a => a.aula_id),
  );

  return aulas
    .filter(a => a.disciplina_id === disciplinaId && !presenteEm.has(a.id))
    .map(a => ({
      aulaId: a.id,
      numero: a.numero,
      data: a.data_aula,
      disciplina: a.disciplina,
      abonada: abonadas.has(a.id),
    }))
    .sort((x, y) => x.numero - y.numero);
}

export interface AulaPendente {
  disciplina: string;
  numero: number;
  data: string;
  professor: string | null;
  /** Há quantos dias a aula aconteceu sem a chamada ser feita. */
  diasAtras: number;
}

/**
 * Aulas cuja data já passou e a chamada não foi feita.
 *
 * Esta é a pendência de verdade. A primeira versão deste relatório contava
 * "aula fechada sem conteúdo escrito", número que é sempre zero: o banco tem
 * uma constraint que impede fechar a chamada sem 30 caracteres de diário. Eu
 * contava uma coisa que não pode acontecer, enquanto a que acontece — o
 * professor simplesmente não fez a chamada — ficava invisível.
 */
export function aulasPendentesDeChamada(
  aulas: readonly (AulaFechada & { finalizada: boolean })[],
  hoje: string,
): AulaPendente[] {
  const emDias = (iso: string) =>
    Math.round((Date.parse(hoje) - Date.parse(iso)) / 86_400_000);

  return aulas
    .filter(a => !a.finalizada && a.data_aula !== null && a.data_aula <= hoje)
    .map(a => ({
      disciplina: a.disciplina,
      numero: a.numero,
      data: a.data_aula as string,
      professor: a.professor,
      diasAtras: emDias(a.data_aula as string),
    }))
    // A mais antiga primeiro: é a que corre risco de ninguém mais lembrar.
    .sort((x, y) => x.data.localeCompare(y.data) || x.disciplina.localeCompare(y.disciplina, "pt-BR"));
}

/** Texto pronto para CSV: sem ponto e vírgula nem quebra de linha soltos. */
export function limparParaCSV(valor: string | null): string {
  if (!valor) return "";
  // Colapsa o espaço que sobra ao trocar o separador: "roteiro; parte" viraria
  // "roteiro  parte", com dois espaços no meio da frase.
  return valor.replace(/[;\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
