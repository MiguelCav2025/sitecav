import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extrairNomes,
  detectarCurso,
  detectarPeriodo,
} from "../src/app/api/admin/parse-results/extractor.ts";

/**
 * Mesma limpeza que /api/admin/parse-results aplica ao texto vindo do
 * pdf-parse v2, que insere marcadores de pagina no texto extraido.
 */
const limparMarcadoresDePagina = (t: string) =>
  t.replace(/^[ \t]*--[ \t]*\d+[ \t]+of[ \t]+\d+[ \t]*--[ \t]*$/gm, "");

describe("detectarCurso", () => {
  test("reconhece os dois cursos, com e sem acento", () => {
    assert.equal(detectarCurso("Animação"), "Animação");
    assert.equal(detectarCurso("ANIMACAO - MANHA"), "Animação");
    assert.equal(detectarCurso("Cine/TV"), "Cine/TV");
    assert.equal(detectarCurso("curso de cinema e tv"), "Cine/TV");
  });

  test("devolve null quando nao ha curso na linha", () => {
    assert.equal(detectarCurso("Joao da Silva"), null);
  });
});

describe("detectarPeriodo", () => {
  test("reconhece as duas formas de escrever cada periodo", () => {
    assert.equal(detectarPeriodo("Manhã"), "Manhã");
    assert.equal(detectarPeriodo("MATUTINO"), "Manhã");
    assert.equal(detectarPeriodo("Noite"), "Noite");
    assert.equal(detectarPeriodo("noturno"), "Noite");
  });

  test("devolve null quando nao ha periodo na linha", () => {
    assert.equal(detectarPeriodo("Maria Souza"), null);
  });
});

describe("extrairNomes", () => {
  test("separa por curso e periodo", () => {
    const texto = [
      "Animacao - Manha",
      "1. Maria Souza Lima",
      "2. Joao Pedro Alves",
      "Cine/TV - Noite",
      "1. Ana Clara Rocha",
    ].join("\n");

    assert.deepEqual(extrairNomes(texto), [
      { curso: "Animação", periodo: "Manhã", nome: "Maria Souza Lima", ordem: 1 },
      { curso: "Animação", periodo: "Manhã", nome: "Joao Pedro Alves", ordem: 2 },
      { curso: "Cine/TV", periodo: "Noite", nome: "Ana Clara Rocha", ordem: 1 },
    ]);
  });

  test("junta numero e nome quando vem em linhas separadas", () => {
    const texto = ["Animacao - Manha", "01", "Maria Souza Lima", "02", "Joao Pedro Alves"].join("\n");
    const r = extrairNomes(texto);
    assert.equal(r.length, 2);
    assert.equal(r[0].nome, "Maria Souza Lima");
    assert.equal(r[1].nome, "Joao Pedro Alves");
  });

  test("aceita curso e periodo em linhas separadas", () => {
    const texto = ["Animacao", "Manha", "1. Maria Souza Lima"].join("\n");
    assert.deepEqual(extrairNomes(texto), [
      { curso: "Animação", periodo: "Manhã", nome: "Maria Souza Lima", ordem: 1 },
    ]);
  });

  test("ignora cabecalho de tabela", () => {
    const texto = ["Animacao - Manha", "Nº  Nome do Candidato", "1. Maria Souza Lima"].join("\n");
    const r = extrairNomes(texto);
    assert.equal(r.length, 1);
    assert.equal(r[0].nome, "Maria Souza Lima");
  });

  test("descarta nomes antes de qualquer secao", () => {
    const texto = ["Maria Souza Lima", "Animacao - Manha", "1. Ana Clara Rocha"].join("\n");
    const r = extrairNomes(texto);
    assert.equal(r.length, 1);
    assert.equal(r[0].nome, "Ana Clara Rocha");
  });

  test("linha em branco nao encerra a secao", () => {
    const texto = ["Animacao - Manha", "1. Maria Souza Lima", "", "2. Joao Pedro Alves"].join("\n");
    assert.equal(extrairNomes(texto).length, 2);
  });

  test("texto vazio devolve lista vazia", () => {
    assert.deepEqual(extrairNomes(""), []);
  });
});

describe("marcadores de pagina do pdf-parse v2", () => {
  const textoComMarcadores = [
    "Animacao - Manha",
    "1. Maria Souza Lima",
    "",
    "-- 1 of 2 --",
    "",
    "Cine/TV - Noite",
    "1. Ana Clara Rocha",
    "-- 2 of 2 --",
  ].join("\n");

  test("sem limpeza, o marcador vira um aprovado fantasma", () => {
    // Documenta por que a limpeza existe: o extrator aceita "-- 1 of 2 --"
    // como se fosse nome de candidato.
    const fantasmas = extrairNomes(textoComMarcadores).filter(c => c.nome.includes("of"));
    assert.ok(fantasmas.length > 0, "o bug deveria se manifestar sem a limpeza");
  });

  test("com a limpeza, sobram apenas os candidatos reais", () => {
    const r = extrairNomes(limparMarcadoresDePagina(textoComMarcadores));
    assert.deepEqual(r.map(c => c.nome), ["Maria Souza Lima", "Ana Clara Rocha"]);
  });

  test("a limpeza nao remove linhas legitimas parecidas", () => {
    const texto = ["Animacao - Manha", "1. Maria Souza Lima", "2. Ana of Souza Lima"].join("\n");
    const r = extrairNomes(limparMarcadoresDePagina(texto));
    assert.equal(r.length, 2);
  });
});
