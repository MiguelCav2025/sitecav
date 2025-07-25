'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Banner = {
  id: string;
  image_url: string;
  title: string | null;
};

export default function BannerManager() {
  const supabase = createClient();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchBanners = async () => {
    const { data, error } = await supabase.from('banners').select('*').order('created_at');
    if (data) {
      setBanners(data);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      
      const file = selectedFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      let { error: uploadError } = await supabase.storage.from('site-assets').upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('banners').insert([{ image_url: publicUrl, title: file.name }]);
      if (insertError) {
        throw insertError;
      }
      
      fetchBanners();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
      setSelectedFile(null); 
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.value = '';
    }
  };

  const handleDelete = async (banner: Banner) => {
    try {
      const fileName = banner.image_url.split('/').pop();
      if (!fileName) throw new Error("Nome do arquivo não encontrado na URL.");
      const { error: storageError } = await supabase.storage.from('site-assets').remove([`banners/${fileName}`]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('banners').delete().eq('id', banner.id);
      if (dbError) throw dbError;
      fetchBanners();
    } catch (error: any) {
      alert("Erro ao excluir o banner: " + error.message);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/images/banners/PSD-BANNER.psd';
    link.download = 'Modelo-Banner-CAV.psd';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gerenciar Banners da Home</CardTitle>
          <Button 
            onClick={handleDownloadTemplate}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Baixar Modelo PSD
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Input type="file" onChange={handleFileSelect} disabled={uploading} accept="image/*" />
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading} 
            variant={selectedFile && !uploading ? "orange" : "default"}
          >
            {uploading ? 'Enviando...' : 'Enviar Banner'}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {banners.length > 0 ? (
            banners.map((banner) => (
              <Dialog key={banner.id}>
                <div className="relative group aspect-[2/1]">
                  <Image
                    src={banner.image_url}
                    alt={banner.title || 'Banner'}
                    fill
                    className="rounded-md object-cover"
                  />
                  <div className="absolute top-2 right-2 z-10">
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Excluir
                      </Button>
                    </DialogTrigger>
                  </div>
                </div>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Você tem certeza?</DialogTitle>
                    <DialogDescription>
                      Essa ação não pode ser desfeita. Isso excluirá permanentemente o banner.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogTrigger asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogTrigger>
                    <Button variant="destructive" onClick={() => handleDelete(banner)}>
                      Excluir
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))
          ) : (
            <p>Nenhum banner encontrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 