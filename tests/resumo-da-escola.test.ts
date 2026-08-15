import { test } from "node:test";
import assert from "node:assert/strict";
import {
  separarPendentes, atrasosPorProfessor, riscoDaEscola, separarRisco,
  andamentoDoSemestre, estaTudoEmOrdem,
  type ChamadaPendente, type FrequenciaDaEscola,
} from "../src/lib/resumo-da-escola.ts";

const rotulo = (id: string) => `turma ${id}`;

function pendente(p: Partial<ChamadaPendente>): ChamadaPendente {
  return {
    aula_id: "a1", turma_id: "t1", curso: "Animação", turno: "Manhã",
    entrada: "2025/2", disciplina_id: "d1", disciplina: "Roteiro",
    numero: 1, data_aula: "2026-08-10", professor: "Camila", dias_atras: 5,
    ...p,
  };
}

function freq(f: Partial<FrequenciaDaEscola>): FrequenciaDaEscola {
  return {
    turma_id: "t1", aluno_id: "al1", aluno: "Bruno", modulo: 2,
    disciplina_id: "d1", disciplina: "Roteiro",
    aulas_previstas: 36, aulas_dadas: 20, presencas: 20, faltas_abonadas: 0,
    ...f,
  };
}

test("a aula de hoje não conta como atrasada", () => {
  const { atrasadas, deHoje } = separarPendentes([
    pendente({ aula_id: "hoje", dias_atras: 0 }),
    pendente({ aula_id: "velha", dias_atras: 12 }),
  ]);

  assert.equal(deHoje.length, 1);
  assert.equal(deHoje[0].aula_id, "hoje");
  assert.equal(atrasadas.length, 1);
  assert.equal(atrasadas[0].aula_id, "velha");
});

test("a mais antiga vem primeiro entre as atrasadas", () => {
  const { atrasadas } = separarPendentes([
    pendente({ aula_id: "b", data_aula: "2026-08-10", dias_atras: 5 }),
    pendente({ aula_id: "a", data_aula: "2026-08-03", dias_atras: 12 }),
  ]);
  assert.deepEqual(atrasadas.map(a => a.aula_id), ["a", "b"]);
});

test("o atraso se agrupa por professor, com o pior no topo", () => {
  const linhas = [
    pendente({ professor: "Camila", dias_atras: 3, turma_id: "t1" }),
    pendente({ professor: "Camila", dias_atras: 12, turma_id: "t2" }),
    pendente({ professor: "Evil", dias_atras: 5, turma_id: "t1" }),
  ];

  const [primeiro, segundo] = atrasosPorProfessor(linhas, rotulo);

  assert.equal(primeiro.professor, "Camila");
  assert.equal(primeiro.quantidade, 2);
  assert.equal(primeiro.diasDaMaisAntiga, 12);
  assert.deepEqual(primeiro.turmas, ["turma t1", "turma t2"]);
  assert.equal(segundo.professor, "Evil");
});

test("aula sem professor definido não some do agrupamento", () => {
  const [so] = atrasosPorProfessor([pendente({ professor: null })], rotulo);
  assert.equal(so.professor, "Sem professor definido");
  assert.equal(so.quantidade, 1);
});

test("quem já não alcança os 70% aparece, e traz a turma junto", () => {
  // 36 aulas previstas, 30 dadas, só 6 presenças: nem vindo às 6 restantes
  // ele passa de 12/36 = 33%.
  const riscos = riscoDaEscola(
    [freq({ aulas_previstas: 36, aulas_dadas: 30, presencas: 6 })],
    rotulo,
  );

  assert.equal(riscos.length, 1);
  assert.equal(riscos[0].jaNaoAlcanca, true);
  assert.equal(riscos[0].turma, "turma t1");
  assert.equal(riscos[0].turmaId, "t1");
  assert.equal(riscos[0].modulo, 2);
});

test("quem tem folga não vira aviso", () => {
  // Presença cheia: nada a avisar.
  const riscos = riscoDaEscola([freq({ aulas_dadas: 20, presencas: 20 })], rotulo);
  assert.deepEqual(riscos, []);
});

test("os dois grupos de risco pedem ações diferentes", () => {
  const riscos = riscoDaEscola([
    freq({ aluno_id: "perdido", aluno: "Ana", aulas_previstas: 36, aulas_dadas: 30, presencas: 6 }),
    freq({ aluno_id: "no-fio", aluno: "Zeca", aulas_previstas: 36, aulas_dadas: 24, presencas: 16 }),
  ], rotulo);

  const { semRecuperacao, porUmFio } = separarRisco(riscos);
  assert.equal(semRecuperacao.length, 1);
  assert.equal(semRecuperacao[0].aluno, "Ana");
  assert.equal(porUmFio.length, 1);
  assert.equal(porUmFio[0].aluno, "Zeca");
  assert.equal(porUmFio[0].jaNaoAlcanca, false);
});

test("o mesmo aluno em duas turmas conta em cada uma", () => {
  const riscos = riscoDaEscola([
    freq({ turma_id: "t1", aulas_previstas: 36, aulas_dadas: 30, presencas: 6 }),
    freq({ turma_id: "t2", aulas_previstas: 36, aulas_dadas: 30, presencas: 6 }),
  ], rotulo);

  assert.equal(riscos.length, 2);
  assert.deepEqual(riscos.map(r => r.turmaId).sort(), ["t1", "t2"]);
});

test("o andamento não multiplica o semestre pelo número de alunos", () => {
  // A view repete a mesma disciplina em cada aluno matriculado. Somar tudo
  // diria que a escola tem 108 aulas previstas onde ela tem 36.
  const andamento = andamentoDoSemestre([
    freq({ aluno_id: "a", aulas_previstas: 36, aulas_dadas: 18 }),
    freq({ aluno_id: "b", aulas_previstas: 36, aulas_dadas: 18 }),
    freq({ aluno_id: "c", aulas_previstas: 36, aulas_dadas: 18 }),
  ]);

  assert.equal(andamento.aulasPrevistas, 36);
  assert.equal(andamento.aulasDadas, 18);
  assert.equal(andamento.percentual, 50);
});

test("o andamento soma disciplinas diferentes da mesma turma", () => {
  const andamento = andamentoDoSemestre([
    freq({ disciplina_id: "d1", aulas_previstas: 36, aulas_dadas: 36 }),
    freq({ disciplina_id: "d2", aulas_previstas: 34, aulas_dadas: 0 }),
  ]);
  assert.equal(andamento.aulasPrevistas, 70);
  assert.equal(andamento.aulasDadas, 36);
});

test("semestre sem nenhuma aula prevista não divide por zero", () => {
  assert.equal(andamentoDoSemestre([]).percentual, 0);
});

test("tudo em ordem só quando todos os blocos estão zerados", () => {
  assert.equal(estaTudoEmOrdem([0, 0, 0]), true);
  assert.equal(estaTudoEmOrdem([0, 1, 0]), false);
  assert.equal(estaTudoEmOrdem([]), true);
});
