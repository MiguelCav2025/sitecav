'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { Photo } from './photo-gallery-data-table/columns';

interface PhotoGalleryFormProps {
  photo?: Photo | null;
  onSave: () => void;
  onClose: () => void;
}

export default function PhotoGalleryForm({ photo, onSave, onClose }: PhotoGalleryFormProps) {
  const supabase = createClient();
  const [title, setTitle] = useState(photo?.title || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    let imageUrl = photo?.image_url || '';

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gallery-photos')
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error('Erro no upload da imagem:', uploadError);
        setIsSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('gallery-photos')
        .getPublicUrl(uploadData.path);
      
      imageUrl = publicUrlData.publicUrl;
    }

    const photoData = {
      title,
      image_url: imageUrl,
    };

    if (photo) {
      // Editar foto existente
      const { error } = await supabase
        .from('photo_gallery')
        .update(photoData)
        .eq('id', photo.id);

      if (error) {
        console.error('Erro ao atualizar a foto:', error);
      }
    } else {
      // Adicionar nova foto
      const { error } = await supabase.from('photo_gallery').insert([photoData]);
      if (error) {
        console.error('Erro ao adicionar a foto:', error);
      }
    }

    setIsSaving(false);
    onSave();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title" className="mb-2 block">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="image" className="mb-2 block">Imagem</Label>
        <Input
          id="image"
          type="file"
          onChange={(e) => e.target.files && setImageFile(e.target.files[0])}
          accept="image/*"
          required={!photo}
        />
        {photo?.image_url && (
            <div className="mt-2">
                <p className="text-sm text-gray-500">Imagem atual:</p>
                <img src={photo.image_url || ''} alt={photo.title || ''} className="h-20 w-auto rounded-md" />
            </div>
        )}
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
} 