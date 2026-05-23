"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Users, Loader2, CheckCircle, AlertCircle, Info, GraduationCap, Download, X } from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  semestre: string;
  curso: string;
  turno: string;
  ativa: boolean;
  _alunos_count?: number;
}

interface Aluno {
  id: string;
  nome: string;
  email: string | null;
}

const CURSOS = ["Animação", "Cine/TV"];
const TURNOS = ["Manhã", "Noite"];

function calcularSemestreDoCurso(semestreEntrada: string): string {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const semestreAtual = hoje.getMonth() < 6 ? 1 : 2;
  const [anoEntrada, semEntrada] = semestreEntrada.split("/").map(Number);
  if (!anoEntrada || !semEntrada) return "";
  const totalSemestresPassados = (anoAtual - anoEntrada) * 2 + (semestreAtual - semEntrada);
  const semCurso = totalSemestresPassados + 1;
  if (semCurso <= 0) return "Ainda não iniciou";
  if (semCurso === 1) return "1º semestre do curso";
  if (semCurso === 2) return "2º semestre do curso";
  if (semCurso === 3) return "3º semestre do curso";
  return "Curso concluído";
}

function badgeSemestre(semCurso: string) {
  if (semCurso.includes("1º")) return "bg-green-100 text-green-700";
  if (semCurso.includes("2º")) return "bg-blue-100 text-blue-700";
  if (semCurso.includes("3º")) return "bg-purple-100 text-purple-700";
  if (semCurso.includes("concluído")) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-700";
}

function cardBgSemestre(semCurso: string) {
  if (semCurso.includes("1º")) return "bg-green-50 hover:bg-green-100/60";
  if (semCurso.includes("2º")) return "bg-blue-50 hover:bg-blue-100/60";
  if (semCurso.includes("3º")) return "bg-purple-50 hover:bg-purple-100/60";
  return "bg-white hover:bg-gray-50";
}

// ── Modal de Alunos ───────────────────────────────────────────────────────────
type Linha = { nome: string; email: string };
const linhaVazia = (): Linha => ({ nome: "", email: "" });

interface CandidatoRevisao {
  nome: string;
  jaNaTurma: boolean;
  selecionado: boolean;
}

function AlunosModal({ turma, onClose }: { turma: Turma; onClose: () => void }) {
  const supabase = createClient();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  // Estado da etapa de revisão de importação
  const [revisao, setRevisao] = useState<CandidatoRevisao[] | null>(null);
  const [semestre_resultado, setSemestreResultado] = useState<string>("");
  const [carregandoRevisao, setCarregandoRevisao] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const fetchAlunos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("alunos").select("id, nome, email")
      .eq("turma_id", turma.id).eq("ativo", true).order("nome");
    setAlunos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAlunos(); }, []);

  const showMsg = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const updateLinha = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l));

  const addLinha = () => setLinhas(prev => [...prev, linhaVazia()]);

  const removeLinha = (i: number) =>
    setLinhas(prev => prev.length === 1 ? [linhaVazia()] : prev.filter((_, idx) => idx !== i));

  const handleSalvarTodos = async () => {
    const validas = linhas.filter(l => l.nome.trim());
    if (validas.length === 0) return showMsg("erro", "Preencha ao menos um nome.");
    setSalvando(true);
    const { error } = await supabase.from("alunos").insert(
      validas.map(l => ({ nome: l.nome.trim(), email: l.email.trim() || null, turma_id: turma.id }))
    );
    if (error) showMsg("erro", "Erro ao salvar.");
    else {
      showMsg("ok", `${validas.length} aluno(s) adicionado(s)!`);
      setLinhas([linhaVazia()]);
      fetchAlunos();
    }
    setSalvando(false);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Remover aluno da turma?")) return;
    await supabase.from("alunos").update({ ativo: false }).eq("id", id);
    setAlunos(prev => prev.filter(a => a.id !== id));
  };

  // Abre revisão: busca candidatos e mostra para conferência antes de importar
  const handleAbrirRevisao = async () => {
    setCarregandoRevisao(true);
    const curso = turma.curso;
    const periodo = turma.turno;

    const { data: resultados } = await supabase
      .from("resultados_processo")
      .select("nome, semestre")
      .eq("is_active", true)
      .eq("curso", curso)
      .eq("periodo", periodo)
      .order("ordem", { ascending: true });

    if (!resultados || resultados.length === 0) {
      showMsg("erro", `Nenhum aprovado encontrado para ${curso} / ${periodo} nos resultados publicados. Verifique se o resultado está ativo na aba "Processo Seletivo".`);
      setCarregandoRevisao(false);
      return;
    }

    const nomesExistentes = new Set(alunos.map(a => a.nome.toLowerCase()));
    setSemestreResultado((resultados[0] as any).semestre ?? "");
    setRevisao(resultados.map((r: any) => ({
      nome: r.nome,
      jaNaTurma: nomesExistentes.has(r.nome.toLowerCase()),
      selecionado: !nomesExistentes.has(r.nome.toLowerCase()),
    })));
    setCarregandoRevisao(false);
  };

  const toggleCandidato = (i: number) =>
    setRevisao(prev => prev ? prev.map((c, idx) => idx === i ? { ...c, selecionado: !c.selecionado } : c) : prev);

  const toggleTodos = (valor: boolean) =>
    setRevisao(prev => prev ? prev.map(c => c.jaNaTurma ? c : { ...c, selecionado: valor }) : prev);

  // Confirma a importação dos selecionados
  const handleConfirmarImport = async () => {
    if (!revisao) return;
    const selecionados = revisao.filter(c => c.selecionado && !c.jaNaTurma);
    if (selecionados.length === 0) return showMsg("erro", "Nenhum candidato selecionado.");
    setConfirmando(true);
    const { error } = await supabase.from("alunos").insert(
      selecionados.map(c => ({ nome: c.nome, turma_id: turma.id }))
    );
    if (error) showMsg("erro", "Erro ao importar.");
    else {
      showMsg("ok", `${selecionados.length} aluno(s) importado(s) com sucesso!`);
      setRevisao(null);
      fetchAlunos();
    }
    setConfirmando(false);
  };

  return (
    <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Alunos — {turma.curso} {turma.turno} (Entrada {turma.semestre})
        </DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">

        {/* ── Etapa de revisão da importação ── */}
        {revisao !== null ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Revisar aprovados para importação</p>
                {semestre_resultado && (
                  <p className="text-xs text-gray-400 mt-0.5">Resultado ativo: <strong>{semestre_resultado}</strong> · {turma.curso} · {turma.turno}</p>
                )}
              </div>
              <button onClick={() => setRevisao(null)} className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
                ← Voltar
              </button>
            </div>

            {/* Ações de seleção */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <button onClick={() => toggleTodos(true)} className="hover:text-blue-600 cursor-pointer underline">Selecionar todos</button>
              <button onClick={() => toggleTodos(false)} className="hover:text-red-500 cursor-pointer underline">Desmarcar todos</button>
              <span className="ml-auto font-medium text-gray-700">
                {revisao.filter(c => c.selecionado).length} de {revisao.filter(c => !c.jaNaTurma).length} novos selecionados
              </span>
            </div>

            {/* Lista de candidatos */}
            <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nome</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revisao.map((c, i) => (
                    <tr key={i} className={c.jaNaTurma ? "bg-gray-50 opacity-60" : "hover:bg-blue-50"}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={c.selecionado}
                          disabled={c.jaNaTurma}
                          onChange={() => toggleCandidato(i)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{c.nome}</td>
                      <td className="px-3 py-2 text-center">
                        {c.jaNaTurma
                          ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Já na turma</span>
                          : <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Novo</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {msg && (
              <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                {msg.tipo === "ok" ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                {msg.texto}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleConfirmarImport} disabled={confirmando || revisao.filter(c => c.selecionado).length === 0}>
                {confirmando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Importar {revisao.filter(c => c.selecionado).length} aluno(s)
              </Button>
              <Button variant="outline" onClick={() => setRevisao(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (

        /* ── Formulário de adição manual ── */
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Adicionar alunos</p>
            {calcularSemestreDoCurso(turma.semestre) === "1º semestre do curso" && (
              <Button size="sm" variant="outline" onClick={handleAbrirRevisao} disabled={carregandoRevisao}>
                {carregandoRevisao ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Importar do Processo Seletivo
              </Button>
            )}
          </div>

          {/* Cabeçalho das colunas */}
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2 px-1">
            <p className="text-xs font-semibold text-gray-500">Nome *</p>
            <p className="text-xs font-semibold text-gray-500">E-mail (opcional)</p>
            <span />
          </div>

          {/* Linhas dinâmicas */}
          <div className="space-y-2">
            {linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <Input
                  placeholder="Nome completo"
                  value={l.nome}
                  onChange={e => updateLinha(i, "nome", e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLinha(); } }}
                />
                <Input
                  placeholder="email@exemplo.com"
                  value={l.email}
                  onChange={e => updateLinha(i, "email", e.target.value)}
                />
                <button
                  onClick={() => removeLinha(i)}
                  className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addLinha}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1 font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar linha
            </button>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${msg.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {msg.tipo === "ok" ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              {msg.texto}
            </div>
          )}

          <Button size="sm" onClick={handleSalvarTodos} disabled={salvando || linhas.every(l => !l.nome.trim())}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Salvar {linhas.filter(l => l.nome.trim()).length > 0 ? `${linhas.filter(l => l.nome.trim()).length} aluno(s)` : ""}
          </Button>
        </div>

        )}
        {/* Lista de alunos sempre visível */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : alunos.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">Nenhum aluno cadastrado nesta turma.</p>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {alunos.length} aluno{alunos.length !== 1 ? "s" : ""}
            </p>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nome</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">E-mail</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alunos.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{a.nome}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{a.email ?? "—"}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => handleExcluir(a.id)} className="text-red-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

// ── TurmasManager principal ───────────────────────────────────────────────────
export default function TurmasManager({ onSelectTurma }: { onSelectTurma?: (id: string, nome: string) => void }) {
  const supabase = createClient();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ semestre: "", curso: "", turno: "" });
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);

  const preview = form.curso && form.turno && form.semestre
    ? `${form.curso} · ${form.turno} · Entrada ${form.semestre}`
    : null;

  const fetchTurmas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("turmas")
      .select("*, alunos(count)")
      .order("semestre", { ascending: false });
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
    else {
      setMsg({ tipo: "ok", texto: `Turma criada: ${nome}` });
      setForm({ semestre: "", curso: "", turno: "" });
      fetchTurmas();
    }
    setSalvando(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir turma? Os alunos vinculados perderão o vínculo.")) return;
    await supabase.from("turmas").delete().eq("id", id);
    fetchTurmas();
  };

  const turmasPorCurso = CURSOS.reduce<Record<string, Turma[]>>((acc, curso) => {
    acc[curso] = turmas.filter(t => t.curso === curso);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Conceito */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>Cada turma representa um <strong>grupo de entrada</strong> — alunos que ingressaram juntos. Em qualquer semestre letivo coexistem até 3 turmas ativas por curso/turno. <span className="text-blue-600">Clique em um card para ver e gerenciar os alunos da turma.</span></p>
        </div>
      </div>

      {/* Criar turma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Turma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Semestre de entrada</Label>
              <Input
                className="w-full"
                placeholder="ex: 2026/2"
                value={form.semestre}
                onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))}
              />
              <p className="text-xs text-gray-400">Quando este grupo começou o curso</p>
            </div>
            <div className="space-y-1">
              <Label>Curso</Label>
              <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
              <GraduationCap className="h-4 w-4 text-gray-400 shrink-0" />
              <span>Será criada como: <strong>{preview}</strong></span>
            </div>
          )}

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
        <div className="flex items-center gap-2 text-white/60 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : turmas.length === 0 ? (
        <p className="text-sm text-white/50 italic">Nenhuma turma cadastrada.</p>
      ) : (
        <div className="space-y-8">
          {CURSOS.map(curso => {
            const lista = turmasPorCurso[curso];
            if (!lista || lista.length === 0) return null;

            // Ordena por semestre do curso (1,2,3) e dentro de cada um Manhã antes de Noite
            const ORDEM_SEM = ["1º semestre do curso", "2º semestre do curso", "3º semestre do curso", "Ainda não iniciou", "Curso concluído"];
            const ORDEM_TURNO = ["Manhã", "Noite"];
            const sorted = [...lista].sort((a, b) => {
              const sA = ORDEM_SEM.indexOf(calcularSemestreDoCurso(a.semestre));
              const sB = ORDEM_SEM.indexOf(calcularSemestreDoCurso(b.semestre));
              if (sA !== sB) return sA - sB;
              return ORDEM_TURNO.indexOf(a.turno) - ORDEM_TURNO.indexOf(b.turno);
            });

            // Agrupa por semestre do curso para exibir em linhas separadas
            const grupos: Record<string, Turma[]> = {};
            sorted.forEach(t => {
              const sem = calcularSemestreDoCurso(t.semestre);
              if (!grupos[sem]) grupos[sem] = [];
              grupos[sem].push(t);
            });

            return (
              <div key={curso} className="space-y-4">
                <p className="text-white font-bold text-lg border-b border-white/20 pb-2">{curso}</p>

                {ORDEM_SEM.filter(sem => grupos[sem]?.length).map(sem => (
                  <div key={sem} className="space-y-2">
                    {/* Rótulo da linha de semestre */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeSemestre(sem)}`}>{sem}</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Cards da linha: Manhã | Noite */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {grupos[sem].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTurmaSelecionada(t)}
                          className={`${cardBgSemestre(sem)} rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left w-full group cursor-pointer`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div>
                                <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{t.turno}</p>
                                <p className="text-xs text-gray-400">Entrada: {t.semestre}</p>
                              </div>
                              <p className="text-xs text-gray-400 flex items-center gap-1 pt-1">
                                <Users className="h-3 w-3" />
                                {t._alunos_count} aluno{t._alunos_count !== 1 ? "s" : ""}
                                <span className="ml-auto text-blue-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver alunos →</span>
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleExcluir(t.id); }}
                              className="text-red-300 hover:text-red-600 p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de alunos */}
      <Dialog open={!!turmaSelecionada} onOpenChange={open => { if (!open) { setTurmaSelecionada(null); fetchTurmas(); } }}>
        {turmaSelecionada && <AlunosModal turma={turmaSelecionada} onClose={() => { setTurmaSelecionada(null); fetchTurmas(); }} />}
      </Dialog>
    </div>
  );
}
