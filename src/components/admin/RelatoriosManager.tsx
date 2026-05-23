"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, BarChart3, Users, BookOpen, AlertCircle } from "lucide-react";

interface Turma { id: string; nome: string; }
interface Aluno { id: string; nome: string; }
interface Aula { id: string; numero: number; chamada_aberta: boolean; }
interface LinhaRelatorio { aluno: string; total_aulas: number; presentes: number; ausentes: number; percentual: number; }

export default function RelatoriosManager() {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSel, setTurmaSel] = useState("");
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<LinhaRelatorio[]>([]);
  const [aulaSel, setAulaSel] = useState("");
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [relatorioAula, setRelatorioAula] = useState<{ nome: string; presente: boolean }[]>([]);

  useEffect(() => {
    supabase.from("turmas").select("id, nome").order("nome").then(({ data }) => setTurmas(data ?? []));
  }, []);

  useEffect(() => {
    if (!turmaSel) { setAulas([]); setAulaSel(""); setRelatorio([]); setRelatorioAula([]); return; }
    supabase.from("aulas").select("id, numero, chamada_aberta").eq("turma_id", turmaSel)
      .eq("chamada_aberta", true).order("numero")
      .then(({ data }) => setAulas(data ?? []));
  }, [turmaSel]);

  const gerarRelatorioPorTurma = async () => {
    if (!turmaSel) return;
    setLoading(true);
    const { data: alunosData } = await supabase.from("alunos").select("id, nome").eq("turma_id", turmaSel).eq("ativo", true).order("nome");
    const { data: aulasData } = await supabase.from("aulas").select("id").eq("turma_id", turmaSel).eq("chamada_aberta", true);
    const aulaIds = (aulasData ?? []).map((a: { id: string }) => a.id);
    const totalAulas = aulaIds.length;

    if (totalAulas === 0) { setRelatorio([]); setLoading(false); return; }

    const { data: presData } = await supabase.from("presencas").select("aluno_id, presente").in("aula_id", aulaIds);

    const linhas: LinhaRelatorio[] = (alunosData ?? []).map((a: Aluno) => {
      const minhas = (presData ?? []).filter((p: { aluno_id: string; presente: boolean }) => p.aluno_id === a.id);
      const presentes = minhas.filter((p: { presente: boolean }) => p.presente).length;
      const ausentes = totalAulas - presentes;
      const percentual = totalAulas > 0 ? Math.round((presentes / totalAulas) * 100) : 0;
      return { aluno: a.nome, total_aulas: totalAulas, presentes, ausentes, percentual };
    });

    setRelatorio(linhas.sort((a, b) => b.percentual - a.percentual));
    setLoading(false);
  };

  const gerarRelatorioPorAula = async () => {
    if (!aulaSel) return;
    setLoading(true);
    const { data: alunosData } = await supabase.from("alunos").select("id, nome").eq("turma_id", turmaSel).eq("ativo", true).order("nome");
    const { data: presData } = await supabase.from("presencas").select("aluno_id, presente").eq("aula_id", aulaSel);

    const mapa = Object.fromEntries((presData ?? []).map((p: { aluno_id: string; presente: boolean }) => [p.aluno_id, p.presente]));
    setRelatorioAula((alunosData ?? []).map((a: Aluno) => ({ nome: a.nome, presente: mapa[a.id] ?? false })));
    setLoading(false);
  };

  const downloadCSV = (dados: Record<string, unknown>[], nome: string) => {
    if (dados.length === 0) return;
    const cabecalho = Object.keys(dados[0]).join(";");
    const linhas = dados.map(d => Object.values(d).join(";"));
    const csv = [cabecalho, ...linhas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nome}.csv`; a.click();
  };

  const nomeTurma = turmas.find(t => t.id === turmaSel)?.nome ?? "";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-400" /> Relatórios de Presença
        </h2>
        <p className="text-sm text-blue-200 mt-1">Visualize e exporte os dados de frequência por aluno ou por aula.</p>
      </div>

      {/* Seleção de turma */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Turma</p>
        <Select value={turmaSel} onValueChange={v => { setTurmaSel(v); setRelatorio([]); setRelatorioAula([]); setAulaSel(""); }}>
          <SelectTrigger className="w-full text-gray-800">
            <SelectValue placeholder="Selecione uma turma..." />
          </SelectTrigger>
          <SelectContent>
            {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {turmaSel && (
        <div className="grid md:grid-cols-2 gap-4">

          {/* ── Frequência por Aluno ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <p className="font-semibold text-gray-800 text-sm">Frequência por Aluno</p>
              </div>
              {relatorio.length > 0 && (
                <button
                  onClick={() => downloadCSV(relatorio as unknown as Record<string, unknown>[], `frequencia-${nomeTurma}`)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              <Button onClick={gerarRelatorioPorTurma} disabled={loading} size="sm" className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Gerar Relatório
              </Button>

              {relatorio.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aluno</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-green-600">✅</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-red-400">❌</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {relatorio.map((r, i) => (
                        <tr key={i} className={r.percentual < 75 ? "bg-red-50" : "hover:bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-800 font-medium text-xs">{r.aluno}</td>
                          <td className="px-3 py-2 text-center text-green-600 font-semibold">{r.presentes}</td>
                          <td className="px-3 py-2 text-center text-red-500 font-semibold">{r.ausentes}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold text-sm ${r.percentual < 75 ? "text-red-600" : "text-gray-700"}`}>
                              {r.percentual}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-50 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-400" /> Vermelho = frequência abaixo de 75%
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-2">Clique em "Gerar Relatório" para visualizar.</p>
              )}
            </div>
          </div>

          {/* ── Presença por Aula ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-orange-500" />
                <p className="font-semibold text-gray-800 text-sm">Presença por Aula</p>
              </div>
              {relatorioAula.length > 0 && (
                <button
                  onClick={() => downloadCSV(relatorioAula as unknown as Record<string, unknown>[], `chamada-aula-${aulaSel}`)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {aulas.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">Nenhuma chamada finalizada nesta turma.</p>
              ) : (
                <>
                  <Select value={aulaSel} onValueChange={v => { setAulaSel(v); setRelatorioAula([]); }}>
                    <SelectTrigger className="w-full text-gray-800">
                      <SelectValue placeholder="Selecione a aula..." />
                    </SelectTrigger>
                    <SelectContent>
                      {aulas.map(a => <SelectItem key={a.id} value={a.id}>Aula {a.numero}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Button onClick={gerarRelatorioPorAula} disabled={loading || !aulaSel} size="sm" className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Gerar Relatório
                  </Button>
                </>
              )}

              {relatorioAula.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aluno</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {relatorioAula.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800 text-xs font-medium">{r.nome}</td>
                          <td className="px-3 py-2 text-center">
                            {r.presente
                              ? <span className="text-green-700 font-semibold text-xs bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Presente</span>
                              : <span className="text-red-600 font-semibold text-xs bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Ausente</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-gray-50 flex gap-3 text-xs text-gray-400">
                    <span className="text-green-600 font-semibold">{relatorioAula.filter(r => r.presente).length} presentes</span>
                    <span className="text-red-500 font-semibold">{relatorioAula.filter(r => !r.presente).length} ausentes</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
