import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emojiSugerido,
  emojiDaDisciplina,
  EMOJI_PADRAO,
} from "../src/lib/emoji-disciplina.ts";

describe("emojiSugerido", () => {
  it("da um emoji diferente para cada disciplina real do CAV", () => {
    // As 30 disciplinas nasceram todas com 📚 na importacao. O ponto do
    // exercicio e o card deixar de ser identico ao vizinho.
    const nomes = [
      "Animação Tradicional", "Animação Digital 2D I", "Roteiro - Animação",
      "Fundamentos de Desenho", "Animação Experimental I",
      "Desenho Aplicado à Animação", "Direção de Arte I",
      "Direção Cinematográfica I - Animação", "Edição de Som - Animação",
      "Pós-Produção de Imagem - Animação", "História do Cinema Brasileiro",
      "Práticas de TV e Internet", "Práticas para Fotografia", "Produção I",
      "Direção de Fotografia e Iluminação", "Teoria da Montagem e Edição",
      "Práticas de Som Direto",
    ];
    const emojis = nomes.map(emojiSugerido);

    assert.equal(emojis.filter(e => e === EMOJI_PADRAO).length, 0,
      "nenhuma deveria cair no padrao: " + nomes.filter(n => emojiSugerido(n) === EMOJI_PADRAO).join(", "));
    assert.ok(new Set(emojis).size >= 10, `poucos emojis distintos: ${new Set(emojis).size}`);
  });

  it("o mais especifico ganha do mais generico", () => {
    // "Direção de Arte" nao pode virar o emoji de "Direção", nem
    // "Edição de Som" o de "Edição".
    assert.notEqual(emojiSugerido("Direção de Arte II"), emojiSugerido("Direção Cinematográfica II"));
    assert.notEqual(emojiSugerido("Edição de Som - Cine/TV"), emojiSugerido("Teoria da Montagem e Edição"));
    assert.notEqual(emojiSugerido("Direção de Fotografia e Iluminação"), emojiSugerido("Práticas para Fotografia"));
  });

  it("ignora acento e caixa", () => {
    assert.equal(emojiSugerido("PRODUÇÃO II"), emojiSugerido("producao ii"));
    assert.equal(emojiSugerido("ANIMAÇÃO TRADICIONAL"), emojiSugerido("Animação Tradicional"));
  });

  it("nome desconhecido cai no padrao, e nao num icone errado", () => {
    assert.equal(emojiSugerido("Disciplina Nova Qualquer"), EMOJI_PADRAO);
    assert.equal(emojiSugerido(""), EMOJI_PADRAO);
  });
});

describe("emojiDaDisciplina", () => {
  it("a escolha do coordenador sempre vence", () => {
    assert.equal(emojiDaDisciplina("Animação Tradicional", "🏆"), "🏆");
  });

  it("sugere quando o valor guardado e o padrao da importacao", () => {
    assert.equal(emojiDaDisciplina("Roteiro - Animação", EMOJI_PADRAO), emojiSugerido("Roteiro - Animação"));
  });

  it("sugere quando nao ha nada guardado", () => {
    assert.equal(emojiDaDisciplina("Roteiro - Animação", null), emojiSugerido("Roteiro - Animação"));
  });
});
