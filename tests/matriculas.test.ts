import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { moduloAtualDaTurma } from "../src/lib/matriculas.ts";
import { MODULOS_DO_CURSO } from "../src/lib/calendario-escolar.ts";

/** Semestre letivo vigente, que agora vem do calendario e nao do mes. */
const AGORA = "2026/2";

describe("moduloAtualDaTurma", () => {
  test("nunca passa da duracao do curso", () => {
    // Turma antiga: ja concluiu, mas quem entra agora entra no ultimo semestre
    assert.equal(moduloAtualDaTurma("2015/1", AGORA), MODULOS_DO_CURSO);
  });

  test("nunca fica abaixo de 1", () => {
    // Turma que so comeca no futuro
    assert.equal(moduloAtualDaTurma("2099/1", AGORA), 1);
  });

  test("entrada invalida cai no primeiro modulo", () => {
    assert.equal(moduloAtualDaTurma("", AGORA), 1);
    assert.equal(moduloAtualDaTurma("lixo", AGORA), 1);
  });

  test("sem calendario cadastrado, cai no primeiro modulo em vez de travar", () => {
    // Matricular alguem nao pode depender do calendario estar preenchido: o
    // modulo da matricula e corrigivel depois, a matricula perdida nao.
    assert.equal(moduloAtualDaTurma("2025/2", null), 1);
  });

  test("sempre devolve um modulo valido do curso", () => {
    for (const entrada of ["2015/1", "2024/2", "2026/1", "2099/2", "", "x/y"]) {
      const s = moduloAtualDaTurma(entrada, AGORA);
      assert.ok(
        Number.isInteger(s) && s >= 1 && s <= MODULOS_DO_CURSO,
        `${entrada} devolveu ${s}, fora da faixa 1..${MODULOS_DO_CURSO}`,
      );
    }
  });
});
