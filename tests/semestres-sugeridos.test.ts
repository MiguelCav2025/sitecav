import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  semestresSugeridos,
  primeiraSegunda,
  ultimaSexta,
} from "../src/lib/semestres-sugeridos.ts";

describe("primeiraSegunda / ultimaSexta", () => {
  it("acham o dia certo", () => {
    // 03/08/2026 e uma segunda — e foi o inicio real do 2026/2.
    assert.equal(primeiraSegunda(2026, 8), "2026-08-03");
    assert.equal(primeiraSegunda(2026, 3), "2026-03-02");
    assert.equal(ultimaSexta(2026, 6), "2026-06-26");
  });

  it("o que devolvem cai mesmo no dia da semana prometido", () => {
    for (let ano = 2026; ano <= 2032; ano++) {
      for (const mes of [3, 6, 8, 12]) {
        const seg = primeiraSegunda(ano, mes).split("-").map(Number);
        const sex = ultimaSexta(ano, mes).split("-").map(Number);
        assert.equal(new Date(Date.UTC(seg[0], seg[1] - 1, seg[2])).getUTCDay(), 1, `seg ${ano}/${mes}`);
        assert.equal(new Date(Date.UTC(sex[0], sex[1] - 1, sex[2])).getUTCDay(), 5, `sex ${ano}/${mes}`);
      }
    }
  });
});

describe("semestresSugeridos", () => {
  const HOJE = "2026-08-13";

  it("comeca pelo semestre em curso, nao pelo ano que vem", () => {
    const s = semestresSugeridos(HOJE, 4);
    assert.deepEqual(s.map(x => x.semestre), ["2026/2", "2027/1", "2027/2", "2028/1"]);
  });

  it("em marco, o semestre em curso e o primeiro", () => {
    const s = semestresSugeridos("2026-03-20", 3);
    assert.deepEqual(s.map(x => x.semestre), ["2026/1", "2026/2", "2027/1"]);
  });

  it("nao propoe o que ja esta cadastrado", () => {
    const s = semestresSugeridos(HOJE, 3, ["2026/2", "2027/1"]);
    assert.deepEqual(s.map(x => x.semestre), ["2027/2", "2028/1", "2028/2"]);
  });

  it("acerta a janela do 2026/2 real do CAV", () => {
    // O coordenador cadastrou 03/08 a 14/12. A sugestao tem que cair perto,
    // senao ela atrapalha mais do que ajuda.
    const [s] = semestresSugeridos(HOJE, 1);
    assert.equal(s.data_inicio, "2026-08-03");
    assert.equal(s.data_fim, "2026-12-14");
  });

  it("ja vem com os feriados do periodo", () => {
    const [s] = semestresSugeridos(HOJE, 1);
    assert.deepEqual(s.feriados, [
      "2026-08-20", "2026-09-07", "2026-10-12", "2026-10-28", "2026-11-02", "2026-11-20",
    ]);
    assert.equal(s.feriadosConhecidos, 6);
  });

  it("o 2o semestre nunca invade o Natal", () => {
    for (let ano = 2026; ano <= 2035; ano++) {
      const s = semestresSugeridos(`${ano}-08-01`, 1)[0];
      assert.ok(s.data_fim < `${ano}-12-20`, `${ano}: terminaria em ${s.data_fim}`);
    }
  });

  it("todo semestre proposto comeca antes de terminar", () => {
    for (const s of semestresSugeridos(HOJE, 8)) {
      assert.ok(s.data_inicio < s.data_fim, `${s.semestre}: ${s.data_inicio} a ${s.data_fim}`);
    }
  });

  it("nao entra em laco quando tudo ja existe", () => {
    const todos = semestresSugeridos(HOJE, 6).map(s => s.semestre);
    assert.deepEqual(semestresSugeridos(HOJE, 3, todos).length, 3, "deve pular para os seguintes");
  });
});
