/**
 * Freio para rotas públicas.
 *
 * O formulário de contato dispara e-mail pelo Resend sem pedir login. Sem
 * freio, um script simples esgota a cota do dia, derruba o canal e ainda pode
 * gerar custo — e o CAV descobriria pelo silêncio, quando alguém reclamasse
 * que escreveu e ninguém respondeu.
 *
 * A contagem vive na memória do processo. Em serverless isso significa um
 * balde por instância, então o limite real é mais frouxo que o configurado —
 * mas segura o caso que importa: a enxurrada de uma origem só. Um freio
 * imperfeito e sem dependência vale mais que um perfeito que ninguém instala.
 */

export interface Balde {
  /** Momentos das tentativas dentro da janela, em ms. */
  tentativas: number[];
}

export interface ResultadoDoLimite {
  permitido: boolean;
  /** Quantas ainda cabem na janela. */
  restantes: number;
  /** Em quantos segundos a próxima vaga abre. Zero quando ainda há vaga. */
  esperarSegundos: number;
}

export interface Limite {
  /** Quantas tentativas cabem na janela. */
  maximo: number;
  /** Tamanho da janela, em ms. */
  janelaMs: number;
}

/**
 * Registra uma tentativa e diz se ela passa.
 *
 * Janela deslizante em vez de janela fixa: com janela fixa, quem dispara no
 * fim de um período e no começo do seguinte manda o dobro do limite em
 * segundos, que é justamente o padrão de quem está abusando.
 */
export function registrarTentativa(
  baldes: Map<string, Balde>,
  chave: string,
  limite: Limite,
  agora: number,
): ResultadoDoLimite {
  const inicioDaJanela = agora - limite.janelaMs;

  const balde = baldes.get(chave) ?? { tentativas: [] };
  // Descarta o que saiu da janela — é o que impede o balde de crescer sem fim.
  balde.tentativas = balde.tentativas.filter(t => t > inicioDaJanela);

  if (balde.tentativas.length >= limite.maximo) {
    baldes.set(chave, balde);
    const maisAntiga = balde.tentativas[0];
    return {
      permitido: false,
      restantes: 0,
      esperarSegundos: Math.max(1, Math.ceil((maisAntiga + limite.janelaMs - agora) / 1000)),
    };
  }

  balde.tentativas.push(agora);
  baldes.set(chave, balde);
  return {
    permitido: true,
    restantes: limite.maximo - balde.tentativas.length,
    esperarSegundos: 0,
  };
}

/**
 * Remove baldes que já esvaziaram.
 *
 * Sem isto o Map guardaria uma entrada por IP para sempre, e um ataque com IPs
 * variados viraria vazamento de memória — trocando um problema por outro.
 */
export function limparBaldesVelhos(
  baldes: Map<string, Balde>,
  janelaMs: number,
  agora: number,
): number {
  let removidos = 0;
  for (const [chave, balde] of baldes) {
    if (balde.tentativas.every(t => t <= agora - janelaMs)) {
      baldes.delete(chave);
      removidos++;
    }
  }
  return removidos;
}

/** De onde veio a requisição, atrás do proxy da Vercel. */
export function origemDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  // O primeiro da lista é o cliente; os seguintes são os proxies do caminho.
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}
