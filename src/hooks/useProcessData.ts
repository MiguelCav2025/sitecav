"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

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

// Dados padrão como fallback
const defaultProcessData: ProcessData = {
  inscription_start_date: "19 de Maio de 2025",
  inscription_end_date: "29 de Maio de 2025",
  semester: "2º. Semestre de 2025",
  exam_date: "05/07/2025 – Sábado",
  exam_time: "09h00 as 12h00",
  exam_location: "Teatro Lauro Gomes",
  result_date: "15/07/2025",
  inscription_link: "https://docs.google.com/forms/d/e/1FAIpQLSd6XwvynaGJdXNBBhEArUk4PeylH3s2UXVyVm0nNRe7MVzW2Q/viewform"
};

export function useProcessData() {
  const [data, setData] = useState<ProcessData>(defaultProcessData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: fetchError } = await supabase
        .from('process_data')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }

      if (result && result.length > 0) {
        setData(result[0]);
      } else {
        // Se não há dados no banco, usar dados padrão
        setData(defaultProcessData);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do processo:', err);
      setError('Erro ao carregar dados do processo');
      // Em caso de erro, usar dados padrão
      setData(defaultProcessData);
    } finally {
      setLoading(false);
    }
  };

  const updateData = async (newData: ProcessData): Promise<boolean> => {
    try {
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
          ...newData,
          is_active: true,
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        throw insertError;
      }

      // Atualizar estado local
      setData(newData);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar dados do processo:', err);
      setError('Erro ao salvar dados');
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    update: updateData
  };
} 