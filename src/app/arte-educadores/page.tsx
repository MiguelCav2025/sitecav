import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';

export default async function ArteEducadoresPage() {
  const supabase = await getSupabaseServerClient();
  const { data: educadores, error } = await supabase
    .from('arte_educadores')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return <div className="container mx-auto py-8 text-red-600">Erro ao carregar arte-educadores.</div>;
  }

  return (
    <div className="bg-blue-900 min-h-screen section-responsive">
      <div className="container mx-auto container-responsive">
        <div className="text-center spacing-section">
          <h1 className="text-hero text-white mb-4">Arte-educadores</h1>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {educadores && educadores.length > 0 ? (
            educadores.map((prof: any) => (
              <Card key={prof.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col items-center text-center group transition-transform duration-300 ease-in-out hover:scale-105 py-8 px-4 gap-0 min-h-[420px] max-h-[500px] w-full min-w-0 shadow-lg">
                {prof.foto_url && (
                  <div className="relative w-36 h-36 mx-auto mb-2 rounded-full border-4 border-blue-900 bg-blue-900 shadow-xl overflow-hidden flex items-center justify-center">
                    <Image
                      src={prof.foto_url}
                      alt={prof.nome}
                      fill
                      className="object-cover w-full h-full"
                      sizes="144px"
                    />
                  </div>
                )}
                <CardHeader className="w-full flex flex-col items-center justify-center p-0 mb-1">
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-blue-900 text-center w-full mb-0 leading-tight">
                    {prof.nome}
                  </CardTitle>
                  {prof.materia && (
                    <p className="text-lg font-bold text-blue-700 text-center w-full mt-0 mb-2">
                      {prof.materia}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="px-0">
                  <p className="text-sm text-gray-700 text-center mx-auto leading-relaxed line-clamp-4 w-full">{prof.mini_bio}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-200">Nenhum arte-educador cadastrado.</div>
          )}
        </div>
      </div>
    </div>
  );
} 