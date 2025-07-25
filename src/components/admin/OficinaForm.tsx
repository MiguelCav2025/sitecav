import React, { useState, useRef } from 'react';
import type { Oficina } from './OficinaManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface OficinaFormProps {
  oficina: Oficina | null;
  onSave: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function OficinaForm({ oficina, onSave, isOpen, setIsOpen }: OficinaFormProps) {
  const supabase = createClient();
  const [form, setForm] = useState<Partial<Oficina>>(oficina || {});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(oficina || {});
    setFile(null);
    setError(null);
    setSuccess(false);
  }, [oficina, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      let capa_url = form.capa_url || null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('oficinas-capas').upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('oficinas-capas').getPublicUrl(fileName);
        capa_url = urlData.publicUrl;
      }
      const payload = {
        capa_url,
        titulo: form.titulo || '',
        data_oficina: form.data_oficina || null,
        descricao: form.descricao || '',
        nome_professor: form.nome_professor || '',
        mini_bio_professor: form.mini_bio_professor || '',
        data_inscricao: form.data_inscricao || null,
        vagas: form.vagas ? Number(form.vagas) : null,
        link_inscricao: form.link_inscricao || '',
      };
      if (oficina && oficina.id) {
        // Update
        const { error: updateError } = await supabase.from('oficinas').update(payload).eq('id', oficina.id);
        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase.from('oficinas').insert([payload]);
        if (insertError) throw insertError;
      }
      setSuccess(true);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar oficina.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-lg mx-auto my-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8 max-h-[90vh] overflow-y-auto shadow-xl relative">
          <button
            type="button"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={() => setIsOpen(false)}
            aria-label="Fechar modal"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold mb-4 text-blue-900">{oficina ? 'Editar Oficina' : 'Nova Oficina'}</h2>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mb-2">Oficina salva com sucesso!</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Capa (imagem)</label>
            <Input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
            {form.capa_url && !file && (
              <img src={form.capa_url} alt="Capa" className="mt-2 w-32 h-20 object-cover rounded" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <Input name="titulo" value={form.titulo || ''} onChange={handleChange} required maxLength={120} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data da Oficina *</label>
            <Input name="data_oficina" type="date" value={form.data_oficina || ''} onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea name="descricao" value={form.descricao || ''} onChange={handleChange} className="w-full border rounded p-2 min-h-[60px]" maxLength={500} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nome do Professor *</label>
            <Input name="nome_professor" value={form.nome_professor || ''} onChange={handleChange} required maxLength={80} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mini Biografia do Professor</label>
            <textarea name="mini_bio_professor" value={form.mini_bio_professor || ''} onChange={handleChange} className="w-full border rounded p-2 min-h-[40px]" maxLength={300} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data de Inscrição</label>
            <Input name="data_inscricao" type="date" value={form.data_inscricao || ''} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Número de Vagas</label>
            <Input name="vagas" type="number" value={form.vagas || ''} onChange={handleChange} min={1} max={999} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Link Inscreva-se</label>
            <Input name="link_inscricao" value={form.link_inscricao || ''} onChange={handleChange} maxLength={200} />
          </div>
          <div className="flex justify-end mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="orange" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
} 