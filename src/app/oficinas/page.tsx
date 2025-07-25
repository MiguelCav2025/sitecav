import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';

export default async function OficinasPage() {
  const supabase = await getSupabaseServerClient();
  const { data: oficinas, error } = await supabase
    .from('oficinas')
    .select('*')
    .order('data_oficina', { ascending: false });

  if (error) {
    return <div className="container mx-auto py-8 text-red-600">Erro ao carregar oficinas.</div>;
  }

  return (
    <div className="bg-blue-900 min-h-screen section-responsive">
      <div className="container mx-auto container-responsive">
        <div className="text-center spacing-section">
          <h1 className="text-hero text-white mb-4">Oficinas</h1>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {oficinas && oficinas.length > 0 ? (
            oficinas.map((oficina: any) => (
              <Card key={oficina.id} className="bg-white rounded-lg border-0 py-0 shadow-xl overflow-hidden flex flex-col group transition-transform duration-300 ease-in-out hover:scale-105 p-0 min-h-[420px] w-full min-w-0">
                {oficina.capa_url && (
                  <div className="relative w-full h-48 overflow-hidden">
                    <Image
                      src={oficina.capa_url}
                      alt={oficina.titulo}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}
                <CardHeader className="pb-0 pt-0 px-6">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-blue-900 mb-1">{oficina.titulo}</CardTitle>
                  <CardDescription className="text-sm text-gray-600 font-semibold">
                    Data: {oficina.data_oficina ? new Date(oficina.data_oficina).toLocaleDateString() : '-'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2 px-6 pb-2">
                  <p className="text-sm text-gray-700 mb-2 line-clamp-4 w-full">{oficina.descricao}</p>
                  <div className="mt-2">
                    <span className="font-semibold">Professor:</span> {oficina.nome_professor}
                    <br />
                    <span className="text-xs text-gray-600">{oficina.mini_bio_professor}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">Inscrições até:</span> {oficina.data_inscricao ? new Date(oficina.data_inscricao).toLocaleDateString() : '-'}
                    <br />
                    <span className="font-semibold">Vagas:</span> {oficina.vagas ?? '-'}
                  </div>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-2">
                  {oficina.link_inscricao && (
                    <Link
                      href={oficina.link_inscricao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors"
                    >
                      Inscreva-se
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-200">Nenhuma oficina cadastrada.</div>
          )}
        </div>
      </div>
    </div>
  );
} 