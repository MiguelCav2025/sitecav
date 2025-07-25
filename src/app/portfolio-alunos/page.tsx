"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/components/admin/ProjectManager";
import Image from "next/image";
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/utils";

// Sub-componente para lidar com a lógica de imagem e fallback
const PortfolioImage = ({ project }: { project: Project }) => {
  const initialUrl = getYouTubeThumbnail(project.video_url || "") || "https://via.placeholder.com/1920x1080/000000/FFFFFF?text=?"
  const [imgSrc, setImgSrc] = useState(initialUrl);

  useEffect(() => {
    setImgSrc(initialUrl);
  }, [initialUrl]);

  const handleImageError = () => {
    // Se maxresdefault falhar, tenta hqdefault
    if (project.video_url) {
      const videoIdMatch = project.video_url.match(/(?:v=|\/)([\w-]{11})(?:\?|&|#|$)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      if (videoId) {
        setImgSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      }
    }
  };

  return (
    <Image
      src={imgSrc}
      alt={project.title || "Projeto sem título"}
      layout="fill"
      objectFit="cover"
      className="transition-transform duration-300 ease-in-out group-hover:scale-110"
      onError={handleImageError}
    />
  );
};

export default function PortfolioAlunosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  useEffect(() => {
    async function getProjects() {
      const supabase = createClient();
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      setProjects(data || []);
    }
    getProjects();
  }, []);

  return (
    <div className="bg-blue-900 min-h-screen section-responsive">
      <div className="container mx-auto container-responsive">
        <div className="text-center spacing-section">
            <h1 className="text-hero text-white mb-4">Portfólio dos Alunos</h1>
            <p className="text-responsive text-[#fd9801]">Trabalhos de conclusão de curso realizados por nossos alunos.</p>
        </div>
        
        <div className="grid-projects gap-responsive">
          {projects.map((project: Project) => (
            <div key={project.id} className="group">
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
                  <div className="cursor-pointer h-full" onClick={() => project.video_url && setPlayingVideoId(project.id)}>
                    <PortfolioImage project={project} />
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play-circle"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/></svg>
                    </div>
                  </div>
                )}
              </div>
              <h3 className="mt-4 text-card-title text-white">{project.title}</h3>
              <p className="text-small-responsive text-gray-200">{project.course_category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 