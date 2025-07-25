"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadForm } from "./DownloadForm";
import { Download, Edit, Trash2, FileText } from "lucide-react";

interface DownloadItem {
  id: string;
  title: string;
  subtitle?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  is_active: boolean;
  created_at: string;
}

export default function DownloadManager() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [editingDownload, setEditingDownload] = useState<DownloadItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchDownloads = async () => {
    const { data } = await supabase
      .from('downloads')
      .select('*')
      .order('created_at', { ascending: false });
    
    setDownloads(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDownloads();
  }, []);

  const handleEdit = (download: DownloadItem) => {
    setEditingDownload(download);
    setIsFormOpen(true);
  };

  const handleDelete = async (download: DownloadItem) => {
    if (confirm('Excluir este download?')) {
      await supabase.from('downloads').delete().eq('id', download.id);
      fetchDownloads();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return Math.round(bytes / 1024) + ' KB';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Download className="h-6 w-6" />
          Gerenciar Downloads
        </CardTitle>
        <Button onClick={() => setIsFormOpen(true)} className="bg-orange-500 hover:bg-orange-600">
          Adicionar Download
        </Button>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <p>Carregando...</p>
        ) : downloads.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Nenhum download cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloads.map((download) => (
              <div key={download.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{download.title}</h3>
                    {download.subtitle && <p className="text-sm text-gray-600">{download.subtitle}</p>}
                    <div className="text-xs text-gray-500 mt-2">
                      {download.file_name} • {formatFileSize(download.file_size)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(download)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(download)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DownloadForm
        download={editingDownload || undefined}
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        onSave={() => {
          fetchDownloads();
          setIsFormOpen(false);
          setEditingDownload(null);
        }}
      />
    </Card>
  );
} 