"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ProcessDataForm from "./ProcessDataForm";
import ResultadosManager from "./ResultadosManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Calendar, RefreshCw, Trophy, ToggleLeft, ToggleRight } from "lucide-react";

interface ProcessData {
  id?: string;
  inscription_start_date: string;
  inscription_end_date: string;
  semester: string;
  exam_date: string;
  exam_time: string;
  exam_location: string;
  result_date: string;
  inscription_link: string;
  is_active?: boolean;
  page_mode?: string;
}

export default function ProcessDataManager() {
  const [processData, setProcessData] = useState<ProcessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createClient();

  const modoAtual = processData?.page_mode ?? "processo_seletivo";

  const fetchProcessData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("process_data")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) setProcessData(data[0]);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      setMessage({ type: "error", text: "Erro ao carregar dados do processo." });
    } finally {
      setLoading(false);
    }
  };

  const saveProcessData = async (data: ProcessData) => {
    try {
      setSaving(true);
      setMessage(null);

      const { error: updateError } = await supabase
        .from("process_data")
        .update({ is_active: false })
        .eq("is_active", true);
      if (updateError) throw updateError;

      // Remove o id para que o Supabase gere um novo UUID no INSERT
      const { id: _id, ...dataWithoutId } = data;
      const { error: insertError } = await supabase.from("process_data").insert([
        {
          ...dataWithoutId,
          is_active: true,
          page_mode: modoAtual,
          updated_at: new Date().toISOString(),
        },
      ]);
      if (insertError) throw insertError;

      setMessage({ type: "success", text: "Dados salvos com sucesso!" });
      await fetchProcessData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setMessage({ type: "error", text: "Erro ao salvar dados." });
    } finally {
      setSaving(false);
    }
  };

  const alternarModo = async () => {
    const novoModo = modoAtual === "processo_seletivo" ? "resultados" : "processo_seletivo";
    try {
      setTogglingMode(true);
      setMessage(null);

      if (processData?.id) {
        const { error } = await supabase
          .from("process_data")
          .update({ page_mode: novoModo })
          .eq("id", processData.id);
        if (error) throw error;
        setProcessData((prev) => (prev ? { ...prev, page_mode: novoModo } : prev));
      } else {
        // Não existe registro ativo ainda — cria um mínimo
        const { error } = await supabase.from("process_data").insert([
          {
            inscription_start_date: "",
            inscription_end_date: "",
            semester: "",
            exam_date: "",
            exam_time: "",
            exam_location: "",
            result_date: "",
            inscription_link: "",
            is_active: true,
            page_mode: novoModo,
          },
        ]);
        if (error) throw error;
        await fetchProcessData();
      }

      setMessage({
        type: "success",
        text: `Página pública alterada para: ${novoModo === "processo_seletivo" ? "Processo Seletivo" : "Resultados"}.`,
      });
    } catch (error) {
      console.error("Erro ao alternar modo:", error);
      setMessage({ type: "error", text: "Erro ao alternar modo da página." });
    } finally {
      setTogglingMode(false);
    }
  };

  useEffect(() => {
    fetchProcessData();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Processo Seletivo / Resultados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando dados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de controle do modo */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {modoAtual === "processo_seletivo" ? (
              <Calendar className="h-5 w-5 text-blue-600" />
            ) : (
              <Trophy className="h-5 w-5 text-orange-500" />
            )}
            Página pública exibindo atualmente:
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchProcessData} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {/* Toggle visual */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border">
            <div
              className={`flex-1 p-3 rounded-lg text-center text-sm font-semibold border-2 transition-all ${
                modoAtual === "processo_seletivo"
                  ? "bg-blue-600 border-blue-600 text-white shadow"
                  : "bg-white border-gray-200 text-gray-400"
              }`}
            >
              <Calendar className="h-5 w-5 mx-auto mb-1" />
              Processo Seletivo
            </div>

            <button
              onClick={alternarModo}
              disabled={togglingMode}
              className="shrink-0 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Alternar modo da página"
            >
              {togglingMode ? (
                <RefreshCw className="h-8 w-8 animate-spin" />
              ) : modoAtual === "processo_seletivo" ? (
                <ToggleLeft className="h-10 w-10 text-blue-600" />
              ) : (
                <ToggleRight className="h-10 w-10 text-orange-500" />
              )}
            </button>

            <div
              className={`flex-1 p-3 rounded-lg text-center text-sm font-semibold border-2 transition-all ${
                modoAtual === "resultados"
                  ? "bg-orange-500 border-orange-500 text-white shadow"
                  : "bg-white border-gray-200 text-gray-400"
              }`}
            >
              <Trophy className="h-5 w-5 mx-auto mb-1" />
              Resultados
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Clique no ícone central para alternar o que os visitantes verão na página{" "}
            <strong>Área do Candidato</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Mensagens */}
      {message && (
        <div
          className={`p-4 rounded-lg border flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Seção ativa */}
      {modoAtual === "processo_seletivo" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-blue-600" />
              Dados do Processo Seletivo
            </CardTitle>
            <p className="text-gray-500 text-sm">
              Edite as informações que aparecem na página pública quando no modo Processo Seletivo.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProcessDataForm
              initialData={processData || undefined}
              onSave={saveProcessData}
              loading={saving}
            />
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-semibold mb-1">ℹ️ Informações Importantes</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>As alterações são aplicadas imediatamente na página Área do Candidato</li>
                <li>Certifique-se de que todas as datas estão corretas antes de salvar</li>
                <li>O link de inscrição deve ser uma URL válida e acessível</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-orange-500" />
              Gerenciar Resultados do Processo Seletivo
            </CardTitle>
            <p className="text-gray-500 text-sm">
              Faça upload do arquivo de resultados (.docx ou .pdf) para extrair e publicar os aprovados.
            </p>
          </CardHeader>
          <CardContent>
            <ResultadosManager />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
