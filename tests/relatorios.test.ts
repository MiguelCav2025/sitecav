import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  frequenciaPorDisciplina,
  resumirFrequencia,
  montarDiario,
  aulasPendentesDeChamada,
  faltasDoAluno,
  limparParaCSV,
  type AulaFechada,
  type RegistroPresenca,
} from "../src/lib/relatorios.ts";
import { PRESENCA_MINIMA } from "../src/lib/aprovacao.ts";

const aula = (id: string, disc: string, numero: number, over: Partial<AulaFechada> = {}): AulaFechada => ({
  id,
  disciplina_id: `d-${disc}`,
  disciplina: disc,
  numero,
  data_aula: "2026-08-03",
  conteudo_ministrado: "Conteúdo dado",
  professor: "Ana",
  ...over,
});

const presente = (aula_id: string, aluno_id: string): RegistroPresenca =>
  ({ aula_id, aluno_id, presente: true });

describe("frequenciaPorDisciplina", () => {
  const alunos = [{ id: "a1", nome: "Bruno" }, { id: "a2", nome: "Ana" }];

  it("conta por disciplina, nao pela media da turma", () => {
    // Bruno vai a tudo em Roteiro e falta tudo em Desenho. Na media da turma
    // daria 50% e ele pareceria um caso unico; por disciplina, aparece que ele
    // esta reprovado em Desenho e aprovado em Roteiro.
    const aulas = [aula("r1", "Roteiro", 1), aula("r2", "Roteiro", 2), aula("d1", "Desenho", 1), aula("d2", "Desenho", 2)];
    const presencas = [presente("r1", "a1"), presente("r2", "a1")];

    const linhas = frequenciaPorDisciplina([alunos[0]], aulas, presencas);
    const porDisc = Object.fromEntries(linhas.map(l => [l.disciplina, l]));

    assert.equal(porDisc["Roteiro"].percentual, 100);
    assert.equal(porDisc["Roteiro"].abaixoDoMinimo, false);
    assert.equal(porDisc["Desenho"].percentual, 0);
    assert.equal(porDisc["Desenho"].abaixoDoMinimo, true);
  });

  it("usa o MESMO corte que decide a aprovacao", () => {
    // 7 de 10 = 70%, exatamente o minimo: passa. O relatorio antigo pintava de
    // vermelho abaixo de 75% e acusaria este aluno sem motivo.
    const aulas = Array.from({ length: 10 }, (_, i) => aula(`x${i}`, "Roteiro", i + 1));
    const presencas = aulas.slice(0, 7).map(a => presente(a.id, "a1"));

    const [linha] = frequenciaPorDisciplina([alunos[0]], aulas, presencas);
    assert.equal(linha.percentual, PRESENCA_MINIMA);
    assert.equal(linha.abaixoDoMinimo, false);
  });

  it("um a menos que o minimo ja e risco", () => {
    const aulas = Array.from({ length: 10 }, (_, i) => aula(`x${i}`, "Roteiro", i + 1));
    const presencas = aulas.slice(0, 6).map(a => presente(a.id, "a1"));
    const [linha] = frequenciaPorDisciplina([alunos[0]], aulas, presencas);
    assert.equal(linha.percentual, 60);
    assert.equal(linha.abaixoDoMinimo, true);
  });

  it("ausencia de registro conta como falta, como na view", () => {
    const aulas = [aula("r1", "Roteiro", 1), aula("r2", "Roteiro", 2)];
    const [linha] = frequenciaPorDisciplina([alunos[0]], aulas, [presente("r1", "a1")]);
    assert.equal(linha.presencas, 1);
    assert.equal(linha.faltas, 1);
  });

  it("registro com presente=false nao vira presenca", () => {
    const aulas = [aula("r1", "Roteiro", 1)];
    const presencas = [{ aula_id: "r1", aluno_id: "a1", presente: false }];
    const [linha] = frequenciaPorDisciplina([alunos[0]], aulas, presencas);
    assert.equal(linha.presencas, 0);
  });

  it("nao mistura a presenca de um aluno com a de outro", () => {
    const aulas = [aula("r1", "Roteiro", 1)];
    const linhas = frequenciaPorDisciplina(alunos, aulas, [presente("r1", "a1")]);
    const bruno = linhas.find(l => l.aluno === "Bruno")!;
    const ana = linhas.find(l => l.aluno === "Ana")!;
    assert.equal(bruno.presencas, 1);
    assert.equal(ana.presencas, 0);
  });

  it("sem chamada fechada nao gera linha nenhuma", () => {
    // Zero por cento acusaria de faltoso um aluno cuja aula nem aconteceu.
    assert.deepEqual(frequenciaPorDisciplina(alunos, [], []), []);
  });

  it("ordena por aluno e depois por disciplina, com acento", () => {
    const aulas = [aula("r1", "Roteiro", 1), aula("d1", "Ética", 1)];
    const linhas = frequenciaPorDisciplina(alunos, aulas, []);
    assert.deepEqual(
      linhas.map(l => `${l.aluno}/${l.disciplina}`),
      ["Ana/Ética", "Ana/Roteiro", "Bruno/Ética", "Bruno/Roteiro"],
    );
  });
});

describe("resumirFrequencia", () => {
  it("conta cada aluno em risco UMA vez, mesmo faltando em varias materias", () => {
    const aulas = [aula("r1", "Roteiro", 1), aula("d1", "Desenho", 1)];
    const linhas = frequenciaPorDisciplina([{ id: "a1", nome: "Bruno" }], aulas, []);
    const r = resumirFrequencia(linhas);
    assert.equal(r.emRisco, 1);
    assert.deepEqual(r.nomesEmRisco, ["Bruno"]);
    assert.equal(r.disciplinas, 2);
    assert.equal(r.alunos, 1);
  });

  it("turma inteira em dia nao acusa ninguem", () => {
    const aulas = [aula("r1", "Roteiro", 1)];
    const linhas = frequenciaPorDisciplina([{ id: "a1", nome: "Bruno" }], aulas, [presente("r1", "a1")]);
    assert.equal(resumirFrequencia(linhas).emRisco, 0);
  });
});

describe("montarDiario", () => {
  it("aponta a aula fechada sem conteudo escrito", () => {
    const linhas = montarDiario([
      aula("r1", "Roteiro", 1),
      aula("r2", "Roteiro", 2, { conteudo_ministrado: null }),
      aula("r3", "Roteiro", 3, { conteudo_ministrado: "   " }),
    ]);
    assert.deepEqual(linhas.map(l => l.semConteudo), [false, true, true]);
  });

  it("ordena por disciplina e numero da aula", () => {
    const linhas = montarDiario([
      aula("r2", "Roteiro", 2), aula("d1", "Desenho", 1), aula("r1", "Roteiro", 1),
    ]);
    assert.deepEqual(
      linhas.map(l => `${l.disciplina}${l.numero}`),
      ["Desenho1", "Roteiro1", "Roteiro2"],
    );
  });
});

describe("abono de falta", () => {
  const aluno = [{ id: "a1", nome: "Bruno" }];
  const dez = Array.from({ length: 10 }, (_, i) => aula(`x${i}`, "Roteiro", i + 1));
  const presencaEm = (n: number) => dez.slice(0, n).map(a => presente(a.id, "a1"));

  it("nao mexe na frequencia oficial — a falta aconteceu", () => {
    // 6 de 10 = 60%. Com 2 abonos o oficial continua 60%.
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(6), [
      { aula_id: "x6", aluno_id: "a1" }, { aula_id: "x7", aluno_id: "a1" },
    ]);
    assert.equal(l.percentual, 60);
    assert.equal(l.faltas, 4);
    assert.equal(l.faltasAbonadas, 2);
  });

  it("mostra em separado quanto daria se o abono valesse", () => {
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(6), [
      { aula_id: "x6", aluno_id: "a1" }, { aula_id: "x7", aluno_id: "a1" },
    ]);
    assert.equal(l.percentualComAbono, 80);
    assert.equal(l.salvoPeloAbono, true, "60% -> 80%: cruza o minimo");
  });

  it("nao marca como salvo quem ja passava sem abono", () => {
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(9), [{ aula_id: "x9", aluno_id: "a1" }]);
    assert.equal(l.abaixoDoMinimo, false);
    assert.equal(l.salvoPeloAbono, false);
  });

  it("nem quem continua abaixo mesmo com o abono", () => {
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(3), [{ aula_id: "x3", aluno_id: "a1" }]);
    assert.equal(l.percentualComAbono, 40);
    assert.equal(l.salvoPeloAbono, false);
  });

  it("abonar aula em que o aluno esteve presente nao soma duas vezes", () => {
    // Somar seria contar a mesma aula duas vezes e passar dos 100%.
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(10), [{ aula_id: "x0", aluno_id: "a1" }]);
    assert.equal(l.percentual, 100);
    assert.equal(l.percentualComAbono, 100);
    assert.equal(l.faltasAbonadas, 0);
  });

  it("abono de um aluno nao vale para outro", () => {
    const dois = [{ id: "a1", nome: "Bruno" }, { id: "a2", nome: "Ana" }];
    const linhas = frequenciaPorDisciplina(dois, dez, presencaEm(6), [{ aula_id: "x6", aluno_id: "a1" }]);
    assert.equal(linhas.find(l => l.aluno === "Bruno")!.faltasAbonadas, 1);
    assert.equal(linhas.find(l => l.aluno === "Ana")!.faltasAbonadas, 0);
  });

  it("sem abono nenhum, o comportamento e o de antes", () => {
    const [l] = frequenciaPorDisciplina(aluno, dez, presencaEm(6));
    assert.equal(l.percentual, l.percentualComAbono);
    assert.equal(l.faltasAbonadas, 0);
    assert.equal(l.salvoPeloAbono, false);
  });

  it("o resumo separa quem depende do abono", () => {
    const r = resumirFrequencia(
      frequenciaPorDisciplina(aluno, dez, presencaEm(6), [
        { aula_id: "x6", aluno_id: "a1" }, { aula_id: "x7", aluno_id: "a1" },
      ]),
    );
    assert.deepEqual(r.nomesEmRisco, ["Bruno"]);
    assert.deepEqual(r.nomesSalvosPeloAbono, ["Bruno"]);
  });
});

describe("faltasDoAluno", () => {
  const aulas = [
    aula("r1", "Roteiro", 1), aula("r2", "Roteiro", 2), aula("r3", "Roteiro", 3),
    aula("d1", "Desenho", 1),
  ];

  it("lista so as aulas em que ele faltou, naquela disciplina", () => {
    const f = faltasDoAluno("a1", "d-Roteiro", aulas, [presente("r1", "a1"), presente("d1", "a1")]);
    assert.deepEqual(f.map(x => x.numero), [2, 3]);
  });

  it("marca quais ja foram abonadas", () => {
    const f = faltasDoAluno("a1", "d-Roteiro", aulas, [presente("r1", "a1")], [
      { aula_id: "r2", aluno_id: "a1" },
    ]);
    assert.deepEqual(f.map(x => x.abonada), [true, false]);
  });

  it("nao mistura o abono de outro aluno", () => {
    const f = faltasDoAluno("a1", "d-Roteiro", aulas, [], [{ aula_id: "r1", aluno_id: "a2" }]);
    assert.equal(f.every(x => !x.abonada), true);
  });

  it("registro presente=false conta como falta", () => {
    const f = faltasDoAluno("a1", "d-Roteiro", aulas,
      [{ aula_id: "r1", aluno_id: "a1", presente: false }]);
    assert.deepEqual(f.map(x => x.numero), [1, 2, 3]);
  });

  it("vem em ordem de aula", () => {
    const embaralhado = [aula("r3", "Roteiro", 3), aula("r1", "Roteiro", 1), aula("r2", "Roteiro", 2)];
    const f = faltasDoAluno("a1", "d-Roteiro", embaralhado, []);
    assert.deepEqual(f.map(x => x.numero), [1, 2, 3]);
  });
});

describe("aulasPendentesDeChamada", () => {
  const HOJE = "2026-08-13";
  const comStatus = (a: AulaFechada, finalizada: boolean) => ({ ...a, finalizada });

  it("acusa a aula que ja passou e nao teve chamada", () => {
    const p = aulasPendentesDeChamada(
      [comStatus(aula("r1", "Roteiro", 1, { data_aula: "2026-08-03" }), false)],
      HOJE,
    );
    assert.equal(p.length, 1);
    assert.equal(p[0].diasAtras, 10);
  });

  it("ignora aula futura — ainda nao aconteceu", () => {
    const p = aulasPendentesDeChamada(
      [comStatus(aula("r1", "Roteiro", 1, { data_aula: "2026-09-01" }), false)],
      HOJE,
    );
    assert.deepEqual(p, []);
  });

  it("ignora aula ja fechada", () => {
    const p = aulasPendentesDeChamada(
      [comStatus(aula("r1", "Roteiro", 1, { data_aula: "2026-08-03" }), true)],
      HOJE,
    );
    assert.deepEqual(p, []);
  });

  it("aula de hoje ja conta como pendente", () => {
    const p = aulasPendentesDeChamada(
      [comStatus(aula("r1", "Roteiro", 1, { data_aula: HOJE }), false)],
      HOJE,
    );
    assert.equal(p.length, 1);
    assert.equal(p[0].diasAtras, 0);
  });

  it("aula sem data nao vira pendencia", () => {
    const p = aulasPendentesDeChamada(
      [comStatus(aula("r1", "Roteiro", 1, { data_aula: null }), false)],
      HOJE,
    );
    assert.deepEqual(p, []);
  });

  it("a mais antiga vem primeiro — e a que ninguem vai lembrar", () => {
    const p = aulasPendentesDeChamada(
      [
        comStatus(aula("r2", "Roteiro", 2, { data_aula: "2026-08-10" }), false),
        comStatus(aula("r1", "Roteiro", 1, { data_aula: "2026-08-03" }), false),
      ],
      HOJE,
    );
    assert.deepEqual(p.map(x => x.data), ["2026-08-03", "2026-08-10"]);
  });
});

describe("limparParaCSV", () => {
  it("tira o que quebraria a coluna", () => {
    assert.equal(limparParaCSV("Aula de roteiro; parte 2\nexercicio"), "Aula de roteiro parte 2 exercicio");
    assert.equal(limparParaCSV(null), "");
    assert.equal(limparParaCSV("  texto  "), "texto");
  });
});
