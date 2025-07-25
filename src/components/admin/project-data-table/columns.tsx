"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Project } from "../ProjectManager"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { getYouTubeThumbnail } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"

// Hook para debounce
function useDebounce(value: any, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

type ColumnsProps = {
    onEdit: (project: Project) => void;
    onDelete: (projectId: string, thumbnailUrl: string | null) => void;
    onFeatureToggle: (projectId: string, isFeatured: boolean) => void;
    fetchProjects: () => void;
}

// Adicionando a tipagem para a meta propriedade
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue extends unknown> {
    className?: string;
  }
}

export const columns = ({ onEdit, onDelete, onFeatureToggle, fetchProjects }: ColumnsProps): ColumnDef<Project>[] => [
  {
    id: "featured",
    cell: ({ row }: { row: { original: Project } }) => {
      const project = row.original;
      
      const handleToggleFeatured = async () => {
        const supabase = createClient();
        const newValue = !project.is_featured;

        // Otimista: atualiza a UI antes da resposta do DB
        onFeatureToggle(project.id, newValue); 

        const { error } = await supabase
          .from('projects')
          .update({ is_featured: newValue })
          .eq('id', project.id);

        if (error) {
          console.error("Failed to update featured status:", error);
          // Reverte em caso de erro
          onFeatureToggle(project.id, project.is_featured); 
        }
      };

      return (
        <Button variant="ghost" size="icon" onClick={handleToggleFeatured} className="group">
          <Star className={`h-5 w-5 ${project.is_featured ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 group-hover:text-yellow-300'}`} />
        </Button>
      );
    },
    size: 20,
  },
  {
    id: "order",
    cell: ({ row }: { row: { original: Project } }) => {
      const project = row.original;
      const [order, setOrder] = useState(project.featured_order);
      const debouncedOrder = useDebounce(order, 300);

      const updateOrderInDb = async (value: number) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('projects')
          .update({ featured_order: value })
          .eq('id', project.id);
        
        if (!error) {
          fetchProjects(); // Recarrega os dados
        }
      };

      useEffect(() => {
        if (debouncedOrder !== project.featured_order) {
          updateOrderInDb(debouncedOrder);
        }
      }, [debouncedOrder, project.id, project.featured_order]);

      const handleBlur = () => {
        if (order !== project.featured_order) {
          updateOrderInDb(order);
        }
      };

      return (
        <Input
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          onBlur={handleBlur}
          className="w-10 h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      );
    },
    size: 50,
  },
  {
    id: "thumbnail",
    cell: ({ row }: { row: { original: Project } }) => {
      const project = row.original;
      const thumbnailUrl = project.thumbnail_url || getYouTubeThumbnail(project.video_url || "");

      if (!thumbnailUrl) {
        return <div className="w-24 h-14 bg-gray-200 rounded-md" />;
      }
      
      return (
        <div className="w-24 h-14 relative">
          <Image
            src={thumbnailUrl}
            alt={`Thumbnail for ${project.title}`}
            fill
            className="rounded-md object-cover"
          />
        </div>
      );
    },
    size: 110,
  },
  {
    accessorKey: "title",
    header: "Título",
    size: 500,
  },
  {
    id: "actions",
    cell: ({ row }: { row: { original: Project } }) => {
      const project = row.original

      return (
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(project.id)}
              >
                Copiar ID do Projeto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(project)}>Editar</DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
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
              <DialogTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogTrigger>
              <Button variant="destructive" onClick={() => onDelete(project.id, project.thumbnail_url)}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    },
    size: 40,
  },
  {
    accessorKey: "course_category",
    header: "Categoria",
    size: 80,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Data de Criação
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    cell: ({ row }: { row: any }) => {
        const date = new Date(row.getValue("created_at"))
        const formatted = date.toLocaleDateString('pt-BR')
        return <div className="font-medium">{formatted}</div>
      },
    size: 80,
  },
] 