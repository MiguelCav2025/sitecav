import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decidirEnvio,
  emailPareceValido,
  ehEmailDePreenchimento,
  montarLinkDeConfirmacao,
} from "../src/lib/acesso.ts";

describe("decidirEnvio", () => {
  it("professor sem conta recebe convite, que é o único tipo que cria a conta", () => {
    const d = decidirEnvio({ user_id: null, senha_alterada: false });
    assert.equal(d.tipoDeLink, "invite");
    assert.equal(d.tipoDeEmail, "primeiro");
  });

  it("professor com conta que já definiu senha recebe recuperação", () => {
    const d = decidirEnvio({ user_id: "abc", senha_alterada: true });
    assert.equal(d.tipoDeLink, "recovery");
    assert.equal(d.tipoDeEmail, "novo");
  });

  it("conta criada na importação, mas nunca usada, ainda é primeiro acesso", () => {
    // O tipo de link segue a existência da conta; o tom do e-mail, não.
    const d = decidirEnvio({ user_id: "abc", senha_alterada: false });
    assert.equal(d.tipoDeLink, "recovery");
    assert.equal(d.tipoDeEmail, "primeiro");
  });

  it("convite vale mais tempo que recuperação", () => {
    const convite = decidirEnvio({ user_id: null, senha_alterada: false });
    const recuperacao = decidirEnvio({ user_id: "abc", senha_alterada: true });
    assert.ok(convite.validadeEmHoras > recuperacao.validadeEmHoras);
  });
});

describe("emailPareceValido", () => {
  it("aceita endereços comuns", () => {
    for (const e of ["ana@gmail.com", "ana.silva@cav.sp.gov.br", "a@b.co"]) {
      assert.equal(emailPareceValido(e), true, e);
    }
  });

  it("ignora espaços em volta", () => {
    assert.equal(emailPareceValido("  ana@gmail.com  "), true);
  });

  it("recusa o que claramente não é endereço", () => {
    for (const e of ["", "ana", "ana@", "@gmail.com", "ana@gmail", "a n a@x.com", "ana@@x.com"]) {
      assert.equal(emailPareceValido(e), false, JSON.stringify(e));
    }
  });
});

describe("ehEmailDePreenchimento", () => {
  it("reconhece os endereços inventados na importação", () => {
    assert.equal(ehEmailDePreenchimento("joao.silva@cav.temp"), true);
    assert.equal(ehEmailDePreenchimento("JOAO@CAV.TEMP"), true);
  });

  it("não confunde com o domínio real da prefeitura", () => {
    assert.equal(ehEmailDePreenchimento("joao@cav.saobernardo.sp.gov.br"), false);
    assert.equal(ehEmailDePreenchimento("joao@gmail.com"), false);
  });
});

describe("montarLinkDeConfirmacao", () => {
  it("aponta para o nosso verificador, não para o Supabase", () => {
    const link = montarLinkDeConfirmacao("https://cav.exemplo.br", "abc123", "invite");
    const url = new URL(link);
    assert.equal(url.origin, "https://cav.exemplo.br");
    assert.equal(url.pathname, "/auth/confirmar");
    assert.equal(url.searchParams.get("token_hash"), "abc123");
    assert.equal(url.searchParams.get("type"), "invite");
  });

  it("escapa o token em vez de colá-lo cru na URL", () => {
    const link = montarLinkDeConfirmacao("http://localhost:3000", "a+b/c=d&e", "recovery");
    assert.equal(new URL(link).searchParams.get("token_hash"), "a+b/c=d&e");
  });
});
