"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileText, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Download {
  id?: string;
  title: string;
  subtitle?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
}

interface DownloadFormProps {
  download?: Download;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: () => void;
}

export function DownloadForm({ download, isOpen, setIsOpen, onSave }: DownloadFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (download) {
      setFormData({
        title: download.title,
        subtitle: download.subtitle || "",
      });
    } else {
      setFormData({ title: "", subtitle: "" });
    }
    setSelectedFile(null);
  }, [download, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;
    if (!download && !selectedFile) return;

    try {
      setUploading(true);
      
      let fileUrl = download?.file_url || "";
      let fileName = download?.file_name || "";

      if (selectedFile) {
        const file = selectedFile;
        const fileExt = file.name.split('.').pop();
        const newFileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('downloads')
          .upload(newFileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('downloads')
          .getPublicUrl(newFileName);

        fileUrl = publicUrl;
        fileName = file.name;
      }

      const downloadData = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: selectedFile?.size || download?.file_size,
        file_type: selectedFile?.type || download?.file_type,
        is_active: true,
      };

      if (download) {
        await supabase.from('downloads').update(downloadData).eq('id', download.id);
      } else {
        await supabase.from('downloads').insert([downloadData]);
      }

      onSave();
      setIsOpen(false);
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {download ? "Editar Download" : "Novo Download"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="ex: Manual do Aluno"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={formData.subtitle}
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="ex: Guia completo para novos estudantes"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            {download && !selectedFile && (
              <p className="text-sm text-gray-600 mt-1">
                Arquivo atual: {download.file_name}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading ? "Salvando..." : (download ? "Atualizar" : "Salvar")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 