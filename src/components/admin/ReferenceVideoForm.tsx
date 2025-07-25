"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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

// Definindo o tipo para os dados do formulário
type VideoFormData = {
  title: string;
  video_url: string;
  course: 'Animação' | 'Cine/TV';
};

interface ReferenceVideoFormProps {
  onSave: (data: any) => Promise<void>;
  video?: any; // Vídeo existente para edição
}

export default function ReferenceVideoForm({ onSave, video }: ReferenceVideoFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<VideoFormData>({
    defaultValues: { title: '', video_url: '', course: 'Cine/TV' },
  });

  useEffect(() => {
    if (isOpen) {
      if (video) {
        reset(video);
      } else {
        reset({ title: '', video_url: '', course: 'Cine/TV' });
      }
    }
  }, [isOpen, video, reset]);

  const handleSave = async (data: VideoFormData) => {
    // A lógica para buscar a thumbnail será adicionada aqui depois
    await onSave({ ...data });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>{video ? 'Editar Vídeo' : 'Adicionar Vídeo'}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{video ? 'Editar Vídeo de Referência' : 'Adicionar Vídeo de Referência'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleSave)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Título</Label>
              <Input id="title" {...register("title", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="video_url" className="text-right">URL</Label>
              <Input id="video_url" {...register("video_url", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="course" className="text-right">Curso</Label>
              <Select onValueChange={(value) => setValue('course', value as any)} defaultValue={video?.course || 'Cine/TV'}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Animação">Animação</SelectItem>
                  <SelectItem value="Cine/TV">Cine/TV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 