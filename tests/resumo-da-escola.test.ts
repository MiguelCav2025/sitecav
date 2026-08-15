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

// ── Lacunas de configuração ──────────────────────────────────────────────────

import {
  lacunasDeConfiguracao, indexarAlunos, buscarAluno,
  type DisciplinaConfigurada,
} from "../src/lib/resumo-da-escola.ts";

function disc(d: Partial<DisciplinaConfigurada>): DisciplinaConfigurada {
  return {
    id: "d1", nome: "Roteiro", curso: "Animação", modulo: 1,
    professor_id: "p1", sala_id: "s1", dia_da_semana: 2, ...d,
  };
}

const semLacunas = {
  disciplinas: [disc({})],
  cursoModuloEmUso: new Set(["Animação|1"]),
  turmas: [{ id: "t1", curso: "Animação", turno: "Manhã", entrada: "2026/1" }],
  turmasComAluno: new Set(["t1"]),
  temCalendario: true,
};

test("escola configurada não gera lacuna nenhuma", () => {
  assert.deepEqual(lacunasDeConfiguracao(semLacunas), []);
});

test("disciplina de módulo que nenhuma turma cursa não vira alarme falso", () => {
  // A tabela guarda as matérias dos 3 módulos dos 2 cursos. Cobrar sala de
  // uma do módulo 3 sem turma no módulo 3 seria acusar o que não existe.
  const lacunas = lacunasDeConfiguracao({
    ...semLacunas,
    disciplinas: [disc({}), disc({ id: "d9", nome: "TCC", modulo: 3, sala_id: null, professor_id: null })],
  });
  assert.deepEqual(lacunas, []);
});

test("disciplina em uso sem professor, sem dia e sem sala vira três avisos", () => {
  const lacunas = lacunasDeConfiguracao({
    ...semLacunas,
    disciplinas: [disc({ professor_id: null, sala_id: null, dia_da_semana: null })],
  });
  assert.equal(lacunas.length, 3);
  assert.ok(lacunas.every(l => l.onde === "disciplinas"));
  assert.ok(lacunas.some(l => l.texto.includes("sem professor")));
  assert.ok(lacunas.some(l => l.texto.includes("sem dia da semana")));
});

test("calendario que nao cobre hoje e a primeira lacuna, porque trava as outras", () => {
  // Sem semestre vigente o modulo de toda turma fica desconhecido: ele sai da
  // entrada MAIS o semestre corrente. Nao adianta apontar sala faltando se o
  // sistema nem sabe em que modulo a turma esta.
  const lacunas = lacunasDeConfiguracao({ ...semLacunas, temCalendario: false });
  assert.equal(lacunas[0].onde, "cronograma");
  assert.ok(lacunas[0].texto.includes("módulo"));
});

test("turma sem nenhum aluno cursando é uma turma que não existe de verdade", () => {
  const [so] = lacunasDeConfiguracao({ ...semLacunas, turmasComAluno: new Set<string>() });
  assert.equal(so.onde, "turmas");
  assert.ok(so.texto.includes("Animação Manhã"));
});

// ── Busca de aluno ───────────────────────────────────────────────────────────

const alunos = [
  { id: "al1", nome: "José da Silva" },
  { id: "al2", nome: "Ana Souza" },
  { id: "al3", nome: "Carlos Concluído" },
];

test("a busca acha quem tem acento sem que se digite o acento", () => {
  const indice = indexarAlunos(alunos, [], rotulo);
  assert.deepEqual(buscarAluno(indice, "jose").map(a => a.nome), ["José da Silva"]);
  assert.deepEqual(buscarAluno(indice, "SOUZA").map(a => a.nome), ["Ana Souza"]);
});

test("uma letra só não busca — devolveria a escola inteira", () => {
  assert.deepEqual(buscarAluno(indexarAlunos(alunos, [], rotulo), "a"), []);
});

test("aluno sem turma nenhuma continua encontrável", () => {
  // Ele existe, só não está cursando. Sumir da busca seria o pior desfecho.
  const [achado] = buscarAluno(indexarAlunos(alunos, [], rotulo), "concluido");
  assert.equal(achado.nome, "Carlos Concluído");
  assert.deepEqual(achado.matriculas, []);
});

test("a busca soma a frequência de todas as disciplinas da turma", () => {
  const indice = indexarAlunos(alunos, [
    freq({ aluno_id: "al1", disciplina_id: "d1", aulas_dadas: 20, presencas: 20 }),
    freq({ aluno_id: "al1", disciplina_id: "d2", aulas_dadas: 20, presencas: 10 }),
  ], rotulo);
  const [jose] = buscarAluno(indice, "jose");
  assert.equal(jose.matriculas.length, 1);
  assert.equal(jose.matriculas[0].percentual, 75);
  assert.equal(jose.matriculas[0].turma, "turma t1");
});

test("sem chamada fechada a frequência é desconhecida, e não zero", () => {
  const indice = indexarAlunos(alunos, [
    freq({ aluno_id: "al1", aulas_dadas: 0, presencas: 0 }),
  ], rotulo);
  assert.equal(buscarAluno(indice, "jose")[0].matriculas[0].percentual, null);
});

test("o aluno em duas turmas aparece uma vez, com as duas matrículas", () => {
  const indice = indexarAlunos(alunos, [
    freq({ aluno_id: "al1", turma_id: "t1" }),
    freq({ aluno_id: "al1", turma_id: "t2" }),
  ], rotulo);
  const achados = buscarAluno(indice, "jose");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].matriculas.length, 2);
});

// ── A matriz da escola ───────────────────────────────────────────────────────

import { matrizDeTurmas } from "../src/lib/resumo-da-escola.ts";

const turmasReais = [
  { turmaId: "a", curso: "Cine/TV",  turno: "Manhã", modulo: 1, quantidade: 13 },
  { turmaId: "b", curso: "Cine/TV",  turno: "Manhã", modulo: 2, quantidade: 9 },
  { turmaId: "c", curso: "Cine/TV",  turno: "Manhã", modulo: 3, quantidade: 7 },
  { turmaId: "d", curso: "Cine/TV",  turno: "Noite", modulo: 1, quantidade: 16 },
  { turmaId: "e", curso: "Cine/TV",  turno: "Noite", modulo: 2, quantidade: 16 },
  { turmaId: "f", curso: "Cine/TV",  turno: "Noite", modulo: 3, quantidade: 10 },
  { turmaId: "g", curso: "Animação", turno: "Manhã", modulo: 2, quantidade: 11 },
  { turmaId: "h", curso: "Animação", turno: "Manhã", modulo: 3, quantidade: 6 },
  { turmaId: "i", curso: "Animação", turno: "Noite", modulo: 1, quantidade: 9 },
  { turmaId: "j", curso: "Animação", turno: "Noite", modulo: 2, quantidade: 11 },
  { turmaId: "k", curso: "Animação", turno: "Noite", modulo: 3, quantidade: 5 },
];

test("a matriz sai por curso, em ordem alfabética", () => {
  assert.deepEqual(matrizDeTurmas(turmasReais, 3).map(c => c.curso), ["Animação", "Cine/TV"]);
});

test("manhã vem antes de noite, e não em ordem alfabética por acaso", () => {
  const [animacao] = matrizDeTurmas(turmasReais, 3);
  assert.deepEqual(animacao.linhas.map(l => l.turno), ["Manhã", "Noite"]);
});

test("a turma que NÃO existe vira um buraco visível, e não some", () => {
  // Este é o ponto da matriz. Numa lista de pílulas, turma ausente não tem
  // pílula — é invisível por definição.
  const [animacao] = matrizDeTurmas(turmasReais, 3);
  const manha = animacao.linhas.find(l => l.turno === "Manhã")!;
  assert.equal(manha.celulas[0], null);       // módulo 1 não existe
  assert.equal(manha.celulas[1]?.quantidade, 11);
  assert.equal(animacao.vazias, 1);
});

test("curso sem buraco nenhum acusa zero vazias", () => {
  const cine = matrizDeTurmas(turmasReais, 3).find(c => c.curso === "Cine/TV")!;
  assert.equal(cine.vazias, 0);
  assert.equal(cine.total, 71);
});

test("o total por curso soma só as turmas dele", () => {
  const [animacao] = matrizDeTurmas(turmasReais, 3);
  assert.equal(animacao.total, 42);
});

test("turno fora do esperado vai para o fim, em vez de sumir", () => {
  const m = matrizDeTurmas(
    [...turmasReais, { turmaId: "z", curso: "Animação", turno: "Integral", modulo: 1, quantidade: 3 }],
    3,
  );
  const [animacao] = m;
  assert.deepEqual(animacao.linhas.map(l => l.turno), ["Manhã", "Noite", "Integral"]);
});
