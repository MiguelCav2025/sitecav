"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, BarChart3, Users, BookOpen } from "lucide-react";

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
    if (!turmaSel) { setAulas([]); setAulaSel(""); setRelatorio([]); return; }
    supabase.from("aulas").select("id, numero, chamada_aberta").eq("turma_id", turmaSel)
      .eq("chamada_aberta", true).order("numero")
      .then(({ data }) => setAulas(data ?? []));
  }, [turmaSel]);

  // Relatório por turma: frequência de cada aluno
  const gerarRelatorioPorTurma = async () => {
    if (!turmaSel) return;
    setLoading(true);
    const { data: alunosData } = await supabase.from("alunos").select("id, nome").eq("turma_id", turmaSel).eq("ativo", true).order("nome");
    const { data: aulasData } = await supabase.from("aulas").select("id").eq("turma_id", turmaSel).eq("chamada_aberta", true);
    const aulaIds = (aulasData ?? []).map((a: any) => a.id);
    const totalAulas = aulaIds.length;

    if (totalAulas === 0) { setRelatorio([]); setLoading(false); return; }

    const { data: presData } = await supabase.from("presencas").select("aluno_id, presente").in("aula_id", aulaIds);

    const linhas: LinhaRelatorio[] = (alunosData ?? []).map((a: Aluno) => {
      const minhas = (presData ?? []).filter((p: any) => p.aluno_id === a.id);
      const presentes = minhas.filter((p: any) => p.presente).length;
      const ausentes = totalAulas - presentes;
      const percentual = totalAulas > 0 ? Math.round((presentes / totalAulas) * 100) : 0;
      return { aluno: a.nome, total_aulas: totalAulas, presentes, ausentes, percentual };
    });

    setRelatorio(linhas.sort((a, b) => b.percentual - a.percentual));
    setLoading(false);
  };

  // Relatório por aula: quem estava presente/ausente
  const gerarRelatorioPorAula = async () => {
    if (!aulaSel) return;
    setLoading(true);
    const { data: alunosData } = await supabase.from("alunos").select("id, nome").eq("turma_id", turmaSel).eq("ativo", true).order("nome");
    const { data: presData } = await supabase.from("presencas").select("aluno_id, presente").eq("aula_id", aulaSel);

    const mapa = Object.fromEntries((presData ?? []).map((p: any) => [p.aluno_id, p.presente]));
    setRelatorioAula((alunosData ?? []).map((a: Aluno) => ({ nome: a.nome, presente: mapa[a.id] ?? false })));
    setLoading(false);
  };

  // Download CSV
  const downloadCSV = (dados: any[], nome: string) => {
    if (dados.length === 0) return;
    const cabecalho = Object.keys(dados[0]).join(";");
    const linhas = dados.map(d => Object.values(d).join(";"));
    const csv = [cabecalho, ...linhas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nome}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" /> Relatórios de Presença</h2>
        <p className="text-sm text-gray-500 mt-1">Visualize e exporte os dados de frequência.</p>
      </div>

      <div className="space-y-1 max-w-sm">
        <Label>Turma</Label>
        <Select value={turmaSel} onValueChange={setTurmaSel}>
          <SelectTrigger><SelectValue placeholder="Selecione uma turma..." /></SelectTrigger>
          <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {turmaSel && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Relatório por turma (frequência de alunos) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> Frequência por Aluno</h3>
            <Button onClick={gerarRelatorioPorTurma} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Gerar Relatório
            </Button>

            {relatorio.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(relatorio, `frequencia-${turmas.find(t => t.id === turmaSel)?.nome}`)}>
                  <Download className="h-4 w-4 mr-2" /> Baixar CSV
                </Button>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aluno</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">✅</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">❌</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {relatorio.map((r, i) => (
                        <tr key={i} className={r.percentual < 75 ? "bg-red-50" : "hover:bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-800 font-medium">{r.aluno}</td>
                          <td className="px-3 py-2 text-center text-green-600">{r.presentes}</td>
                          <td className="px-3 py-2 text-center text-red-500">{r.ausentes}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${r.percentual < 75 ? "text-red-600" : "text-gray-700"}`}>{r.percentual}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 p-2">Linhas em vermelho: frequência abaixo de 75%</p>
                </div>
              </>
            )}
          </div>

          {/* Relatório por aula */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2"><BookOpen className="h-4 w-4 text-orange-500" /> Presença por Aula</h3>
            <div className="space-y-1">
              <Label className="text-xs">Aula</Label>
              <Select value={aulaSel} onValueChange={setAulaSel}>
                <SelectTrigger><SelectValue placeholder="Selecione a aula..." /></SelectTrigger>
                <SelectContent>
                  {aulas.length === 0
                    ? <SelectItem value="none" disabled>Nenhuma chamada finalizada</SelectItem>
                    : aulas.map(a => <SelectItem key={a.id} value={a.id}>Aula {a.numero}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <Button onClick={gerarRelatorioPorAula} disabled={loading || !aulaSel} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Gerar Relatório
            </Button>

            {relatorioAula.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(relatorioAula, `chamada-aula-${aulaSel}`)}>
                  <Download className="h-4 w-4 mr-2" /> Baixar CSV
                </Button>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aluno</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {relatorioAula.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{r.nome}</td>
                          <td className="px-3 py-2 text-center">
                            {r.presente
                              ? <span className="text-green-600 font-semibold text-xs bg-green-50 px-2 py-0.5 rounded-full">Presente</span>
                              : <span className="text-red-500 font-semibold text-xs bg-red-50 px-2 py-0.5 rounded-full">Ausente</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
