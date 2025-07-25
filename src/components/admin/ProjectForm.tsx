'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Project } from "./ProjectManager";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProjectFormProps {
  project?: Project | null;
  onSave: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function ProjectForm({ project, onSave, isOpen, setIsOpen }: ProjectFormProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState<Partial<Project> | null>(project || null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(project || {});
    } else {
      // Limpa o formulário quando o modal é fechado
      setFormData({});
      setThumbnailFile(null);
      // Limpa o campo de input de arquivo visualmente
      const input = document.getElementById('thumbnail') as HTMLInputElement;
      if (input) {
        input.value = '';
      }
    }
  }, [isOpen, project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData({ ...formData, [id]: value });
  };

  const handleSelectChange = (fieldName: string, value: string) => {
    setFormData({ ...formData, [fieldName]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setThumbnailFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    let thumbnailUrl = formData?.thumbnail_url || null;

    if (thumbnailFile) {
      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(`projects/${fileName}`, thumbnailFile);

      if (error) {
        console.error('Error uploading thumbnail:', error);
        return;
      }
      thumbnailUrl = supabase.storage.from('site-assets').getPublicUrl(data.path).data.publicUrl;
    }

    const projectData = { ...formData, thumbnail_url: thumbnailUrl };

    if (project?.id) {
      // Update
      const { error } = await supabase.from('projects').update(projectData).eq('id', project.id);
      if (error) console.error("Error updating project:", error);
    } else {
      // Create
      const { error } = await supabase.from('projects').insert(projectData);
      if (error) console.error("Error creating project:", error);
    }

    onSave();
    setIsOpen(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{project?.id ? 'Editar Projeto' : 'Adicionar Novo Projeto'}</DialogTitle>
          <DialogDescription>
            Preencha as informações do projeto aqui. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
            </Label>
            <Input id="title" value={formData?.title || ''} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Descrição
            </Label>
            <Textarea id="description" value={formData?.description || ''} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="video_url" className="text-right">
              URL do Vídeo
            </Label>
            <Input id="video_url" value={formData?.video_url || ''} onChange={handleChange} placeholder="Link do YouTube" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="course_category" className="text-right">
              Categoria
            </Label>
            <Select
              value={formData?.course_category || ''}
              onValueChange={(value) => handleSelectChange('course_category', value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Animação">Animação</SelectItem>
                <SelectItem value="Cine/Tv">Cine/Tv</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="thumbnail" className="text-right">
              Thumbnail
            </Label>
            <Input id="thumbnail" type="file" onChange={handleFileChange} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Salvar projeto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 