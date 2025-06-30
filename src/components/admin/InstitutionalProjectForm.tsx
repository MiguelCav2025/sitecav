"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { InstitutionalProject } from "./institutional-project-data-table/columns"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface ProjectFormProps {
  project?: InstitutionalProject | null
  onSave: () => void
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export function InstitutionalProjectForm({ project, onSave, isOpen, setIsOpen }: ProjectFormProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Partial<InstitutionalProject>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchProjectDetails() {
      if (isOpen && project?.id) {
        const { data, error } = await supabase
          .from('institutional_projects')
          .select('*')
          .eq('id', project.id)
          .single()
        if (data) {
            setFormData(data)
            setImageFile(null)
        }
        else console.error("Erro ao buscar detalhes:", error)
      } else if (isOpen) {
        setFormData({})
        setImageFile(null)
      }
    }
    fetchProjectDetails()
  }, [isOpen, project, supabase])


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData({ ...formData, [id]: value })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    setIsSaving(true)
    let imageUrl = formData?.image_url || null

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project_images')
        .upload(fileName, imageFile)

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        setIsSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('project_images').getPublicUrl(uploadData.path)
      imageUrl = urlData.publicUrl
    }

    const projectData = {
      title: formData?.title,
      subtitle: formData?.subtitle,
      description: formData?.description,
      link_url: formData?.link_url,
      image_url: imageUrl,
    }

    if (project?.id) {
      const { error } = await supabase
        .from('institutional_projects')
        .update(projectData)
        .eq('id', project.id)
      if (error) console.error('Error updating project:', error)
    } else {
        const { data: existingProjects, error: countError } = await supabase
            .from('institutional_projects')
            .select('id');
        
        if (countError) {
            console.error("Erro ao contar projetos:", countError)
            setIsSaving(false)
            return
        }

        const newPosition = existingProjects?.length || 0;

        const { error } = await supabase
            .from('institutional_projects')
            .insert({ ...projectData, order_position: newPosition });
        if (error) console.error('Error creating project:', error);
    }
    
    setIsSaving(false)
    onSave()
    setIsOpen(false)
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{project?.id ? 'Editar Projeto' : 'Adicionar Novo Projeto'}</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo. A ordem é gerenciada na tabela principal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Título</Label>
            <Input id="title" value={formData?.title || ''} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subtitle" className="text-right">Subtítulo</Label>
            <Input id="subtitle" value={formData?.subtitle || ''} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Descrição</Label>
            <Textarea id="description" value={formData?.description || ''} onChange={handleChange} className="col-span-3 min-h-[100px]" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="link_url" className="text-right">Link</Label>
            <Input id="link_url" value={formData?.link_url || ''} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right">Imagem</Label>
            <Input id="image" type="file" onChange={handleFileChange} className="col-span-3" />
          </div>
          {formData?.image_url && !imageFile && (
            <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-start-2 col-span-3">
                    <p className="text-sm text-muted-foreground">Imagem atual:</p>
                    <img src={formData.image_url} alt="Imagem atual" className="w-32 h-auto rounded-md mt-1" />
                </div>
            </div>
          )}
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 