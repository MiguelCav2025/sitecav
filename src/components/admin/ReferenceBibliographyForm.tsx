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
import { Bibliography } from "./reference-bibliography-data-table/columns";

type BibliographyFormData = {
  title: string;
  url: string;
  course: 'Animação' | 'Cine/TV';
};

interface ReferenceBibliographyFormProps {
  onSave: (data: BibliographyFormData) => Promise<void>;
  bibliography?: Bibliography;
}

export default function ReferenceBibliographyForm({ onSave, bibliography }: ReferenceBibliographyFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<BibliographyFormData>({
    defaultValues: { title: '', url: '', course: 'Cine/TV' },
  });

  useEffect(() => {
    if (isOpen) {
      if (bibliography) {
        reset(bibliography);
      } else {
        reset({ title: '', url: '', course: 'Cine/TV' });
      }
    }
  }, [isOpen, bibliography, reset]);

  const handleSave = async (data: BibliographyFormData) => {
    await onSave(data);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>{bibliography ? 'Editar' : 'Adicionar Bibliografia'}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{bibliography ? 'Editar Referência' : 'Adicionar Referência'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleSave)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Título</Label>
              <Input id="title" {...register("title", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">URL</Label>
              <Input id="url" {...register("url", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="course" className="text-right">Curso</Label>
              <Select onValueChange={(value) => setValue('course', value as any)} defaultValue={bibliography?.course || 'Cine/TV'}>
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