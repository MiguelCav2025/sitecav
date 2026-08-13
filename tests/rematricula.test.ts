import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  somarSemestres,
  turmaDaRepeticao,
  retidosAguardandoRematricula,
  type TurmaSimples,
  type MatriculaHistorica,
} from "../src/lib/rematricula.ts";

const turma = (id: string, curso: string, turno: string, entrada: string, ativa = true): TurmaSimples =>
  ({ id, nome: `${curso} ${turno} ${entrada}`, curso, turno, entrada, ativa });

// O quadro real do CAV hoje.
const TURMAS = [
  turma("t1", "Cine/TV", "Noite", "2025/2"),
  turma("t2", "Cine/TV", "Noite", "2026/1"),
  turma("t3", "Cine/TV", "Noite", "2026/2"),
  turma("t4", "Cine/TV", "Manhã", "2026/2"),
  turma("t5", "Animação", "Noite", "2026/2"),
];

describe("somarSemestres", () => {
  it("vira o ano ao passar do segundo semestre", () => {
    assert.equal(somarSemestres("2026/1", 1), "2026/2");
    assert.equal(somarSemestres("2026/2", 1), "2027/1");
    assert.equal(somarSemestres("2026/1", 2), "2027/1");
  });

  it("anda para tras tambem", () => {
    assert.equal(somarSemestres("2027/1", -1), "2026/2");
  });

  it("recusa entrada invalida", () => {
    assert.equal(somarSemestres("lixo", 1), null);
    assert.equal(somarSemestres("", 1), null);
  });
});

describe("turmaDaRepeticao", () => {
  it("manda para a turma que entrou um semestre depois", () => {
    // Quem repete o modulo 2 na turma 2026/1 vai para a 2026/2, porque e ela
    // que estara no modulo 2 quando ele recomecar.
    const destino = turmaDaRepeticao(TURMAS[1], TURMAS);
    assert.equal(destino?.id, "t3");
  });

  it("nao troca de curso nem de turno", () => {
    const destino = turmaDaRepeticao(turma("x", "Animação", "Manhã", "2026/1"), TURMAS);
    assert.equal(destino, null, "nao existe Animação Manhã 2026/2 — e nao vale pegar outra");
  });

  it("devolve null quando a turma seguinte ainda nao existe", () => {
    // A turma mais nova nao tem para onde mandar: a proxima so nasce depois do
    // processo seletivo. Null aqui quer dizer "espere", nao "erro".
    assert.equal(turmaDaRepeticao(TURMAS[2], TURMAS), null);
  });

  it("ignora turma desativada", () => {
    const comInativa = [turma("t1", "Cine/TV", "Noite", "2025/2"), turma("t2", "Cine/TV", "Noite", "2026/1", false)];
    assert.equal(turmaDaRepeticao(comInativa[0], comInativa), null);
  });

  it("nunca devolve a propria turma de origem", () => {
    const mesma = [turma("t9", "Cine/TV", "Noite", "2026/1")];
    assert.equal(turmaDaRepeticao(mesma[0], mesma), null);
  });
});

describe("retidosAguardandoRematricula", () => {
  const m = (id: string, alunoId: string, aluno: string, situacao: string, modulo = 2): MatriculaHistorica =>
    ({ id, alunoId, aluno, turmaId: "t2", modulo, situacao });

  it("lista quem foi retido e nao tem matricula ativa", () => {
    const r = retidosAguardandoRematricula([
      m("m1", "a1", "Bruno", "retido"),
      m("m2", "a2", "Ana", "aprovado"),
    ]);
    assert.deepEqual(r.map(x => x.aluno), ["Bruno"]);
  });

  it("some da lista assim que ele volta a cursar", () => {
    // O estado e derivado da ausencia de matricula ativa: nao ha flag para
    // alguem esquecer de baixar depois de rematricular.
    const r = retidosAguardandoRematricula([
      m("m1", "a1", "Bruno", "retido"),
      m("m2", "a1", "Bruno", "cursando"),
    ]);
    assert.deepEqual(r, []);
  });

  it("desistente nao entra — ele saiu, nao repetiu", () => {
    const r = retidosAguardandoRematricula([m("m1", "a1", "Bruno", "desistente")]);
    assert.deepEqual(r, []);
  });

  it("retido duas vezes aparece uma vez so", () => {
    const r = retidosAguardandoRematricula([
      m("m1", "a1", "Bruno", "retido", 1),
      m("m2", "a1", "Bruno", "retido", 2),
    ]);
    assert.equal(r.length, 1);
    assert.equal(r[0].modulo, 2, "vale a retencao mais recente");
  });

  it("ordena por nome, com acento", () => {
    const r = retidosAguardandoRematricula([
      m("m1", "a1", "Zeca", "retido"),
      m("m2", "a2", "Ávila", "retido"),
    ]);
    assert.deepEqual(r.map(x => x.aluno), ["Ávila", "Zeca"]);
  });
});
