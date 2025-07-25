'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './arte-educadores-data-table/data-table';
import { columns as educadoresColumns } from './arte-educadores-data-table/columns';
import ArteEducadorForm from './ArteEducadorForm';

export type ArteEducador = {
  id: string;
  foto_url: string | null;
  nome: string;
  mini_bio: string | null;
  materia: string | null;
};

export default function ArteEducadorManager() {
  const supabase = createClient();
  const [educadores, setEducadores] = useState<ArteEducador[]>([]);
  const [editingEducador, setEditingEducador] = useState<ArteEducador | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchEducadores = async () => {
    const { data, error } = await supabase
      .from('arte_educadores')
      .select('*')
      .order('nome', { ascending: true });
    if (!error) setEducadores(data || []);
  };

  useEffect(() => {
    fetchEducadores();
  }, []);

  const handleEdit = (educador: ArteEducador) => {
    setEditingEducador(educador);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('arte_educadores').delete().eq('id', id);
    fetchEducadores();
  };

  const onFormSave = () => {
    fetchEducadores();
    setIsFormOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Arte-educadores</CardTitle>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingEducador(null); setIsFormOpen(true); }} variant="orange">Adicionar Novo Educador</Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={educadoresColumns({ onEdit: handleEdit, onDelete: handleDelete })} data={educadores} />
      </CardContent>
      <ArteEducadorForm
        educador={editingEducador}
        onSave={onFormSave}
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
      />
    </Card>
  );
} 