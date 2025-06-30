"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/admin/project-data-table/data-table"; 
import { columns, Bibliography } from "./reference-bibliography-data-table/columns";
import ReferenceBibliographyForm from "./ReferenceBibliographyForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export default function ReferenceBibliographyManager() {
  const [bibliographies, setBibliographies] = useState<Bibliography[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const supabase = createClient();

  const fetchBibliographies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reference_bibliographies")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setBibliographies(data);
    }
    if(error) {
      console.error("Erro ao buscar bibliografias:", error);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBibliographies();
  }, [fetchBibliographies]);

  const handleSave = async (formData: Omit<Bibliography, 'id' | 'created_at'>, id?: string) => {
    if (id) {
      // Update
      const { error } = await supabase.from("reference_bibliographies").update(formData).eq("id", id);
      if (error) console.error("Erro ao atualizar:", error);
    } else {
      // Insert
      const { error } = await supabase.from("reference_bibliographies").insert(formData);
      if (error) console.error("Erro ao inserir:", error);
    }
    fetchBibliographies();
    setIsAddModalOpen(false); // Fechar modal após salvar
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reference_bibliographies").delete().eq("id", id);
    if (!error) {
        fetchBibliographies();
    } else {
        console.error("Erro ao excluir:", error);
    }
  };
  
  const actionColumn = {
    id: "actions",
    header: "Ações",
    cell: ({ row }: { row: { original: Bibliography }}) => {
      const bibliography = row.original;
      return (
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
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <ReferenceBibliographyForm
                      bibliography={bibliography}
                      onSave={(data) => handleSave(data, bibliography.id)}
                  />
              </DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Excluir
                </DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem certeza?</DialogTitle>
              <DialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente a referência bibliográfica.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" asChild>
                 <DialogTrigger>Cancelar</DialogTrigger>
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(bibliography.id)}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    },
  };

  const tableColumns = [actionColumn, ...columns];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle>Gerenciar Bibliografia</CardTitle>
            <Button onClick={() => setIsAddModalOpen(true)} variant="orange">Adicionar Referência</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p>Carregando...</p> : <DataTable columns={tableColumns} data={bibliographies} />}
      </CardContent>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Referência</DialogTitle>
          </DialogHeader>
          <ReferenceBibliographyForm onSave={(data) => handleSave(data)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
} 