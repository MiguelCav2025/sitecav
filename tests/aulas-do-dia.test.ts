import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AULAS_POR_ENCONTRO,
  HORARIOS,
  rotuloDoTurno,
  horarioDaAula,
  aulasDadas,
  proximaPresenca,
  rotuloDaPresenca,
  type PresencaNoDia,
} from "../src/lib/aulas-do-dia.ts";
import { PRESENCA_MINIMA } from "../src/lib/aprovacao.ts";

describe("horarios do Guia", () => {
  it("manha e noite tem duas aulas cada", () => {
    assert.equal(HORARIOS["Manhã"].length, AULAS_POR_ENCONTRO);
    assert.equal(HORARIOS["Noite"].length, AULAS_POR_ENCONTRO);
  });

  it("os 15 minutos de intervalo estao onde deviam", () => {
    for (const turno of ["Manhã", "Noite"]) {
      const [a, b] = HORARIOS[turno];
      const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
      assert.equal(min(b.inicio) - min(a.fim), 15, turno);
    }
  });

  it("a noite espelha a manha", () => {
    const dur = (a: { inicio: string; fim: string }) => {
      const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
      return min(a.fim) - min(a.inicio);
    };
    assert.deepEqual(HORARIOS["Manhã"].map(dur), HORARIOS["Noite"].map(dur));
  });

  it("rotulo pronto para a tela", () => {
    assert.equal(rotuloDoTurno("Manhã"), "09:00–10:20 e 10:35–12:00");
    assert.equal(rotuloDoTurno("Noite"), "19:00–20:20 e 20:35–22:00");
    assert.equal(rotuloDoTurno("Tarde"), "", "turno desconhecido nao inventa horario");
  });

  it("acha a aula pedida", () => {
    assert.equal(horarioDaAula("Noite", 2)?.inicio, "20:35");
    assert.equal(horarioDaAula("Tarde", 1), null);
  });
});

describe("aulasDadas", () => {
  it("cada encontro fechado vale duas aulas", () => {
    assert.equal(aulasDadas(18), 36);
    assert.equal(aulasDadas(17), 34);
    assert.equal(aulasDadas(19), 38);
    assert.equal(aulasDadas(0), 0);
  });

  it("70% dos dias e 70% das aulas quando todo mundo fica o dia inteiro", () => {
    // A conta so muda para quem sai no intervalo — e e por isso que a
    // presenca conta aulas, e nao dias.
    const encontros = 18;
    const presencaEmDias = 13 / encontros;
    const presencaEmAulas = (13 * 2) / aulasDadas(encontros);
    assert.equal(presencaEmDias, presencaEmAulas);
  });

  it("quem sai no intervalo pesa metade", () => {
    // 18 dias = 36 aulas. Foi a todos, mas saiu no intervalo em 12 deles:
    // 6*2 + 12*1 = 24 aulas de 36 = 66,7%, abaixo do minimo.
    const assistidas = 6 * 2 + 12 * 1;
    const pct = (assistidas * 100) / aulasDadas(18);
    assert.ok(pct < PRESENCA_MINIMA, `${pct}% deveria reprovar`);
  });
});

describe("proximaPresenca", () => {
  it("o caminho normal e um toque: ausente vira presente no dia inteiro", () => {
    assert.equal(proximaPresenca(undefined), 2);
    assert.equal(proximaPresenca(0), 2);
  });

  it("o segundo toque e para quem saiu no intervalo", () => {
    assert.equal(proximaPresenca(2), 1);
  });

  it("o terceiro volta para ausente, fechando o ciclo", () => {
    assert.equal(proximaPresenca(1), 0);
  });

  it("tres toques voltam ao começo", () => {
    let v: PresencaNoDia | undefined = undefined;
    v = proximaPresenca(v);
    v = proximaPresenca(v);
    v = proximaPresenca(v);
    assert.equal(v, 0);
  });
});

describe("rotuloDaPresenca", () => {
  it("diz o que o professor precisa ler", () => {
    assert.equal(rotuloDaPresenca(2), "Presente");
    assert.equal(rotuloDaPresenca(1), "Só a 1ª aula");
    assert.equal(rotuloDaPresenca(0), "Ausente");
    assert.equal(rotuloDaPresenca(undefined), "Ausente");
  });
});
