import { Resend } from "resend";

/**
 * O e-mail que leva o professor ao primeiro acesso.
 *
 * O link é de uso único e expira. Nenhuma senha trafega por aqui: quem define
 * a senha é o próprio professor, na tela que abre depois do clique. Assim
 * ninguém — nem a coordenação — chega a conhecer a senha de ninguém.
 */

/**
 * Remetente. Precisa ser de um domínio verificado no Resend; caso contrário o
 * envio falha com "domain is not verified". O padrão só serve para teste e
 * entrega apenas no e-mail dono da conta Resend.
 */
const REMETENTE = process.env.RESEND_FROM ?? "CAV <onboarding@resend.dev>";

export type TipoDeAcesso = "primeiro" | "novo";

interface Parametros {
  para: string;
  nome: string;
  link: string;
  tipo: TipoDeAcesso;
  /** Quanto tempo o link vale, em horas — só para o texto do e-mail. */
  validadeEmHoras: number;
}

function corpo({ nome, link, tipo, validadeEmHoras }: Omit<Parametros, "para">) {
  const primeiroNome = nome.trim().split(/\s+/)[0];

  const chamada =
    tipo === "primeiro"
      ? "Seu acesso ao sistema do CAV está pronto."
      : "Recebemos um pedido para refazer seu acesso ao sistema do CAV.";

  const explicacao =
    tipo === "primeiro"
      ? "Clique no botão abaixo para criar sua senha. Depois disso, é com ela que você entra."
      : "Clique no botão abaixo para definir uma nova senha.";

  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:0 0 24px">
    Centro de Audiovisual de São Bernardo do Campo
  </p>

  <p style="font-size:16px;margin:0 0 8px">Olá, ${primeiroNome}.</p>
  <p style="font-size:16px;line-height:1.55;margin:0 0 24px">${chamada} ${explicacao}</p>

  <p style="margin:0 0 28px">
    <a href="${link}"
       style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
              padding:13px 26px;border-radius:8px;font-size:15px;font-weight:600">
      Criar minha senha
    </a>
  </p>

  <p style="font-size:14px;line-height:1.55;color:#4b5563;margin:0 0 24px">
    O link vale por ${validadeEmHoras} ${validadeEmHoras === 1 ? "hora" : "horas"} e só pode ser usado uma vez.
    Se ele expirar, peça um novo à coordenação — não há problema nenhum em repetir.
  </p>

  <p style="font-size:14px;line-height:1.55;color:#4b5563;margin:0 0 24px">
    No celular, depois de entrar, use a opção <strong>Adicionar à tela de início</strong>
    do navegador. O sistema passa a abrir como aplicativo, direto no ícone.
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0" />

  <p style="font-size:13px;line-height:1.5;color:#9ca3af;margin:0">
    Se você não esperava este e-mail, pode ignorá-lo — sem o clique, nada muda.
    Esta mensagem é automática; não responda.
  </p>
</div>`.trim();
}

export async function enviarEmailDeAcesso({
  para,
  nome,
  link,
  tipo,
  validadeEmHoras,
}: Parametros): Promise<{ erro: string | null }> {
  if (!process.env.RESEND_API_KEY) {
    return { erro: "RESEND_API_KEY não configurada — o e-mail não pôde ser enviado." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: REMETENTE,
    to: para,
    subject:
      tipo === "primeiro"
        ? "Seu acesso ao sistema do CAV"
        : "Refazer o acesso ao sistema do CAV",
    html: corpo({ nome, link, tipo, validadeEmHoras }),
  });

  return { erro: error ? error.message : null };
}
