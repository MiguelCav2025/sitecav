"use client" // A página agora busca dados no cliente para ser dinâmica

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Link as LinkIcon, Film, BookOpen, UserCheck, CalendarDays, ClipboardList } from 'lucide-react';

// --- Definições de Tipos para os Dados ---
interface ReferenceItem {
    id: number;
    title: string;
    course: string;
}

interface Video extends ReferenceItem {
    video_url: string;
    thumbnail_url: string;
}

interface Bibliography extends ReferenceItem {
    url: string;
}

interface ProcessData {
    id?: string;
    inscription_start_date: string;
    inscription_end_date: string;
    semester: string;
    exam_date: string;
    exam_time: string;
    exam_location: string;
    result_date: string;
    inscription_link: string;
    is_active?: boolean;
}

interface PageData {
    animacaoVideos: Video[];
    cineTvVideos: Video[];
    animacaoBib: Bibliography[];
    cineTvBib: Bibliography[];
}

// --- Sub-componentes para melhor organização ---

const VideoLinkList = ({ videos }: { videos: Video[] }) => (
    <div className="w-full">
        {videos.length > 0 ? (
            <ul className="space-y-2">
                {videos.map(video => (
                    <li key={video.id}>
                        <a 
                            href={video.video_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-start gap-2 text-xs text-blue-800 hover:text-orange-600 hover:underline"
                        >
                            <LinkIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{video.title}</span>
                        </a>
                    </li>
                ))}
            </ul>
        ) : (
            <div className="flex items-center justify-center h-20 bg-gray-100 rounded-lg">
                <p className="text-gray-500 text-sm">Nenhum vídeo cadastrado.</p>
            </div>
        )}
    </div>
);

const BibliographyList = ({ items }: { items: Bibliography[] }) => (
    <div className="w-full mt-4">
        {items.length > 0 ? (
            <ul className="space-y-2">
                {items.map(item => (
                    <li key={item.id}>
                        <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-start gap-2 text-xs text-blue-800 hover:text-orange-600 hover:underline"
                        >
                            <LinkIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{item.title}</span>
                        </a>
                    </li>
                ))}
            </ul>
        ) : (
             <div className="flex items-center justify-center h-20 bg-gray-100 rounded-lg">
                <p className="text-gray-500 text-sm">Nenhuma bibliografia cadastrada.</p>
            </div>
        )}
    </div>
);

const InfoCard = ({ icon, title, children, bgColor = "bg-gray-100" }: { 
    icon: React.ReactNode, 
    title: string, 
    children: React.ReactNode,
    bgColor?: string 
}) => (
    <div className={`${bgColor} p-6 rounded-xl shadow-md`}>
        <div className="flex items-center gap-4 mb-4">
            {icon}
            <h3 className="text-xl font-bold text-blue-900">{title}</h3>
        </div>
        {children}
    </div>
);


// Dados padrão como fallback
const defaultProcessData: ProcessData = {
    inscription_start_date: "19 de Maio de 2025",
    inscription_end_date: "29 de Maio de 2025", 
    semester: "2º. Semestre de 2025",
    exam_date: "05/07/2025 – Sábado",
    exam_time: "09h00 as 12h00",
    exam_location: "Teatro Lauro Gomes",
    result_date: "15/07/2025",
    inscription_link: "https://docs.google.com/forms/d/e/1FAIpQLSd6XwvynaGJdXNBBhEArUk4PeylH3s2UXVyVm0nNRe7MVzW2Q/viewform"
};

export default function AreaDoCandidatoPage() {
    const [data, setData] = useState<PageData>({
        animacaoVideos: [],
        cineTvVideos: [],
        animacaoBib: [],
        cineTvBib: [],
    });
    
    const [processData, setProcessData] = useState<ProcessData>(defaultProcessData);

    useEffect(() => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        async function fetchData() {
            const [
                animacaoVideosData,
                cineTvVideosData,
                animacaoBibData,
                cineTvBibData,
                processDataResult
            ] = await Promise.all([
                supabase.from('reference_videos').select('*').eq('course', 'Animação').order('created_at', { ascending: true }),
                supabase.from('reference_videos').select('*').eq('course', 'Cine/TV').order('created_at', { ascending: true }),
                supabase.from('reference_bibliographies').select('*').eq('course', 'Animação'),
                supabase.from('reference_bibliographies').select('*').eq('course', 'Cine/TV'),
                supabase.from('process_data').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1)
            ]);

            setData({
                animacaoVideos: animacaoVideosData.data as Video[] || [],
                cineTvVideos: cineTvVideosData.data as Video[] || [],
                animacaoBib: animacaoBibData.data as Bibliography[] || [],
                cineTvBib: cineTvBibData.data as Bibliography[] || [],
            });

            // Usar dados do banco se existirem, senão usar dados padrão
            if (processDataResult.data && processDataResult.data.length > 0) {
                setProcessData(processDataResult.data[0] as ProcessData);
            }
        }
        
        fetchData();
    }, []);
    

  return (
    <div className="bg-blue-900 min-h-screen py-8 px-12">
        <div className="container mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-5xl font-extrabold text-white mb-2">Área do Candidato</h1>
                <p className="text-xl text-[#fd9801]">Processo Seletivo CAV – {processData.semester}</p>
            </div>
            
            {/* Card Principal de Informações */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 mb-16">
                 <p className="text-base mb-4 text-center bg-blue-50 p-4 rounded-lg">
                    Estão abertas a partir do dia {processData.inscription_start_date} até o dia {processData.inscription_end_date}, as inscrições para os interessados em participar dos cursos de formação em Cine/TV e Animação, a serem ministrados no CAV, {processData.semester}.
                 </p>
                 <p className="my-6 text-gray-700 text-center text-sm leading-relaxed">Os cursos são gratuitos e terão duração de 03 (três) semestres, com aulas e atividades diárias a serem ministradas nos períodos matutino (9h00 às 12h00) ou noturno (19h00 às 22h00) em <strong>FORMATO PRESENCIAL</strong>, no CAV, localizado na Rua Helena Jacquey, 208 – Rudge Ramos – São Bernardo do Campo/SP.</p>

                <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8 mb-8 text-gray-800">
                    <InfoCard 
                        icon={<UserCheck className="h-8 w-8 text-orange-500" />} 
                        title="Requisitos"
                        bgColor="bg-blue-100"
                    >
                        <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
                            <li>Ter, no mínimo, 16 anos de idade completos na data de matrícula;</li>
                            <li>Estar cursando ou ter finalizado o Ensino Médio;</li>
                            <li>Possuir disponibilidade de frequentar o curso em regime presencial de aulas diárias.</li>
                        </ul>
                    </InfoCard>
                    <InfoCard 
                        icon={<ClipboardList className="h-8 w-8 text-orange-500" />} 
                        title="Vagas"
                        bgColor="bg-blue-100"
                    >
                         <ul className="list-disc list-inside space-y-2 mt-2 text-sm text-blue-800">
                            <li>Animação | Manhã: 30 vagas</li>
                            <li>Animação | Noite: 30 vagas</li>
                            <li>Cine/TV | Manhã: 30 vagas</li>
                            <li>Cine/TV | Noite: 30 vagas</li>
                        </ul>
                    </InfoCard>
                    <InfoCard 
                        icon={<CalendarDays className="h-8 w-8 text-orange-500" />} 
                        title="Local e Data da Prova"
                        bgColor="bg-blue-100"
                    >
                        <div className="space-y-2 text-sm text-blue-800">
                            <p><strong>Data:</strong> {processData.exam_date}</p>
                            <p><strong>Horário:</strong> {processData.exam_time}</p>
                            <p><strong>Local:</strong> {processData.exam_location}</p>
                            <p className="mt-2"><strong>Resultado:</strong> {processData.result_date}</p>
                        </div>
                    </InfoCard>
                </div>

                <div className="mt-8">
                     <InfoCard 
                         icon={<ClipboardList className="h-8 w-8 text-orange-500" />} 
                         title="Etapas do Processo Seletivo"
                         bgColor="bg-blue-100"
                     >
                        <div className="space-y-4 text-blue-800">
                            <ol className="list-decimal list-inside space-y-3 text-sm">
                                <li>
                                    <strong>ETAPA 1:</strong> Prova diagnóstica, contendo questões de múltipla escolha e questões dissertativas específicas, pertinentes à área de interesse do curso pretendido. A pontuação máxima da prova é de 100 pontos.
                                </li>
                                <li>
                                    <strong>ETAPA 2:</strong> Havendo necessidade, o CAV reserva-se o direito de aplicar uma entrevista com os candidatos aprovados como critério de desempate. A classificação será feita pela média alcançada nas duas etapas.
                                </li>
                            </ol>
                            <p className="text-xs text-blue-700 bg-blue-50 p-3 rounded-lg">
                                <strong>Observação:</strong> Caso o número de participantes seja menor que o número de vagas, as vagas remanescentes serão disponibilizadas ao público mediante entrevista.
                            </p>
                        </div>
                    </InfoCard>
                </div>
                
                 <p className="mt-8 font-semibold text-orange-600 text-center bg-orange-50 p-4 rounded-lg text-sm">Atenção para a matrícula: Trazer documentos ORIGINAIS, eles serão usados APENAS para consulta e devolvidos imediatamente. NÃO TRAZER CÓPIAS.</p>
            </div>

            <div className="text-center mb-16">
                <Link href={processData.inscription_link} target="_blank" rel="noopener noreferrer" className="bg-orange-500 text-white font-bold text-2xl py-4 px-12 rounded-lg hover:bg-orange-600 transition-transform duration-300 ease-in-out hover:scale-105 inline-block shadow-lg">
                    Inscreva-se Agora!
                </Link>
            </div>

            {/* Seção de Bibliografia e Filmografia */}
            <div className="text-center mb-12">
                 <h2 className="text-4xl font-bold text-white">Material de Estudo</h2>
                 <p className="text-base text-orange-300 max-w-3xl mx-auto mt-2 leading-relaxed">A bibliografia completa e os links para os artigos, juntamente com a filmografia indicada para estudo, estão disponíveis abaixo, separados por curso.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10">
                {/* Coluna Animação */}
                <div className="bg-white p-6 rounded-2xl shadow-2xl">
                    <h3 className="text-3xl font-bold text-center mb-6 text-blue-900">Animação</h3>
                    <div className="space-y-6">
                        <InfoCard 
                            icon={<Film className="h-6 w-6 text-orange-500" />} 
                            title="Filmografia de Referência"
                            bgColor="bg-blue-100"
                        >
                            <VideoLinkList videos={data.animacaoVideos as Video[]} />
                        </InfoCard>
                        <InfoCard 
                            icon={<BookOpen className="h-6 w-6 text-orange-500" />} 
                            title="Bibliografia Essencial"
                            bgColor="bg-blue-100"
                        >
                            <BibliographyList items={data.animacaoBib as Bibliography[]} />
                        </InfoCard>
                    </div>
                </div>

                 {/* Coluna Cine/TV */}
                <div className="bg-white p-6 rounded-2xl shadow-2xl">
                    <h3 className="text-3xl font-bold text-center mb-6 text-blue-900">Cine/TV</h3>
                    <div className="space-y-6">
                        <InfoCard 
                            icon={<Film className="h-6 w-6 text-orange-500" />} 
                            title="Filmografia de Referência"
                            bgColor="bg-blue-100"
                        >
                            <VideoLinkList videos={data.cineTvVideos as Video[]} />
                        </InfoCard>
                        <InfoCard 
                            icon={<BookOpen className="h-6 w-6 text-orange-500" />} 
                            title="Bibliografia Essencial"
                            bgColor="bg-blue-100"
                        >
                            <BibliographyList items={data.cineTvBib as Bibliography[]} />
                        </InfoCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}