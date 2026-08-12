import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AREAS,
  TODAS_AS_SECOES,
  SECAO_PADRAO,
  areaDaSecao,
  secaoValida,
} from "../src/lib/admin-navegacao.ts";

describe("estrutura da navegacao", () => {
  test("nenhuma secao repetida entre as areas", () => {
    const valores = TODAS_AS_SECOES.map(s => s.value);
    assert.equal(new Set(valores).size, valores.length, "ha secoes com o mesmo value");
  });

  test("toda area tem pelo menos uma secao", () => {
    for (const a of AREAS) {
      assert.ok(a.secoes.length > 0, `area ${a.value} esta vazia`);
    }
  });

  test("toda secao tem rotulo, ajuda e icone", () => {
    for (const s of TODAS_AS_SECOES) {
      assert.ok(s.label?.trim(), `secao ${s.value} sem rotulo`);
      assert.ok(s.ajuda?.trim(), `secao ${s.value} sem texto de ajuda`);
      assert.ok(s.icone, `secao ${s.value} sem icone`);
    }
  });

  test("a secao padrao existe", () => {
    assert.ok(TODAS_AS_SECOES.some(s => s.value === SECAO_PADRAO));
  });
});

describe("passos da area Escola", () => {
  const escola = AREAS.find(a => a.value === "escola")!;

  test("a area Escola existe", () => {
    assert.ok(escola);
  });

  test("todas as secoes da Escola sao numeradas", () => {
    for (const s of escola.secoes) {
      assert.equal(typeof s.passo, "number", `${s.value} deveria ter passo`);
    }
  });

  test("os passos sao 1..N, sem furo nem repeticao", () => {
    const passos = escola.secoes.map(s => s.passo!);
    assert.deepEqual(passos, Array.from({ length: passos.length }, (_, i) => i + 1));
  });

  test("cronograma vem antes de turmas, que vem antes de disciplinas", () => {
    // A ordem comunica a dependencia real: sem cronograma nao ha datas,
    // sem turma nao ha alunos, sem disciplina nao ha aulas.
    const ordem = escola.secoes.map(s => s.value);
    assert.ok(ordem.indexOf("cronograma") < ordem.indexOf("turmas"));
    assert.ok(ordem.indexOf("turmas") < ordem.indexOf("disciplinas"));
  });

  test("as areas Site e Sistema nao usam numeracao", () => {
    for (const a of AREAS.filter(a => a.value !== "escola")) {
      for (const s of a.secoes) {
        assert.equal(s.passo, undefined, `${s.value} nao deveria ter passo`);
      }
    }
  });
});

describe("areaDaSecao", () => {
  test("encontra a area de cada secao", () => {
    assert.equal(areaDaSecao("banners").value, "site");
    assert.equal(areaDaSecao("turmas").value, "escola");
    assert.equal(areaDaSecao("admin").value, "sistema");
  });

  test("secao desconhecida cai na primeira area, sem quebrar", () => {
    assert.equal(areaDaSecao("nao-existe").value, AREAS[0].value);
  });
});

describe("secaoValida", () => {
  test("mantem uma secao conhecida", () => {
    assert.equal(secaoValida("relatorios"), "relatorios");
  });

  test("troca por padrao o que nao existe ou esta ausente", () => {
    assert.equal(secaoValida("nao-existe"), SECAO_PADRAO);
    assert.equal(secaoValida(null), SECAO_PADRAO);
    assert.equal(secaoValida(undefined), SECAO_PADRAO);
    assert.equal(secaoValida(""), SECAO_PADRAO);
  });
});
