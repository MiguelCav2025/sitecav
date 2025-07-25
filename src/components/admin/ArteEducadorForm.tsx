import React, { useState, useRef } from 'react';
import type { ArteEducador } from './ArteEducadorManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface ArteEducadorFormProps {
  educador: ArteEducador | null;
  onSave: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function ArteEducadorForm({ educador, onSave, isOpen, setIsOpen }: ArteEducadorFormProps) {
  const supabase = createClient();
  const [form, setForm] = useState<Partial<ArteEducador>>(educador || {});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(educador || {});
    setFile(null);
    setError(null);
    setSuccess(false);
  }, [educador, isOpen]);

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
      let foto_url = form.foto_url || null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('arte-educadores-fotos').upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('arte-educadores-fotos').getPublicUrl(fileName);
        foto_url = urlData.publicUrl;
      }
      const payload = {
        foto_url,
        nome: form.nome || '',
        mini_bio: form.mini_bio || '',
        materia: form.materia || '',
      };
      if (educador && educador.id) {
        // Update
        const { error: updateError } = await supabase.from('arte_educadores').update(payload).eq('id', educador.id);
        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase.from('arte_educadores').insert([payload]);
        if (insertError) throw insertError;
      }
      setSuccess(true);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar arte-educador.');
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
          <h2 className="text-xl font-bold mb-4 text-blue-900">{educador ? 'Editar Arte-educador' : 'Novo Arte-educador'}</h2>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mb-2">Arte-educador salvo com sucesso!</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Foto (imagem)</label>
            <Input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
            {form.foto_url && !file && (
              <img src={form.foto_url} alt="Foto" className="mt-2 w-24 h-24 object-cover rounded-full" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <Input name="nome" value={form.nome || ''} onChange={handleChange} required maxLength={80} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Matéria</label>
            <Input name="materia" value={form.materia || ''} onChange={handleChange} maxLength={100} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mini Biografia</label>
            <textarea name="mini_bio" value={form.mini_bio || ''} onChange={handleChange} className="w-full border rounded p-2 min-h-[40px]" maxLength={300} />
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