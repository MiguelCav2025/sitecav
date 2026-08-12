import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { interpretarGabarito, numerosFaltando } from "../src/lib/gabarito.ts";

describe("interpretarGabarito", () => {
  test("le o formato mais comum, um por linha", () => {
    assert.deepEqual(interpretarGabarito("1-A\n2-B\n3-C"), [
      { numero: 1, resposta: "A" },
      { numero: 2, resposta: "B" },
      { numero: 3, resposta: "C" },
    ]);
  });

  test("le tudo numa linha so", () => {
    assert.deepEqual(interpretarGabarito("1-A, 2-B, 3-C"), [
      { numero: 1, resposta: "A" },
      { numero: 2, resposta: "B" },
      { numero: 3, resposta: "C" },
    ]);
  });

  test("aceita separadores misturados", () => {
    assert.deepEqual(interpretarGabarito("1. A; 2) B\n3 - C\n4: D"), [
      { numero: 1, resposta: "A" },
      { numero: 2, resposta: "B" },
      { numero: 3, resposta: "C" },
      { numero: 4, resposta: "D" },
    ]);
  });

  test("aceita resposta por extenso", () => {
    assert.deepEqual(interpretarGabarito("12 - Todas as anteriores"), [
      { numero: 12, resposta: "Todas as anteriores" },
    ]);
  });

  test("ordena por numero", () => {
    assert.deepEqual(interpretarGabarito("10-A\n2-B"), [
      { numero: 2, resposta: "B" },
      { numero: 10, resposta: "A" },
    ]);
  });

  test("numero repetido: vale o ultimo", () => {
    assert.deepEqual(interpretarGabarito("1-A\n1-D"), [{ numero: 1, resposta: "D" }]);
  });

  test("ignora titulos, lixo e linhas vazias", () => {
    assert.deepEqual(interpretarGabarito("\nGABARITO OFICIAL\n\n1-A\n   \n2-B\n"), [
      { numero: 1, resposta: "A" },
      { numero: 2, resposta: "B" },
    ]);
  });

  test("preserva maiuscula e minuscula como vieram", () => {
    assert.deepEqual(interpretarGabarito("1-a\n2-B"), [
      { numero: 1, resposta: "a" },
      { numero: 2, resposta: "B" },
    ]);
  });

  test("texto vazio nao quebra", () => {
    assert.deepEqual(interpretarGabarito(""), []);
    assert.deepEqual(interpretarGabarito("   \n  "), []);
  });

  test("numero sem resposta e descartado", () => {
    assert.deepEqual(interpretarGabarito("1-\n2-B"), [{ numero: 2, resposta: "B" }]);
  });

  test("ignora numeracao comecando em zero", () => {
    assert.deepEqual(interpretarGabarito("0-A\n1-B"), [{ numero: 1, resposta: "B" }]);
  });
});

describe("numerosFaltando", () => {
  test("aponta os buracos na sequencia", () => {
    assert.deepEqual(
      numerosFaltando([
        { numero: 1, resposta: "A" },
        { numero: 4, resposta: "B" },
      ]),
      [2, 3],
    );
  });

  test("sequencia completa nao tem buraco", () => {
    assert.deepEqual(
      numerosFaltando([
        { numero: 1, resposta: "A" },
        { numero: 2, resposta: "B" },
      ]),
      [],
    );
  });

  test("lista vazia nao tem buraco", () => {
    assert.deepEqual(numerosFaltando([]), []);
  });

  test("comecar do 3 acusa o 1 e o 2 faltando", () => {
    assert.deepEqual(numerosFaltando([{ numero: 3, resposta: "C" }]), [1, 2]);
  });
});
