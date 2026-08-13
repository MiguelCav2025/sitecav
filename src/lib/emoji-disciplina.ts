/**
 * Um emoji que diga alguma coisa sobre a disciplina.
 *
 * Todas nasceram com 📚 porque a importação usou um valor fixo. Numa grade de
 * 30 cards idênticos, o emoji deixa de ser referência visual e vira ruído — o
 * olho procura o nome em todos, um por um.
 *
 * A escolha do coordenador sempre vence: isto só preenche quem ficou no padrão.
 */

/** O valor com que a importação preencheu tudo. */
export const EMOJI_PADRAO = "📚";

/**
 * Do mais específico para o mais genérico: "direção de arte" tem que ganhar de
 * "direção", e "edição de som" de "som". A ordem desta lista É a regra.
 */
const REGRAS: ReadonlyArray<[RegExp, string]> = [
  [/direc\w*\s+de\s+arte/, "🎨"],
  [/direc\w*\s+de\s+fotografia|iluminac/, "💡"],
  [/direc\w*\s+cinematografica/, "🎬"],
  [/edicao\s+de\s+som|som\s+direto|audio/, "🎧"],
  [/pos.?producao/, "🖥️"],
  [/montagem|edicao/, "✂️"],
  [/roteiro/, "📝"],
  [/fotografia/, "📷"],
  [/desenho/, "✏️"],
  [/animacao\s+tradicional/, "🖌️"],
  [/animacao\s+experimental/, "🌀"],
  [/animacao\s+digital|animacao\s+2d/, "🎞️"],
  [/animacao/, "🎞️"],
  [/historia\s+do\s+cinema|historia/, "📖"],
  [/praticas?\s+de\s+tv|internet|televisao/, "📺"],
  [/producao\s+de\s+imagem|imagem\s+e\s+som/, "🎥"],
  [/producao/, "🎬"],
  [/som|musica/, "🎵"],
  [/teoria/, "📖"],
];

/** Tira acento e caixa, para as regras não precisarem prever cada grafia. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * O emoji que combina com o nome. Cai no padrão quando nada casa — melhor um
 * livro genérico do que um ícone que sugere a matéria errada.
 */
export function emojiSugerido(nome: string): string {
  const limpo = normalizar(nome);
  for (const [padrao, emoji] of REGRAS) {
    if (padrao.test(limpo)) return emoji;
  }
  return EMOJI_PADRAO;
}

/**
 * O emoji a exibir: o que o coordenador escolheu, ou a sugestão quando ele
 * nunca escolheu. Distinguir os dois casos é o que permite melhorar a sugestão
 * depois sem apagar escolha de ninguém.
 */
export function emojiDaDisciplina(nome: string, guardado: string | null): string {
  if (guardado && guardado !== EMOJI_PADRAO) return guardado;
  return emojiSugerido(nome);
}
