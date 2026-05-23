"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, LogOut, ChevronRight, CheckCircle, XCircle, Loader2, Users, GraduationCap } from "lucide-react";
import Image from "next/image";

interface Turma { id: string; nome: string; }
interface Aula { id: string; numero: number; semana: number | null; descricao: string | null; chamada_aberta: boolean; turma: Turma; }
interface Aluno { id: string; nome: string; email: string | null; }
interface Presenca { aluno_id: string; presente: boolean; }

export default function ProfessorDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [nomeProfessor, setNomeProfessor] = useState("");
  const [loading, setLoading] = useState(true);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [aulaSelecionada, setAulaSelecionada] = useState<Aula | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [salvandoPresenca, setSalvandoPresenca] = useState<string | null>(null);
  const [chamadaFinalizada, setChamadaFinalizada] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/professor/login"); return; }

      const { data: prof } = await supabase.from("professores").select("nome, id, senha_alterada").eq("id", user.id).single();
      if (!prof) { router.push("/professor/login"); return; }
      if (!prof.senha_alterada) { router.push("/professor/alterar-senha"); return; }

      setNomeProfessor(prof.nome);

      // Busca turmas do professor
      const { data: pt } = await supabase.from("professor_turmas").select("turma_id").eq("professor_id", prof.id);
      const turmaIds = (pt ?? []).map((x: any) => x.turma_id);

      if (turmaIds.length === 0) { setLoading(false); return; }

      // Busca aulas das turmas do professor (pendentes de chamada)
      const { data: aulasData } = await supabase
        .from("aulas")
        .select("*, turma:turmas(id, nome)")
        .in("turma_id", turmaIds)
        .order("numero", { ascending: true });

      setAulas((aulasData ?? []) as Aula[]);
      setLoading(false);
    };
    init();
  }, []);

  const abrirChamada = async (aula: Aula) => {
    setAulaSelecionada(aula);
    setChamadaFinalizada(aula.chamada_aberta);

    // Busca alunos da turma
    const { data: alunosData } = await supabase
      .from("alunos")
      .select("id, nome, email")
      .eq("turma_id", aula.turma.id)
      .eq("ativo", true)
      .order("nome");

    setAlunos((alunosData ?? []) as Aluno[]);

    // Busca presenças já registradas
    const { data: presData } = await supabase
      .from("presencas")
      .select("aluno_id, presente")
      .eq("aula_id", aula.id);

    const mapa: Record<string, boolean> = {};
    (presData ?? []).forEach((p: Presenca) => { mapa[p.aluno_id] = p.presente; });
    setPresencas(mapa);
  };

  const togglePresenca = async (alunoId: string) => {
    if (chamadaFinalizada) return;
    const novoValor = !presencas[alunoId];
    setSalvandoPresenca(alunoId);

    setPresencas(prev => ({ ...prev, [alunoId]: novoValor }));

    await supabase.from("presencas").upsert(
      { aula_id: aulaSelecionada!.id, aluno_id: alunoId, presente: novoValor },
      { onConflict: "aula_id,aluno_id" }
    );

    setSalvandoPresenca(null);
  };

  const finalizarChamada = async () => {
    if (!aulaSelecionada) return;
    // Garante que todos os não marcados ficam como ausentes
    const semPresenca = alunos.filter(a => presencas[a.id] === undefined);
    if (semPresenca.length > 0) {
      await supabase.from("presencas").upsert(
        semPresenca.map(a => ({ aula_id: aulaSelecionada.id, aluno_id: a.id, presente: false })),
        { onConflict: "aula_id,aluno_id" }
      );
    }
    await supabase.from("aulas").update({ chamada_aberta: true, data_aula: new Date().toISOString().split("T")[0] }).eq("id", aulaSelecionada.id);
    setChamadaFinalizada(true);
    setAulas(prev => prev.map(a => a.id === aulaSelecionada.id ? { ...a, chamada_aberta: true } : a));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/professor/login");
  };

  const presentes = Object.values(presencas).filter(Boolean).length;
  const ausentes = alunos.length - presentes;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  // ── Chamada aberta ─────────────────────────────────────────────────────────
  if (aulaSelecionada) {
    return (
      <div className="min-h-screen bg-blue-900 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button onClick={() => setAulaSelecionada(null)} className="text-white/70 hover:text-white text-sm flex items-center gap-1">
              ← Voltar
            </button>
            <button onClick={handleLogout} className="text-white/70 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          <div className="text-center text-white mb-2">
            <p className="text-orange-400 font-semibold">{aulaSelecionada.turma.nome}</p>
            <h1 className="text-2xl font-bold">Aula {aulaSelecionada.numero}</h1>
            {aulaSelecionada.descricao && <p className="text-white/60 text-sm mt-1">{aulaSelecionada.descricao}</p>}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{presentes}</p>
              <p className="text-xs text-green-300">Presentes</p>
            </div>
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{ausentes}</p>
              <p className="text-xs text-red-300">Ausentes</p>
            </div>
          </div>

          {chamadaFinalizada && (
            <div className="bg-green-500 text-white rounded-xl p-3 text-center text-sm font-semibold">
              ✅ Chamada finalizada e registrada
            </div>
          )}

          {/* Lista de alunos */}
          <div className="space-y-2">
            {alunos.length === 0 ? (
              <div className="bg-white/10 rounded-xl p-6 text-center text-white/60">
                Nenhum aluno cadastrado nesta turma.
              </div>
            ) : (
              alunos.map(aluno => {
                const presente = presencas[aluno.id] ?? false;
                const salvando = salvandoPresenca === aluno.id;
                return (
                  <button
                    key={aluno.id}
                    onClick={() => togglePresenca(aluno.id)}
                    disabled={chamadaFinalizada || salvando}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-150 text-left
                      ${presente
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      }
                      ${chamadaFinalizada ? "cursor-default opacity-90" : "cursor-pointer active:scale-98"}
                    `}
                  >
                    <span className="font-medium">{aluno.nome}</span>
                    <span className="shrink-0 ml-2">
                      {salvando
                        ? <Loader2 className="h-5 w-5 animate-spin" />
                        : presente
                        ? <CheckCircle className="h-6 w-6" />
                        : <XCircle className="h-6 w-6 text-white/40" />
                      }
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {!chamadaFinalizada && alunos.length > 0 && (
            <Button onClick={finalizarChamada} className="w-full py-6 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white">
              Finalizar e Registrar Chamada
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Lista de aulas ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-900 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/LOGO LARANJA CAV.png" alt="CAV" width={80} height={32} className="object-contain" />
          </div>
          <button onClick={handleLogout} className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Olá, {nomeProfessor.split(" ")[0]} 👋</h1>
          <p className="text-white/60 text-sm mt-1">Selecione uma aula para abrir a chamada</p>
        </div>

        {aulas.length === 0 ? (
          <div className="bg-white/10 rounded-2xl p-8 text-center text-white/60">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhuma aula vinculada ao seu perfil ainda.</p>
            <p className="text-xs mt-1">Peça ao administrador para vincular suas turmas.</p>
          </div>
        ) : (
          // Agrupa por turma
          Object.entries(
            aulas.reduce<Record<string, Aula[]>>((acc, aula) => {
              const nome = aula.turma.nome;
              if (!acc[nome]) acc[nome] = [];
              acc[nome].push(aula);
              return acc;
            }, {})
          ).map(([turmaNome, aulasGrupo]) => (
            <div key={turmaNome} className="space-y-2">
              <p className="text-orange-400 font-semibold text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> {turmaNome}
              </p>
              {aulasGrupo.map(aula => (
                <button
                  key={aula.id}
                  onClick={() => abrirChamada(aula)}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 flex items-center justify-between text-left transition-all active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${aula.chamada_aberta ? "bg-green-500" : "bg-blue-600"}`}>
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Aula {aula.numero}</p>
                      <p className="text-white/50 text-xs">
                        {aula.semana ? `Semana ${aula.semana}` : ""}
                        {aula.descricao ? ` · ${aula.descricao}` : ""}
                        {aula.chamada_aberta ? " · ✅ Chamada feita" : " · Chamada pendente"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/40 shrink-0" />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
