export interface ItemGabarito {
  numero: number;
  resposta: string;
}

/**
 * Interpreta um gabarito colado em texto livre.
 *
 * Aceita os formatos que aparecem na prática, misturados à vontade:
 *
 *   1-A  2-B  3-C          (espaço, tabulação ou quebra de linha)
 *   1. A, 2. B; 3) C
 *   12 - Todas as anteriores
 *
 * Números repetidos: vale o último. O resultado sai ordenado por número.
 */
export function interpretarGabarito(texto: string): ItemGabarito[] {
  const porNumero = new Map<number, string>();

  for (const bruto of texto.split(/[\n,;]+/)) {
    const linha = bruto.trim();
    if (!linha) continue;

    // número, separador opcional (- . ) : –), resposta
    const m = linha.match(/^(\d+)\s*[-.)\]:–]?\s*(.+)$/);
    if (!m) continue;

    const numero = Number(m[1]);
    const resposta = m[2].trim();
    if (!Number.isInteger(numero) || numero < 1) continue;

    // O separador e opcional no regex, entao "1-" faz o proprio hifen ser
    // capturado como resposta. Exigir ao menos uma letra ou digito descarta
    // esses restos sem recusar respostas legitimas.
    if (!/[\p{L}\p{N}]/u.test(resposta)) continue;

    porNumero.set(numero, resposta);
  }

  return [...porNumero.entries()]
    .map(([numero, resposta]) => ({ numero, resposta }))
    .sort((a, b) => a.numero - b.numero);
}

/** Aponta buracos na numeração, para o coordenador conferir antes de publicar. */
export function numerosFaltando(itens: ItemGabarito[]): number[] {
  if (itens.length === 0) return [];
  const existentes = new Set(itens.map(i => i.numero));
  const maior = Math.max(...existentes);
  const faltando: number[] = [];
  for (let n = 1; n <= maior; n++) if (!existentes.has(n)) faltando.push(n);
  return faltando;
}
