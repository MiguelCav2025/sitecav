"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

// Definindo o tipo para os dados do vídeo de referência
export type ReferenceVideo = {
  id: string
  title: string
  video_url: string
  course: 'Animação' | 'Cine/TV'
}

export const columns: ColumnDef<ReferenceVideo>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Título
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "course",
    header: "Curso",
  },
  {
    accessorKey: "video_url",
    header: "URL do Vídeo",
  },
] 