"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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

// Conta quantas ocorrências de cada dia da semana (1=Seg…5=Sex) há no período
function contarOcorrencias(inicio: string, fim: string, feriados: string[]): Record<number, number> {
  const resultado: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const feriadosSet = new Set(feriados);
  const d = new Date(inicio + "T12:00:00");
  const fimDate = new Date(fim + "T12:00:00");
  while (d <= fimDate) {
    const dow = d.getDay(); // 0=Dom … 6=Sáb
    if (dow >= 1 && dow <= 5 && !feriadosSet.has(d.toISOString().split("T")[0])) {
      resultado[dow] = (resultado[dow] ?? 0) + 1;
    }
    d.setDate(d.getDate() + 1);
  }
  return resultado;
}

export default function CronogramaManager() {
  const supabase = createClient();
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

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cronogramas")
      .select("*")
      .order("data_inicio", { ascending: false });
    setCronogramas(data ?? []);
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
    if (!confirm(`Excluir cronograma ${semestre}?`)) return;
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

  const handleRemoverFeriado = async (cron: Cronograma, data: string) => {
    const novosFeriados = cron.feriados.filter(f => f !== data);
    await supabase.from("cronogramas").update({ feriados: novosFeriados }).eq("id", cron.id);
    setCronogramas(prev => prev.map(c => c.id === cron.id ? { ...c, feriados: novosFeriados } : c));
  };

  return (
    <div className="space-y-6">

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Calendar className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>Cadastre o período letivo de cada semestre. Ao criar uma disciplina com <strong>dia da semana definido</strong>, o sistema usa o cronograma para preencher automaticamente as datas de cada aula.</p>
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
              <Label>Semestre *</Label>
              <Input className="w-full" placeholder="ex: 2026/2" value={form.semestre} onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Início das aulas *</Label>
                <Input type="date" className="w-full" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fim das aulas *</Label>
                <Input type="date" className="w-full" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
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
                    {/* Resumo de aulas por dia */}
                    {ocorrencias && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Aulas disponíveis por dia da semana</p>
                        <div className="flex gap-4 flex-wrap">
                          {Object.entries(ocorrencias).map(([dia, qtd]) => (
                            <div key={dia} className="text-center bg-gray-50 rounded-lg px-4 py-2">
                              <p className="text-xs text-gray-400">{DIAS_SEMANA[parseInt(dia)]}</p>
                              <p className="text-xl font-bold text-gray-700">{qtd}</p>
                              <p className="text-xs text-gray-400">aulas</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feriados */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500">Feriados / Recessos</p>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          className="h-8 text-xs w-44"
                          min={cron.data_inicio}
                          max={cron.data_fim}
                          value={feriadoInput[cron.id] ?? ""}
                          onChange={e => setFeriadoInput(prev => ({ ...prev, [cron.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAdicionarFeriado(cron)}>
                          + Adicionar
                        </Button>
                      </div>
                      {cron.feriados.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhum feriado cadastrado.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {cron.feriados.map(f => (
                            <span key={f} className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1 rounded-full">
                              {formatarData(f)}
                              <button onClick={() => handleRemoverFeriado(cron, f)} className="hover:text-red-900">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

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
