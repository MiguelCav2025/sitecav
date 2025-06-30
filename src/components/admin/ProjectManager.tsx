'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "./project-data-table/data-table";
import { columns } from "./project-data-table/columns";
import { ProjectForm } from "./ProjectForm";
import { RowSelectionState } from "@tanstack/react-table";

export type Project = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  course_category: string | null;
  is_featured: boolean;
  featured_order: number;
};

export default function ProjectManager() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('featured_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar projetos:", error);
      setProjects([]);
    } else {
      setProjects(data);
    }
    setRowSelection({});
  };

  useEffect(() => {
    fetchProjects();
  }, [supabase]);

  const handleDelete = async (projectId: string, thumbnailUrl: string | null) => {
    try {
      if (thumbnailUrl) {
        const fileName = thumbnailUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('site-assets').remove([`projects/${fileName}`]);
        }
      }
      await supabase.from('projects').delete().eq('id', projectId);
      fetchProjects();
    } catch (error: any) {
      alert("Erro ao excluir o projeto: " + error.message);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const onFormSave = () => {
    fetchProjects();
    setIsFormOpen(false);
  }

  const handleFeatureToggle = (projectId: string, isFeatured: boolean) => {
    setProjects(currentProjects =>
      currentProjects.map(p =>
        p.id === projectId ? { ...p, is_featured: isFeatured } : p
      )
    );
  };

  const dynamicColumns = columns({ 
    onEdit: handleEdit, 
    onDelete: handleDelete,
    onFeatureToggle: handleFeatureToggle,
    fetchProjects: fetchProjects
  });

  const numSelected = Object.keys(rowSelection).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Portfólio/Galeria</CardTitle>
        <div className="flex items-center gap-2">
          {/* A exclusão em massa será reimplementada no futuro, se necessário */}
          <Button onClick={handleAddNew} variant="orange">Adicionar Novo Projeto</Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable 
          columns={dynamicColumns} 
          data={projects}
        />
      </CardContent>
      <ProjectForm
        project={editingProject}
        onSave={onFormSave}
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
      />
    </Card>
  );
} 