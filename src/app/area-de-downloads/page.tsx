"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Download, FileText, Calendar, HardDrive } from "lucide-react";

interface DownloadItem {
  id: string;
  title: string;
  subtitle?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

export default function AreaDeDownloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchDownloads = async () => {
      try {
        const { data, error } = await supabase
          .from('downloads')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar downloads:', error);
          setDownloads([]);
        } else {
          setDownloads(data || []);
        }
      } catch (error) {
        console.error('Erro:', error);
        setDownloads([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
  }, []);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'doc':
      case 'docx':
        return '📝';
      default:
        return '📁';
    }
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header da página */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-600 mb-4">
              <Link href="/" className="hover:text-gray-800">
                Início
              </Link>
              <span className="mx-2">›</span>
              <span className="text-gray-800">Área de Downloads</span>
            </nav>

            {/* Título principal */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Área de Downloads
            </h1>
            <p className="text-lg text-gray-600">
              Baixe formulários, materiais didáticos e documentos importantes do CAV.
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Conteúdo principal */}
          {loading ? (
            
            /* Estado de carregamento */
            <div className="text-center py-16">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Download className="w-8 h-8 text-gray-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Carregando downloads...
                </h2>
                <p className="text-gray-600">
                  Aguarde enquanto buscamos os arquivos disponíveis.
                </p>
              </div>
            </div>

          ) : downloads.length === 0 ? (
            
            /* Estado vazio - nenhum download ainda */
            <div className="text-center py-16">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Nenhum download disponível
                </h2>
                <p className="text-gray-600 mb-6">
                  Esta seção será alimentada em breve com materiais importantes para download.
                </p>
                
                {/* Categorias que estarão disponíveis */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <h3 className="font-medium text-gray-900 mb-2">
                      📋 Formulários e Documentos
                    </h3>
                    <p className="text-sm text-gray-600">
                      Formulários de inscrição, termos e documentos importantes
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <h3 className="font-medium text-gray-900 mb-2">
                      📖 Manuais e Guias
                    </h3>
                    <p className="text-sm text-gray-600">
                      Manuais técnicos e guias de utilização
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <h3 className="font-medium text-gray-900 mb-2">
                      🎓 Materiais Didáticos
                    </h3>
                    <p className="text-sm text-gray-600">
                      Apostilas, slides e materiais de apoio
                    </p>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            
            /* Exibição dos downloads disponíveis */
            <div className="space-y-4">
              {downloads.map((download) => (
                <div key={download.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl">
                          {getFileIcon(download.file_name)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {download.title}
                          </h3>
                          {download.subtitle && (
                            <p className="text-sm text-gray-600 mt-1">
                              {download.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{download.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-4 h-4" />
                          <span>{formatFileSize(download.file_size)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(download.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-6">
                      <a
                        href={download.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Estatísticas */}
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-500">
                  {downloads.length} arquivo{downloads.length !== 1 ? 's' : ''} disponível{downloads.length !== 1 ? 'eis' : ''} para download
                </p>
              </div>
            </div>
          )}

          {/* Informações de contato */}
          <div className="mt-12 bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              Precisa de ajuda?
            </h3>
            <p className="text-gray-700 mb-4">
              Se você não encontrou o que procura ou tem dúvidas sobre algum download, entre em contato conosco.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link 
                href="/contato" 
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Entre em Contato
              </Link>
              <a 
                href="tel:(11)2630-7874" 
                className="inline-flex items-center justify-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                (11) 2630-7874
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 