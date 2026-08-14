import { avaliarModulo, type AvaliacaoDoModulo, type DesempenhoDisciplina } from "./aprovacao.ts";
import { MODULOS_DO_CURSO } from "./calendario-escolar.ts";

/**
 * Fechamento do módulo: transformar as linhas de `vw_desempenho_aluno` na
 * decisão que o coordenador tem de tomar, aluno por aluno (D25).
 *
 * A regra de aprovação em si vive em `aprovacao.ts`. Aqui só se agrupa, ordena
 * e resume — mas é justamente aqui que dava para errar calado: um aluno que
 * não aparece na view não é um aluno sem disciplinas, é um aluno que ninguém
 * lançou nota. Os dois casos precisam chegar diferentes na tela.
 */

/** Uma linha da view, já com o aluno. */
export interface LinhaDesempenho extends DesempenhoDisciplina {
  aluno_id: string;
  aluno: string;
}

/** Aluno matriculado, venha ele com notas ou sem nenhuma. */
export interface AlunoParaFechar {
  alunoId: string;
  nome: string;
  matriculaId: string;
  avaliacao: AvaliacaoDoModulo;
}

export interface MatriculaAberta {
  matriculaId: string;
  alunoId: string;
  nome: string;
}

/**
 * Cruza quem está matriculado com o que foi lançado.
 *
 * A lista de saída sai de `matriculas`, não da view: aluno sem uma única nota
 * lançada não aparece em `vw_desempenho_aluno`, e sumir da tela de fechamento
 * seria o pior desfecho possível — ninguém decide sobre quem não vê.
 */
export function montarFechamento(
  matriculas: readonly MatriculaAberta[],
  linhas: readonly LinhaDesempenho[],
): AlunoParaFechar[] {
  const porAluno = new Map<string, DesempenhoDisciplina[]>();
  for (const l of linhas) {
    if (!porAluno.has(l.aluno_id)) porAluno.set(l.aluno_id, []);
    porAluno.get(l.aluno_id)!.push({
      disciplina_id: l.disciplina_id,
      disciplina: l.disciplina,
      modulo: l.modulo,
      nota_professor: l.nota_professor,
      nota_banca: l.nota_banca,
      nota_final: l.nota_final,
      aulas_dadas: l.aulas_dadas,
      presencas: l.presencas,
    });
  }

  return matriculas
    .map(m => ({
      alunoId: m.alunoId,
      nome: m.nome,
      matriculaId: m.matriculaId,
      avaliacao: avaliarModulo(
        (porAluno.get(m.alunoId) ?? []).sort((a, b) =>
          a.disciplina.localeCompare(b.disciplina, "pt-BR")),
      ),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface ResumoDoFechamento {
  total: number;
  aprovados: number;
  retidos: number;
  indefinidos: number;
  /** Fechar com alguém indefinido é decidir no escuro. */
  prontoParaFechar: boolean;
}

export function resumirFechamento(alunos: readonly AlunoParaFechar[]): ResumoDoFechamento {
  const conta = (s: string) => alunos.filter(a => a.avaliacao.situacao === s).length;
  const indefinidos = conta("indefinido");

  return {
    total: alunos.length,
    aprovados: conta("aprovado"),
    retidos: conta("retido"),
    indefinidos,
    prontoParaFechar: alunos.length > 0 && indefinidos === 0,
  };
}

/**
 * O que ainda falta lançar, sem repetir a mesma pendência N vezes.
 *
 * Uma banca não lançada aparece em todas as disciplinas de todos os alunos da
 * turma. Listar cada ocorrência daria dezenas de linhas dizendo a mesma coisa,
 * e a pendência de verdade se perderia no meio.
 */
export function pendenciasDaTurma(alunos: readonly AlunoParaFechar[]): string[] {
  const vistas = new Set<string>();
  for (const a of alunos) for (const p of a.avaliacao.pendencias) vistas.add(p);
  return [...vistas].sort((x, y) => x.localeCompare(y, "pt-BR"));
}

/** O que se grava na matrícula ao encerrar. */
export type Desfecho = "aprovado" | "retido" | "concluido";

/**
 * Passar no último módulo não é ser aprovado — é **concluir o curso**.
 *
 * A diferença não é semântica: quem foi aprovado no módulo 1 ou 2 volta no
 * semestre seguinte, e quem concluiu, não. Gravar os dois como `aprovado`
 * torna impossível listar os formandos, e o primeiro deles aparece no fim
 * deste semestre.
 */
export function desfechoDaAprovacao(modulo: number): "aprovado" | "concluido" {
  return modulo >= MODULOS_DO_CURSO ? "concluido" : "aprovado";
}

/** A situação da matrícula que corresponde à avaliação, quando há uma. */
export function situacaoSugerida(
  avaliacao: AvaliacaoDoModulo,
  modulo: number,
): Desfecho | null {
  if (avaliacao.situacao === "aprovado") return desfechoDaAprovacao(modulo);
  if (avaliacao.situacao === "retido") return "retido";
  return null;
}
