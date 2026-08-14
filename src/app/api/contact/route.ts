import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  registrarTentativa, limparBaldesVelhos, origemDaRequisicao, type Balde,
} from "@/lib/limite-de-taxa";

/**
 * Formulário de contato do site.
 *
 * É a única rota pública que dispara e-mail. Sem freio nem validação, um
 * script simples esgota a cota do Resend, derruba o canal e ainda gera custo —
 * e o CAV descobriria pelo silêncio, quando alguém reclamasse que escreveu e
 * ninguém respondeu.
 */

/** Vive na memória do processo. Ver a nota em `limite-de-taxa.ts`. */
const baldes = new Map<string, Balde>();
const LIMITE = { maximo: 5, janelaMs: 10 * 60_000 };

const LIMITES_DO_TEXTO = {
  nome: 120,
  email: 254,
  mensagem: 5000,
};

const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/** Escapa o que vai para dentro do HTML do e-mail. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Cabeçalho de e-mail não aceita quebra de linha: quem injeta `\nBcc:` no
 * campo de e-mail transforma o formulário do CAV em disparador de spam.
 */
const temInjecaoDeCabecalho = (v: string) => /[\r\n]/.test(v);

export async function POST(req: Request) {
  const origem = origemDaRequisicao(req.headers);
  const freio = registrarTentativa(baldes, origem, LIMITE, Date.now());
  limparBaldesVelhos(baldes, LIMITE.janelaMs, Date.now());

  if (!freio.permitido) {
    return NextResponse.json(
      {
        success: false,
        error: `Muitas mensagens seguidas. Tente de novo em ${Math.ceil(freio.esperarSegundos / 60)} minuto(s).`,
      },
      { status: 429, headers: { "Retry-After": String(freio.esperarSegundos) } },
    );
  }

  let corpo: { name?: unknown; email?: unknown; message?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Envio inválido." }, { status: 400 });
  }

  const nome = typeof corpo.name === "string" ? corpo.name.trim() : "";
  const email = typeof corpo.email === "string" ? corpo.email.trim() : "";
  const mensagem = typeof corpo.message === "string" ? corpo.message.trim() : "";

  if (!nome || !email || !mensagem) {
    return NextResponse.json(
      { success: false, error: "Preencha nome, e-mail e mensagem." },
      { status: 400 },
    );
  }
  if (nome.length > LIMITES_DO_TEXTO.nome || email.length > LIMITES_DO_TEXTO.email ||
      mensagem.length > LIMITES_DO_TEXTO.mensagem) {
    return NextResponse.json(
      { success: false, error: "Mensagem longa demais." },
      { status: 400 },
    );
  }
  if (!EMAIL.test(email) || temInjecaoDeCabecalho(email) || temInjecaoDeCabecalho(nome)) {
    return NextResponse.json(
      { success: false, error: "E-mail inválido." },
      { status: 400 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    // Sem chave, o envio falharia de qualquer jeito — melhor dizer isso do que
    // devolver "sucesso" para uma mensagem que ninguém vai ler.
    return NextResponse.json(
      { success: false, error: "O envio está indisponível. Escreva para centrodeaudiovisualsbc@gmail.com." },
      { status: 503 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      // Precisa ser de domínio verificado no Resend. O valor anterior era um
      // placeholder ("contato@seudominio.com") que nunca foi trocado — ou seja,
      // o formulário provavelmente não entregava nada.
      from: process.env.RESEND_FROM ?? "CAV <onboarding@resend.dev>",
      to: "centrodeaudiovisualsbc@gmail.com",
      subject: `Contato pelo site — ${nome}`,
      replyTo: email,
      html: `<p><b>Nome:</b> ${escaparHtml(nome)}</p>
             <p><b>E-mail:</b> ${escaparHtml(email)}</p>
             <p><b>Mensagem:</b><br/>${escaparHtml(mensagem).replace(/\n/g, "<br/>")}</p>`,
    });

    if (error) {
      // A mensagem do provedor não vai para o visitante: ela expõe detalhes da
      // configuração e ele não tem o que fazer com isso.
      console.error("[contato] falha no envio:", error);
      return NextResponse.json(
        { success: false, error: "Não foi possível enviar agora. Tente mais tarde." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[contato] erro inesperado:", e);
    return NextResponse.json(
      { success: false, error: "Não foi possível enviar agora. Tente mais tarde." },
      { status: 502 },
    );
  }
}
