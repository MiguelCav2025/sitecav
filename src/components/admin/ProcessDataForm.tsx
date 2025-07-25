"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ExternalLink, AlertCircle, Save, RotateCcw } from "lucide-react";

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

interface ProcessDataFormProps {
  initialData?: ProcessData;
  onSave: (data: ProcessData) => Promise<void>;
  loading?: boolean;
}

// Dados padrão
const defaultData: ProcessData = {
  inscription_start_date: "19 de Maio de 2025",
  inscription_end_date: "29 de Maio de 2025",
  semester: "2º. Semestre de 2025",
  exam_date: "05/07/2025 – Sábado",
  exam_time: "09h00 as 12h00",
  exam_location: "Teatro Lauro Gomes",
  result_date: "15/07/2025",
  inscription_link: "https://docs.google.com/forms/d/e/1FAIpQLSd6XwvynaGJdXNBBhEArUk4PeylH3s2UXVyVm0nNRe7MVzW2Q/viewform"
};

export default function ProcessDataForm({ initialData, onSave, loading = false }: ProcessDataFormProps) {
  const [formData, setFormData] = useState<ProcessData>({
    inscription_start_date: "19 de Maio de 2025",
    inscription_end_date: "29 de Maio de 2025",
    semester: "2º. Semestre de 2025",
    exam_date: "05/07/2025 – Sábado",
    exam_time: "09h00 as 12h00",
    exam_location: "Teatro Lauro Gomes",
    result_date: "15/07/2025",
    inscription_link: "https://docs.google.com/forms/d/e/1FAIpQLSd6XwvynaGJdXNBBhEArUk4PeylH3s2UXVyVm0nNRe7MVzW2Q/viewform"
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar campos obrigatórios
    if (!formData.inscription_start_date.trim()) {
      newErrors.inscription_start_date = "Data de início é obrigatória";
    }
    if (!formData.inscription_end_date.trim()) {
      newErrors.inscription_end_date = "Data de fim é obrigatória";
    }
    if (!formData.semester.trim()) {
      newErrors.semester = "Semestre é obrigatório";
    }
    if (!formData.exam_date.trim()) {
      newErrors.exam_date = "Data da prova é obrigatória";
    }
    if (!formData.exam_time.trim()) {
      newErrors.exam_time = "Horário da prova é obrigatório";
    }
    if (!formData.exam_location.trim()) {
      newErrors.exam_location = "Local da prova é obrigatório";
    }
    if (!formData.result_date.trim()) {
      newErrors.result_date = "Data do resultado é obrigatória";
    }

    // Validar URL
    if (!formData.inscription_link.trim()) {
      newErrors.inscription_link = "Link de inscrição é obrigatório";
    } else {
      try {
        new URL(formData.inscription_link);
      } catch {
        newErrors.inscription_link = "URL inválida";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleReset = () => {
    setFormData(initialData || defaultData);
    setErrors({});
  };

  const updateField = (field: keyof ProcessData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando usuário digita
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Período de Inscrições */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Período de Inscrições
            </h3>
            
            <div>
              <Label htmlFor="inscription_start_date">Data de Início</Label>
              <Input
                id="inscription_start_date"
                type="text"
                value={formData.inscription_start_date}
                onChange={(e) => updateField("inscription_start_date", e.target.value)}
                placeholder="ex: 19 de Maio de 2025"
                className={errors.inscription_start_date ? "border-red-500" : ""}
              />
              {errors.inscription_start_date && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.inscription_start_date}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="inscription_end_date">Data de Fim</Label>
              <Input
                id="inscription_end_date"
                type="text"
                value={formData.inscription_end_date}
                onChange={(e) => updateField("inscription_end_date", e.target.value)}
                placeholder="ex: 29 de Maio de 2025"
                className={errors.inscription_end_date ? "border-red-500" : ""}
              />
              {errors.inscription_end_date && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.inscription_end_date}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="semester">Semestre</Label>
              <Input
                id="semester"
                type="text"
                value={formData.semester}
                onChange={(e) => updateField("semester", e.target.value)}
                placeholder="ex: 2º. Semestre de 2025"
                className={errors.semester ? "border-red-500" : ""}
              />
              {errors.semester && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.semester}
                </p>
              )}
            </div>
          </div>

          {/* Dados da Prova */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Dados da Prova
            </h3>
            
            <div>
              <Label htmlFor="exam_date">Data da Prova</Label>
              <Input
                id="exam_date"
                type="text"
                value={formData.exam_date}
                onChange={(e) => updateField("exam_date", e.target.value)}
                placeholder="ex: 05/07/2025 – Sábado"
                className={errors.exam_date ? "border-red-500" : ""}
              />
              {errors.exam_date && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.exam_date}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="exam_time">Horário da Prova</Label>
              <Input
                id="exam_time"
                type="text"
                value={formData.exam_time}
                onChange={(e) => updateField("exam_time", e.target.value)}
                placeholder="ex: 09h00 as 12h00"
                className={errors.exam_time ? "border-red-500" : ""}
              />
              {errors.exam_time && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.exam_time}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="exam_location">Local da Prova</Label>
              <Input
                id="exam_location"
                type="text"
                value={formData.exam_location}
                onChange={(e) => updateField("exam_location", e.target.value)}
                placeholder="ex: Teatro Lauro Gomes"
                className={errors.exam_location ? "border-red-500" : ""}
              />
              {errors.exam_location && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.exam_location}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="result_date">Data do Resultado</Label>
              <Input
                id="result_date"
                type="text"
                value={formData.result_date}
                onChange={(e) => updateField("result_date", e.target.value)}
                placeholder="ex: 15/07/2025"
                className={errors.result_date ? "border-red-500" : ""}
              />
              {errors.result_date && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.result_date}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Link de Inscrição */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ExternalLink className="h-5 w-5 text-green-600" />
            Link de Inscrição
          </h3>
          
          <div>
            <Label htmlFor="inscription_link">URL do Formulário</Label>
            <Textarea
              id="inscription_link"
              value={formData.inscription_link}
              onChange={(e) => updateField("inscription_link", e.target.value)}
              placeholder="https://docs.google.com/forms/..."
              rows={3}
              className={errors.inscription_link ? "border-red-500" : ""}
            />
            {errors.inscription_link && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.inscription_link}
              </p>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <Button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPreview(!showPreview)}
            disabled={loading}
          >
            {showPreview ? "Ocultar Preview" : "Visualizar Preview"}
          </Button>
        </div>
      </form>

      {/* Preview */}
      {showPreview && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Preview - Como ficará na página:</h3>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm mb-2 text-center bg-blue-50 p-3 rounded">
              Estão abertas a partir do dia {formData.inscription_start_date} até o dia {formData.inscription_end_date}, as inscrições para os interessados em participar dos cursos de formação em Cine/TV e Animação, a serem ministrados no CAV, {formData.semester}.
            </p>
            
            <div className="mt-4 space-y-2 text-sm">
              <p><strong>Data:</strong> {formData.exam_date}</p>
              <p><strong>Horário:</strong> {formData.exam_time}</p>
              <p><strong>Local:</strong> {formData.exam_location}</p>
              <p><strong>Resultado:</strong> {formData.result_date}</p>
            </div>
            
            <div className="mt-4">
              <p className="text-xs text-gray-600">Link de inscrição:</p>
              <a href={formData.inscription_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">
                {formData.inscription_link}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 