"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  semestre: string;
  curso: string;
  turno: string;
  ativa: boolean;
  _alunos_count?: number;
}

const CURSOS = ["Animação", "Cine/TV"];
const TURNOS = ["Manhã", "Noite"];

export default function TurmasManager({ onSelectTurma }: { onSelectTurma?: (id: string, nome: string) => void }) {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ semestre: "", curso: "", turno: "" });

  const fetchTurmas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("turmas")
      .select("*, alunos(count)")
      .order("created_at", { ascending: false });
    if (data) {
      setTurmas(data.map((t: any) => ({ ...t, _alunos_count: t.alunos?.[0]?.count ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTurmas(); }, []);

  const handleCriar = async () => {
    if (!form.semestre || !form.curso || !form.turno) return setMsg({ tipo: "erro", texto: "Preencha todos os campos." });
    setSalvando(true);
    const nome = `${form.curso} ${form.turno} ${form.semestre}`;
    const { error } = await supabase.from("turmas").insert([{ nome, semestre: form.semestre, curso: form.curso, turno: form.turno }]);
    if (error) setMsg({ tipo: "erro", texto: "Erro ao criar turma." });
    else { setMsg({ tipo: "ok", texto: `Turma "${nome}" criada!` }); setForm({ semestre: "", curso: "", turno: "" }); fetchTurmas(); }
    setSalvando(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir turma? Os alunos vinculados perderão o vínculo.")) return;
    await supabase.from("turmas").delete().eq("id", id);
    fetchTurmas();
  };

  return (
    <div className="space-y-6">
      {/* Criar turma */}
      <Card>
        <CardHeader><CardTitle className="text-base">Nova Turma</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Semestre</Label>
              <Input placeholder="ex: 2026/2" value={form.semestre} onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Curso</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {msg.texto}
            </div>
          )}
          <Button onClick={handleCriar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Turma
          </Button>
        </CardContent>
      </Card>

      {/* Lista de turmas */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : turmas.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhuma turma cadastrada.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map(t => (
            <div key={t.id} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{t.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {t._alunos_count} aluno{t._alunos_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => handleExcluir(t.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              {onSelectTurma && (
                <Button size="sm" variant="outline" className="mt-3 w-full text-xs" onClick={() => onSelectTurma(t.id, t.nome)}>
                  Ver alunos
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
