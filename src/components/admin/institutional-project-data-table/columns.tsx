"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"

export type InstitutionalProject = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  link_url: string | null
  image_url: string | null
  order_position: number
}

type ColumnsProps = {
  onEdit: (project: InstitutionalProject) => void
  onDelete: (id: string) => void
}

export const columns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<InstitutionalProject>[] => [
  {
    accessorKey: "order_position",
    header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Ordem
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    cell: ({ row }) => <div className="pl-4">{row.original.order_position}</div>,
  },
  {
    accessorKey: "image_url",
    header: "Imagem",
    cell: ({ row }) => {
      const imageUrl = row.getValue("image_url")
      return imageUrl ? <Image src={imageUrl as string} alt="Thumbnail" width={100} height={56} className="rounded object-cover" /> : <div className="w-[100px] h-[56px] bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">Sem Imagem</div>
    },
  },
  {
    accessorKey: "title",
    header: "Título",
    cell: ({ row }) => {
        return (
            <div className="flex flex-col">
                <span className="font-medium">{row.original.title}</span>
                <span className="text-sm text-muted-foreground">{row.original.subtitle}</span>
            </div>
        )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const project = row.original

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
            <DropdownMenuItem onClick={() => onEdit(project)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(project.id)}
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