"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirmacao } from "@/components/ui/confirmar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Loader2, CheckCircle, AlertCircle, ListChecks, Eye, EyeOff, Wand2,
} from "lucide-react";
import { interpretarGabarito, numerosFaltando, type ItemGabarito } from "@/lib/gabarito";

interface Gabarito {
  id: string;
  semestre: string;
  curso: string | null;
  titulo: string | null;
  observacao: string | null;
  is_active: boolean;
}

const CURSOS = ["Animação", "Cine/TV"];
const SEM_CURSO = "todos";

export default function GabaritoManager() {
  const supabase = createClient();
  const { confirmar, dialogo } = useConfirmacao();

  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const [form, setForm] = useState({ semestre: "", curso: SEM_CURSO, titulo: "", observacao: "" });
  const [salvando, setSalvando] = useState(false);

  const [selecionado, setSelecionado] = useState<Gabarito | null>(null);
  const [itens, setItens] = useState<ItemGabarito[]>([]);
  const [colagem, setColagem] = useState("");
  const [salvandoItens, setSalvandoItens] = useState(false);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 6000);
  };

  const fetchGabaritos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gabaritos")
      .select("id, semestre, curso, titulo, observacao, is_active")
      .order("created_at", { ascending: false });
    setGabaritos(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchGabaritos(); }, [fetchGabaritos]);

  const abrirItens = async (g: Gabarito) => {
    setSelecionado(g);
    setColagem("");
    const { data } = await supabase
      .from("gabarito_itens")
      .select("numero, resposta")
      .eq("gabarito_id", g.id)
      .order("numero");
    setItens((data ?? []) as ItemGabarito[]);
  };

  const handleCriar = async () => {
    if (!form.semestre.trim()) return showMsg("erro", "Informe o semestre (ex.: 2026/1).");
    setSalvando(true);
    const { data, error } = await supabase
      .from("gabaritos")
      .insert([{
        semestre: form.semestre.trim(),
        curso: form.curso === SEM_CURSO ? null : form.curso,
        titulo: form.titulo.trim() || null,
        observacao: form.observacao.trim() || null,
        is_active: false, // nasce como rascunho: só aparece no site quando publicado
      }])
      .select()
      .single();

    if (error) { showMsg("erro", `Erro ao criar: ${error.message}`); setSalvando(false); return; }

    showMsg("ok", "Gabarito criado como rascunho. Cadastre as respostas e publique.");
    setForm({ semestre: "", curso: SEM_CURSO, titulo: "", observacao: "" });
    setSalvando(false);
    await fetchGabaritos();
    if (data) abrirItens(data as Gabarito);
  };

  const handlePublicar = async (g: Gabarito) => {
    if (!g.is_active) {
      const { count } = await supabase
        .from("gabarito_itens")
        .select("id", { count: "exact", head: true })
        .eq("gabarito_id", g.id);
      if (!count) return showMsg("erro", "Cadastre as respostas antes de publicar.");
    }

    const { error } = await supabase
      .from("gabaritos")
      .update({ is_active: !g.is_active, updated_at: new Date().toISOString() })
      .eq("id", g.id);

    if (error) return showMsg("erro", `Erro: ${error.message}`);
    showMsg("ok", g.is_active ? "Gabarito despublicado." : "Gabarito publicado no site.");
    fetchGabaritos();
    if (selecionado?.id === g.id) setSelecionado({ ...g, is_active: !g.is_active });
  };

  const handleExcluir = async (g: Gabarito) => {
    const ok = await confirmar({
      titulo: `Excluir o gabarito de ${g.semestre}?`,
      perigo: true,
      rotuloConfirmar: "Excluir gabarito",
      descricao: (
        <>
          <p><strong>Todas as respostas cadastradas vão junto.</strong> Não há como desfazer.</p>
          <p className="text-gray-500">Se a intenção é só tirar do ar, desative em vez de excluir.</p>
        </>
      ),
    });
    if (!ok) return;
    const { error } = await supabase.from("gabaritos").delete().eq("id", g.id);
    if (error) return showMsg("erro", `Erro ao excluir: ${error.message}`);
    if (selecionado?.id === g.id) { setSelecionado(null); setItens([]); }
    showMsg("ok", "Gabarito excluído.");
    fetchGabaritos();
  };

  /** Substitui todas as respostas do gabarito pelo que está na tela. */
  const salvarItens = async (novos: ItemGabarito[]) => {
    if (!selecionado) return;
    setSalvandoItens(true);

    const { error: errDel } = await supabase
      .from("gabarito_itens").delete().eq("gabarito_id", selecionado.id);
    if (errDel) { showMsg("erro", `Erro ao limpar respostas: ${errDel.message}`); setSalvandoItens(false); return; }

    if (novos.length > 0) {
      const { error } = await supabase.from("gabarito_itens").insert(
        novos.map(i => ({ gabarito_id: selecionado.id, numero: i.numero, resposta: i.resposta }))
      );
      if (error) { showMsg("erro", `Erro ao salvar respostas: ${error.message}`); setSalvandoItens(false); return; }
    }

    setItens(novos);
    setSalvandoItens(false);
    showMsg("ok", `${novos.length} resposta(s) salva(s).`);
  };

  const aplicarColagem = () => {
    const lidos = interpretarGabarito(colagem);
    if (lidos.length === 0) return showMsg("erro", "Não consegui ler nenhuma resposta. Use o formato 1-A, 2-B...");
    setItens(lidos);
    setColagem("");
    showMsg("ok", `${lidos.length} resposta(s) interpretada(s). Confira e clique em Salvar.`);
  };

  const alterarResposta = (numero: number, resposta: string) =>
    setItens(prev => prev.map(i => (i.numero === numero ? { ...i, resposta } : i)));

  const faltando = numerosFaltando(itens);

  return (
    <div className="space-y-6">
      {dialogo}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
          msg.tipo === "ok"
            ? "border border-green-200 bg-green-50 text-green-800"
            : "border border-red-200 bg-red-50 text-red-800"}`}>
          {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.texto}
        </div>
      )}

      {/* Novo gabarito */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Novo Gabarito
          </CardTitle>
          <p className="text-sm text-gray-500">
            Ele aparece no topo da página pública apenas quando o Processo Seletivo está em modo{" "}
            <strong>Resultados</strong> e o gabarito está publicado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-gray-700">Semestre *</Label>
              <Input
                className="text-gray-800"
                placeholder="2026/1"
                value={form.semestre}
                onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Curso</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CURSO}>Todos os cursos</SelectItem>
                  {CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-700">Título</Label>
            <Input
              className="text-gray-800"
              placeholder="Prova objetiva (opcional)"
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-700">Observação</Label>
            <Input
              className="text-gray-800"
              placeholder="Texto exibido abaixo do gabarito (opcional)"
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            />
          </div>
          <Button onClick={handleCriar} disabled={salvando}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Criar Gabarito
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : gabaritos.length === 0 ? (
        <p className="text-sm italic text-white/50">Nenhum gabarito cadastrado.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Gabarito</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Curso</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Situação</th>
                  <th className="w-32 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gabaritos.map(g => (
                  <tr key={g.id} className={`hover:bg-gray-50 ${selecionado?.id === g.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirItens(g)} className="text-left">
                        <span className="font-medium text-gray-800">{g.titulo || "Prova"}</span>
                        <span className="ml-2 text-gray-400">{g.semestre}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{g.curso ?? "Todos"}</td>
                    <td className="px-4 py-3">
                      {g.is_active
                        ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Publicado</span>
                        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Rascunho</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => abrirItens(g)} className="p-1 text-blue-400 hover:text-blue-600" title="Editar respostas">
                          <ListChecks className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePublicar(g)}
                          className={`p-1 ${g.is_active ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}`}
                          title={g.is_active ? "Despublicar" : "Publicar no site"}
                        >
                          {g.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleExcluir(g)} className="p-1 text-red-400 hover:text-red-600" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Editor de respostas */}
      {selecionado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Respostas — {selecionado.titulo || "Prova"} {selecionado.semestre}
              {selecionado.curso && <span className="text-gray-400"> · {selecionado.curso}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-gray-700">Colar gabarito</Label>
              <textarea
                rows={4}
                value={colagem}
                onChange={e => setColagem(e.target.value)}
                placeholder={"1-A  2-B  3-C\n4. D, 5) E\n12 - Todas as anteriores"}
                className="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400">
                Aceita quebra de linha, vírgula ou espaço. Serve para colar a prova inteira de uma vez.
              </p>
              <Button variant="outline" size="sm" onClick={aplicarColagem} disabled={!colagem.trim()}>
                <Wand2 className="mr-2 h-4 w-4" /> Interpretar
              </Button>
            </div>

            {itens.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-gray-700">{itens.length} questões</span>
                  {faltando.length > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      Faltando: {faltando.join(", ")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {itens.map(i => (
                    <div key={i.numero} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5">
                      <span className="w-7 shrink-0 text-right text-xs font-semibold text-gray-400">{i.numero}</span>
                      <input
                        value={i.resposta}
                        onChange={e => alterarResposta(i.numero, e.target.value)}
                        className="w-full min-w-0 border-0 p-0 text-sm font-medium text-gray-800 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={() => salvarItens(itens)} disabled={salvandoItens}>
                {salvandoItens ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Salvar respostas
              </Button>
              <Button variant="outline" onClick={() => { setSelecionado(null); setItens([]); }}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
