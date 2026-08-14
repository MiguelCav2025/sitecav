import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  salvarRascunho,
  lerRascunho,
  limparRascunho,
  mesclarPresencas,
  pendentes,
} from "../src/lib/rascunho-chamada.ts";
import type { PresencaNoDia } from "../src/lib/aulas-do-dia.ts";

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
    salvarRascunho("a1", { aluno1: 2, aluno2: 0 }, "Exercício de bouncing ball");
    const r = lerRascunho("a1");
    assert.deepEqual(r?.presencas, { aluno1: 2, aluno2: 0 });
    assert.equal(r?.conteudo, "Exercício de bouncing ball");
  });

  it("aula sem rascunho devolve null", () => {
    assert.equal(lerRascunho("nao-existe"), null);
  });

  it("nao mistura o rascunho de uma aula com o de outra", () => {
    salvarRascunho("a1", { x: 2 }, "");
    salvarRascunho("a2", { y: 0 }, "");
    assert.deepEqual(lerRascunho("a1")?.presencas, { x: 2 });
    assert.deepEqual(lerRascunho("a2")?.presencas, { y: 0 });
  });

  it("rascunho vazio se apaga em vez de ficar guardado", () => {
    salvarRascunho("a1", { x: 2 }, "algo");
    salvarRascunho("a1", {}, "   ");
    assert.equal(lerRascunho("a1"), null);
  });

  it("limparRascunho apaga — a chamada fechada nao pode deixar sobra", () => {
    salvarRascunho("a1", { x: 2 }, "texto");
    limparRascunho("a1");
    assert.equal(lerRascunho("a1"), null);
  });

  it("rascunho velho e descartado: e de outro semestre", () => {
    salvarRascunho("a1", { x: 2 }, "");
    const oitoDias = Date.now() + 8 * 86_400_000;
    assert.equal(lerRascunho("a1", oitoDias), null);
  });

  it("rascunho de ontem continua valendo", () => {
    salvarRascunho("a1", { x: 2 }, "");
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
    const servidor: Record<string, PresencaNoDia> = { ana: 2, bruno: 2 };
    // No servidor ele estava presente o dia todo; no aparelho, o professor
    // corrigiu para "só a 1ª aula" e a correção não chegou a subir.
    const local: Record<string, PresencaNoDia> = { bruno: 1 };
    assert.deepEqual(mesclarPresencas(servidor, local), { ana: 2, bruno: 1 });
  });

  it("sem rascunho, vale o servidor", () => {
    assert.deepEqual(mesclarPresencas({ ana: 2 }, undefined), { ana: 2 });
  });
});

describe("pendentes", () => {
  it("conta os toques que nao chegaram", () => {
    salvarRascunho("a1", { x: 2, y: 0 }, "");
    assert.equal(pendentes(lerRascunho("a1")), 2);
    assert.equal(pendentes(null), 0);
  });
});
