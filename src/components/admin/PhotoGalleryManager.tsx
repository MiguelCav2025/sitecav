'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PhotoGalleryForm from './PhotoGalleryForm';
import { DraggableDataTable } from './photo-gallery-data-table/DraggableDataTable';
import type { Photo } from './photo-gallery-data-table/columns';

export default function PhotoGalleryManager() {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [initialOrder, setInitialOrder] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const fetchPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from('photo_gallery')
      .select('*')
      .order('gallery_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar as fotos:', error);
      setPhotos([]);
      setInitialOrder([]);
    } else {
      setPhotos(data as Photo[] || []);
      setInitialOrder(data as Photo[] || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    fetchPhotos();
  }, [fetchPhotos]);

  const handleSave = () => {
    fetchPhotos();
    setEditingPhoto(null);
  };
  
  const openEditModal = (photo: Photo) => {
    setEditingPhoto(photo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPhoto(null);
  }

  const deletePhoto = async (photoId: string) => {
    const photoToDelete = photos.find(p => p.id === photoId);
    if (!photoToDelete) return;

    const fileName = photoToDelete.image_url.split('/').pop();
    if (fileName) {
        const { error: storageError } = await supabase.storage.from('gallery-photos').remove([fileName]);
        if (storageError) {
            console.error('Erro ao excluir a imagem do Storage:', storageError);
            alert("Não foi possível remover o arquivo de imagem.");
            return;
        }
    }
    
    const { error } = await supabase.from('photo_gallery').delete().eq('id', photoId);
    if (error) {
      console.error('Erro ao excluir a foto:', error);
    } else {
      fetchPhotos();
    }
  };

  const handleSaveChanges = async () => {
    setIsSavingOrder(true);
    const updates = photos.map((photo, index) => ({
      id: photo.id,
      gallery_order: index,
    }));

    const { error } = await supabase.from("photo_gallery").upsert(updates);

    if (error) {
      console.error("Erro ao salvar a nova ordem:", error);
    } else {
      setInitialOrder(photos);
    }
    setIsSavingOrder(false);
  };

  const isOrderChanged = JSON.stringify(photos) !== JSON.stringify(initialOrder);

  if (loading) {
    return <div>Carregando galeria...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Gerenciar Galeria de Fotos</CardTitle>
          <div>
            <Button 
              onClick={handleSaveChanges} 
              disabled={!isOrderChanged || isSavingOrder} 
              className="mr-2"
              variant={isOrderChanged && !isSavingOrder ? "orange" : "default"}
            >
              {isSavingOrder ? "Salvando..." : "Salvar Ordem"}
            </Button>
            <Button onClick={() => setIsModalOpen(true)} variant="orange">Adicionar Foto</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => !isOpen && closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPhoto ? 'Editar Foto' : 'Adicionar Nova Foto'}</DialogTitle>
              <DialogDescription>
                {editingPhoto ? 'Modifique os detalhes da foto.' : 'Faça o upload da imagem e adicione um título.'}
              </DialogDescription>
            </DialogHeader>
            <PhotoGalleryForm 
              photo={editingPhoto}
              onSave={handleSave} 
              onClose={closeModal}
            />
          </DialogContent>
        </Dialog>
        <DraggableDataTable
          items={photos}
          setItems={setPhotos}
          onEdit={openEditModal}
          onDelete={deletePhoto}
        />
      </CardContent>
    </Card>
  );
} 