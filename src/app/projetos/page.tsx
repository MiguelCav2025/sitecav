import { getSupabaseServerClient } from "@/lib/supabase/server"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

// Definindo o tipo para um projeto, para segurança de tipo
type InstitutionalProject = {
    id: string;
    created_at: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    image_url: string | null;
    link_url: string | null;
    order_position: number;
}

async function getInstitutionalProjects(): Promise<InstitutionalProject[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutional_projects")
    .select("*")
    .order("order_position", { ascending: true })

  if (error) {
    console.error("Erro ao buscar projetos institucionais:", error)
    return []
  }
  return data || []
}

export default async function ProjetosPage() {
  const projects = await getInstitutionalProjects()

  return (
    <div className="bg-blue-900 min-h-screen section-responsive">
      <div className="container mx-auto container-responsive">
        <div className="text-center spacing-section">
          <h1 className="text-hero text-white mb-4">
            Projetos do CAV
          </h1>
          <p className="text-responsive text-[#fd9801] max-w-3xl mx-auto">
            Desde a produção de conteúdo audiovisual até iniciativas de formação e cultura.
          </p>
        </div>

        <div className="grid-projects gap-responsive">
          {projects.map((project: InstitutionalProject) => (
            <div 
              key={project.id} 
              className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col group transition-transform duration-300 ease-in-out hover:scale-105"
            >
              <div className="relative w-full h-56 overflow-hidden">
                <Image
                  src={project.image_url || 'https://placehold.co/600x400?text=CAV'}
                  alt={project.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="card-responsive flex flex-col flex-grow">
                <h3 className="text-card-title text-blue-900 mb-2">{project.title}</h3>
                {project.subtitle && <p className="text-responsive text-orange-600 font-semibold mb-4">{project.subtitle}</p>}
                <p className="text-responsive text-gray-700 mb-6 flex-grow">
                  {project.description}
                </p>
                {project.link_url && (
                  <Button asChild className="mt-auto w-fit bg-blue-900 text-white hover:bg-blue-800">
                    <Link href={project.link_url} target="_blank" rel="noopener noreferrer">
                      Saiba Mais <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
            <div className="text-center py-16">
                <p className="text-gray-500">Nenhum projeto cadastrado no momento.</p>
            </div>
        )}
      </div>
    </div>
  )
} 