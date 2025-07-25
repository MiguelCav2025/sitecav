import { createClient } from "@/lib/supabase/client";

async function getProject(id: string) {
  const supabase = createClient();
  const { data } = await supabase.from('projects').select('*').eq('id', id).single();
  return data;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return <div>Projeto não encontrado.</div>
  }

  // Extrai o ID do vídeo do YouTube
  const getYouTubeId = (url: string) => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        return urlObj.searchParams.get('v');
    } catch (_) {
        return null;
    }
  };

  const videoId = project.video_url ? getYouTubeId(project.video_url) : null;

  return (
    <div className="container mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold text-center mb-4">{project.title}</h1>
      <p className="text-lg text-center text-gray-600 mb-8">{project.description}</p>
      
      {videoId ? (
        <div className="aspect-w-16 aspect-h-9">
          <iframe 
            src={`https://www.youtube.com/embed/${videoId}`} 
            title={project.title || "Player de vídeo"} 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            className="w-full h-full"
            style={{ minHeight: '500px' }}
          ></iframe>
        </div>
      ) : (
        <p className="text-center">URL do vídeo é inválida ou não fornecida.</p>
      )}
    </div>
  );
} 