import type { SupabaseClient } from "@supabase/supabase-js";
import { moduloAtual, MODULOS_DO_CURSO } from "./calendario-escolar.ts";

/**
 * Quem está em qual turma vem de `matriculas`, nunca de um campo no aluno.
 *
 * Um aluno pode cursar duas turmas ao mesmo tempo — terminando um curso e
 * começando outro — então não existe "a turma dele". Um único campo apontando
 * para uma turma faria o aluno sumir da chamada da outra, em silêncio.
 */

export type SituacaoMatricula =
  | "cursando"
  | "aprovado"
  | "retido"
  | "desistente"
  | "concluido";

export interface AlunoDaTurma {
  id: string;
  nome: string;
  email: string | null;
  /** Id da matrícula que o liga a esta turma. */
  matriculaId: string;
  modulo: number;
}

interface LinhaMatricula {
  id: string;
  modulo: number;
  aluno: { id: string; nome: string; email: string | null; ativo: boolean } | null;
}

/**
 * Alunos que estão cursando a turma agora, em ordem alfabética.
 *
 * Não recebe `ativo` como filtro no servidor de propósito: o vínculo com a
 * turma é a matrícula em andamento, e `alunos.ativo` diz apenas se a pessoa
 * segue na escola. Filtrar aqui evita depender de sintaxe de join do PostgREST.
 */
export async function buscarAlunosDaTurma(
  supabase: SupabaseClient,
  turmaId: string,
): Promise<{ alunos: AlunoDaTurma[]; erro: string | null }> {
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, modulo, aluno:alunos(id, nome, email, ativo)")
    .eq("turma_id", turmaId)
    .eq("situacao", "cursando");

  if (error) return { alunos: [], erro: error.message };

  const alunos = ((data ?? []) as unknown as LinhaMatricula[])
    .filter(m => m.aluno && m.aluno.ativo)
    .map(m => ({
      id: m.aluno!.id,
      nome: m.aluno!.nome,
      email: m.aluno!.email,
      matriculaId: m.id,
      modulo: m.modulo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { alunos, erro: null };
}

export interface MatriculaDaTurma extends AlunoDaTurma {
  situacao: SituacaoMatricula;
}

/**
 * TODOS que passaram por esta turma, encerrados ou não.
 *
 * Serve aos relatórios e ao fechamento. A `buscarAlunosDaTurma` filtra por
 * `cursando`, o que está certo para a chamada — aluno encerrado não é chamado.
 * Mas usar o mesmo filtro no relatório fazia a turma sumir da tela no instante
 * em que o módulo era fechado, justamente quando ela mais interessa relatar.
 *
 * Aluno com duas matrículas na mesma turma (repetência) aparece uma vez só:
 * as presenças estão nas mesmas aulas, então duplicá-lo duplicaria as linhas.
 */
export async function buscarMatriculasDaTurma(
  supabase: SupabaseClient,
  turmaId: string,
): Promise<{ matriculas: MatriculaDaTurma[]; erro: string | null }> {
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, modulo, situacao, aluno:alunos(id, nome, email, ativo)")
    .eq("turma_id", turmaId);

  if (error) return { matriculas: [], erro: error.message };

  const porAluno = new Map<string, MatriculaDaTurma>();
  for (const m of (data ?? []) as unknown as (LinhaMatricula & { situacao: SituacaoMatricula })[]) {
    if (!m.aluno) continue;
    // A matrícula em andamento tem precedência sobre uma antiga encerrada.
    const jaTem = porAluno.get(m.aluno.id);
    if (jaTem && jaTem.situacao === "cursando") continue;

    porAluno.set(m.aluno.id, {
      id: m.aluno.id,
      nome: m.aluno.nome,
      email: m.aluno.email,
      matriculaId: m.id,
      modulo: m.modulo,
      situacao: m.situacao,
    });
  }

  return {
    matriculas: [...porAluno.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    erro: null,
  };
}

/**
 * Em que módulo uma turma está, limitado à duração do curso.
 *
 * Sem semestre vigente cai em 1: matricular alguém é operação que não pode
 * travar por falta de calendário, e o módulo de uma matrícula é corrigível
 * depois. Errar para o começo do curso é o erro menos danoso.
 */
export function moduloAtualDaTurma(entrada: string, semestreAtual: string | null): number {
  const n = moduloAtual(entrada, semestreAtual);
  if (n === null) return 1;
  return Math.min(MODULOS_DO_CURSO, Math.max(1, n));
}

/** Matricula alunos numa turma, no módulo em que ela está. */
export async function matricularAlunos(
  supabase: SupabaseClient,
  turmaId: string,
  entradaDaTurma: string,
  alunoIds: string[],
  semestreAtual: string | null,
): Promise<{ erro: string | null }> {
  if (alunoIds.length === 0) return { erro: null };

  const modulo = moduloAtualDaTurma(entradaDaTurma, semestreAtual);
  const { error } = await supabase.from("matriculas").insert(
    alunoIds.map(aluno_id => ({
      aluno_id,
      turma_id: turmaId,
      modulo,
      situacao: "cursando",
    })),
  );
  return { erro: error?.message ?? null };
}

/**
 * Encerra a matrícula do aluno naquela turma.
 *
 * Sair da turma não apaga nada: presenças e notas apontam para aula e
 * disciplina, então o histórico sobrevive à saída (D26).
 */
/**
 * Desfaz um encerramento: a matrícula volta a "cursando".
 *
 * Sem isto, aprovar alguém por engano não tinha caminho de volta pela tela — e
 * a decisão do fechamento é justamente a que mais custa errar. Limpa a data e a
 * observação para não sobrar registro de uma decisão que foi desfeita.
 */
export async function reabrirMatricula(
  supabase: SupabaseClient,
  matriculaId: string,
): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from("matriculas")
    .update({
      situacao: "cursando",
      encerrada_em: null,
      observacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matriculaId);
  return { erro: error?.message ?? null };
}

export async function encerrarMatricula(
  supabase: SupabaseClient,
  matriculaId: string,
  situacao: Exclude<SituacaoMatricula, "cursando">,
  observacao?: string,
): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from("matriculas")
    .update({
      situacao,
      encerrada_em: new Date().toISOString().split("T")[0],
      observacao: observacao ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matriculaId);
  return { erro: error?.message ?? null };
}
