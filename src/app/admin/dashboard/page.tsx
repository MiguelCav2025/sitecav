'use client';

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const BannerManager = dynamic(() => import('@/components/admin/BannerManager'), { ssr: false });
const ProjectManager = dynamic(() => import('@/components/admin/ProjectManager'), { ssr: false });
const ReferenceVideoManager = dynamic(() => import('@/components/admin/ReferenceVideoManager'), { ssr: false });
const ReferenceBibliographyManager = dynamic(() => import('@/components/admin/ReferenceBibliographyManager'), { ssr: false });
const InstitutionalProjectManager = dynamic(() => import('@/components/admin/InstitutionalProjectManager'), { ssr: false });
const PhotoGalleryManager = dynamic(() => import('@/components/admin/PhotoGalleryManager'), { ssr: false });
const DownloadManager = dynamic(() => import('@/components/admin/DownloadManager'), { ssr: false });
const ProcessDataManager = dynamic(() => import('@/components/admin/ProcessDataManager'), { ssr: false });
const OficinaManager = dynamic(() => import('@/components/admin/OficinaManager'), { ssr: false });
const ArteEducadorManager = dynamic(() => import('@/components/admin/ArteEducadorManager'), { ssr: false });
const AdminManager = dynamic(() => import('@/components/admin/AdminManager'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const breakpoint = useBreakpoint();
  const [tab, setTab] = useState("banners");
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Lista de abas centralizada para fácil manutenção e ordem preservada
  const tabs = [
    { value: "banners", label: "Banners" },
    { value: "portfolio", label: "Portfólio Alunos" },
    { value: "institutional_projects", label: "Projetos do Cav" },
    { value: "photo_gallery", label: "Galeria de fotos" },
    { value: "oficinas", label: "Oficinas" },
    { value: "arte_educadores", label: "Educadores" },
    { value: "downloads", label: "Área de Download" },
    { value: "process_data", label: "Processo Seletivo" },
    { value: "ref_videos", label: "Filmografia" },
    { value: "ref_biblio", label: "Bibliografia" },
    { value: "admin", label: "Admin" },
  ];

  // Definir a cor azul do fundo do sistema
  const azulFundo = '#2563eb'; // Substitua pelo valor exato se for diferente

  // Garante que o scroll horizontal sempre comece do início
  useEffect(() => {
    if (breakpoint !== "mobile" && tabsListRef.current) {
      tabsListRef.current.scrollLeft = 0;
    }
  }, [breakpoint, tabsListRef]);

  // Garante que a aba ativa fique sempre visível ao trocar
  useEffect(() => {
    if (breakpoint !== "mobile" && tabsListRef.current) {
      const activeTab = tabsListRef.current.querySelector('[data-state="active"]');
      if (activeTab && 'scrollIntoView' in activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
  }, [tab, breakpoint]);

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
      <Tabs value={tab} onValueChange={setTab} defaultValue="banners">
        <div className="mb-2 hidden sm:block">
          <span className="block text-white text-base font-semibold">Selecione abaixo a área que quer modificar:</span>
        </div>
        {/* Menu dropdown customizado para todas as telas */}
        <div className="mb-4">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full rounded-lg border border-gray-400 px-4 py-4 text-base font-semibold bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-full py-2">
              {tabs.map(({ value, label }) => (
                <SelectItem
                  key={value}
                  value={value}
                  className={
                    tab === value
                      ? 'bg-orange-500 text-white font-bold'
                      : 'font-semibold'
                  }
                  style={
                    tab === value
                      ? { backgroundColor: '#f97316', color: '#fff' }
                      : { color: azulFundo }
                  }
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Conteúdo das abas */}
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
        <TabsContent value="oficinas" className="mt-4">
          <OficinaManager />
        </TabsContent>
        <TabsContent value="arte_educadores" className="mt-4">
          <ArteEducadorManager />
        </TabsContent>
        <TabsContent value="admin" className="mt-4">
          {/* Componente AdminManager será criado e importado dinamicamente */}
          {typeof window !== 'undefined' && (
            <AdminManager />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 