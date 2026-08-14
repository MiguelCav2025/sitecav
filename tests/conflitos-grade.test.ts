import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conflitosDeSala,
  descreverConflito,
  nomeDoDia,
  type DisciplinaNaGrade,
} from "../src/lib/conflitos-grade.ts";

const disc = (
  id: string, nome: string, over: Partial<DisciplinaNaGrade> = {},
): DisciplinaNaGrade => ({
  id, nome, curso: "Animação", modulo: 1,
  dia_da_semana: 1, sala_id: "s1", sala: "Digital 1",
  turnos: ["Manhã", "Noite"],
  ...over,
});

describe("conflitosDeSala", () => {
  it("acusa duas disciplinas na mesma sala, dia e turno", () => {
    const c = conflitosDeSala([disc("a", "Roteiro"), disc("b", "Desenho")]);
    assert.equal(c.length, 2, "uma por turno: manhã e noite");
    assert.deepEqual(c[0].disciplinas.map(d => d.nome), ["Desenho", "Roteiro"]);
  });

  it("salas diferentes no mesmo dia nao colidem", () => {
    const c = conflitosDeSala([disc("a", "Roteiro"), disc("b", "Desenho", { sala_id: "s2" })]);
    assert.deepEqual(c, []);
  });

  it("mesma sala em dias diferentes nao colide", () => {
    const c = conflitosDeSala([disc("a", "Roteiro"), disc("b", "Desenho", { dia_da_semana: 2 })]);
    assert.deepEqual(c, []);
  });

  it("turnos diferentes na mesma sala e dia nao colidem", () => {
    // Uma de manha e outra a noite dividem a sala sem se encontrar.
    const c = conflitosDeSala([
      disc("a", "Roteiro", { turnos: ["Manhã"] }),
      disc("b", "Desenho", { turnos: ["Noite"] }),
    ]);
    assert.deepEqual(c, []);
  });

  it("disciplina sem sala ou sem dia nao entra", () => {
    assert.deepEqual(
      conflitosDeSala([disc("a", "Roteiro", { sala_id: null }), disc("b", "Desenho", { sala_id: null })]),
      [],
    );
    assert.deepEqual(
      conflitosDeSala([disc("a", "Roteiro", { dia_da_semana: null }), disc("b", "Desenho", { dia_da_semana: null })]),
      [],
    );
  });

  it("tres na mesma sala viram um conflito com as tres, nao tres conflitos", () => {
    const c = conflitosDeSala([
      disc("a", "Roteiro", { turnos: ["Manhã"] }),
      disc("b", "Desenho", { turnos: ["Manhã"] }),
      disc("c", "Som", { turnos: ["Manhã"] }),
    ]);
    assert.equal(c.length, 1);
    assert.equal(c[0].disciplinas.length, 3);
  });

  it("a grade real do CAV nao tem conflito nenhum", () => {
    // Cada dia da semana tem uma disciplina por sala, por curso e modulo.
    const grade: DisciplinaNaGrade[] = [];
    let sala = 0;
    for (const dia of [1, 2, 3, 4, 5]) {
      for (const modulo of [1, 2, 3]) {
        grade.push(disc(`d${dia}${modulo}`, `Materia ${dia}-${modulo}`, {
          dia_da_semana: dia, modulo, sala_id: `s${sala++}`,
        }));
      }
    }
    assert.deepEqual(conflitosDeSala(grade), []);
  });
});

describe("descreverConflito", () => {
  it("diz o problema inteiro numa frase", () => {
    const [c] = conflitosDeSala([
      disc("a", "Roteiro", { turnos: ["Manhã"] }),
      disc("b", "Desenho", { turnos: ["Manhã"], modulo: 2 }),
    ]);
    assert.equal(
      descreverConflito(c),
      "Digital 1, segunda de manhã: Desenho (Animação, módulo 2) e Roteiro (Animação, módulo 1).",
    );
  });
});

describe("nomeDoDia", () => {
  it("traduz os dias letivos", () => {
    assert.equal(nomeDoDia(1), "segunda");
    assert.equal(nomeDoDia(5), "sexta");
  });
});
