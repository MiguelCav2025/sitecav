import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  decidirEnvio,
  emailPareceValido,
  ehEmailDePreenchimento,
  montarLinkDeConfirmacao,
} from "@/lib/acesso";
import { enviarEmailDeAcesso } from "@/lib/email/acesso-professor";

/**
 * Envia ao professor o link do primeiro acesso — ou de um novo acesso, para
 * quem esqueceu a senha ou trocou de e-mail.
 *
 * Nenhuma senha é criada, escrita ou transmitida aqui. Pedimos ao Supabase um
 * link de uso único, mandamos por e-mail, e quem define a senha é o professor
 * na tela que abre depois. Ninguém mais chega a conhecê-la.
 *
 * Detalhe importante deste projeto: a API de *listagem* do Auth está fora do ar
 * (erro 500 no servidor do Supabase), mas a de geração de link funciona. Por
 * isso nunca perguntamos "esta conta existe?" — deduzimos pelo `user_id`
 * guardado em `professores` e tratamos a colisão quando ela aparece.
 */
export async function POST(request: Request) {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  let professorId: unknown;
  try {
    ({ professorId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  if (typeof professorId !== "string" || !professorId) {
    return NextResponse.json({ error: "Professor não informado." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: professor, error: erroBusca } = await admin
    .from("professores")
    .select("id, nome, email, user_id, senha_alterada, ativo")
    .eq("id", professorId)
    .maybeSingle();

  if (erroBusca) {
    return NextResponse.json({ error: "Falha ao buscar o professor." }, { status: 500 });
  }
  if (!professor) {
    return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });
  }
  if (!professor.ativo) {
    return NextResponse.json(
      { error: "Professor inativo. Reative o cadastro antes de dar acesso." },
      { status: 409 }
    );
  }

  const email = (professor.email ?? "").trim();
  if (!email) {
    return NextResponse.json(
      { error: "Este professor ainda não tem e-mail cadastrado. Preencha o e-mail antes de enviar." },
      { status: 409 }
    );
  }
  if (ehEmailDePreenchimento(email)) {
    return NextResponse.json(
      { error: "O e-mail cadastrado é de preenchimento (@cav.temp) e não recebe mensagens. Troque pelo e-mail real do professor." },
      { status: 409 }
    );
  }
  if (!emailPareceValido(email)) {
    return NextResponse.json(
      { error: `O e-mail "${email}" parece inválido. Corrija o cadastro antes de enviar.` },
      { status: 409 }
    );
  }

  const decisao = decidirEnvio(professor);

  // A origem vem do navegador do coordenador, que já está no site certo. Em
  // produção isso é o domínio da prefeitura; em desenvolvimento, o localhost.
  const origem = request.headers.get("origin") ?? new URL(request.url).origin;

  async function gerarLink(tipo: "invite" | "recovery") {
    return admin.auth.admin.generateLink({ type: tipo, email });
  }

  let { data: gerado, error: erroLink } = await gerarLink(decisao.tipoDeLink);

  // O palpite pelo `user_id` erra em dois casos reais, e nos dois o outro tipo
  // resolve: convite recusado porque já existe conta com este e-mail (vínculo
  // perdido), e recuperação recusada porque não existe (o professor trocou de
  // e-mail depois do cadastro). O `user_id` que volta reata o vínculo abaixo, e
  // o histórico de aulas não depende dele — está preso ao id do professor.
  if (erroLink) {
    const alternativa = decisao.tipoDeLink === "invite" ? "recovery" : "invite";
    const segundaTentativa = await gerarLink(alternativa);
    if (!segundaTentativa.error) {
      ({ data: gerado, error: erroLink } = segundaTentativa);
      decisao.tipoDeLink = alternativa;
      decisao.validadeEmHoras = alternativa === "invite" ? 24 : 1;
    }
  }

  if (erroLink || !gerado?.properties?.hashed_token) {
    return NextResponse.json(
      { error: `O Supabase recusou gerar o link: ${erroLink?.message ?? "resposta inesperada"}` },
      { status: 502 }
    );
  }

  // Reata o cadastro à conta. Sem isso o professor entra, mas o sistema não
  // sabe que aquele login é ele — e a área do professor aparece vazia.
  const userIdDaConta = gerado.user?.id ?? null;
  if (userIdDaConta && userIdDaConta !== professor.user_id) {
    const { error: erroVinculo } = await admin
      .from("professores")
      .update({ user_id: userIdDaConta })
      .eq("id", professor.id);

    if (erroVinculo) {
      return NextResponse.json(
        { error: `Link gerado, mas o vínculo com a conta falhou: ${erroVinculo.message}. Nada foi enviado.` },
        { status: 500 }
      );
    }
  }

  const { erro: erroEmail } = await enviarEmailDeAcesso({
    para: email,
    nome: professor.nome,
    link: montarLinkDeConfirmacao(origem, gerado.properties.hashed_token, decisao.tipoDeLink),
    tipo: decisao.tipoDeEmail,
    validadeEmHoras: decisao.validadeEmHoras,
  });

  if (erroEmail) {
    return NextResponse.json({ error: `Falha no envio do e-mail: ${erroEmail}` }, { status: 502 });
  }

  // Registrado só depois do envio confirmado, para a tela não mentir.
  const enviadoEm = new Date().toISOString();
  await admin.from("professores").update({ acesso_enviado_em: enviadoEm }).eq("id", professor.id);

  return NextResponse.json({ ok: true, email, enviadoEm, tipo: decisao.tipoDeEmail });
}
