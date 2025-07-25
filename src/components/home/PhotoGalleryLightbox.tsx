"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Photo = {
  id: number;
  image_url: string;
  title: string;
};

interface PhotoGalleryLightboxProps {
  photo: Photo;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export default function PhotoGalleryLightbox({
  photo,
  onClose,
  onNext,
  onPrevious,
}: PhotoGalleryLightboxProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-6xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full rounded-lg overflow-hidden"
        >
             <Image
                src={photo.image_url}
                alt={photo.title || "Foto da galeria"}
                fill
                sizes="100vw"
                className="object-contain"
                priority
            />
        </motion.div>

        {photo.title && (
            <div className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-white text-center">
                <p className="text-lg font-medium">{photo.title}</p>
            </div>
        )}
      </div>

      {/* Botões */}
      <Button
        variant="ghost"
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full h-10 w-10 p-2 z-20"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-6 w-6" />
      </Button>

      <Button
        variant="ghost"
        className="absolute top-1/2 -translate-y-1/2 left-4 text-white bg-black/50 rounded-full h-10 w-10 p-2 z-20"
        onClick={(e) => { e.stopPropagation(); onPrevious(); }}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      <Button
        variant="ghost"
        className="absolute top-1/2 -translate-y-1/2 right-4 text-white bg-black/50 rounded-full h-10 w-10 p-2 z-20"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </motion.div>
  );
} 