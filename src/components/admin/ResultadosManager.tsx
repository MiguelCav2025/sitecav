"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2,
  Trash2, RefreshCw, Users, Trophy, PlusCircle,
} from "lucide-react";
import type { CandidatoExtraido } from "@/app/api/admin/parse-results/route";

interface Resultado {
  id: string;
  semestre: string;
  curso: string;
  periodo: string;
  nome: string;
  ordem: number;
}

interface CandidatoEditavel extends CandidatoExtraido {
  key: string;
  removido?: boolean;
}

const CURSOS = ["Animação", "Cine/TV"] as const;
const PERIODOS = ["Manhã", "Noite"] as const;

export default function ResultadosManager() {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado geral
  const [resultadosAtuais, setResultadosAtuais] = useState<Resultado[]>([]);
  const [semestroAtual, setSemestreAtual] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [modoUpload, setModoUpload] = useState(false);

  // Estado do upload
  const [semestre, setSemestre] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoExtraido, setTextoExtraido] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoEditavel[]>([]);
  const [etapa, setEtapa] = useState<"upload" | "revisao">("upload");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucessoMsg, setSucessoMsg] = useState("");

  // Busca resultados salvos ao montar
  const fetchResultados = async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("resultados_processo")
        .select("*")
        .eq("is_active", true)
        .order("ordem", { ascending: true });

      if (data && data.length > 0) {
        setResultadosAtuais(data as Resultado[]);
        setSemestreAtual(data[0].semestre);
      } else {
        setResultadosAtuais([]);
        setSemestreAtual("");
        // Se não há resultados, abre upload direto
        setModoUpload(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { fetchResultados(); }, []);

  const filtrar = (curso: string, periodo: string) =>
    resultadosAtuais.filter(r => r.curso === curso && r.periodo === periodo);

  const totalAtual = resultadosAtuais.length;

  // ── Upload handlers ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setArquivo(f);
  };

  const handleParsear = async () => {
    if (!arquivo) return setErro("Selecione um arquivo.");
    if (!semestre.trim()) return setErro("Informe o semestre (ex: 2026/2).");
    setErro("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const res = await fetch("/api/admin/parse-results", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { setErro(json.error || "Erro ao processar arquivo."); return; }
      setTextoExtraido(json.textoExtraido);
      setCandidatos((json.candidatos as CandidatoExtraido[]).map((c, i) => ({ ...c, key: `${i}` })));
      setEtapa("revisao");
    } catch { setErro("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  const toggleRemover = (key: string) =>
    setCandidatos(prev => prev.map(c => c.key === key ? { ...c, removido: !c.removido } : c));

  const atualizarNome = (key: string, valor: string) =>
    setCandidatos(prev => prev.map(c => c.key === key ? { ...c, nome: valor } : c));

  const adicionarCandidato = (curso: string, periodo: string) => {
    const key = `manual_${Date.now()}`;
    const existentes = candidatos.filter(c => c.curso === curso && c.periodo === periodo && !c.removido);
    setCandidatos(prev => [...prev, { key, curso, periodo, nome: "", ordem: existentes.length + 1 }]);
  };

  const handleSalvar = async () => {
    if (!semestre.trim()) return setErro("Informe o semestre.");
    const ativos = candidatos.filter(c => !c.removido && c.nome.trim().length > 0);
    if (ativos.length === 0) return setErro("Nenhum candidato para salvar.");
    setSalvando(true); setErro("");
    try {
      await supabase.from("resultados_processo").update({ is_active: false }).eq("is_active", true);
      const { error } = await supabase.from("resultados_processo").insert(
        ativos.map(c => ({ semestre: semestre.trim(), curso: c.curso, periodo: c.periodo, nome: c.nome.trim(), ordem: c.ordem, is_active: true }))
      );
      if (error) throw error;
      setSucessoMsg(`${ativos.length} candidatos salvos com sucesso!`);
      setModoUpload(false);
      setEtapa("upload");
      setArquivo(null);
      setCandidatos([]);
      if (inputRef.current) inputRef.current.value = "";
      await fetchResultados();
    } catch (e) {
      console.error(e);
      setErro("Erro ao salvar no banco. Verifique o console.");
    } finally { setSalvando(false); }
  };

  const resetarUpload = () => {
    setEtapa("upload");
    setArquivo(null);
    setCandidatos([]);
    setTextoExtraido("");
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
        <span className="text-gray-600">Carregando resultados...</span>
      </div>
    );
  }

  // ── Exibição dos resultados atuais ─────────────────────────────────────────
  if (!modoUpload) {
    return (
      <div className="space-y-4">
        {/* Cabeçalho com semestre e botão de atualizar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-700">
              <Trophy className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-lg">
                Resultados publicados — <span className="text-orange-500">{semestroAtual}</span>
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{totalAtual} candidatos aprovados publicados na página pública.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchResultados}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recarregar
            </Button>
            <Button size="sm" onClick={() => { setSucessoMsg(""); setModoUpload(true); }}>
              <PlusCircle className="h-4 w-4 mr-1" /> Publicar novos resultados
            </Button>
          </div>
        </div>

        {sucessoMsg && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" /> {sucessoMsg}
          </div>
        )}

        {/* Grade de resultados atuais */}
        {CURSOS.map(curso => (
          <div key={curso} className="space-y-3">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${curso === "Animação" ? "bg-purple-500" : "bg-orange-500"}`} />
              {curso}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {PERIODOS.map(periodo => {
                const lista = filtrar(curso, periodo);
                return (
                  <div key={periodo} className="bg-gray-50 border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm text-gray-700 flex items-center gap-1">
                        <Users className="h-4 w-4" /> {curso} — {periodo}
                      </span>
                      <span className="text-xs text-gray-400">{lista.length} aprovados</span>
                    </div>
                    {lista.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhum cadastrado.</p>
                    ) : (
                      <ol className="space-y-1">
                        {lista.map((r, i) => (
                          <li key={r.id} className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                            {r.nome}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Modo upload/revisão ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {resultadosAtuais.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => { resetarUpload(); setModoUpload(false); }}>
          ← Voltar para resultados publicados
        </Button>
      )}

      <div className="max-w-xs">
        <Label htmlFor="semestre" className="mb-1 block font-semibold">Semestre dos resultados</Label>
        <Input id="semestre" placeholder="Ex: 2026/2" value={semestre} onChange={e => setSemestre(e.target.value)} disabled={etapa === "revisao"} />
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {etapa === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-blue-600" /> Enviar arquivo de resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm">Arquivo (.docx ou .pdf)</Label>
              <input ref={inputRef} type="file" accept=".docx,.pdf" onChange={handleFileChange}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer" />
              {arquivo && (
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {arquivo.name} — {(arquivo.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              <p className="font-semibold mb-1">Dica para melhor extração:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>O arquivo deve ter seções claras por curso (Animação, Cine/TV)</li>
                <li>Cada seção deve indicar o período (Manhã / Noite)</li>
                <li>Formato .docx tem melhor precisão que .pdf</li>
              </ul>
            </div>
            <Button onClick={handleParsear} disabled={!arquivo || loading || !semestre.trim()}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</> : <><Upload className="h-4 w-4 mr-2" />Extrair dados do arquivo</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {etapa === "revisao" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>{candidatos.filter(c => !c.removido).length}</strong> candidatos extraídos. Revise antes de salvar.
            </p>
            <Button variant="outline" size="sm" onClick={resetarUpload}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recomeçar
            </Button>
          </div>

          {CURSOS.map(curso => PERIODOS.map(periodo => {
            const lista = candidatos.filter(c => c.curso === curso && c.periodo === periodo);
            const ativos = lista.filter(c => !c.removido);
            return (
              <Card key={`${curso}-${periodo}`}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      {curso} — {periodo}
                      <span className="text-xs font-normal text-gray-500">({ativos.length} aprovados)</span>
                    </span>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => adicionarCandidato(curso, periodo)}>
                      + Adicionar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {lista.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Nenhum extraído.{" "}
                      <button className="text-blue-500 underline" onClick={() => adicionarCandidato(curso, periodo)}>
                        Adicionar manualmente
                      </button>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lista.map(c => (
                        <div key={c.key} className={`flex items-center gap-2 ${c.removido ? "opacity-40" : ""}`}>
                          <span className="w-6 text-xs text-gray-400 text-right shrink-0">{c.removido ? "—" : c.ordem}</span>
                          <Input value={c.nome} onChange={e => atualizarNome(c.key, e.target.value)} disabled={c.removido} className="text-sm h-8" />
                          <button onClick={() => toggleRemover(c.key)}
                            className={`shrink-0 p-1 rounded hover:bg-gray-100 ${c.removido ? "text-green-600" : "text-red-500"}`}
                            title={c.removido ? "Restaurar" : "Remover"}>
                            {c.removido ? <CheckCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }))}

          {textoExtraido && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mb-1">Ver texto bruto extraído</summary>
              <pre className="bg-gray-50 border rounded p-3 whitespace-pre-wrap max-h-64 overflow-auto text-gray-600">{textoExtraido}</pre>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><CheckCircle className="h-4 w-4 mr-2" />Confirmar e salvar resultados</>}
            </Button>
            <Button variant="outline" onClick={resetarUpload} disabled={salvando}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
