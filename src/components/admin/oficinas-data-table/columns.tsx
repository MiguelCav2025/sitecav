import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Oficina } from "../OficinaManager";
import Image from "next/image";

export const columns = ({ onEdit, onDelete }: { onEdit: (oficina: Oficina) => void; onDelete: (id: string) => void; }): ColumnDef<Oficina>[] => [
  {
    id: "capa",
    header: "Capa",
    cell: ({ row }) => {
      const oficina = row.original;
      return oficina.capa_url ? (
        <div className="w-20 h-12 relative">
          <Image src={oficina.capa_url} alt={oficina.titulo} fill className="object-cover rounded" />
        </div>
      ) : (
        <div className="w-20 h-12 bg-gray-200 rounded" />
      );
    },
    size: 80,
  },
  {
    accessorKey: "titulo",
    header: "Título",
    size: 200,
  },
  {
    accessorKey: "data_oficina",
    header: "Data",
    cell: ({ row }) => {
      const data = row.original.data_oficina;
      return data ? new Date(data).toLocaleDateString() : "-";
    },
    size: 80,
  },
  {
    accessorKey: "nome_professor",
    header: "Professor",
    size: 120,
  },
  {
    accessorKey: "vagas",
    header: "Vagas",
    size: 60,
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const oficina = row.original;
      return (
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                ...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(oficina)}>Editar</DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-600">Excluir</DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem certeza?</DialogTitle>
              <DialogDescription>Essa ação não pode ser desfeita. Isso excluirá permanentemente a oficina.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogTrigger>
              <Button variant="destructive" onClick={() => onDelete(oficina.id)}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    },
    size: 60,
  },
]; 