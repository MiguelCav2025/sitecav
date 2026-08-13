"use client";

import { Fragment, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmacao, useConfirmacao } from "@/components/ui/confirmar";
import {
  Plus, Trash2, Loader2, CheckCircle, AlertCircle, UserCheck, Pencil, X, Check,
  Power, Send, ShieldCheck, Copy, Link2,
} from "lucide-react";

interface Professor {
  id: string;
  nome: string;
  email: string | null;
  senha_alterada: boolean;
  ativo: boolean;
  /** Login do professor. NULL = ainda sem conta, ou acesso revogado. */
  user_id: string | null;
  /** Quando o último link de acesso foi enviado. NULL = nunca. */
  acesso_enviado_em: string | null;
}

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function ProfessoresManager() {
  const supabase = createClient();
  const { confirmar, dialogo } = useConfirmacao();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "" });

  /** id do professor cujo convite está sendo gerado agora */
  const [enviando, setEnviando] = useState<string | null>(null);
  /** O link aparece na linha do próprio professor — nunca solto na tela, para
      não restar dúvida de a quem ele dá acesso. */
  const [linkGerado, setLinkGerado] = useState<
    { professorId: string; professor: string; link: string; horas: number; copiou: boolean } | null
  >(null);
  const [confirmandoNovoLink, setConfirmandoNovoLink] = useState<Professor | null>(null);

  // edição inline
  const [editando, setEditando] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 8000);
  };

  const fetchDados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("professores")
      .select("id, nome, email, senha_alterada, ativo, user_id, acesso_enviado_em")
      .order("ativo", { ascending: false })
      .order("nome");

    // Erro aqui quase sempre é a migração da Fase 12 ainda não aplicada. Sem
    // este aviso a tela apareceria vazia, como se não houvesse professor algum.
    if (error) showMsg("erro", `Não foi possível carregar os professores: ${error.message}`);
    setProfessores(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  /**
   * Cadastra o professor. Sem senha e sem conta de login: a conta nasce depois,
   * quando o convite é enviado. Assim o coordenador pode montar a lista agora,
   * antes de ter os e-mails de todo mundo.
   */
  const handleCriar = async () => {
    if (!form.nome.trim()) return showMsg("erro", "O nome é obrigatório.");

    setSalvando(true);
    const { error } = await supabase.from("professores").insert([{
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      senha_alterada: false,
    }]);
    setSalvando(false);

    if (error) return showMsg("erro", `Erro ao cadastrar: ${error.message}`);

    showMsg("ok", form.email.trim()
      ? `${form.nome} cadastrado. Use "Enviar acesso" para mandar o convite.`
      : `${form.nome} cadastrado. Preencha o e-mail quando souber, para poder enviar o acesso.`);
    setForm({ nome: "", email: "" });
    fetchDados();
  };

  /**
   * Pede ao servidor um link de uso único e manda por e-mail. O professor
   * define a própria senha ao clicar — nenhuma senha passa por esta tela nem
   * pelas mãos da coordenação.
   */
  /**
   * Primeiro link: sem cerimônia. Segundo em diante: confirma, porque o
   * anterior deixa de valer no mesmo instante — e pode já estar na mão do
   * professor. O texto muda conforme ele já tenha entrado ou não: para quem
   * está acessando, isto é uma redefinição de senha, não um convite.
   */
  const handleEnviarAcesso = (p: Professor) => {
    if (p.acesso_enviado_em === null) return gerarLink(p);
    setConfirmandoNovoLink(p);
  };

  const gerarLink = async (p: Professor) => {
    setConfirmandoNovoLink(null);
    setEnviando(p.id);
    try {
      const res = await fetch("/api/admin/enviar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: p.id, canal: "link" }),
      });
      const json = await res.json();
      if (!res.ok) { showMsg("erro", json.error ?? "Não foi possível gerar o acesso."); setEnviando(null); return; }

      // Copiar sem sair da tela: o coordenador cola direto na conversa que já
      // tem com o professor. O clipboard falha em contexto não seguro e em
      // alguns navegadores — por isso o link também aparece para copiar à mão.
      let copiou = false;
      try {
        await navigator.clipboard.writeText(json.link);
        copiou = true;
      } catch { /* mostrado abaixo, para copiar manualmente */ }

      setLinkGerado({
        professorId: p.id, professor: p.nome,
        link: json.link, horas: json.validadeEmHoras, copiou,
      });
      fetchDados();
    } catch {
      showMsg("erro", "Erro de rede ao gerar o acesso.");
    }
    setEnviando(null);
  };

  /**
   * Desativar é a operação normal: o professor sai da grade e perde o acesso,
   * mas o registro e todo o histórico de aulas continuam intactos.
   */
  const handleAlternarAtivo = async (p: Professor) => {
    const desativando = p.ativo;
    if (desativando) {
      const ok = await confirmar({
        titulo: `Desativar ${p.nome}?`,
        rotuloConfirmar: "Desativar",
        descricao: (
          <>
            <p>Ele perde o acesso ao app e some da lista de quem pode receber novas aulas.</p>
            <p>
              <strong>O histórico fica inteiro</strong>: as aulas que ele deu continuam com o
              nome dele, e os diários também. Reativar depois é um clique.
            </p>
          </>
        ),
      });
      if (!ok) return;
    }

    const { error } = await supabase
      .from("professores")
      .update({ ativo: !p.ativo })
      .eq("id", p.id);

    if (error) return showMsg("erro", `Erro ao alterar situação: ${error.message}`);
    showMsg("ok", desativando ? `${p.nome} foi desativado.` : `${p.nome} foi reativado.`);
    fetchDados();
  };

  /**
   * Exclusão de verdade. Só funciona para professor que nunca foi vinculado a
   * uma aula — a FK está como RESTRICT justamente para proteger o histórico.
   */
  const handleExcluir = async (p: Professor) => {
    const ok = await confirmar({
      titulo: `Excluir ${p.nome} definitivamente?`,
      perigo: true,
      rotuloConfirmar: "Excluir",
      descricao: (
        <>
          <p>O cadastro e a conta de acesso dele somem. Não há como desfazer.</p>
          <p>
            Só funciona para quem <strong>nunca teve aula atribuída</strong> — o banco recusa
            se houver histórico. Se ele já lecionou, o caminho é <strong>Desativar</strong>.
          </p>
        </>
      ),
    });
    if (!ok) return;

    const { error } = await supabase.from("professores").delete().eq("id", p.id);

    if (error) {
      return showMsg("erro",
        `Não é possível excluir: ${p.nome} já tem aulas atribuídas. Use Desativar para preservar o histórico.`
      );
    }

    // Só remove o login depois que o registro saiu sem erro
    if (p.user_id) {
      await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.user_id }),
      });
    }
    showMsg("ok", `${p.nome} foi excluído.`);
    fetchDados();
  };

  const iniciarEdicao = (p: Professor) => {
    setEditando(p.id);
    setEditForm({ nome: p.nome, email: p.email ?? "" });
  };

  const cancelarEdicao = () => { setEditando(null); };

  const salvarEdicao = async (id: string) => {
    if (!editForm.nome.trim()) return;
    setSalvandoEdit(true);
    const res = await fetch("/api/admin/update-professor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professorId: id, nome: editForm.nome.trim(), email: editForm.email.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      showMsg("erro", json.error ?? "Erro ao atualizar professor.");
    } else {
      setProfessores(prev => prev.map(p =>
        p.id === id ? { ...p, nome: editForm.nome.trim(), email: editForm.email.trim() || null } : p
      ));
      setEditando(null);
      showMsg("ok", "Professor atualizado!");
    }
    setSalvandoEdit(false);
  };

  /** Em que ponto do acesso o professor está. */
  const situacaoDoAcesso = (p: Professor) => {
    if (p.senha_alterada) return { texto: "Acessando", cor: "bg-green-50 text-green-700" };
    if (p.acesso_enviado_em) return { texto: "Convite enviado", cor: "bg-blue-50 text-blue-700" };
    return { texto: "Sem acesso", cor: "bg-gray-100 text-gray-500" };
  };

  const semEmail = professores.filter(p => p.ativo && !p.email).length;

  return (
    <div className="space-y-6">
      {dialogo}
      <Confirmacao
        aberto={confirmandoNovoLink !== null}
        titulo={confirmandoNovoLink?.senha_alterada ? "Redefinir a senha?" : "Gerar um novo link?"}
        perigo={confirmandoNovoLink?.senha_alterada ?? false}
        rotuloConfirmar={confirmandoNovoLink?.senha_alterada ? "Redefinir senha" : "Gerar novo link"}
        onCancelar={() => setConfirmandoNovoLink(null)}
        onConfirmar={() => confirmandoNovoLink && gerarLink(confirmandoNovoLink)}
        descricao={
          confirmandoNovoLink?.senha_alterada ? (
            <>
              <p>
                <strong>{confirmandoNovoLink.nome}</strong> já está usando o sistema. O novo link
                serve para ele <strong>criar outra senha</strong> — use quando ele esquecer a atual.
              </p>
              <p>A senha de hoje continua valendo até ele abrir o link e trocar.</p>
            </>
          ) : (
            <>
              <p>
                <strong>{confirmandoNovoLink?.nome}</strong> já tem um link gerado
                {confirmandoNovoLink?.acesso_enviado_em
                  ? ` em ${formatarData(confirmandoNovoLink.acesso_enviado_em)}`
                  : ""}, e ele ainda não foi usado.
              </p>
              <p className="text-amber-700">
                Gerar outro <strong>invalida o anterior na hora</strong>. Se você já mandou o
                primeiro, ele deixa de funcionar e o professor verá "link expirado".
              </p>
            </>
          )
        }
      />
      <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-800">Como o professor entra</p>
          <p className="text-sm text-gray-600">
            Cadastre o professor, preencha o e-mail e clique em <strong>Gerar link de acesso</strong>.
            O link é copiado na hora — mande por WhatsApp, e-mail pessoal, como preferir.
            Ele clica, cria a própria senha, e passa a entrar com e-mail e senha.
          </p>
          <p className="text-sm text-gray-600">
            Nenhuma senha é definida aqui, e ninguém além do professor chega a conhecê-la.
            Se ele esquecer ou trocar de endereço, é só gerar outro — o anterior deixa de valer.
          </p>
          <p className="text-xs text-gray-500">
            O e-mail é o <strong>login</strong> dele, não precisa receber nada. Por isso o
            link funciona mesmo antes de termos um domínio de envio configurado.
          </p>
          {semEmail > 0 && (
            <p className="text-xs text-amber-700 flex items-center gap-1 mt-2">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {semEmail === 1
                ? "1 professor ativo ainda está sem e-mail e não pode receber o acesso."
                : `${semEmail} professores ativos ainda estão sem e-mail e não podem receber o acesso.`}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Professor
          </CardTitle>
          <p className="text-sm text-gray-500">
            As disciplinas que ele leciona são definidas na aba <strong>Disciplinas</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-gray-700">Nome *</Label>
              <Input
                className="w-full text-gray-800"
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">E-mail</Label>
              <Input
                className="w-full text-gray-800"
                type="email"
                placeholder="professor@exemplo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <p className="text-xs text-gray-400">
                Pode ficar em branco agora e ser preenchido depois, pelo lápis na tabela.
                Sem ele não há como enviar o acesso.
              </p>
            </div>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {msg.texto}
            </div>
          )}

          <Button onClick={handleCriar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Cadastrar Professor
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : professores.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhum professor cadastrado.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Acesso</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Convite</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {professores.map(p => {
                  const situacao = situacaoDoAcesso(p);
                  const podeEnviar = p.ativo && !!p.email;
                  const meuLink = linkGerado?.professorId === p.id ? linkGerado : null;
                  return (
                    <Fragment key={p.id}>
                    <tr className="hover:bg-gray-50">
                      {editando === p.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input
                              className="h-8 text-xs text-gray-800 w-full"
                              value={editForm.nome}
                              onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                            />
                          </td>
                          <td className="px-4 py-2" colSpan={3}>
                            <Input
                              className="h-8 text-xs text-gray-800 w-full"
                              type="email"
                              placeholder="professor@exemplo.com"
                              value={editForm.email}
                              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => salvarEdicao(p.id)}
                                disabled={salvandoEdit}
                                className="text-green-600 hover:text-green-800 p-1"
                              >
                                {salvandoEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button onClick={cancelarEdicao} className="text-gray-400 hover:text-gray-600 p-1">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <div className={`flex items-center gap-2 font-medium ${p.ativo ? "text-gray-800" : "text-gray-400"}`}>
                              <UserCheck className={`h-4 w-4 shrink-0 ${p.ativo ? "text-blue-500" : "text-gray-300"}`} />
                              {p.nome}
                              {!p.ativo && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-3 ${p.ativo ? "text-gray-500" : "text-gray-300"}`}>
                            {p.email ?? <span className="text-amber-600 italic">falta preencher</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${situacao.cor}`}>
                              {situacao.texto}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {p.acesso_enviado_em ? formatarData(p.acesso_enviado_em) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEnviarAcesso(p)}
                                disabled={!podeEnviar || enviando === p.id}
                                // Estado explícito em vez da variante `disabled:`: o botão
                                // precisa parecer inerte de longe, senão o coordenador clica
                                // achando que mandou convite e nada acontece.
                                className={`p-1 ${podeEnviar
                                  ? "text-blue-500 hover:text-blue-700"
                                  : "text-gray-300 cursor-not-allowed"}`}
                                title={
                                  !p.ativo ? "Professor inativo"
                                    : !p.email ? "Preencha o e-mail para poder gerar o link"
                                    : p.acesso_enviado_em ? `Gerar um novo link para ${p.nome}`
                                    : `Copiar o link de primeiro acesso de ${p.nome}`
                                }
                              >
                                {/* Copiar, não enviar: o avião de papel prometia
                                    um envio que não acontece — quem manda é o
                                    coordenador, pelo caminho que quiser. */}
                                {enviando === p.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Link2 className="h-4 w-4" />}
                              </button>
                              <button onClick={() => iniciarEdicao(p)} className="text-blue-400 hover:text-blue-600 p-1" title="Editar nome e e-mail">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleAlternarAtivo(p)}
                                className={`p-1 ${p.ativo ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}`}
                                title={p.ativo ? "Desativar (preserva o histórico)" : "Reativar"}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleExcluir(p)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Excluir (só se nunca teve aula atribuída)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>

                    {meuLink && (
                      <tr className="bg-blue-50/70">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm text-gray-700">
                                Link de <strong>{p.nome}</strong> — {p.email}
                                <span className="block text-xs text-gray-500">
                                  Vale {meuLink.horas}h, uso único. Só esta pessoa deve recebê-lo:
                                  quem abrir entra como ela.
                                </span>
                              </p>
                              <button onClick={() => setLinkGerado(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            {meuLink.copiou ? (
                              <p className="flex items-center gap-1.5 text-sm text-green-700">
                                <CheckCircle className="h-4 w-4 shrink-0" /> Copiado — é só colar na conversa com {p.nome.split(" ")[0]}.
                              </p>
                            ) : (
                              <p className="flex items-center gap-1.5 text-sm text-amber-700">
                                <AlertCircle className="h-4 w-4 shrink-0" /> O navegador não deixou copiar sozinho — selecione o texto e copie.
                              </p>
                            )}

                            <input
                              readOnly
                              value={meuLink.link}
                              onFocus={e => e.currentTarget.select()}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-700"
                            />

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(meuLink.link)
                                    .then(() => setLinkGerado({ ...meuLink, copiou: true }))
                                    .catch(() => showMsg("erro", "Não consegui copiar — selecione o texto e copie à mão."));
                                }}
                              >
                                <Copy className="h-4 w-4 mr-1" /> Copiar link
                              </Button>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `Olá, ${p.nome.split(" ")[0]}! Seu acesso ao sistema do CAV: ${meuLink.link}\n\n` +
                                  `Você entra com o e-mail ${p.email} e a senha que criar ao abrir o link. ` +
                                  `Ele vale ${meuLink.horas}h e só pode ser usado uma vez.`,
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-800 hover:bg-green-100"
                              >
                                <Send className="h-4 w-4" /> Abrir no WhatsApp
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
