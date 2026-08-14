/**
 * Achar a mesma pessoa cadastrada duas vezes.
 *
 * O aluno é cadastrado digitando o nome. Nada impedia dois "João Silva" de
 * virarem duas pessoas — cada uma com a sua frequência, cada uma abaixo dos
 * 70%, e o professor vendo o nome repetido na chamada sem saber qual marcar.
 *
 * O sistema não decide: ele avisa e o coordenador confirma. Nome repetido é
 * comum de verdade, e barrar impediria dois homônimos legítimos de existir.
 */

/** Sem acento, sem caixa, sem espaço sobrando. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * As partes que identificam a pessoa: primeiro e último nome.
 *
 * "José da Silva" e "Jose Silva" são a mesma pessoa escrita de dois jeitos —
 * o que muda são as partículas do meio, justamente o que mais varia entre
 * quem digita a lista e quem preenche a ficha.
 */
function pontas(nome: string): string {
  const partes = normalizarNome(nome)
    .split(" ")
    .filter(p => p.length > 2 || !["de", "da", "do", "das", "dos", "e"].includes(p));
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

export interface Parecido<T> {
  candidato: T;
  /** `exato` = mesmo nome; `pontas` = mesmo primeiro e último nome. */
  como: "exato" | "pontas";
}

/**
 * Quem já existe com nome igual ou muito parecido.
 *
 * Deliberadamente sem distância de edição: "Ana" e "Ane" são pessoas
 * diferentes, e um alarme que dispara à toa é ignorado no terceiro aluno.
 */
export function procurarParecidos<T extends { nome: string }>(
  nome: string,
  existentes: readonly T[],
): Parecido<T>[] {
  const alvo = normalizarNome(nome);
  if (!alvo) return [];
  const alvoPontas = pontas(nome);

  const saida: Parecido<T>[] = [];
  for (const c of existentes) {
    const dele = normalizarNome(c.nome);
    if (dele === alvo) saida.push({ candidato: c, como: "exato" });
    else if (alvoPontas && pontas(c.nome) === alvoPontas) saida.push({ candidato: c, como: "pontas" });
  }

  // O nome idêntico primeiro: é o caso mais provável de ser a mesma pessoa.
  return saida.sort((a, b) => (a.como === "exato" ? -1 : 1) - (b.como === "exato" ? -1 : 1));
}

/** Duplicatas dentro da própria lista que está sendo cadastrada. */
export function repetidosNaLista(nomes: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const n of nomes) {
    const k = normalizarNome(n);
    if (!k) continue;
    if (vistos.has(k)) repetidos.add(n.trim());
    vistos.add(k);
  }
  return [...repetidos];
}
