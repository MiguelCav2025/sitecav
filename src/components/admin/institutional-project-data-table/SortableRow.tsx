"use client"

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell } from '@/components/ui/table';
import { InstitutionalProject } from './columns';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from 'next/image';

interface SortableRowProps {
  id: string;
  project: InstitutionalProject;
  order: number;
  onEdit: (project: InstitutionalProject) => void;
  onDelete: (id: string) => void;
}

export function SortableRow({ id, project, order, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      <TableCell>
        <Button variant="ghost" {...listeners} className="cursor-grab">
          <GripVertical className="h-5 w-5" />
        </Button>
      </TableCell>
      <TableCell className="font-medium">{order}</TableCell>
      <TableCell>
        {project.image_url ? (
          <Image src={project.image_url} alt={project.title} width={80} height={45} className="rounded object-cover" />
        ) : (
          <div className="w-20 h-[45px] bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">Sem Imagem</div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
            <span className="font-medium">{project.title}</span>
            <span className="text-sm text-muted-foreground">{project.subtitle}</span>
        </div>
      </TableCell>
      <TableCell>
        <Dialog>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                  Editar
              </DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600 hover:!text-red-600"
                >
                    Excluir
                </DropdownMenuItem>
              </DialogTrigger>
              </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem certeza?</DialogTitle>
              <DialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente o projeto.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <Button variant="outline" asChild>
                 <DialogTrigger>Cancelar</DialogTrigger>
              </Button>
              <Button variant="destructive" onClick={() => onDelete(project.id)}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
} 