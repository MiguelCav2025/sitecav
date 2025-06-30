"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ProcessDataForm from "./ProcessDataForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Calendar, RefreshCw } from "lucide-react";

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
}

export default function ProcessDataManager() {
  const [processData, setProcessData] = useState<ProcessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const supabase = createClient();

  const fetchProcessData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('process_data')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setProcessData(data[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados do processo.' });
    } finally {
      setLoading(false);
    }
  };

  const saveProcessData = async (data: ProcessData) => {
    try {
      setSaving(true);
      setMessage(null);

      // Desativar registros anteriores
      const { error: updateError } = await supabase
        .from('process_data')
        .update({ is_active: false })
        .eq('is_active', true);

      if (updateError) {
        throw updateError;
      }

      // Inserir novo registro
      const { error: insertError } = await supabase
        .from('process_data')
        .insert([{
          ...data,
          is_active: true,
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        throw insertError;
      }

      setMessage({ type: 'success', text: 'Dados salvos com sucesso!' });
      
      // Recarregar dados
      await fetchProcessData();
      
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar dados.' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProcessData();
  }, []);

  // Auto-ocultar mensagem após 5 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Dados do Processo Seletivo
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Dados do Processo Seletivo
          </CardTitle>
          <p className="text-gray-600 mt-1">
            Gerencie as informações que aparecem na página Área do Candidato
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={fetchProcessData}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Recarregar
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mensagens */}
        {message && (
          <div className={`p-4 rounded-lg border flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Formulário */}
        <div>
          <ProcessDataForm
            initialData={processData || undefined}
            onSave={saveProcessData}
            loading={saving}
          />
        </div>

        {/* Informações Adicionais */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informações Importantes</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• As alterações são aplicadas imediatamente na página Área do Candidato</li>
            <li>• Certifique-se de que todas as datas estão corretas</li>
            <li>• O link de inscrição deve ser uma URL válida e acessível</li>
            <li>• Apenas um conjunto de dados fica ativo por vez</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 