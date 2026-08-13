import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  domingoDePascoa,
  feriadosDoAno,
  feriadosNoPeriodo,
  conciliarFeriados,
} from "../src/lib/feriados.ts";

describe("domingoDePascoa", () => {
  it("acerta anos conferidos em calendário", () => {
    assert.equal(domingoDePascoa(2024), "2024-03-31");
    assert.equal(domingoDePascoa(2025), "2025-04-20");
    assert.equal(domingoDePascoa(2026), "2026-04-05");
    assert.equal(domingoDePascoa(2027), "2027-03-28");
    assert.equal(domingoDePascoa(2030), "2030-04-21");
  });

  it("cai sempre num domingo", () => {
    for (let ano = 2024; ano <= 2040; ano++) {
      const [a, m, d] = domingoDePascoa(ano).split("-").map(Number);
      assert.equal(new Date(Date.UTC(a, m - 1, d)).getUTCDay(), 0, `${ano}`);
    }
  });
});

describe("feriadosDoAno", () => {
  it("posiciona os móveis a partir da Páscoa", () => {
    const f = feriadosDoAno(2026);
    const acha = (nome: string) => f.find(x => x.nome === nome)?.data;
    // Páscoa 2026 = 05/04
    assert.equal(acha("Sexta-feira Santa"), "2026-04-03");
    assert.equal(acha("Carnaval"), "2026-02-17");
    assert.equal(acha("Carnaval (segunda)"), "2026-02-16");
    assert.equal(acha("Corpus Christi"), "2026-06-04");
  });

  it("traz o aniversário de São Bernardo", () => {
    const f = feriadosDoAno(2026).find(x => x.data === "2026-08-20");
    assert.equal(f?.tipo, "municipal");
  });

  it("vem em ordem de data", () => {
    const datas = feriadosDoAno(2027).map(f => f.data);
    assert.deepEqual(datas, [...datas].sort());
  });
});

describe("feriadosNoPeriodo", () => {
  // O semestre real do CAV, conferido com o coordenador.
  const INICIO = "2026-08-03";
  const FIM = "2026-12-14";

  it("encontra exatamente os feriados letivos do 2026/2 do CAV", () => {
    assert.deepEqual(
      feriadosNoPeriodo(INICIO, FIM).map(f => f.data),
      [
        "2026-08-20", // aniversário da cidade
        "2026-09-07", // Independência
        "2026-10-12", // Aparecida
        "2026-10-28", // Servidor Público
        "2026-11-02", // Finados
        "2026-11-20", // Consciência Negra
      ]
    );
  });

  it("descarta feriado que cai no fim de semana — não tira aula de ninguém", () => {
    // 15/11/2026 é domingo; 25/12/2026 é sexta, mas fora do período.
    const datas = feriadosNoPeriodo(INICIO, FIM).map(f => f.data);
    assert.ok(!datas.includes("2026-11-15"));
    assert.ok(!datas.includes("2026-12-25"));
  });

  it("atravessa a virada do ano", () => {
    const datas = feriadosNoPeriodo("2026-12-20", "2027-01-05").map(f => f.data);
    assert.deepEqual(datas, ["2026-12-25", "2027-01-01"]);
  });

  it("período inválido não inventa nada", () => {
    assert.deepEqual(feriadosNoPeriodo("2026-12-14", "2026-08-03"), []);
    assert.deepEqual(feriadosNoPeriodo("", ""), []);
  });
});

describe("conciliarFeriados", () => {
  const INICIO = "2026-08-03";
  const FIM = "2026-12-14";

  it("separa o que já está marcado, o que falta e o que é da casa", () => {
    // O que o CAV realmente cadastrou: os 6 conhecidos + a emenda de 21/08.
    const marcados = [
      "2026-08-20", "2026-08-21", "2026-09-07",
      "2026-10-12", "2026-10-28", "2026-11-02", "2026-11-20",
    ];
    const r = conciliarFeriados(marcados, INICIO, FIM);

    assert.equal(r.jaMarcados.length, 6);
    assert.deepEqual(r.sugestoes, []);
    // A emenda do aniversário não está em lista nenhuma — é decisão da escola.
    assert.deepEqual(r.personalizados, ["2026-08-21"]);
  });

  it("aponta o que o coordenador ainda não marcou", () => {
    const r = conciliarFeriados(["2026-09-07"], INICIO, FIM);
    assert.deepEqual(
      r.sugestoes.map(f => f.data),
      ["2026-08-20", "2026-10-12", "2026-10-28", "2026-11-02", "2026-11-20"]
    );
    assert.deepEqual(r.jaMarcados.map(f => f.data), ["2026-09-07"]);
  });

  it("calendário vazio sugere tudo e não acusa nada de personalizado", () => {
    const r = conciliarFeriados([], INICIO, FIM);
    assert.equal(r.sugestoes.length, 6);
    assert.deepEqual(r.jaMarcados, []);
    assert.deepEqual(r.personalizados, []);
  });
});
