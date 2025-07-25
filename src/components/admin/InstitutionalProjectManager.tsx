"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { InstitutionalProject } from "./institutional-project-data-table/columns"
import { Button } from "@/components/ui/button"
import { InstitutionalProjectForm } from "./InstitutionalProjectForm"
import { DraggableDataTable } from "./institutional-project-data-table/DraggableDataTable"
import { arrayMove } from "@dnd-kit/sortable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function InstitutionalProjectManager() {
  const supabase = createClient()
  const [projects, setProjects] = useState<InstitutionalProject[]>([])
  const [initialOrder, setInitialOrder] = useState<InstitutionalProject[]>([])
  const [loading, setLoading] = useState(true)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<InstitutionalProject | null>(null)

  const getProjects = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("institutional_projects")
      .select("*") 
      .order("order_position", { ascending: true })

    if (error) {
      console.error("Erro ao buscar projetos institucionais:", error)
      setProjects([])
      setInitialOrder([])
    } else if (data) {
      setProjects(data)
      setInitialOrder(data)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    getProjects()
  }, [getProjects])

  const handleReorder = (event: any) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
        setProjects((items) => {
            const oldIndex = items.findIndex((item) => item.id === active.id)
            const newIndex = items.findIndex((item) => item.id === over.id)
            return arrayMove(items, oldIndex, newIndex)
        })
    }
  }

  const handleSaveChanges = async () => {
    setIsSavingOrder(true)
    const updates = projects.map((project, index) => ({
      id: project.id,
      order_position: index,
    }))

    const { error } = await supabase.from("institutional_projects").upsert(updates)

    if (error) {
      console.error("Erro ao salvar a nova ordem:", error)
      // Adicionar notificação de erro para o usuário
    } else {
      setInitialOrder(projects) // Atualiza a ordem inicial para a nova ordem salva
    }
    setIsSavingOrder(false)
  }

  const isOrderChanged = JSON.stringify(projects) !== JSON.stringify(initialOrder)

  const handleAddNew = () => {
    setSelectedProject(null)
    setIsFormOpen(true)
  }

  const handleEdit = (project: InstitutionalProject) => {
    setSelectedProject(project)
    setIsFormOpen(true)
  }

  const handleDelete = async (projectId: string) => {
    // A confirmação agora é feita no componente SortableRow
    // Primeiro, deletar a imagem do storage se houver
    // (Lógica a ser adicionada)
    
    const { error } = await supabase
      .from("institutional_projects")
      .delete()
      .eq("id", projectId)

    if (error) {
      console.error("Erro ao excluir projeto:", error)
    } else {
      getProjects() // Atualiza a lista
    }
  }

  const handleSave = () => {
    setIsFormOpen(false)
    getProjects()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Projetos Institucionais</CardTitle>
        <div>
          <Button 
            onClick={handleSaveChanges} 
            disabled={!isOrderChanged || isSavingOrder} 
            className="mr-2"
            variant={isOrderChanged && !isSavingOrder ? "orange" : "default"}
          >
            {isSavingOrder ? "Salvando..." : "Salvar Ordem"}
          </Button>
          <Button onClick={handleAddNew} variant="orange">Adicionar Projeto</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Carregando projetos...</p>
        ) : (
          <DraggableDataTable
            items={projects}
            setItems={setProjects}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {isFormOpen && (
          <InstitutionalProjectForm 
            isOpen={isFormOpen}
            setIsOpen={setIsFormOpen}
            project={selectedProject}
            onSave={handleSave}
          />
        )}
      </CardContent>
    </Card>
  )
} 