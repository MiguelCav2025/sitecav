"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"

export type Photo = {
  id: string; 
  created_at: string;
  image_url: string;
  title: string | null;
  gallery_order: number;
};

type ColumnsProps = {
  onEdit: (photo: Photo) => void
  onDelete: (id: string) => void
}

export const columns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<Photo>[] => [
  {
    accessorKey: "image_url",
    header: "Imagem",
    cell: ({ row }) => {
      const imageUrl = row.getValue("image_url")
      return imageUrl ? <Image src={imageUrl as string} alt="Thumbnail" width={100} height={100} className="rounded object-cover aspect-square" /> : <div className="w-[100px] h-[100px] bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">Sem Imagem</div>
    },
  },
  {
    accessorKey: "title",
    header: "Título",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const photo = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(photo)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(photo.id)}
              className="text-red-600 hover:!text-red-600"
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
] 