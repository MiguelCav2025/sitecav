import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { name, email, message } = await req.json();

  try {
    await resend.emails.send({
      from: "Contato Site CAV <contato@seudominio.com>", // Precisa ser domínio verificado no Resend
      to: "centrodeaudiovisualsbc@gmail.com",
      subject: `Nova mensagem de contato de ${name}`,
      replyTo: email,
      html: `<p><b>Nome:</b> ${name}</p>
             <p><b>Email:</b> ${email}</p>
             <p><b>Mensagem:</b><br/>${message}</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
} 