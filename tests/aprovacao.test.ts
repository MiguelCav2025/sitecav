import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarSemestre,
  avaliarDisciplina,
  arredondar,
  NOTA_MINIMA,
  PRESENCA_MINIMA,
  type DesempenhoDisciplina,
} from "../src/lib/aprovacao.ts";

/** Monta uma disciplina já com nota final coerente, como a view devolve. */
function disciplina(
  nome: string,
  { professor = 8, banca = 8, aulas = 10, presencas = 10, modulo = 2 }: Partial<{
    professor: number | null; banca: number | null;
    aulas: number | null; presencas: number | null; modulo: number;
  }> = {},
): DesempenhoDisciplina {
  // Reproduz o que a view faz: no 1º módulo não há banca, e a final é a do
  // professor; do 2º em diante, é a média com a banca.
  const semBanca = modulo === 1;
  const bancaEfetiva = semBanca ? null : banca;
  const final = semBanca
    ? professor
    : professor !== null && banca !== null
      ? Math.round(((professor + banca) / 2) * 100) / 100
      : null;

  return {
    disciplina_id: nome,
    disciplina: nome,
    semestre_do_curso: modulo,
    nota_professor: professor,
    nota_banca: bancaEfetiva,
    nota_final: final,
    aulas_dadas: aulas,
    presencas,
  };
}

describe("arredondar", () => {
  test("arredonda para uma casa por padrao", () => {
    assert.equal(arredondar(6.95), 7);
    assert.equal(arredondar(5.94), 5.9);
    assert.equal(arredondar(5.95), 6);
  });
});

describe("aprovado", () => {
  test("nota e frequencia acima do minimo em todas as disciplinas", () => {
    const r = avaliarSemestre([disciplina("Roteiro"), disciplina("Direção")]);
    assert.equal(r.situacao, "aprovado");
    assert.equal(r.presencaGeral, 100);
    assert.deepEqual(r.reprovadasPorNota, []);
  });

  test("exatamente no limite de nota e de presenca aprova", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { professor: 6, banca: 6, aulas: 10, presencas: 7 }),
    ]);
    assert.equal(r.situacao, "aprovado");
    assert.equal(r.presencaGeral, PRESENCA_MINIMA);
  });

  test("o arredondamento pode salvar o aluno (N18)", () => {
    // (6.5 + 5.4) / 2 = 5.95 -> arredondado para 6.0
    const r = avaliarSemestre([disciplina("Roteiro", { professor: 6.5, banca: 5.4 })]);
    assert.equal(r.situacao, "aprovado");
  });
});

describe("retido", () => {
  test("basta ficar abaixo da nota em UMA disciplina (N21)", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro"),
      disciplina("Direção", { professor: 4, banca: 4 }),
      disciplina("Montagem"),
    ]);
    assert.equal(r.situacao, "retido");
    assert.deepEqual(r.reprovadasPorNota, ["Direção"]);
    assert.ok(r.motivos[0].includes("Direção"));
  });

  test("frequencia abaixo de 70% retem, mesmo com notas boas", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 6 }),
      disciplina("Direção", { aulas: 10, presencas: 7 }),
    ]);
    assert.equal(r.situacao, "retido");
    assert.deepEqual(r.reprovadasPorFrequencia, [{ disciplina: "Roteiro", percentual: 60 }]);
    assert.ok(r.motivos.some(m => m.includes("Frequência")));
  });

  test("a frequencia e exigida EM CADA disciplina, nao na media (N22)", () => {
    // 4/10 numa e 10/10 na outra da 70% somados — mas a regra e por
    // disciplina, entao Roteiro reprova o aluno com 40%.
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 4 }),
      disciplina("Direção", { aulas: 10, presencas: 10 }),
    ]);
    assert.equal(r.presencaGeral, 70, "a soma continua sendo informada");
    assert.equal(r.situacao, "retido");
    assert.deepEqual(r.reprovadasPorFrequencia, [{ disciplina: "Roteiro", percentual: 40 }]);
  });

  test("uma disciplina no limite exato de 70% nao reprova", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 7 }),
      disciplina("Direção", { aulas: 10, presencas: 10 }),
    ]);
    assert.equal(r.situacao, "aprovado");
    assert.deepEqual(r.reprovadasPorFrequencia, []);
  });

  test("lista todas as disciplinas com frequencia insuficiente", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 3 }),
      disciplina("Direção", { aulas: 10, presencas: 5 }),
      disciplina("Montagem", { aulas: 10, presencas: 9 }),
    ]);
    assert.deepEqual(r.reprovadasPorFrequencia.map(f => f.disciplina), ["Roteiro", "Direção"]);
  });

  test("reprova mesmo com outra disciplina pendente", () => {
    // Ja ficou abaixo em Direcao: nao ha o que esperar
    const r = avaliarSemestre([
      disciplina("Direção", { professor: 3, banca: 3 }),
      disciplina("Roteiro", { professor: null }),
    ]);
    assert.equal(r.situacao, "retido");
    assert.ok(r.pendencias.length > 0, "a pendencia continua sendo reportada");
  });

  test("nota abaixo e presenca abaixo: ambos os motivos aparecem", () => {
    const r = avaliarSemestre([disciplina("Roteiro", { professor: 2, banca: 2, aulas: 10, presencas: 2 })]);
    assert.equal(r.situacao, "retido");
    assert.equal(r.motivos.length, 2);
  });
});

describe("indefinido", () => {
  test("professor ainda nao lancou a nota", () => {
    const r = avaliarSemestre([disciplina("Roteiro"), disciplina("Direção", { professor: null })]);
    assert.equal(r.situacao, "indefinido");
    assert.ok(r.pendencias[0].includes("professor ainda não lançou"));
  });

  test("banca ainda nao avaliou o grupo", () => {
    const r = avaliarSemestre([disciplina("Roteiro", { banca: null })]);
    assert.equal(r.situacao, "indefinido");
    assert.ok(r.pendencias[0].includes("banca"));
  });

  test("aluno sem grupo nao leva zero: fica pendente (N20)", () => {
    // Sem grupo, a view devolve nota_banca null. Transformar isso em zero
    // reprovaria o aluno por esquecimento administrativo.
    const r = avaliarSemestre([disciplina("Roteiro", { professor: 9, banca: null })]);
    assert.equal(r.situacao, "indefinido");
    assert.deepEqual(r.reprovadasPorNota, []);
  });

  test("nenhuma chamada fechada ainda", () => {
    const r = avaliarSemestre([disciplina("Roteiro", { aulas: 0, presencas: 0 })]);
    assert.equal(r.situacao, "indefinido");
    assert.equal(r.presencaGeral, null);
    assert.ok(r.pendencias.some(p => p.includes("chamada")));
  });

  test("disciplina sem chamada nao conta na frequencia das outras", () => {
    // A disciplina sem aula dada vira pendencia; a outra e avaliada normalmente
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 10 }),
      disciplina("Direção", { aulas: 0, presencas: 0 }),
    ]);
    assert.equal(r.situacao, "indefinido");
    assert.equal(r.presencaGeral, 100, "so as aulas efetivamente dadas entram na conta");
    assert.deepEqual(r.reprovadasPorFrequencia, []);
  });

  test("semestre sem disciplina alguma", () => {
    const r = avaliarSemestre([]);
    assert.equal(r.situacao, "indefinido");
    assert.equal(r.presencaGeral, null);
  });
});

describe("avaliarDisciplina — o veredito de cada materia", () => {
  test("aprovado na materia: nota e frequencia em dia", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 8, banca: 7, aulas: 10, presencas: 9 }));
    assert.equal(r.situacao, "aprovado");
    assert.equal(r.notaFinal, 7.5);
    assert.equal(r.percentual, 90);
  });

  test("retido na materia so pela nota", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 4, banca: 4, aulas: 10, presencas: 10 }));
    assert.equal(r.situacao, "retido");
    assert.ok(r.motivos.some(m => m.includes("abaixo de 6")));
  });

  test("retido na materia so pela frequencia", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 9, banca: 9, aulas: 10, presencas: 5 }));
    assert.equal(r.situacao, "retido");
    assert.equal(r.percentual, 50);
    assert.ok(r.motivos.some(m => m.includes("Frequência")));
  });

  test("indefinida enquanto falta a banca", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { banca: null }));
    assert.equal(r.situacao, "indefinido");
    assert.equal(r.notaFinal, null);
  });

  test("nota baixa vence pendencia de frequencia", () => {
    // Ja esta abaixo da nota; nenhuma chamada futura reverte isso
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 2, banca: 2, aulas: 0, presencas: 0 }));
    assert.equal(r.situacao, "retido");
  });
});

describe("os dois niveis se encaixam", () => {
  test("cada disciplina tem seu veredito e o semestre agrega", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { professor: 8, banca: 8, aulas: 10, presencas: 10 }),
      disciplina("Direção", { professor: 4, banca: 4, aulas: 10, presencas: 10 }),
      disciplina("Montagem", { professor: 9, banca: null }),
    ]);

    assert.deepEqual(
      r.disciplinas.map(d => [d.disciplina, d.situacao]),
      [["Roteiro", "aprovado"], ["Direção", "retido"], ["Montagem", "indefinido"]],
    );
    // Passou numa, reprovou noutra, falta a terceira: o semestre esta retido
    assert.equal(r.situacao, "retido");
  });

  test("aprovado no semestre exige aprovacao em todas", () => {
    const r = avaliarSemestre([disciplina("Roteiro"), disciplina("Direção")]);
    assert.ok(r.disciplinas.every(d => d.situacao === "aprovado"));
    assert.equal(r.situacao, "aprovado");
  });

  test("uma pendente segura o semestre, mas nao as aprovadas", () => {
    const r = avaliarSemestre([disciplina("Roteiro"), disciplina("Direção", { professor: null })]);
    assert.equal(r.disciplinas[0].situacao, "aprovado");
    assert.equal(r.disciplinas[1].situacao, "indefinido");
    assert.equal(r.situacao, "indefinido");
  });
});

describe("1o modulo nao tem banca", () => {
  test("a nota final e a do professor, sem media", () => {
    const r = avaliarDisciplina(disciplina("Fundamentos de Desenho", { professor: 7, modulo: 1 }));
    assert.equal(r.notaFinal, 7);
    assert.equal(r.notaBanca, null);
    assert.equal(r.situacao, "aprovado");
  });

  test("banca ausente NAO e pendencia no 1o modulo", () => {
    // Se fosse, a turma de entrada inteira ficaria travada
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 8, banca: null, modulo: 1 }));
    assert.equal(r.situacao, "aprovado");
    assert.ok(!r.motivos.some(m => m.includes("banca")));
  });

  test("no 1o modulo a nota do professor sozinha pode reprovar", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 4, modulo: 1 }));
    assert.equal(r.situacao, "retido");
    assert.equal(r.notaFinal, 4);
  });

  test("do 2o modulo em diante a banca continua obrigatoria", () => {
    const r = avaliarDisciplina(disciplina("Roteiro", { professor: 8, banca: null, modulo: 2 }));
    assert.equal(r.situacao, "indefinido");
    assert.ok(r.motivos.some(m => m.includes("banca")));
  });

  test("semestre inteiro de 1o modulo fecha sem banca", () => {
    const r = avaliarSemestre([
      disciplina("Fundamentos de Desenho", { professor: 7, modulo: 1 }),
      disciplina("Animação Tradicional", { professor: 8, modulo: 1 }),
    ]);
    assert.equal(r.situacao, "aprovado");
    assert.deepEqual(r.pendencias, []);
  });
});

describe("constantes da regra", () => {
  test("os limites sao os combinados", () => {
    assert.equal(NOTA_MINIMA, 6);
    assert.equal(PRESENCA_MINIMA, 70);
  });
});
