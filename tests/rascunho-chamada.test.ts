import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  salvarRascunho,
  lerRascunho,
  limparRascunho,
  mesclarPresencas,
  pendentes,
} from "../src/lib/rascunho-chamada.ts";

/** localStorage de mentira: o node --test não roda num navegador. */
class StorageFalso {
  private dados = new Map<string, string>();
  getItem(k: string) { return this.dados.get(k) ?? null; }
  setItem(k: string, v: string) { this.dados.set(k, v); }
  removeItem(k: string) { this.dados.delete(k); }
  clear() { this.dados.clear(); }
  get length() { return this.dados.size; }
  key(i: number) { return [...this.dados.keys()][i] ?? null; }
}

const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

beforeEach(() => storage.clear());

describe("salvar e ler rascunho", () => {
  it("devolve o que foi guardado", () => {
    salvarRascunho("a1", { aluno1: true, aluno2: false }, "Exercício de bouncing ball");
    const r = lerRascunho("a1");
    assert.deepEqual(r?.presencas, { aluno1: true, aluno2: false });
    assert.equal(r?.conteudo, "Exercício de bouncing ball");
  });

  it("aula sem rascunho devolve null", () => {
    assert.equal(lerRascunho("nao-existe"), null);
  });

  it("nao mistura o rascunho de uma aula com o de outra", () => {
    salvarRascunho("a1", { x: true }, "");
    salvarRascunho("a2", { y: false }, "");
    assert.deepEqual(lerRascunho("a1")?.presencas, { x: true });
    assert.deepEqual(lerRascunho("a2")?.presencas, { y: false });
  });

  it("rascunho vazio se apaga em vez de ficar guardado", () => {
    salvarRascunho("a1", { x: true }, "algo");
    salvarRascunho("a1", {}, "   ");
    assert.equal(lerRascunho("a1"), null);
  });

  it("limparRascunho apaga — a chamada fechada nao pode deixar sobra", () => {
    salvarRascunho("a1", { x: true }, "texto");
    limparRascunho("a1");
    assert.equal(lerRascunho("a1"), null);
  });

  it("rascunho velho e descartado: e de outro semestre", () => {
    salvarRascunho("a1", { x: true }, "");
    const oitoDias = Date.now() + 8 * 86_400_000;
    assert.equal(lerRascunho("a1", oitoDias), null);
  });

  it("rascunho de ontem continua valendo", () => {
    salvarRascunho("a1", { x: true }, "");
    const amanha = Date.now() + 86_400_000;
    assert.ok(lerRascunho("a1", amanha));
  });

  it("JSON corrompido nao quebra a tela — e descartado", () => {
    storage.setItem("cav:chamada:a1", "{isso nao e json");
    assert.equal(lerRascunho("a1"), null);
  });
});

describe("mesclarPresencas", () => {
  it("o rascunho vence, porque e o que ainda nao subiu", () => {
    const servidor = { ana: true, bruno: true };
    const local = { bruno: false };
    assert.deepEqual(mesclarPresencas(servidor, local), { ana: true, bruno: false });
  });

  it("sem rascunho, vale o servidor", () => {
    assert.deepEqual(mesclarPresencas({ ana: true }, undefined), { ana: true });
  });
});

describe("pendentes", () => {
  it("conta os toques que nao chegaram", () => {
    salvarRascunho("a1", { x: true, y: false }, "");
    assert.equal(pendentes(lerRascunho("a1")), 2);
    assert.equal(pendentes(null), 0);
  });
});
