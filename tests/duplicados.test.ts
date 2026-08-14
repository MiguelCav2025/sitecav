import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarNome,
  procurarParecidos,
  repetidosNaLista,
} from "../src/lib/duplicados.ts";

const alunos = [
  { id: "1", nome: "João da Silva" },
  { id: "2", nome: "Maria Souza" },
  { id: "3", nome: "Ana Paula Ferreira" },
];

describe("normalizarNome", () => {
  it("tira acento, caixa e espaco sobrando", () => {
    assert.equal(normalizarNome("  JOÃO   da SILVA "), "joao da silva");
    assert.equal(normalizarNome("Ana Paula"), "ana paula");
  });
});

describe("procurarParecidos", () => {
  it("acha o nome identico, ignorando acento e caixa", () => {
    const p = procurarParecidos("joao da silva", alunos);
    assert.equal(p.length, 1);
    assert.equal(p[0].como, "exato");
    assert.equal(p[0].candidato.id, "1");
  });

  it("acha quem so mudou a particula do meio", () => {
    // "João da Silva" e "João Silva" sao a mesma pessoa escrita de dois jeitos.
    const p = procurarParecidos("João Silva", alunos);
    assert.equal(p.length, 1);
    assert.equal(p[0].como, "pontas");
  });

  it("acha quem perdeu o nome do meio", () => {
    const p = procurarParecidos("Ana Ferreira", alunos);
    assert.equal(p[0]?.candidato.id, "3");
  });

  it("nao confunde pessoas diferentes com nome parecido", () => {
    // Sem distancia de edicao de proposito: um alarme que dispara a toa
    // e ignorado no terceiro aluno.
    assert.deepEqual(procurarParecidos("Ana Souza", alunos), []);
    assert.deepEqual(procurarParecidos("Joana da Silva", alunos), []);
    assert.deepEqual(procurarParecidos("Maria Souzas", alunos), []);
  });

  it("nome vazio nao acha nada", () => {
    assert.deepEqual(procurarParecidos("", alunos), []);
    assert.deepEqual(procurarParecidos("   ", alunos), []);
  });

  it("o identico vem antes do parecido", () => {
    const lista = [{ id: "a", nome: "João Silva" }, { id: "b", nome: "João da Silva" }];
    const p = procurarParecidos("João da Silva", lista);
    assert.equal(p[0].candidato.id, "b", "o exato primeiro");
    assert.equal(p.length, 2);
  });

  it("primeiro nome sozinho ainda casa consigo mesmo", () => {
    assert.equal(procurarParecidos("Madonna", [{ id: "x", nome: "Madonna" }]).length, 1);
  });
});

describe("repetidosNaLista", () => {
  it("acusa o mesmo nome digitado duas vezes na mesma leva", () => {
    assert.deepEqual(repetidosNaLista(["Ana", "Bruno", "ana"]), ["ana"]);
  });

  it("lista limpa nao acusa nada", () => {
    assert.deepEqual(repetidosNaLista(["Ana", "Bruno"]), []);
  });

  it("linha vazia nao conta como repetida", () => {
    assert.deepEqual(repetidosNaLista(["", "  ", "Ana"]), []);
  });
});
