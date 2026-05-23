"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Users,
} from "lucide-react";
import type { CandidatoExtraido } from "@/app/api/admin/parse-results/route";

interface CandidatoEditavel extends CandidatoExtraido {
  key: string;
  removido?: boolean;
}

const CURSOS = ["Animação", "Cine/TV"] as const;
const PERIODOS = ["Manhã", "Noite"] as const;

export default function ResultadosManager() {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [semestre, setSemestre] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoExtraido, setTextoExtraido] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoEditavel[]>([]);
  const [etapa, setEtapa] = useState<"upload" | "revisao" | "salvo">("upload");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucessoMsg, setSucessoMsg] = useState("");

  const agrupar = () => {
    const grupos: Record<string, Record<string, CandidatoEditavel[]>> = {};
    for (const c of candidatos.filter((x) => !x.removido)) {
      if (!grupos[c.curso]) grupos[c.curso] = {};
      if (!grupos[c.curso][c.periodo]) grupos[c.curso][c.periodo] = [];
      grupos[c.curso][c.periodo].push(c);
    }
    return grupos;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setArquivo(f);
  };

  const handleParsear = async () => {
    if (!arquivo) return setErro("Selecione um arquivo.");
    if (!semestre.trim()) return setErro("Informe o semestre (ex: 2026/1).");
    setErro("");
    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", arquivo);

      const res = await fetch("/api/admin/parse-results", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.error || "Erro ao processar arquivo.");
        return;
      }

      setTextoExtraido(json.textoExtraido);
      setCandidatos(
        (json.candidatos as CandidatoExtraido[]).map((c, i) => ({
          ...c,
          key: `${i}`,
        }))
      );
      setEtapa("revisao");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRemover = (key: string) => {
    setCandidatos((prev) =>
      prev.map((c) => (c.key === key ? { ...c, removido: !c.removido } : c))
    );
  };

  const atualizarCampo = (key: string, campo: keyof CandidatoEditavel, valor: string) => {
    setCandidatos((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [campo]: valor } : c))
    );
  };

  const adicionarCandidato = (curso: string, periodo: string) => {
    const key = `manual_${Date.now()}`;
    const existentes = candidatos.filter(
      (c) => c.curso === curso && c.periodo === periodo && !c.removido
    );
    setCandidatos((prev) => [
      ...prev,
      { key, curso, periodo, nome: "", ordem: existentes.length + 1 },
    ]);
  };

  const handleSalvar = async () => {
    if (!semestre.trim()) return setErro("Informe o semestre.");
    const ativos = candidatos.filter((c) => !c.removido && c.nome.trim().length > 0);
    if (ativos.length === 0) return setErro("Nenhum candidato para salvar.");

    setSalvando(true);
    setErro("");

    try {
      // Desativar resultados anteriores do mesmo semestre
      await supabase
        .from("resultados_processo")
        .update({ is_active: false })
        .eq("semestre", semestre)
        .eq("is_active", true);

      // Inserir novos
      const { error } = await supabase.from("resultados_processo").insert(
        ativos.map((c) => ({
          semestre: semestre.trim(),
          curso: c.curso,
          periodo: c.periodo,
          nome: c.nome.trim(),
          ordem: c.ordem,
          is_active: true,
        }))
      );

      if (error) throw error;

      setSucessoMsg(`${ativos.length} candidatos salvos com sucesso!`);
      setEtapa("salvo");
    } catch (e) {
      console.error(e);
      setErro("Erro ao salvar no banco. Verifique o console.");
    } finally {
      setSalvando(false);
    }
  };

  const resetar = () => {
    setEtapa("upload");
    setArquivo(null);
    setCandidatos([]);
    setTextoExtraido("");
    setErro("");
    setSucessoMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const grupos = agrupar();

  return (
    <div className="space-y-6">
      {/* Semestre */}
      <div className="max-w-xs">
        <Label htmlFor="semestre" className="mb-1 block font-semibold">
          Semestre dos resultados
        </Label>
        <Input
          id="semestre"
          placeholder="Ex: 2026/1"
          value={semestre}
          onChange={(e) => setSemestre(e.target.value)}
          disabled={etapa === "salvo"}
        />
      </div>

      {/* Mensagens */}
      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}
      {sucessoMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {sucessoMsg}
        </div>
      )}

      {/* ETAPA 1 — Upload */}
      {etapa === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-blue-600" />
              Enviar arquivo de resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm">Arquivo (.docx ou .pdf)</Label>
              <input
                ref={inputRef}
                type="file"
                accept=".docx,.pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
              />
              {arquivo && (
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {arquivo.name} — {(arquivo.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-semibold mb-1">Dica para melhor extração:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>O arquivo deve ter seções claras por curso (Animação, Cine/TV)</li>
                <li>Cada seção deve indicar o período (Manhã / Noite)</li>
                <li>Os nomes devem estar listados, um por linha</li>
                <li>Formato .docx tem melhor precisão que .pdf</li>
              </ul>
            </div>

            <Button onClick={handleParsear} disabled={!arquivo || loading || !semestre.trim()}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Extrair dados do arquivo</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2 — Revisão */}
      {etapa === "revisao" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>{candidatos.filter((c) => !c.removido).length}</strong> candidatos extraídos.
              Revise, edite ou remova antes de salvar.
            </p>
            <Button variant="outline" size="sm" onClick={resetar}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recomeçar
            </Button>
          </div>

          {CURSOS.map((curso) =>
            PERIODOS.map((periodo) => {
              const lista = (candidatos || []).filter(
                (c) => c.curso === curso && c.periodo === periodo
              );
              const ativos = lista.filter((c) => !c.removido);

              return (
                <Card key={`${curso}-${periodo}`}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        {curso} — {periodo}
                        <span className="text-xs font-normal text-gray-500">
                          ({ativos.length} aprovados)
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => adicionarCandidato(curso, periodo)}
                      >
                        + Adicionar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {lista.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        Nenhum candidato extraído para esta turma.
                        <button
                          className="ml-2 text-blue-500 underline"
                          onClick={() => adicionarCandidato(curso, periodo)}
                        >
                          Adicionar manualmente
                        </button>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {lista.map((c) => (
                          <div
                            key={c.key}
                            className={`flex items-center gap-2 ${c.removido ? "opacity-40" : ""}`}
                          >
                            <span className="w-6 text-xs text-gray-400 text-right shrink-0">
                              {c.removido ? "—" : c.ordem}
                            </span>
                            <Input
                              value={c.nome}
                              onChange={(e) => atualizarCampo(c.key, "nome", e.target.value)}
                              disabled={c.removido}
                              className="text-sm h-8"
                            />
                            <button
                              onClick={() => toggleRemover(c.key)}
                              className={`shrink-0 p-1 rounded hover:bg-gray-100 ${c.removido ? "text-green-600" : "text-red-500"}`}
                              title={c.removido ? "Restaurar" : "Remover"}
                            >
                              {c.removido ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Texto bruto para referência */}
          {textoExtraido && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mb-1">
                Ver texto bruto extraído do arquivo
              </summary>
              <pre className="bg-gray-50 border rounded p-3 whitespace-pre-wrap max-h-64 overflow-auto text-gray-600">
                {textoExtraido}
              </pre>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Confirmar e salvar resultados</>
              )}
            </Button>
            <Button variant="outline" onClick={resetar} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 3 — Salvo */}
      {etapa === "salvo" && (
        <div className="text-center py-8 space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <p className="text-lg font-semibold text-gray-800">{sucessoMsg}</p>
          <p className="text-sm text-gray-500">
            A página pública será atualizada automaticamente.
          </p>
          <Button variant="outline" onClick={resetar}>
            <Upload className="h-4 w-4 mr-2" /> Enviar novos resultados
          </Button>
        </div>
      )}
    </div>
  );
}
