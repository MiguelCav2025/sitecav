'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import PhotoGalleryLightbox from './PhotoGalleryLightbox';

type Photo = {
  id: number;
  image_url: string;
  title: string;
};

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('photo_gallery')
        .select('id, image_url, title')
        .order('gallery_order', { ascending: true, nullsFirst: false })
        .limit(12); // Limitar a um número razoável de fotos na home

      if (error) {
        console.error('Error fetching photos:', error);
      } else {
        setPhotos(data);
      }
    };
    fetchPhotos();
  }, []);

  const openModal = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeModal = () => {
    setSelectedImageIndex(null);
  };

  const goToNext = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % photos.length);
    }
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex - 1 + photos.length) % photos.length);
    }
  };

  return (
    <section className="section-responsive bg-blue-900">
      <div className="container mx-auto container-responsive">
        <h2 className="text-hero text-white text-center spacing-section">Galeria de Fotos</h2>
        {photos.length > 0 && (
          <div className="grid-gallery gap-responsive">
            {photos.map((photo, index) => (
              <div key={photo.id} className="cursor-pointer group overflow-hidden rounded-lg transition-transform duration-300 ease-in-out hover:scale-105" onClick={() => openModal(index)}>
                <Image
                  src={photo.image_url}
                  alt={photo.title || 'Foto da galeria'}
                  width={400}
                  height={400}
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedImageIndex !== null && (
          <PhotoGalleryLightbox
            photo={photos[selectedImageIndex]}
            onClose={closeModal}
            onNext={goToNext}
            onPrevious={goToPrevious}
          />
        )}
      </AnimatePresence>
    </section>
  );
} 