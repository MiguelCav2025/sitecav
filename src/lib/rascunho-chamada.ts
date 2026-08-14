/**
 * O rascunho da chamada, guardado no próprio aparelho.
 *
 * A chamada é feita em pé, na frente da turma, no celular do professor. Se a
 * internet cair no meio — e vai cair —, cada toque que não chegou ao servidor
 * some da tela e ele recomeça sem saber quais já tinha marcado.
 *
 * Não é offline de verdade: PWA sem service worker não garante isso, e
 * prometer o que não se cumpre é pior. O que dá para garantir é **não perder o
 * que já foi digitado**: fica no aparelho até o servidor confirmar.
 *
 * Some sozinho quando a chamada é fechada — rascunho que sobrevive ao fim vira
 * lixo que um dia reaparece sobre dado bom.
 */

export interface RascunhoDaChamada {
  aulaId: string;
  /** aluno_id → presente. Só o que ainda não foi confirmado pelo servidor. */
  presencas: Record<string, boolean>;
  conteudo: string;
  salvoEm: number;
}

const PREFIXO = "cav:chamada:";
/** Rascunho velho é de outro semestre, ou de aula que alguém já fechou. */
const VALIDADE_EM_DIAS = 7;

const chave = (aulaId: string) => `${PREFIXO}${aulaId}`;

/** localStorage falha em aba anônima e quando o disco enche. Nunca derruba a tela. */
function comStorage<T>(acao: (s: Storage) => T, padrao: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return padrao;
    return acao(window.localStorage);
  } catch {
    return padrao;
  }
}

export function salvarRascunho(
  aulaId: string,
  presencas: Record<string, boolean>,
  conteudo: string,
): void {
  comStorage(s => {
    const vazio = Object.keys(presencas).length === 0 && !conteudo.trim();
    if (vazio) return s.removeItem(chave(aulaId));
    s.setItem(chave(aulaId), JSON.stringify({ aulaId, presencas, conteudo, salvoEm: Date.now() }));
  }, undefined);
}

export function lerRascunho(aulaId: string, agora = Date.now()): RascunhoDaChamada | null {
  return comStorage(s => {
    const bruto = s.getItem(chave(aulaId));
    if (!bruto) return null;

    try {
      const r = JSON.parse(bruto) as RascunhoDaChamada;
      if (!r || typeof r !== "object" || !r.presencas) return null;

      const dias = (agora - (r.salvoEm ?? 0)) / 86_400_000;
      if (dias > VALIDADE_EM_DIAS) { s.removeItem(chave(aulaId)); return null; }

      return r;
    } catch {
      // JSON corrompido: melhor descartar do que quebrar a tela da chamada.
      s.removeItem(chave(aulaId));
      return null;
    }
  }, null);
}

export function limparRascunho(aulaId: string): void {
  comStorage(s => s.removeItem(chave(aulaId)), undefined);
}

/**
 * O que o professor vê: o servidor como base, o rascunho por cima.
 *
 * O rascunho vence porque é o mais recente — foi digitado depois do que o
 * servidor tinha, e é justamente o que não conseguiu subir.
 */
export function mesclarPresencas(
  doServidor: Readonly<Record<string, boolean>>,
  rascunho: Readonly<Record<string, boolean>> | undefined,
): Record<string, boolean> {
  return { ...doServidor, ...(rascunho ?? {}) };
}

/** Quantos toques ainda não chegaram ao servidor. */
export function pendentes(rascunho: RascunhoDaChamada | null): number {
  return rascunho ? Object.keys(rascunho.presencas).length : 0;
}
