"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Link as LinkIcon } from "lucide-react"

export type Bibliography = {
  id: string
  title: string
  url: string
  course: 'Animação' | 'Cine/TV'
}

export const columns: ColumnDef<Bibliography>[] = [
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
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
        const url = row.getValue("url") as string
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
            <LinkIcon className="h-4 w-4" />
            Abrir link
          </a>
        )
      },
  },
] 