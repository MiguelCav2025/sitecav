import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArteEducador } from "../ArteEducadorManager";
import Image from "next/image";

export const columns = ({ onEdit, onDelete }: { onEdit: (educador: ArteEducador) => void; onDelete: (id: string) => void; }): ColumnDef<ArteEducador>[] => [
  {
    id: "foto",
    header: "Foto",
    cell: ({ row }) => {
      const educador = row.original;
      return educador.foto_url ? (
        <div className="w-16 h-16 relative">
          <Image src={educador.foto_url} alt={educador.nome} fill className="object-cover rounded-full" />
        </div>
      ) : (
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
      );
    },
    size: 70,
  },
  {
    accessorKey: "nome",
    header: "Nome",
    size: 180,
  },
  {
    accessorKey: "materia",
    header: "Matéria",
    size: 150,
  },
  {
    accessorKey: "mini_bio",
    header: "Mini Bio",
    size: 300,
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const educador = row.original;
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
              <DropdownMenuItem onClick={() => onEdit(educador)}>Editar</DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-600">Excluir</DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem certeza?</DialogTitle>
              <DialogDescription>Essa ação não pode ser desfeita. Isso excluirá permanentemente o arte-educador.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogTrigger>
              <Button variant="destructive" onClick={() => onDelete(educador.id)}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    },
    size: 60,
  },
]; 