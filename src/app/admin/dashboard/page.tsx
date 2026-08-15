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
const ResumoManager = dynamic(() => import('@/components/admin/listas/ResumoManager'), { ssr: false });
const CronogramaManager = dynamic(() => import('@/components/admin/listas/CronogramaManager'), { ssr: false });
const TurmasManager = dynamic(() => import('@/components/admin/listas/TurmasManager'), { ssr: false });
const DisciplinasManager = dynamic(() => import('@/components/admin/listas/DisciplinasManager'), { ssr: false });
const ProfessoresManager = dynamic(() => import('@/components/admin/listas/ProfessoresManager'), { ssr: false });
const GruposEBancaManager = dynamic(() => import('@/components/admin/listas/GruposEBancaManager'), { ssr: false });
const FechamentoManager = dynamic(() => import('@/components/admin/listas/FechamentoManager'), { ssr: false });
const RelatoriosManager = dynamic(() => import('@/components/admin/RelatoriosManager'), { ssr: false });

// ── Sistema ───────────────────────────────────────────────────────────────────
const AdminManager = dynamic(() => import('@/components/admin/AdminManager'), { ssr: false });
const SalasManager = dynamic(() => import('@/components/admin/SalasManager'), { ssr: false });

function ConteudoSecao({ secao, aoNavegar }: { secao: string; aoNavegar: (s: string) => void }) {
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

    case "resumo": return <ResumoManager aoNavegar={aoNavegar} />;
    case "cronograma": return <CronogramaManager />;
    case "turmas": return <TurmasManager />;
    case "disciplinas": return <DisciplinasManager />;
    case "professores": return <ProfessoresManager />;
    case "grupos": return <GruposEBancaManager />;
    case "fechamento": return <FechamentoManager />;
    case "relatorios": return <RelatoriosManager />;

    case "admin": return <AdminManager />;
    case "salas": return <SalasManager />;
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

      // Administrador é CONCESSÃO EXPLÍCITA: constar em `administradores` com
      // ativo = true. Aqui a regra era a antiga — "não é professor, então é
      // admin" —, que promovia qualquer conta órfã ou importada. O middleware,
      // o `requireAdmin()` e o `is_admin()` do banco já concordavam entre si;
      // esta tela era a única que ainda decidia por eliminação.
      const { data: admin } = await supabase
        .from('administradores')
        .select('user_id')
        .eq('user_id', data.user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (admin) { setUser(data.user); return; }

      // Não é admin. Se for professor, vai para a área dele — e para a troca
      // de senha, se ainda não criou a própria.
      const { data: prof } = await supabase
        .from('professores')
        .select('senha_alterada')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (prof) {
        router.push(prof.senha_alterada ? '/professor/dashboard' : '/professor/alterar-senha');
        return;
      }

      // Autenticado e não é nem uma coisa nem outra: não há tela para ele.
      router.push('/admin/login');
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
        <ConteudoSecao secao={secao} aoNavegar={setSecao} />
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
