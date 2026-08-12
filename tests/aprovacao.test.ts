import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarSemestre,
  arredondar,
  NOTA_MINIMA,
  PRESENCA_MINIMA,
  type DesempenhoDisciplina,
} from "../src/lib/aprovacao.ts";

/** Monta uma disciplina já com nota final coerente, como a view devolve. */
function disciplina(
  nome: string,
  { professor = 8, banca = 8, aulas = 10, presencas = 10 }: Partial<{
    professor: number | null; banca: number | null; aulas: number | null; presencas: number | null;
  }> = {},
): DesempenhoDisciplina {
  const final = professor !== null && banca !== null
    ? Math.round(((professor + banca) / 2) * 100) / 100
    : null;
  return {
    disciplina_id: nome,
    disciplina: nome,
    nota_professor: professor,
    nota_banca: banca,
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

  test("frequencia geral abaixo de 70% retem, mesmo com notas boas", () => {
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 6 }),
      disciplina("Direção", { aulas: 10, presencas: 7 }),
    ]);
    assert.equal(r.situacao, "retido");
    assert.equal(r.presencaGeral, 65);
    assert.ok(r.motivos.some(m => m.includes("Frequência")));
  });

  test("a frequencia e somada no semestre, nao exigida disciplina a disciplina", () => {
    // 4/10 numa e 10/10 na outra = 14/20 = 70%, que passa
    const r = avaliarSemestre([
      disciplina("Roteiro", { aulas: 10, presencas: 4 }),
      disciplina("Direção", { aulas: 10, presencas: 10 }),
    ]);
    assert.equal(r.presencaGeral, 70);
    assert.equal(r.situacao, "aprovado");
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

  test("semestre sem disciplina alguma", () => {
    const r = avaliarSemestre([]);
    assert.equal(r.situacao, "indefinido");
    assert.equal(r.presencaGeral, null);
  });
});

describe("constantes da regra", () => {
  test("os limites sao os combinados", () => {
    assert.equal(NOTA_MINIMA, 6);
    assert.equal(PRESENCA_MINIMA, 70);
  });
});
