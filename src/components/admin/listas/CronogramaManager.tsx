"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { contarDiasLetivos } from "@/lib/calendario-escolar";
import { useConfirmacao } from "@/components/ui/confirmar";
import { conciliarFeriados, type TipoDeFeriado } from "@/lib/feriados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, Calendar, ChevronDown, ChevronUp, X } from "lucide-react";

interface Cronograma {
  id: string;
  semestre: string;
  data_inicio: string;
  data_fim: string;
  feriados: string[];
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatarData(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Conta quantas ocorrências de cada dia da semana (1=Seg…5=Sex) há no período.
// A regra vive em @/lib/calendario-escolar, com testes.
const contarOcorrencias = (inicio: string, fim: string, feriados: string[]) =>
  contarDiasLetivos({ data_inicio: inicio, data_fim: fim, feriados });

export default function CronogramaManager() {
  const supabase = createClient();
  const { confirmar, dialogo } = useConfirmacao();
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({ semestre: "", data_inicio: "", data_fim: "" });
  // Feriados em edição por cronograma
  const [feriadoInput, setFeriadoInput] = useState<Record<string, string>>({});
  // Edição inline de datas por cronograma
  const [editDatas, setEditDatas] = useState<Record<string, { inicio: string; fim: string }>>({});

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cronogramas")
      .select("*")
      .order("data_inicio", { ascending: false });
    const rows = data ?? [];
    setCronogramas(rows);
    // inicializa editDatas com os valores atuais
    const init: Record<string, { inicio: string; fim: string }> = {};
    rows.forEach(c => { init[c.id] = { inicio: c.data_inicio, fim: c.data_fim }; });
    setEditDatas(init);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCriar = async () => {
    if (!form.semestre.trim() || !form.data_inicio || !form.data_fim)
      return showMsg("erro", "Preencha semestre, início e fim.");
    if (form.data_inicio > form.data_fim)
      return showMsg("erro", "Data de início deve ser anterior ao fim.");
    setSalvando(true);
    const { error } = await supabase.from("cronogramas").insert([{
      semestre: form.semestre.trim(),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      feriados: [],
    }]);
    if (error) showMsg("erro", "Erro ao salvar cronograma.");
    else {
      showMsg("ok", `Cronograma ${form.semestre} criado!`);
      setForm({ semestre: "", data_inicio: "", data_fim: "" });
      setFormAberto(false);
      fetch();
    }
    setSalvando(false);
  };

  const handleExcluir = async (id: string, semestre: string) => {
    const ok = await confirmar({
      titulo: `Excluir o calendário de ${semestre}?`,
      perigo: true,
      rotuloConfirmar: "Excluir calendário",
      descricao: (
        <>
          <p>Somem as datas de início e fim e todos os feriados marcados.</p>
          <p><strong>As aulas já geradas continuam com as datas que têm.</strong> Mas sem o calendário, criar disciplina nova neste semestre deixa de saber quantas aulas cabem.</p>
        </>
      ),
    });
    if (!ok) return;
    await supabase.from("cronogramas").delete().eq("id", id);
    fetch();
  };

  const handleAdicionarFeriado = async (cron: Cronograma) => {
    const val = feriadoInput[cron.id]?.trim();
    if (!val) return;
    if (val < cron.data_inicio || val > cron.data_fim)
      return showMsg("erro", "Data fora do período do cronograma.");
    const novosFeriados = [...cron.feriados, val].sort();
    await supabase.from("cronogramas").update({ feriados: novosFeriados }).eq("id", cron.id);
    setCronogramas(prev => prev.map(c => c.id === cron.id ? { ...c, feriados: novosFeriados } : c));
    setFeriadoInput(prev => ({ ...prev, [cron.id]: "" }));
  };

  const handleSalvarDatas = async (cronId: string) => {
    const ed = editDatas[cronId];
    if (!ed) return;
    if (ed.inicio > ed.fim) return showMsg("erro", "Data de início deve ser anterior ao fim.");
    await supabase.from("cronogramas").update({ data_inicio: ed.inicio, data_fim: ed.fim }).eq("id", cronId);
    setCronogramas(prev => prev.map(c => c.id === cronId ? { ...c, data_inicio: ed.inicio, data_fim: ed.fim } : c));
    showMsg("ok", "Datas atualizadas!");
  };

  const handleRemoverFeriado = async (cron: Cronograma, data: string) => {
    const novosFeriados = cron.feriados.filter(f => f !== data);
    await supabase.from("cronogramas").update({ feriados: novosFeriados }).eq("id", cron.id);
    setCronogramas(prev => prev.map(c => c.id === cron.id ? { ...c, feriados: novosFeriados } : c));
  };

  /**
   * Aceita feriados sugeridos pelo calendário.
   *
   * A sugestão nunca se aplica sozinha: quem decide se o CAV para naquele dia é
   * a coordenação. Ponto facultativo, então, muda de escola para escola.
   */
  const handleAceitarSugestoes = async (cron: Cronograma, datas: string[]) => {
    if (datas.length === 0) return;
    const novosFeriados = [...new Set([...cron.feriados, ...datas])].sort();
    const { error } = await supabase
      .from("cronogramas").update({ feriados: novosFeriados }).eq("id", cron.id);
    if (error) return showMsg("erro", `Erro ao salvar feriados: ${error.message}`);
    setCronogramas(prev => prev.map(c => c.id === cron.id ? { ...c, feriados: novosFeriados } : c));
    showMsg("ok", datas.length === 1
      ? "Feriado adicionado."
      : `${datas.length} feriados adicionados.`);
  };

  const CORES_POR_TIPO: Record<TipoDeFeriado, string> = {
    nacional:    "bg-red-50 border-red-200 text-red-700",
    municipal:   "bg-orange-50 border-orange-200 text-orange-700",
    facultativo: "bg-amber-50 border-amber-200 text-amber-800",
  };

  return (
    <div className="space-y-6">
      {dialogo}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Calendar className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>Cadastre o período letivo de cada semestre — início, fim e os dias em que não há aula. Ao criar uma disciplina com <strong>dia da semana definido</strong>, o sistema usa este calendário para preencher as datas de cada aula e saber quantas são.</p>
          <p>Os feriados nacionais e o aniversário de São Bernardo aparecem <strong>sugeridos</strong>, já calculados para o período. Quem confirma é você: incluir um dia aqui tira uma aula da grade. Datas da escola — emenda, recesso, evento — você adiciona à mão.</p>
        </div>
      </div>

      {/* Accordion novo cronograma */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormAberto(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Cronograma
          </span>
          {formAberto ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {formAberto && (
          <div className="px-6 pb-6 space-y-4 border-t pt-4">
            <div className="space-y-1">
              <Label className="text-gray-700">Semestre *</Label>
              <Input className="w-full text-gray-800" placeholder="ex: 2026/2" value={form.semestre} onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-gray-700">Início das aulas *</Label>
                <Input type="date" className="w-full text-gray-800" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-700">Fim das aulas *</Label>
                <Input type="date" className="w-full text-gray-800" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>

            {/* Preview de aulas por dia */}
            {form.data_inicio && form.data_fim && form.data_inicio <= form.data_fim && (
              <div className="bg-gray-50 rounded-xl p-4 border">
                <p className="text-xs font-semibold text-gray-500 mb-2">Aulas disponíveis por dia (sem feriados)</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(contarOcorrencias(form.data_inicio, form.data_fim, [])).map(([dia, qtd]) => (
                    <div key={dia} className="text-center">
                      <p className="text-xs text-gray-400">{DIAS_SEMANA[parseInt(dia)]}</p>
                      <p className="text-lg font-bold text-gray-700">{qtd}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {msg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {msg.texto}
              </div>
            )}

            <Button onClick={handleCriar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Cronograma
            </Button>
          </div>
        )}
      </div>

      {/* Lista de cronogramas */}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : cronogramas.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhum cronograma cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {cronogramas.map(cron => {
            const ocorrencias = cron.data_inicio && cron.data_fim
              ? contarOcorrencias(cron.data_inicio, cron.data_fim, cron.feriados)
              : null;
            const aberto = expandido === cron.id;
            return (
              <div key={cron.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Cabeçalho */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandido(aberto ? null : cron.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{cron.semestre}</p>
                      <p className="text-xs text-gray-400">
                        {formatarData(cron.data_inicio)} → {formatarData(cron.data_fim)}
                        {cron.feriados.length > 0 && ` · ${cron.feriados.length} feriado(s)`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); handleExcluir(cron.id, cron.semestre); }}
                      className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {aberto ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {aberto && (
                  <div className="border-t px-4 py-4 space-y-4">

                    {/* Edição de datas */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500">Período letivo</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Início</label>
                          <input
                            type="date"
                            className="block h-8 text-xs text-gray-800 border border-gray-300 rounded-lg px-2 focus:outline-none focus:border-blue-500"
                            value={editDatas[cron.id]?.inicio ?? cron.data_inicio}
                            onChange={e => setEditDatas(prev => ({ ...prev, [cron.id]: { ...prev[cron.id], inicio: e.target.value } }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Fim</label>
                          <input
                            type="date"
                            className="block h-8 text-xs text-gray-800 border border-gray-300 rounded-lg px-2 focus:outline-none focus:border-blue-500"
                            value={editDatas[cron.id]?.fim ?? cron.data_fim}
                            onChange={e => setEditDatas(prev => ({ ...prev, [cron.id]: { ...prev[cron.id], fim: e.target.value } }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-gray-700"
                          onClick={() => handleSalvarDatas(cron.id)}
                        >
                          Salvar datas
                        </Button>
                      </div>
                    </div>

                    {/* Resumo de aulas por dia (recalcula com datas editadas) */}
                    {(() => {
                      const inicio = editDatas[cron.id]?.inicio ?? cron.data_inicio;
                      const fim = editDatas[cron.id]?.fim ?? cron.data_fim;
                      const oc = inicio && fim && inicio <= fim ? contarOcorrencias(inicio, fim, cron.feriados) : null;
                      if (!oc) return null;
                      return (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Aulas disponíveis por dia da semana</p>
                          <div className="flex gap-4 flex-wrap">
                            {Object.entries(oc).map(([dia, qtd]) => (
                              <div key={dia} className="text-center bg-gray-50 rounded-lg px-4 py-2">
                                <p className="text-xs text-gray-400">{DIAS_SEMANA[parseInt(dia)]}</p>
                                <p className="text-xl font-bold text-gray-700">{qtd}</p>
                                <p className="text-xs text-gray-400">aulas</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Feriados */}
                    {(() => {
                      const inicio = editDatas[cron.id]?.inicio ?? cron.data_inicio;
                      const fim = editDatas[cron.id]?.fim ?? cron.data_fim;
                      const { jaMarcados, sugestoes, personalizados } =
                        conciliarFeriados(cron.feriados, inicio, fim);
                      const porData = new Map(jaMarcados.map(f => [f.data, f]));

                      return (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-gray-500">Feriados / Recessos</p>

                          {/* O que o calendário conhece e ainda não foi marcado.
                              Feriado em fim de semana não entra: não tira aula
                              de ninguém, e marcá-lo bagunçaria a contagem. */}
                          {sugestoes.length > 0 && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs text-blue-900">
                                  <strong>
                                    {sugestoes.length === 1
                                      ? "1 feriado cai em dia de aula"
                                      : `${sugestoes.length} feriados caem em dia de aula`}
                                  </strong>{" "}
                                  neste período e ainda não está marcado. Clique para incluir —
                                  ou ignore, se no CAV houver aula.
                                </p>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs shrink-0"
                                  onClick={() => handleAceitarSugestoes(cron, sugestoes.map(f => f.data))}
                                >
                                  Incluir todos
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {sugestoes.map(f => (
                                  <button
                                    key={f.data}
                                    onClick={() => handleAceitarSugestoes(cron, [f.data])}
                                    className="flex items-center gap-1 rounded-full border border-blue-300 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                                    title={`Incluir ${f.nome}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                    {formatarData(f.data)} · {f.nome}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Data que nenhuma lista conhece: emenda, recesso,
                              evento da escola. Só a coordenação sabe. */}
                          <div className="flex gap-2">
                            <input
                              type="date"
                              className="h-8 text-xs text-gray-800 border border-gray-300 rounded-lg px-2 w-44 focus:outline-none focus:border-blue-500"
                              min={cron.data_inicio}
                              max={cron.data_fim}
                              value={feriadoInput[cron.id] ?? ""}
                              onChange={e => setFeriadoInput(prev => ({ ...prev, [cron.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" className="h-8 text-xs text-gray-700" onClick={() => handleAdicionarFeriado(cron)}>
                              + Adicionar
                            </Button>
                          </div>

                          {cron.feriados.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Nenhum feriado cadastrado.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {cron.feriados.map(data => {
                                const conhecido = porData.get(data);
                                const ehPersonalizado = personalizados.includes(data);
                                const cor = conhecido
                                  ? CORES_POR_TIPO[conhecido.tipo]
                                  : "bg-gray-50 border-gray-200 text-gray-600";
                                return (
                                  <span
                                    key={data}
                                    className={`flex items-center gap-1 border text-xs px-2 py-1 rounded-full ${cor}`}
                                    title={ehPersonalizado ? "Data da escola — nenhum calendário oficial a conhece" : conhecido?.nome}
                                  >
                                    {formatarData(data)}
                                    {conhecido && <span className="opacity-75">· {conhecido.nome}</span>}
                                    {ehPersonalizado && <span className="opacity-60">· da escola</span>}
                                    <button onClick={() => handleRemoverFeriado(cron, data)} className="ml-0.5 hover:opacity-60">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <button
                      onClick={() => handleExcluir(cron.id, cron.semestre)}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Excluir cronograma
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
