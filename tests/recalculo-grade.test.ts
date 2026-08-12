import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  planejarRecalculoDaGrade,
  resumirPlano,
  planoVazio,
  type AulaExistente,
} from "../src/lib/recalculo-grade.ts";

// 02/02/2026 e uma segunda-feira. Ate 23/03 ha 8 segundas.
const PERIODO = { data_inicio: "2026-02-02", data_fim: "2026-03-23", feriados: [] as string[] };
const SEGUNDA = 1;

const SEGUNDAS = [
  "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
  "2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23",
];

/** Monta aulas ja alinhadas com o cronograma original. */
function aulasEmDia(quantas: number, fechadasAte = 0): AulaExistente[] {
  return Array.from({ length: quantas }, (_, i) => ({
    id: `aula-${i + 1}`,
    numero: i + 1,
    data_aula: SEGUNDAS[i] ?? null,
    chamada_aberta: i + 1 <= fechadasAte,
  }));
}

describe("nada a fazer", () => {
  test("grade ja correta nao gera mudanca", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(4), {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 4,
    });
    assert.deepEqual(plano.atualizar, []);
    assert.deepEqual(plano.criar, []);
    assert.deepEqual(plano.remover, []);
    assert.ok(planoVazio(plano));
    assert.equal(resumirPlano(plano), "Nada muda na grade.");
  });
});

describe("feriado novo", () => {
  test("desloca apenas as aulas abertas seguintes", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(4), {
      periodo: { ...PERIODO, feriados: ["2026-02-16"] },
      diaDaSemana: SEGUNDA,
      totalAulas: 4,
    });

    // Com 16/02 feriado, as segundas viram 02, 09, 23/02 e 02/03
    assert.deepEqual(plano.atualizar, [
      { id: "aula-3", numero: 3, de: "2026-02-16", para: "2026-02-23" },
      { id: "aula-4", numero: 4, de: "2026-02-23", para: "2026-03-02" },
    ]);
    assert.deepEqual(plano.criar, []);
    assert.deepEqual(plano.remover, []);
  });

  test("aula fechada nunca muda de data, mesmo com feriado em cima dela", () => {
    // As aulas 1 a 3 ja tiveram a chamada fechada
    const plano = planejarRecalculoDaGrade(aulasEmDia(4, 3), {
      periodo: { ...PERIODO, feriados: ["2026-02-16"] },
      diaDaSemana: SEGUNDA,
      totalAulas: 4,
    });

    assert.deepEqual(plano.preservadas.map(p => p.numero), [1, 2, 3]);
    // So a aula 4, ainda aberta, e reposicionada
    assert.deepEqual(plano.atualizar, [
      { id: "aula-4", numero: 4, de: "2026-02-23", para: "2026-03-02" },
    ]);
  });
});

describe("mudar o dia da semana", () => {
  test("reposiciona todas as aulas abertas", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(2), {
      periodo: PERIODO, diaDaSemana: 3, totalAulas: 2, // quarta-feira
    });
    assert.deepEqual(plano.atualizar, [
      { id: "aula-1", numero: 1, de: "2026-02-02", para: "2026-02-04" },
      { id: "aula-2", numero: 2, de: "2026-02-09", para: "2026-02-11" },
    ]);
  });
});

describe("mudar o total de aulas", () => {
  test("aumentar cria as aulas que faltam", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(2), {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 4,
    });
    assert.deepEqual(plano.criar, [
      { numero: 3, data_aula: "2026-02-16" },
      { numero: 4, data_aula: "2026-02-23" },
    ]);
    assert.deepEqual(plano.atualizar, []);
  });

  test("reduzir remove as aulas abertas que sobram", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(4), {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 2,
    });
    assert.deepEqual(plano.remover, [
      { id: "aula-3", numero: 3 },
      { id: "aula-4", numero: 4 },
    ]);
  });

  test("reduzir NAO remove aula ja fechada, e avisa", () => {
    // As 4 aulas ja foram dadas; o coordenador tenta reduzir para 2
    const plano = planejarRecalculoDaGrade(aulasEmDia(4, 4), {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 2,
    });
    assert.deepEqual(plano.remover, [], "aula fechada jamais pode ser removida");
    assert.deepEqual(plano.preservadas.map(p => p.numero).sort(), [1, 2, 3, 4]);
    assert.equal(plano.avisos.filter(a => a.includes("já teve a chamada fechada")).length, 2);
  });
});

describe("aulas que nao cabem no semestre", () => {
  test("ficam sem data e o coordenador e avisado", () => {
    const curto = { data_inicio: "2026-02-02", data_fim: "2026-02-09", feriados: [] };
    const plano = planejarRecalculoDaGrade([], { periodo: curto, diaDaSemana: SEGUNDA, totalAulas: 4 });

    assert.deepEqual(plano.criar.map(c => c.data_aula), ["2026-02-02", "2026-02-09", null, null]);
    assert.ok(plano.avisos.some(a => a.includes("sem data")), "deveria avisar sobre as aulas sem data");
  });
});

describe("entradas invalidas", () => {
  test("total menor que 1 nao gera plano", () => {
    for (const total of [0, -5, 1.5]) {
      const plano = planejarRecalculoDaGrade(aulasEmDia(2), {
        periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: total,
      });
      assert.ok(planoVazio(plano));
      assert.ok(plano.avisos.length > 0);
    }
  });

  test("disciplina sem aulas ainda: cria tudo do zero", () => {
    const plano = planejarRecalculoDaGrade([], {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 3,
    });
    assert.equal(plano.criar.length, 3);
    assert.deepEqual(plano.atualizar, []);
    assert.deepEqual(plano.remover, []);
  });

  test("buraco na numeracao e preenchido", () => {
    const comBuraco: AulaExistente[] = [
      { id: "a1", numero: 1, data_aula: "2026-02-02", chamada_aberta: false },
      { id: "a3", numero: 3, data_aula: "2026-02-16", chamada_aberta: false },
    ];
    const plano = planejarRecalculoDaGrade(comBuraco, {
      periodo: PERIODO, diaDaSemana: SEGUNDA, totalAulas: 3,
    });
    assert.deepEqual(plano.criar, [{ numero: 2, data_aula: "2026-02-09" }]);
  });
});

describe("resumirPlano", () => {
  test("descreve tudo que vai acontecer", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(4, 2), {
      periodo: { ...PERIODO, feriados: ["2026-02-16"] },
      diaDaSemana: SEGUNDA,
      totalAulas: 3,
    });
    const resumo = resumirPlano(plano);
    assert.ok(resumo.includes("muda"), resumo);
    assert.ok(resumo.includes("removida"), resumo);
    assert.ok(resumo.includes("intocada"), resumo);
  });

  test("concorda em numero no singular", () => {
    const plano = planejarRecalculoDaGrade(aulasEmDia(1), {
      periodo: PERIODO, diaDaSemana: 3, totalAulas: 1,
    });
    assert.ok(resumirPlano(plano).startsWith("1 aula muda de data"), resumirPlano(plano));
  });
});
