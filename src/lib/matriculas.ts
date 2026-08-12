import type { SupabaseClient } from "@supabase/supabase-js";
import { semestreDoCurso, SEMESTRES_DO_CURSO } from "./calendario-escolar.ts";

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
  semestreDoCurso: number;
}

interface LinhaMatricula {
  id: string;
  semestre_do_curso: number;
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
    .select("id, semestre_do_curso, aluno:alunos(id, nome, email, ativo)")
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
      semestreDoCurso: m.semestre_do_curso,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { alunos, erro: null };
}

/**
 * Em que semestre do curso uma turma está hoje, limitado à duração do curso.
 * Usado ao matricular alguém numa turma já em andamento.
 */
export function semestreAtualDaTurma(semestreDeEntrada: string): number {
  const n = semestreDoCurso(semestreDeEntrada);
  if (n === null) return 1;
  return Math.min(SEMESTRES_DO_CURSO, Math.max(1, n));
}

/** Matricula alunos numa turma, no semestre em que ela está. */
export async function matricularAlunos(
  supabase: SupabaseClient,
  turmaId: string,
  semestreDeEntradaDaTurma: string,
  alunoIds: string[],
): Promise<{ erro: string | null }> {
  if (alunoIds.length === 0) return { erro: null };

  const semestre = semestreAtualDaTurma(semestreDeEntradaDaTurma);
  const { error } = await supabase.from("matriculas").insert(
    alunoIds.map(aluno_id => ({
      aluno_id,
      turma_id: turmaId,
      semestre_do_curso: semestre,
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
