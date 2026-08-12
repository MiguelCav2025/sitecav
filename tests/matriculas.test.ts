import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { semestreAtualDaTurma } from "../src/lib/matriculas.ts";
import { SEMESTRES_DO_CURSO } from "../src/lib/calendario-escolar.ts";

describe("semestreAtualDaTurma", () => {
  test("nunca passa da duracao do curso", () => {
    // Turma antiga: ja concluiu, mas quem entra agora entra no ultimo semestre
    assert.equal(semestreAtualDaTurma("2015/1"), SEMESTRES_DO_CURSO);
  });

  test("nunca fica abaixo de 1", () => {
    // Turma que so comeca no futuro
    assert.equal(semestreAtualDaTurma("2099/1"), 1);
  });

  test("entrada invalida cai no primeiro semestre", () => {
    assert.equal(semestreAtualDaTurma(""), 1);
    assert.equal(semestreAtualDaTurma("lixo"), 1);
  });

  test("sempre devolve um semestre valido do curso", () => {
    for (const entrada of ["2015/1", "2024/2", "2026/1", "2099/2", "", "x/y"]) {
      const s = semestreAtualDaTurma(entrada);
      assert.ok(
        Number.isInteger(s) && s >= 1 && s <= SEMESTRES_DO_CURSO,
        `${entrada} devolveu ${s}, fora da faixa 1..${SEMESTRES_DO_CURSO}`,
      );
    }
  });
});
