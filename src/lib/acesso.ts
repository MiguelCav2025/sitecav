/**
 * Regras do convite de acesso do professor.
 *
 * Separado da rota de API para poder ser testado sem rede, sem banco e sem
 * disparar e-mail de verdade.
 */

/** Tipo de link pedido ao Supabase. */
export type TipoDeLink = "invite" | "recovery";

/** Tom do e-mail: quem nunca entrou recebe boas-vindas; os demais, "refazer". */
export type TipoDeEmail = "primeiro" | "novo";

export interface DecisaoDeEnvio {
  tipoDeLink: TipoDeLink;
  tipoDeEmail: TipoDeEmail;
  /** Só para o texto do e-mail. Convite dura mais que recuperação no Supabase. */
  validadeEmHoras: number;
}

/**
 * Um convite (`invite`) cria a conta; uma recuperação (`recovery`) exige que
 * ela já exista. Quem ainda não tem `user_id` nunca teve conta ligada ao
 * cadastro, então precisa de convite.
 *
 * O tom do e-mail segue outra pergunta: `senha_alterada` conta se o professor
 * já chegou a definir uma senha alguma vez. Um professor com conta criada na
 * importação, mas que nunca entrou, ainda está no primeiro acesso.
 */
export function decidirEnvio(professor: {
  user_id: string | null;
  senha_alterada: boolean;
}): DecisaoDeEnvio {
  const temConta = professor.user_id !== null;

  return {
    tipoDeLink: temConta ? "recovery" : "invite",
    tipoDeEmail: professor.senha_alterada ? "novo" : "primeiro",
    validadeEmHoras: temConta ? 1 : 24,
  };
}

/**
 * Validação deliberadamente frouxa: só o suficiente para pegar o erro de
 * digitação óbvio antes de gastar uma chamada de API. Quem julga se o endereço
 * existe é a entrega do e-mail, não uma expressão regular.
 */
export function emailPareceValido(email: string): boolean {
  const limpo = email.trim();
  if (limpo.length < 5 || limpo.length > 254) return false;
  if (/\s/.test(limpo)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(limpo);
}

/**
 * Endereços `@cav.temp` foram inventados na importação para dar um login a
 * professores cujo e-mail real ninguém tinha. Enviar convite para eles não
 * entrega nada — melhor barrar e pedir o endereço de verdade.
 */
export function ehEmailDePreenchimento(email: string): boolean {
  return /@cav\.temp$/i.test(email.trim());
}

/** Monta a URL do nosso próprio verificador, não a que o Supabase devolve. */
export function montarLinkDeConfirmacao(
  origem: string,
  tokenHash: string,
  tipoDeLink: TipoDeLink
): string {
  const url = new URL("/auth/confirmar", origem);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", tipoDeLink);
  return url.toString();
}
