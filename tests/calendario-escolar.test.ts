import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  lerSemestre,
  moduloAtual,
  rotuloModulo,
  semestreLetivo,
  contarDiasLetivos,
  gerarDatasAulas,
} from "../src/lib/calendario-escolar.ts";

// Data fixa para os testes não dependerem de quando rodam
const em = (iso: string) => new Date(`${iso}T12:00:00`);

describe("lerSemestre", () => {
  test("aceita o formato ano/semestre", () => {
    assert.deepEqual(lerSemestre("2025/1"), { ano: 2025, semestre: 1 });
    assert.deepEqual(lerSemestre("2026/2"), { ano: 2026, semestre: 2 });
  });

  test("recusa o que nao for valido", () => {
    for (const invalido of ["", "2025", "2025/3", "2025/0", "abc/1", "2025/1/2", "/1"]) {
      assert.equal(lerSemestre(invalido), null, `deveria recusar: ${JSON.stringify(invalido)}`);
    }
  });
});

describe("modulo", () => {
  test("avanca a cada seis meses a partir da entrada", () => {
    assert.equal(moduloAtual("2025/1", em("2025-03-10")), 1);
    assert.equal(moduloAtual("2025/1", em("2025-08-10")), 2);
    assert.equal(moduloAtual("2025/1", em("2026-03-10")), 3);
  });

  test("passa de 3 quando a turma ja concluiu", () => {
    assert.equal(moduloAtual("2025/1", em("2026-08-10")), 4);
  });

  test("fica negativo para turma que ainda nao comecou", () => {
    assert.equal(moduloAtual("2026/1", em("2025-03-10")), -1);
  });

  test("a virada e em 1 de julho", () => {
    assert.equal(moduloAtual("2025/1", em("2025-06-30")), 1);
    assert.equal(moduloAtual("2025/1", em("2025-07-01")), 2);
  });

  test("entrada invalida devolve null, nao zero", () => {
    // Zero e uma resposta legitima: a turma comeca no semestre que vem.
    // Confundir os dois casos foi o que fez uma tela mostrar turma futura
    // como se estivesse no 1o semestre.
    assert.equal(moduloAtual("", em("2025-03-10")), null);
    assert.equal(moduloAtual("lixo", em("2025-03-10")), null);
    assert.equal(moduloAtual("2025/2", em("2025-03-10")), 0);
  });
});

describe("rotuloModulo", () => {
  test("traduz o numero para texto", () => {
    assert.equal(rotuloModulo(1), "Módulo 1");
    assert.equal(rotuloModulo(3), "Módulo 3");
  });

  test("nunca diz 'semestre' — era essa palavra que colidia com 2026/2", () => {
    for (const n of [1, 2, 3, 4, 0, -1]) {
      assert.ok(!/semestre/i.test(rotuloModulo(n)), `rotuloModulo(${n})`);
    }
  });

  test("distingue nao comecou de ja terminou", () => {
    assert.equal(rotuloModulo(0), "Ainda não iniciou");
    assert.equal(rotuloModulo(-1), "Ainda não iniciou");
    assert.equal(rotuloModulo(4), "Curso concluído");
  });

  test("entrada invalida vira texto vazio", () => {
    assert.equal(rotuloModulo(null), "");
  });
});

describe("semestreLetivo", () => {
  test("soma os semestres do curso a partir da entrada", () => {
    assert.equal(semestreLetivo("2025/1", 1), "2025/1");
    assert.equal(semestreLetivo("2025/1", 2), "2025/2");
    assert.equal(semestreLetivo("2025/1", 3), "2026/1");
  });

  test("atravessa a virada de ano corretamente", () => {
    assert.equal(semestreLetivo("2025/2", 1), "2025/2");
    assert.equal(semestreLetivo("2025/2", 2), "2026/1");
    assert.equal(semestreLetivo("2025/2", 3), "2026/2");
  });

  test("devolve vazio para entrada invalida", () => {
    assert.equal(semestreLetivo("lixo", 1), "");
    assert.equal(semestreLetivo("2025/1", 0), "");
  });
});

// 02/02/2026 e uma segunda-feira. O periodo vai ate a segunda 23/02.
const PERIODO = { data_inicio: "2026-02-02", data_fim: "2026-02-23", feriados: [] as string[] };

describe("contarDiasLetivos", () => {
  test("conta cada dia util do periodo", () => {
    assert.deepEqual(contarDiasLetivos(PERIODO), { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3 });
  });

  test("desconta feriados", () => {
    const comFeriado = { ...PERIODO, feriados: ["2026-02-16"] };
    assert.equal(contarDiasLetivos(comFeriado)[1], 3);
  });

  test("nao conta sabado e domingo", () => {
    const soFimDeSemana = { data_inicio: "2026-02-07", data_fim: "2026-02-08", feriados: [] };
    assert.deepEqual(contarDiasLetivos(soFimDeSemana), { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});

describe("gerarDatasAulas", () => {
  test("usa sempre o mesmo dia da semana", () => {
    assert.deepEqual(
      gerarDatasAulas(PERIODO, 1, 4),
      ["2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23"],
    );
  });

  test("feriado nao desloca a grade: cabe uma aula a menos", () => {
    // Esta e a regra central. Com a segunda 16/02 feriado, sobram tres
    // segundas no periodo, entao a quarta aula fica sem data.
    assert.deepEqual(
      gerarDatasAulas({ ...PERIODO, feriados: ["2026-02-16"] }, 1, 4),
      ["2026-02-02", "2026-02-09", "2026-02-23", null],
    );
  });

  test("aulas que nao cabem no periodo ficam sem data", () => {
    assert.deepEqual(
      gerarDatasAulas(PERIODO, 1, 6),
      ["2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23", null, null],
    );
  });

  test("pede menos aulas do que cabe: para no total pedido", () => {
    assert.deepEqual(gerarDatasAulas(PERIODO, 1, 2), ["2026-02-02", "2026-02-09"]);
  });

  test("total invalido devolve lista vazia", () => {
    assert.deepEqual(gerarDatasAulas(PERIODO, 1, 0), []);
    assert.deepEqual(gerarDatasAulas(PERIODO, 1, -3), []);
  });

  test("nao escorrega para outro dia da semana", () => {
    const datas = gerarDatasAulas(
      { data_inicio: "2026-02-02", data_fim: "2026-06-30", feriados: ["2026-02-16", "2026-03-02"] },
      1,
      10,
    );
    for (const d of datas) {
      if (d) assert.equal(new Date(`${d}T12:00:00`).getDay(), 1, `${d} nao e segunda-feira`);
    }
  });

  test("periodo invertido nao gera datas", () => {
    const invertido = { data_inicio: "2026-03-01", data_fim: "2026-02-01", feriados: [] };
    assert.deepEqual(gerarDatasAulas(invertido, 1, 2), [null, null]);
  });
});
