"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Project } from "@/components/admin/ProjectManager"
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/utils"

interface ProjectCarouselProps {
  projects: Project[]
}

// Sub-componente para lidar com a lógica de imagem e fallback
const ProjectImage = ({ project }: { project: Project }) => {
  const initialUrl = getYouTubeThumbnail(project.video_url || "") || "https://via.placeholder.com/1920x1080/000000/FFFFFF?text=?"
  const [imgSrc, setImgSrc] = useState(initialUrl);

  useEffect(() => {
    setImgSrc(initialUrl);
  }, [initialUrl]);

  const handleImageError = () => {
    // Se maxresdefault falhar, tenta hqdefault
    if (project.video_url) {
      const videoId = (new URL(project.video_url)).searchParams.get('v') || (new URL(project.video_url)).pathname.slice(1);
      setImgSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    }
  };

  return (
    <Image
      src={imgSrc}
      alt={project.title || "Projeto sem título"}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover transition-transform duration-[400ms] ease-in-out"
      onError={handleImageError}
    />
  );
};

export default function ProjectCarousel({ projects }: ProjectCarouselProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-10">
        <p>Nenhum projeto encontrado.</p>
      </div>
    );
  }

  return (
    <div className="container-responsive">
      <Carousel
        opts={{
          align: "start",
          loop: playingVideoId === null, // Desativa o loop quando um vídeo está tocando
        }}
        className="w-full"
      >
        <CarouselContent>
          {projects.map((project) => (
            <CarouselItem key={project.id} className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
              <div className="group py-2 px-0.5 block transition-transform duration-[400ms] ease-in-out hover:scale-105">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  {playingVideoId === project.id ? (
                    (() => {
                      const embedUrl = getYouTubeEmbedUrl(project.video_url || "");
                      return embedUrl ? (
                        <iframe
                          width="100%"
                          height="100%"
                          src={embedUrl}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      ) : <p className="flex items-center justify-center h-full text-white text-center p-4">Vídeo indisponível</p>;
                    })()
                  ) : (
                    <div className="relative cursor-pointer h-full" onClick={() => project.video_url && setPlayingVideoId(project.id)}>
                      <ProjectImage project={project} />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-[400ms]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play-circle"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/></svg>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center text-white">
                  <h3 className="text-card-title">{project.title}</h3>
                  <p className="text-small-responsive text-gray-200">{project.course_category}</p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Setas para Mobile - sobre o vídeo */}
        <CarouselPrevious className="md:hidden top-[40%] h-8 w-8 left-2 z-10" />
        <CarouselNext className="md:hidden top-[40%] h-8 w-8 right-2 z-10" />
        
        {/* Setas para Desktop - fora do vídeo */}
        <CarouselPrevious className="hidden md:flex top-[26%] h-8 w-8" />
        <CarouselNext className="hidden md:flex top-[26%] h-8 w-8" />
      </Carousel>
    </div>
  );
} 