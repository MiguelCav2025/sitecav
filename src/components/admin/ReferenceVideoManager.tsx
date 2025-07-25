"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from '@supabase/ssr'
import { DataTable } from "@/components/admin/project-data-table/data-table";
import { columns, ReferenceVideo } from "./reference-video-data-table/columns";
import ReferenceVideoForm from "./ReferenceVideoForm";
import { getYouTubeThumbnail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReferenceVideoManager() {
  const [videos, setVideos] = useState<ReferenceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reference_videos")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setVideos(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleAddVideo = async (videoData: any) => {
    const thumbnailUrl = getYouTubeThumbnail(videoData.video_url);
    const { error } = await supabase
      .from("reference_videos")
      .insert([{ ...videoData, thumbnail_url: thumbnailUrl }]);
    if (!error) {
      await fetchVideos();
      setIsAddModalOpen(false);
    } else {
      console.error("Erro ao adicionar vídeo:", error);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    const { error } = await supabase.from("reference_videos").delete().eq("id", id);
    if (!error) {
        await fetchVideos();
    } else {
        console.error("Erro ao excluir vídeo:", error);
    }
  };
  
  const actionColumn = {
    id: "actions",
    header: "Ações",
    cell: ({ row }: { row: { original: ReferenceVideo }}) => {
      const video = row.original;
      return (
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Excluir
                </DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem certeza?</DialogTitle>
              <DialogDescription>
                Essa ação não pode ser desfeita. Isso excluirá permanentemente o vídeo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <Button variant="outline" asChild>
                 <DialogTrigger>Cancelar</DialogTrigger>
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteVideo(video.id)}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    },
  };

  const tableColumns = [actionColumn, ...columns];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Gerenciar Vídeos de Referência</CardTitle>
          <Button onClick={() => setIsAddModalOpen(true)} variant="orange">Adicionar Vídeo</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p>Carregando vídeos...</p> : <DataTable columns={tableColumns} data={videos} />}
      </CardContent>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Vídeo de Referência</DialogTitle>
            <DialogDescription>
              Insira o título, descrição e a URL do vídeo do YouTube.
            </DialogDescription>
          </DialogHeader>
          <ReferenceVideoForm onSave={handleAddVideo} />
        </DialogContent>
      </Dialog>
    </Card>
  );
} 