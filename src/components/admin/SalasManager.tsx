"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirmacao } from "@/components/ui/confirmar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle, Check, CheckCircle, DoorOpen, Loader2, Pencil, Plus, Power, Trash2, X,
} from "lucide-react";

interface Sala {
  id: string;
  nome: string;
  observacao: string | null;
  ativa: boolean;
  emUso: number;
}

/**
 * Cadastro dos espaços onde as aulas acontecem.
 *
 * A grade curricular do CAV indica a sala de cada disciplina, e o professor
 * precisa saber para onde ir. Sala com disciplina vinculada não é apagada —
 * desativa-se, como fazemos com professor e disciplina.
 */
export default function SalasManager() {
  const supabase = createClient();
  const { confirmar, dialogo } = useConfirmacao();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ nome: "", observacao: "" });
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");

  const aviso = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: salasData }, { data: disciplinas }] = await Promise.all([
      supabase.from("salas").select("id, nome, observacao, ativa").order("nome"),
      supabase.from("disciplinas").select("sala_id"),
    ]);

    const uso = new Map<string, number>();
    for (const d of (disciplinas ?? []) as { sala_id: string | null }[]) {
      if (d.sala_id) uso.set(d.sala_id, (uso.get(d.sala_id) ?? 0) + 1);
    }

    setSalas(((salasData ?? []) as Omit<Sala, "emUso">[]).map(s => ({ ...s, emUso: uso.get(s.id) ?? 0 })));
    setCarregando(false);
  }, [supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  const criar = async () => {
    if (!form.nome.trim()) return aviso("erro", "Dê um nome à sala.");
    setSalvando(true);
    const { error } = await supabase.from("salas").insert([{
      nome: form.nome.trim(),
      observacao: form.observacao.trim() || null,
    }]);
    setSalvando(false);
    if (error) {
      return aviso("erro", error.message.includes("duplicate")
        ? `Já existe uma sala chamada "${form.nome.trim()}".`
        : `Erro ao criar: ${error.message}`);
    }
    setForm({ nome: "", observacao: "" });
    carregar();
  };

  const salvarNome = async (s: Sala) => {
    if (!nomeEdit.trim()) return;
    const { error } = await supabase.from("salas").update({ nome: nomeEdit.trim() }).eq("id", s.id);
    if (error) return aviso("erro", `Erro ao renomear: ${error.message}`);
    setEditando(null);
    carregar();
  };

  const alternarAtiva = async (s: Sala) => {
    const { error } = await supabase.from("salas").update({ ativa: !s.ativa }).eq("id", s.id);
    if (error) return aviso("erro", `Erro: ${error.message}`);
    carregar();
  };

  const excluir = async (s: Sala) => {
    if (s.emUso > 0) {
      return aviso("erro",
        `"${s.nome}" está em ${s.emUso} disciplina(s). Desative em vez de excluir.`);
    }
    const ok = await confirmar({
      titulo: `Excluir a sala "${s.nome}"?`,
      perigo: true,
      rotuloConfirmar: "Excluir sala",
      descricao: (
        <>
          <p>As disciplinas que aconteciam nela ficam <strong>sem sala</strong>, e passam a aparecer em âmbar na grade.</p>
          <p className="text-gray-500">Se a sala só saiu de uso, desative em vez de excluir — assim o histórico continua legível.</p>
        </>
      ),
    });
    if (!ok) return;
    const { error } = await supabase.from("salas").delete().eq("id", s.id);
    if (error) return aviso("erro", `Erro ao excluir: ${error.message}`);
    carregar();
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Nova Sala
          </CardTitle>
          <p className="text-sm text-gray-500">
            Os espaços onde as aulas acontecem. A disciplina aponta para uma sala, e o professor a vê no app.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-gray-700">Nome *</Label>
              <Input
                className="text-gray-800"
                placeholder="Digital 1"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") criar(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-700">Observação</Label>
              <Input
                className="text-gray-800"
                placeholder="Opcional"
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Criar Sala
          </Button>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="flex items-center gap-2 py-4 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : salas.length === 0 ? (
        <p className="text-sm italic text-white/50">Nenhuma sala cadastrada.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Sala</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Observação</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Uso</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salas.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {editando === s.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            className="h-8 w-full text-xs text-gray-800"
                            value={nomeEdit}
                            onChange={e => setNomeEdit(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") salvarNome(s);
                              if (e.key === "Escape") setEditando(null);
                            }}
                          />
                          <button onClick={() => salvarNome(s)} className="shrink-0 text-green-600 hover:text-green-800">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditando(null)} className="shrink-0 text-gray-400 hover:text-gray-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className={`flex items-center gap-2 font-medium ${s.ativa ? "text-gray-800" : "text-gray-400"}`}>
                          <DoorOpen className={`h-4 w-4 shrink-0 ${s.ativa ? "text-blue-500" : "text-gray-300"}`} />
                          {s.nome}
                          {!s.ativa && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inativa</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.observacao ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.emUso === 0
                        ? <span className="text-xs italic text-gray-400">livre</span>
                        : `${s.emUso} disciplina${s.emUso !== 1 ? "s" : ""}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditando(s.id); setNomeEdit(s.nome); }}
                          className="p-1 text-blue-400 hover:text-blue-600"
                          title="Renomear"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => alternarAtiva(s)}
                          className={`p-1 ${s.ativa ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}`}
                          title={s.ativa ? "Desativar" : "Reativar"}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => excluir(s)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Excluir (só se nenhuma disciplina usar)"
                        >
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
    </div>
  );
}
