import Image from "next/image";
import HomeCarousel from "@/components/home/HomeCarousel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import ProjectCarousel from "@/components/home/ProjectCarousel";
import PhotoGallery from "@/components/home/PhotoGallery";

// NOTE: Esta página irá renderizar no servidor, mas a busca de dados
// se comportará como se estivesse no cliente.
// Esta é uma solução temporária para contornar o problema do server client.

async function getPageData() {
  const supabase = await getSupabaseServerClient();
  const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true);
  
  // Busca apenas projetos marcados como destaque
  const { data: featuredProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('is_featured', true);

  // Ordenação manual no código para tratar '0' como "sem ordem"
  const sortedProjects = featuredProjects?.sort((a, b) => {
    if (a.featured_order > 0 && b.featured_order > 0) {
      return a.featured_order - b.featured_order; // Ordena ambos pelo número
    }
    if (a.featured_order > 0) return -1; // 'a' tem ordem, 'b' não, então 'a' vem primeiro
    if (b.featured_order > 0) return 1;  // 'b' tem ordem, 'a' não, então 'b' vem primeiro
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Nenhum tem ordem, usa data
  }) || [];

  // Separa os projetos por categoria
  const featuredCineTv = sortedProjects.filter(p => p.course_category === 'Cine/Tv') || [];
  const featuredAnimacao = sortedProjects.filter(p => p.course_category === 'Animação') || [];

  return { banners, featuredCineTv, featuredAnimacao };
}

export default async function Home() {
  const { banners, featuredCineTv, featuredAnimacao } = await getPageData();

  return (
    <div>
      <section id="hero">
        <HomeCarousel banners={banners ?? []} />
      </section>

      <section id="quem-somos" className="section-responsive">
        <div className="container mx-auto container-responsive">
          <h2 className="text-hero text-blue-900 text-center spacing-section">Quem Somos</h2>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-responsive text-blue-900 text-justify leading-relaxed">
            <div className="space-y-6">
              <p className="text-responsive">
                Inaugurado em novembro de 2012, o CAV é um centro de formação e apoio à produção audiovisual, um dos campos da economia que mais cresce, capaz de gerar anualmente mais de 25 bilhões de reais na economia brasileira.
              </p>
              <p className="text-responsive">
                O CAV oferece gratuitamente dois cursos regulares de caráter livre e profissionalizante, com duração de 1 ano e meio: Animação e Cine/TV, além de atividades de curta duração como oficinas, workshops, palestras e projetos de extensão.
              </p>
            </div>
            <div className="space-y-6">
              <p className="text-responsive">
                Em paralelo ao trabalho de formação, dispõe de um Núcleo de Produção que realiza peças audiovisuais, apoia projetos de realizadores independentes, abrindo espaço para que alunos participem de todo o processo.
              </p>
              <p className="text-responsive">
               Fornece a experiência e o estímulo para as pessoas interessadas em entrar neste mercado, fomentando o olhar por meio da integração entre teoria e prática.
              </p>
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <Image
              src="/images/LOGO LARANJA CAV.png" 
              alt="Logo CAV" 
              width={400} 
              height={175}
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <section id="galeria-projetos" className="section-responsive bg-blue-900">
        <div className="container mx-auto container-responsive">
          <h2 className="text-hero text-white text-center spacing-section">Galeria de Projetos</h2>
          
          {featuredCineTv.length > 0 && (
            <div className={featuredAnimacao.length > 0 ? "mb-4" : ""}>
              <ProjectCarousel projects={featuredCineTv} />
            </div>
          )}

          {featuredAnimacao.length > 0 && (
            <div>
              <ProjectCarousel projects={featuredAnimacao} />
            </div>
          )}

        </div>
      </section>

      <section id="testemunhos" className="section-responsive text-center">
        <div className="container mx-auto container-responsive">
          <h2 className="text-hero text-blue-900 spacing-section">Testemunhos</h2>
          <div className="grid-testimonials gap-responsive">
            <div className="bg-[#fd9801] card-responsive rounded-lg shadow-lg transition-transform duration-300 ease-in-out hover:scale-105">
              <p className="italic text-white mb-4 text-small-responsive px-3">&ldquo;Para mim o CAV é muito mais do que uma escola, é uma segunda casa. As experiências, vivências e conhecimentos adquiridos e iniciados ali, com professores, colegas e profissionais ligados ao mercado são transformadoras e, como uma bússola, nos dão a indicação de que caminho a seguir.&rdquo;</p>
              <p className="font-semibold text-white">- Valdir Junior</p>
              <p className="text-small-responsive text-gray-200">Formado em 2015</p>
            </div>
            <div className="bg-[#fd9801] card-responsive rounded-lg shadow-lg transition-transform duration-300 ease-in-out hover:scale-105">
              <p className="italic text-white mb-4 text-small-responsive px-3">&ldquo;Participar do começo desse projeto, mesmo com todas as dificuldades iniciais, foi uma experiência enriquecedora, pessoal e profissional. Estar com grandes professores que se tornaram amigos e grandes amigos que se tornaram parceiros de projetos, e no final amar ainda mais o cinema.&rdquo;</p>
              <p className="font-semibold text-white">- Paula Tonelotto Rodrigues</p>
              <p className="text-small-responsive text-gray-200">Segunda turma do CAV</p>
            </div>
            <div className="bg-[#fd9801] card-responsive rounded-lg shadow-lg transition-transform duration-300 ease-in-out hover:scale-105">
              <p className="italic text-white mb-4 text-small-responsive px-3">&ldquo;O CAV foi pra mim uma realização, primeiro por ter a chance de estudar cinema, segundo que me encontrei profissionalmente. Foi 1 ano e meio de grandes aprendizados e experiências. Agradeço aos professores e colegas pela vivencia partilhada e, é claro, poder respirar dessa arte.&rdquo;</p>
              <p className="font-semibold text-white">- Jonathan Fernandes</p>
              <p className="text-small-responsive text-gray-200">Formado em Cine/TV 2014</p>
            </div>
          </div>
        </div>
      </section>

      <PhotoGallery />
    </div>
  );
}
