'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import NavegacaoAdmin from "@/components/admin/NavegacaoAdmin";
import { areaDaSecao, secaoValida } from "@/lib/admin-navegacao";

// ── Site ──────────────────────────────────────────────────────────────────────
const BannerManager = dynamic(() => import('@/components/admin/BannerManager'), { ssr: false });
const ProjectManager = dynamic(() => import('@/components/admin/ProjectManager'), { ssr: false });
const InstitutionalProjectManager = dynamic(() => import('@/components/admin/InstitutionalProjectManager'), { ssr: false });
const PhotoGalleryManager = dynamic(() => import('@/components/admin/PhotoGalleryManager'), { ssr: false });
const OficinaManager = dynamic(() => import('@/components/admin/OficinaManager'), { ssr: false });
const ArteEducadorManager = dynamic(() => import('@/components/admin/ArteEducadorManager'), { ssr: false });
const DownloadManager = dynamic(() => import('@/components/admin/DownloadManager'), { ssr: false });
const ProcessDataManager = dynamic(() => import('@/components/admin/ProcessDataManager'), { ssr: false });
const GabaritoManager = dynamic(() => import('@/components/admin/GabaritoManager'), { ssr: false });
const ReferenceVideoManager = dynamic(() => import('@/components/admin/ReferenceVideoManager'), { ssr: false });
const ReferenceBibliographyManager = dynamic(() => import('@/components/admin/ReferenceBibliographyManager'), { ssr: false });

// ── Escola ────────────────────────────────────────────────────────────────────
const CronogramaManager = dynamic(() => import('@/components/admin/listas/CronogramaManager'), { ssr: false });
const TurmasManager = dynamic(() => import('@/components/admin/listas/TurmasManager'), { ssr: false });
const DisciplinasManager = dynamic(() => import('@/components/admin/listas/DisciplinasManager'), { ssr: false });
const ProfessoresManager = dynamic(() => import('@/components/admin/listas/ProfessoresManager'), { ssr: false });
const GruposEBancaManager = dynamic(() => import('@/components/admin/listas/GruposEBancaManager'), { ssr: false });
const RelatoriosManager = dynamic(() => import('@/components/admin/RelatoriosManager'), { ssr: false });

// ── Sistema ───────────────────────────────────────────────────────────────────
const AdminManager = dynamic(() => import('@/components/admin/AdminManager'), { ssr: false });

function ConteudoSecao({ secao }: { secao: string }) {
  switch (secao) {
    case "banners": return <BannerManager />;
    case "portfolio": return <ProjectManager />;
    case "institutional_projects": return <InstitutionalProjectManager />;
    case "photo_gallery": return <PhotoGalleryManager />;
    case "oficinas": return <OficinaManager />;
    case "arte_educadores": return <ArteEducadorManager />;
    case "downloads": return <DownloadManager />;
    case "process_data":
      return (
        <div className="space-y-8">
          <ProcessDataManager />
          {/* O gabarito controla a mesma página pública, no modo Resultados */}
          <div className="border-t border-white/10 pt-8">
            <h3 className="mb-4 text-lg font-semibold text-white">Gabarito da Prova</h3>
            <GabaritoManager />
          </div>
        </div>
      );
    case "ref_videos": return <ReferenceVideoManager />;
    case "ref_biblio": return <ReferenceBibliographyManager />;

    case "cronograma": return <CronogramaManager />;
    case "turmas": return <TurmasManager />;
    case "disciplinas": return <DisciplinasManager />;
    case "professores": return <ProfessoresManager />;
    case "grupos": return <GruposEBancaManager />;
    case "relatorios": return <RelatoriosManager />;

    case "admin": return <AdminManager />;
    default: return null;
  }
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [secao, setSecao] = useState(() => secaoValida(searchParams.get("tab")));

  // Mantém a seção na URL para sobreviver ao reload
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", secao);
    router.replace(`/admin/dashboard?${params.toString()}`, { scroll: false });
  }, [secao]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push('/admin/login'); return; }

      // Bloqueia professores de acessar o admin
      const { data: prof } = await supabase
        .from('professores')
        .select('id, senha_alterada')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (prof) {
        router.push(prof.senha_alterada ? '/professor/dashboard' : '/professor/alterar-senha');
        return;
      }

      setUser(data.user);
    };
    getUser();
  }, [router, supabase.auth]);

  if (!user) return null;

  const area = areaDaSecao(secao);
  const secaoAtual = area.secoes.find(s => s.value === secao);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-8 lg:px-14">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Painel do CAV</h1>
        <p className="mt-1 text-sm text-blue-200">
          Escolha a área e depois o que deseja gerenciar.
        </p>
      </header>

      <NavegacaoAdmin secao={secao} onSelecionar={setSecao} />

      <section className="mt-8">
        {secaoAtual && (
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
            {secaoAtual.passo !== undefined && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                {secaoAtual.passo}
              </span>
            )}
            {secaoAtual.label}
          </h2>
        )}
        <ConteudoSecao secao={secao} />
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
