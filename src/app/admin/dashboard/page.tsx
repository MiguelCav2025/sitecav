'use client';

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const BannerManager = dynamic(() => import('@/components/admin/BannerManager'), { ssr: false });
const ProjectManager = dynamic(() => import('@/components/admin/ProjectManager'), { ssr: false });
const ReferenceVideoManager = dynamic(() => import('@/components/admin/ReferenceVideoManager'), { ssr: false });
const ReferenceBibliographyManager = dynamic(() => import('@/components/admin/ReferenceBibliographyManager'), { ssr: false });
const InstitutionalProjectManager = dynamic(() => import('@/components/admin/InstitutionalProjectManager'), { ssr: false });
const PhotoGalleryManager = dynamic(() => import('@/components/admin/PhotoGalleryManager'), { ssr: false });
const DownloadManager = dynamic(() => import('@/components/admin/DownloadManager'), { ssr: false });
const ProcessDataManager = dynamic(() => import('@/components/admin/ProcessDataManager'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      } else {
        router.push('/admin/login');
      }
    };
    getUser();
  }, [router, supabase.auth]);

  if (!user) {
    return null; // Não renderiza nada até o usuário ser verificado
  }

  return (
    <div className="container mx-auto py-10 px-14">
      <Tabs defaultValue="banners">
        <TabsList className="grid h-14 w-full grid-cols-8 p-1">
          <TabsTrigger value="banners" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Banners Home</TabsTrigger>
          <TabsTrigger value="portfolio" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Portfólio Alunos</TabsTrigger>
          <TabsTrigger value="institutional_projects" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Projetos CAV</TabsTrigger>
          <TabsTrigger value="photo_gallery" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Galeria de Fotos</TabsTrigger>
          <TabsTrigger value="downloads" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Área Downloads</TabsTrigger>
          <TabsTrigger value="process_data" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Dados Processo</TabsTrigger>
          <TabsTrigger value="ref_videos" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Filmografia</TabsTrigger>
          <TabsTrigger value="ref_biblio" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Bibliografia</TabsTrigger>
        </TabsList>
        <TabsContent value="banners" className="mt-4">
          <BannerManager />
        </TabsContent>
        <TabsContent value="portfolio" className="mt-4">
          <ProjectManager />
        </TabsContent>
        <TabsContent value="institutional_projects" className="mt-4">
          <InstitutionalProjectManager />
        </TabsContent>
        <TabsContent value="photo_gallery" className="mt-4">
          <PhotoGalleryManager />
        </TabsContent>
        <TabsContent value="downloads" className="mt-4">
          <DownloadManager />
        </TabsContent>
        <TabsContent value="process_data" className="mt-4">
          <ProcessDataManager />
        </TabsContent>
        <TabsContent value="ref_videos" className="mt-4">
          <ReferenceVideoManager />
        </TabsContent>
        <TabsContent value="ref_biblio" className="mt-4">
          <ReferenceBibliographyManager />
        </TabsContent>
      </Tabs>
    </div>
  );
} 