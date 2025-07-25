'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './oficinas-data-table/data-table';
import { columns as oficinasColumns } from './oficinas-data-table/columns';
import OficinaForm from './OficinaForm';

export type Oficina = {
  id: string;
  capa_url: string | null;
  titulo: string;
  data_oficina: string;
  descricao: string | null;
  nome_professor: string;
  mini_bio_professor: string | null;
  data_inscricao: string | null;
  vagas: number | null;
  link_inscricao: string | null;
};

export default function OficinaManager() {
  const supabase = createClient();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [editingOficina, setEditingOficina] = useState<Oficina | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchOficinas = async () => {
    const { data, error } = await supabase
      .from('oficinas')
      .select('*')
      .order('data_oficina', { ascending: false });
    if (!error) setOficinas(data || []);
  };

  useEffect(() => {
    fetchOficinas();
  }, []);

  const handleEdit = (oficina: Oficina) => {
    setEditingOficina(oficina);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('oficinas').delete().eq('id', id);
    fetchOficinas();
  };

  const onFormSave = () => {
    fetchOficinas();
    setIsFormOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Oficinas</CardTitle>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingOficina(null); setIsFormOpen(true); }} variant="orange">Adicionar Nova Oficina</Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={oficinasColumns({ onEdit: handleEdit, onDelete: handleDelete })} data={oficinas} />
      </CardContent>
      <OficinaForm
        oficina={editingOficina}
        onSave={onFormSave}
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
      />
    </Card>
  );
} 