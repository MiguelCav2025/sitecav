import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  montarFechamento,
  resumirFechamento,
  pendenciasDaTurma,
  situacaoSugerida,
  desfechoDaAprovacao,
  type LinhaDesempenho,
  type MatriculaAberta,
} from "../src/lib/fechamento.ts";

const matricula = (n: string, id: string): MatriculaAberta =>
  ({ matriculaId: `m-${id}`, alunoId: id, nome: n });

/** Linha completa e aprovável, salvo o que o teste sobrescrever. */
const linha = (alunoId: string, aluno: string, disciplina: string, over: Partial<LinhaDesempenho> = {}): LinhaDesempenho => ({
  aluno_id: alunoId,
  aluno,
  disciplina_id: `d-${disciplina}`,
  disciplina,
  modulo: 1,
  nota_professor: 8,
  nota_banca: null,
  nota_final: 8,
  aulas_dadas: 10,
  presencas: 10,
  ...over,
});

describe("montarFechamento", () => {
  it("ordena os alunos pelo nome, respeitando acento", () => {
    const alunos = montarFechamento(
      [matricula("Zeca", "3"), matricula("Ávila", "1"), matricula("Bruno", "2")],
      [],
    );
    assert.deepEqual(alunos.map(a => a.nome), ["Ávila", "Bruno", "Zeca"]);
  });

  it("mantém na lista o aluno sem NENHUMA nota lançada", () => {
    // Ele não aparece na view. Se a lista saísse de lá, ele sumiria da tela e
    // ninguém decidiria sobre ele.
    const alunos = montarFechamento([matricula("Ana", "1")], []);
    assert.equal(alunos.length, 1);
    assert.equal(alunos[0].avaliacao.situacao, "indefinido");
  });

  it("agrupa as disciplinas por aluno, sem misturar", () => {
    const alunos = montarFechamento(
      [matricula("Ana", "1"), matricula("Bia", "2")],
      [
        linha("1", "Ana", "Roteiro"),
        linha("1", "Ana", "Desenho"),
        linha("2", "Bia", "Roteiro"),
      ],
    );
    assert.deepEqual(alunos[0].avaliacao.disciplinas.map(d => d.disciplina), ["Desenho", "Roteiro"]);
    assert.deepEqual(alunos[1].avaliacao.disciplinas.map(d => d.disciplina), ["Roteiro"]);
  });

  it("ignora linha de aluno que não está matriculado", () => {
    const alunos = montarFechamento([matricula("Ana", "1")], [linha("9", "Fantasma", "Roteiro")]);
    assert.equal(alunos.length, 1);
    assert.equal(alunos[0].nome, "Ana");
  });

  it("uma disciplina reprovada retém o aluno no módulo (D35/N21)", () => {
    const alunos = montarFechamento(
      [matricula("Ana", "1")],
      [
        linha("1", "Ana", "Roteiro"),
        linha("1", "Ana", "Desenho", { nota_professor: 4, nota_final: 4 }),
      ],
    );
    assert.equal(alunos[0].avaliacao.situacao, "retido");
  });

  it("frequência abaixo de 70% retém, mesmo com nota alta", () => {
    const alunos = montarFechamento(
      [matricula("Ana", "1")],
      [linha("1", "Ana", "Roteiro", { nota_professor: 10, nota_final: 10, aulas_dadas: 10, presencas: 6 })],
    );
    assert.equal(alunos[0].avaliacao.situacao, "retido");
  });
});

describe("resumirFechamento", () => {
  const alunos = montarFechamento(
    [matricula("Ana", "1"), matricula("Bia", "2"), matricula("Caio", "3")],
    [
      linha("1", "Ana", "Roteiro"),
      linha("2", "Bia", "Roteiro", { nota_professor: 3, nota_final: 3 }),
      // Caio não tem nada lançado
    ],
  );

  it("conta cada situação", () => {
    const r = resumirFechamento(alunos);
    assert.equal(r.total, 3);
    assert.equal(r.aprovados, 1);
    assert.equal(r.retidos, 1);
    assert.equal(r.indefinidos, 1);
  });

  it("não deixa fechar enquanto houver indefinido", () => {
    assert.equal(resumirFechamento(alunos).prontoParaFechar, false);
  });

  it("libera quando todos têm resultado", () => {
    const completos = montarFechamento(
      [matricula("Ana", "1"), matricula("Bia", "2")],
      [linha("1", "Ana", "Roteiro"), linha("2", "Bia", "Roteiro", { nota_professor: 3, nota_final: 3 })],
    );
    assert.equal(resumirFechamento(completos).prontoParaFechar, true);
  });

  it("turma vazia não está pronta — não há o que fechar", () => {
    assert.equal(resumirFechamento([]).prontoParaFechar, false);
  });
});

describe("pendenciasDaTurma", () => {
  it("diz cada pendência UMA vez, por mais alunos que a tenham", () => {
    // A banca é a mesma para todo mundo: sem deduplicar, a lista repetiria a
    // mesma frase uma vez por aluno e por disciplina.
    const alunos = montarFechamento(
      [matricula("Ana", "1"), matricula("Bia", "2")],
      [
        linha("1", "Ana", "Roteiro", { modulo: 2, nota_banca: null }),
        linha("1", "Ana", "Desenho", { modulo: 2, nota_banca: null }),
        linha("2", "Bia", "Roteiro", { modulo: 2, nota_banca: null }),
      ],
    );
    const p = pendenciasDaTurma(alunos);
    assert.equal(new Set(p).size, p.length);
    assert.ok(p.some(x => /banca/i.test(x)), p.join(" | "));
  });

  it("turma completa não tem pendência", () => {
    const alunos = montarFechamento([matricula("Ana", "1")], [linha("1", "Ana", "Roteiro")]);
    assert.deepEqual(pendenciasDaTurma(alunos), []);
  });
});

describe("situacaoSugerida", () => {
  const [aprovado] = montarFechamento([matricula("Ana", "1")], [linha("1", "Ana", "Roteiro")]);
  const [retido] = montarFechamento([matricula("Bia", "2")], [linha("2", "Bia", "Roteiro", { nota_professor: 2, nota_final: 2 })]);
  const [indefinido] = montarFechamento([matricula("Caio", "3")], []);

  it("traduz o resultado, e nao sugere nada para indefinido", () => {
    assert.equal(situacaoSugerida(aprovado.avaliacao, 1), "aprovado");
    assert.equal(situacaoSugerida(retido.avaliacao, 1), "retido");
    assert.equal(situacaoSugerida(indefinido.avaliacao, 1), null);
  });

  it("passar no ULTIMO modulo e concluir o curso, nao ser aprovado", () => {
    // Quem e aprovado no 1o ou no 2o volta no semestre seguinte. Quem conclui,
    // nao. Gravar os dois como "aprovado" torna impossivel listar os formandos.
    assert.equal(situacaoSugerida(aprovado.avaliacao, 3), "concluido");
    assert.equal(situacaoSugerida(aprovado.avaliacao, 2), "aprovado");
  });

  it("reter no ultimo modulo continua sendo reter", () => {
    assert.equal(situacaoSugerida(retido.avaliacao, 3), "retido");
  });
});

describe("desfechoDaAprovacao", () => {
  it("so o ultimo modulo conclui", () => {
    assert.equal(desfechoDaAprovacao(1), "aprovado");
    assert.equal(desfechoDaAprovacao(2), "aprovado");
    assert.equal(desfechoDaAprovacao(3), "concluido");
  });

  it("modulo acima do ultimo tambem conclui, nao volta a ser aprovado", () => {
    assert.equal(desfechoDaAprovacao(4), "concluido");
  });
});
