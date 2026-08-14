import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  registrarTentativa,
  limparBaldesVelhos,
  origemDaRequisicao,
  type Balde,
} from "../src/lib/limite-de-taxa.ts";

const LIMITE = { maximo: 3, janelaMs: 60_000 };
const T0 = 1_000_000;

describe("registrarTentativa", () => {
  it("deixa passar ate o limite", () => {
    const b = new Map<string, Balde>();
    for (let i = 1; i <= 3; i++) {
      const r = registrarTentativa(b, "1.2.3.4", LIMITE, T0);
      assert.equal(r.permitido, true, `tentativa ${i}`);
      assert.equal(r.restantes, 3 - i);
    }
  });

  it("barra a partir da quarta e diz quanto esperar", () => {
    const b = new Map<string, Balde>();
    for (let i = 0; i < 3; i++) registrarTentativa(b, "1.2.3.4", LIMITE, T0);
    const r = registrarTentativa(b, "1.2.3.4", LIMITE, T0);
    assert.equal(r.permitido, false);
    assert.equal(r.esperarSegundos, 60);
  });

  it("uma origem nao gasta a cota da outra", () => {
    const b = new Map<string, Balde>();
    for (let i = 0; i < 3; i++) registrarTentativa(b, "1.1.1.1", LIMITE, T0);
    assert.equal(registrarTentativa(b, "2.2.2.2", LIMITE, T0).permitido, true);
  });

  it("a janela desliza: quem esperou volta a passar", () => {
    const b = new Map<string, Balde>();
    for (let i = 0; i < 3; i++) registrarTentativa(b, "1.2.3.4", LIMITE, T0);
    assert.equal(registrarTentativa(b, "1.2.3.4", LIMITE, T0 + 61_000).permitido, true);
  });

  it("janela DESLIZANTE, nao fixa: nao libera o dobro na virada", () => {
    // Com janela fixa, 3 no fim de um periodo + 3 no inicio do seguinte dariam
    // 6 em segundos — que e exatamente o padrao de quem esta abusando.
    const b = new Map<string, Balde>();
    for (let i = 0; i < 3; i++) registrarTentativa(b, "1.2.3.4", LIMITE, T0 + i);
    // Meio segundo depois da "virada" ingenua, ainda dentro da janela real.
    assert.equal(registrarTentativa(b, "1.2.3.4", LIMITE, T0 + 59_000).permitido, false);
  });

  it("o balde nao cresce sem fim", () => {
    const b = new Map<string, Balde>();
    for (let i = 0; i < 50; i++) registrarTentativa(b, "1.2.3.4", LIMITE, T0 + i * 30_000);
    assert.ok(b.get("1.2.3.4")!.tentativas.length <= LIMITE.maximo);
  });
});

describe("limparBaldesVelhos", () => {
  it("remove quem esvaziou — senao um ataque com IPs variados vira vazamento", () => {
    const b = new Map<string, Balde>();
    registrarTentativa(b, "antigo", LIMITE, T0);
    registrarTentativa(b, "recente", LIMITE, T0 + 120_000);
    assert.equal(limparBaldesVelhos(b, LIMITE.janelaMs, T0 + 120_000), 1);
    assert.deepEqual([...b.keys()], ["recente"]);
  });
});

describe("origemDaRequisicao", () => {
  it("pega o cliente, nao o proxy", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" });
    assert.equal(origemDaRequisicao(h), "203.0.113.9");
  });

  it("cai no x-real-ip quando nao ha lista", () => {
    assert.equal(origemDaRequisicao(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  });

  it("sem cabecalho nenhum, nao quebra", () => {
    assert.equal(origemDaRequisicao(new Headers()), "desconhecido");
  });
});
