"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { buscarAlunosDaTurma, matricularAlunos, encerrarMatricula } from "@/lib/matriculas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmacao } from "@/components/ui/confirmar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Users, Loader2, CheckCircle, AlertCircle, Info, GraduationCap, Download, X, ChevronDown, ChevronUp } from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  /** Semestre do calendário em que a turma começou. Dele sai o módulo atual. */
  entrada: string;
  curso: string;
  turno: string;
  ativa: boolean;
  _alunos_count?: number;
}

interface Aluno {
  id: string;
  nome: string;
  email: string | null;
  /** Vínculo com esta turma. Sair da turma é encerrar a matrícula. */
  matriculaId: string;
}

const CURSOS = ["Animação", "Cine/TV"];
const TURNOS = ["Manhã", "Noite"];

const rotuloDoModulo = (entrada: string, semestreAtual: string | null) =>
  rotuloModulo(moduloAtual(entrada, semestreAtual));

// A cor sai do NÚMERO do módulo, não de procurar "1º" no texto do rótulo.
// Enquanto o rótulo era "1º semestre do curso", casar por texto funcionava; ao
// virar "Módulo 1" todas as turmas cairiam na cor de exceção, sem erro nenhum.
function badgeModulo(modulo: number | null) {
  if (modulo === 1) return "bg-green-100 text-green-700";
  if (modulo === 2) return "bg-blue-100 text-blue-700";
  if (modulo === 3) return "bg-purple-100 text-purple-700";
  if (modulo !== null && modulo > 3) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-700";
}

function cardBgModulo(modulo: number | null) {
  if (modulo === 1) return "bg-green-50";
  if (modulo === 2) return "bg-blue-50";
  if (modulo === 3) return "bg-purple-50";
  return "bg-white";
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
  const { semestre: semestreAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  // Edição inline de e-mail
  const [editandoEmail, setEditandoEmail] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState("");

  const iniciarEdicaoEmail = (a: Aluno) => {
    setEditandoEmail(a.id);
    setEmailEdit(a.email ?? "");
  };

  const salvarEmail = async (id: string) => {
    await supabase.from("alunos").update({ email: emailEdit.trim() || null }).eq("id", id);
    setAlunos(prev => prev.map(a => a.id === id ? { ...a, email: emailEdit.trim() || null } : a));
    setEditandoEmail(null);
  };

  // Estado da etapa de revisão de importação
  const [revisao, setRevisao] = useState<CandidatoRevisao[] | null>(null);
  const [semestre_resultado, setSemestreResultado] = useState<string>("");
  const [carregandoRevisao, setCarregandoRevisao] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const fetchAlunos = async () => {
    setLoading(true);
    const { alunos: daTurma, erro } = await buscarAlunosDaTurma(supabase, turma.id);
    if (erro) showMsg("erro", `Erro ao carregar alunos: ${erro}`);
    setAlunos(daTurma.map(a => ({ id: a.id, nome: a.nome, email: a.email, matriculaId: a.matriculaId })));
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

    // Duas etapas: a pessoa e o vínculo dela com a turma. O aluno existe por
    // si; a turma em que ele está é uma matrícula.
    const { data: criados, error } = await supabase.from("alunos").insert(
      validas.map(l => ({ nome: l.nome.trim(), email: l.email.trim() || null }))
    ).select("id");

    if (error || !criados) {
      showMsg("erro", `Erro ao salvar: ${error?.message ?? "resposta vazia"}`);
      setSalvando(false);
      return;
    }

    const { erro } = await matricularAlunos(
      supabase, turma.id, turma.entrada, criados.map(c => c.id), semestreAtual,
    );
    if (erro) showMsg("erro", `Alunos criados, mas houve falha ao matricular: ${erro}`);
    else {
      showMsg("ok", `${validas.length} aluno(s) adicionado(s)!`);
      setLinhas([linhaVazia()]);
    }
    fetchAlunos();
    setSalvando(false);
  };

  const handleExcluir = async (a: Aluno) => {
    const ok = await confirmar({
      titulo: `Remover ${a.nome} desta turma?`,
      perigo: true,
      rotuloConfirmar: "Remover da turma",
      descricao: (
        <>
          <p>
            A matrícula dele nesta turma é encerrada como <strong>desistente</strong>, e ele
            some da chamada a partir de agora.
          </p>
          <p>
            <strong>Nada do histórico é apagado</strong>: as presenças e notas até hoje
            continuam, porque estão presas às aulas, não à turma.
          </p>
          <p className="text-gray-500">
            Se ele foi reprovado, o caminho certo é a aba <strong>Fechamento</strong> — lá a
            situação fica registrada como retido, não como desistência.
          </p>
        </>
      ),
    });
    if (!ok) return;

    // Sair da turma é encerrar a matrícula, não apagar a pessoa (D26).
    const { erro } = await encerrarMatricula(supabase, a.matriculaId, "desistente");
    if (erro) return showMsg("erro", `Erro ao remover: ${erro}`);
    setAlunos(prev => prev.filter(x => x.id !== a.id));
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

    const { data: criados, error } = await supabase.from("alunos").insert(
      selecionados.map(c => ({ nome: c.nome }))
    ).select("id");

    if (error || !criados) {
      showMsg("erro", `Erro ao importar: ${error?.message ?? "resposta vazia"}`);
      setConfirmando(false);
      return;
    }

    const { erro } = await matricularAlunos(
      supabase, turma.id, turma.entrada, criados.map(c => c.id), semestreAtual,
    );
    if (erro) showMsg("erro", `Alunos criados, mas houve falha ao matricular: ${erro}`);
    else {
      showMsg("ok", `${selecionados.length} aluno(s) importado(s) com sucesso!`);
      setRevisao(null);
    }
    fetchAlunos();
    setConfirmando(false);
  };

  return (
    <DialogContent className="!max-w-4xl w-[95vw] max-h-[85vh] flex flex-col">
      {dialogo}
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Alunos — {turma.curso} {turma.turno} (Entrada {turma.entrada})
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
            {rotuloDoModulo(turma.entrada, semestreAtual) === "Módulo 1" && (
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
                    <tr key={a.id} className="hover:bg-gray-50 group/row">
                      <td className="px-4 py-2 font-medium text-gray-800">{a.nome}</td>
                      <td className="px-4 py-1.5">
                        {editandoEmail === a.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              type="email"
                              value={emailEdit}
                              onChange={e => setEmailEdit(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") salvarEmail(a.id);
                                if (e.key === "Escape") setEditandoEmail(null);
                              }}
                              className="h-7 text-xs w-full"
                              placeholder="email@exemplo.com"
                            />
                            <button onClick={() => salvarEmail(a.id)} className="text-green-600 hover:text-green-800 shrink-0">
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditandoEmail(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => iniciarEdicaoEmail(a)}
                            className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer text-left w-full"
                            title="Clique para editar e-mail"
                          >
                            {a.email ?? <span className="text-gray-300 italic">adicionar e-mail</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleExcluir(a)}
                          title="Remover da turma (preserva o histórico)"
                          className="text-red-400 hover:text-red-600"
                        >
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
  const { semestre: semestreAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState({ entrada: "", curso: "", turno: "" });
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const preview = form.curso && form.turno && form.entrada
    ? `${form.curso} · ${form.turno} · Entrada ${form.entrada}`
    : null;

  const fetchTurmas = async () => {
    setLoading(true);

    // O total por turma sai das matrículas em andamento. Antes vinha de
    // `alunos(count)`, que dependia da coluna alunos.turma_id — a mesma que
    // não conseguia representar aluno cursando duas turmas.
    const [{ data }, { data: matriculas }] = await Promise.all([
      supabase.from("turmas").select("*").order("entrada", { ascending: false }),
      supabase.from("matriculas").select("turma_id").eq("situacao", "cursando"),
    ]);

    const porTurma = new Map<string, number>();
    for (const m of (matriculas ?? []) as { turma_id: string }[]) {
      porTurma.set(m.turma_id, (porTurma.get(m.turma_id) ?? 0) + 1);
    }

    if (data) {
      setTurmas((data as Turma[]).map(t => ({ ...t, _alunos_count: porTurma.get(t.id) ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTurmas(); }, []);

  const handleCriar = async () => {
    if (!form.entrada || !form.curso || !form.turno) return setMsg({ tipo: "erro", texto: "Preencha todos os campos." });
    setSalvando(true);
    const nome = `${form.curso} ${form.turno} ${form.entrada}`;
    const { error } = await supabase.from("turmas").insert([{ nome, entrada: form.entrada, curso: form.curso, turno: form.turno }]);
    if (error) setMsg({ tipo: "erro", texto: "Erro ao criar turma." });
    else {
      setMsg({ tipo: "ok", texto: `Turma criada: ${nome}` });
      setForm({ entrada: "", curso: "", turno: "" });
      fetchTurmas();
    }
    setSalvando(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleExcluir = async (t: Turma) => {
    const ok = await confirmar({
      titulo: `Excluir a turma ${t.nome}?`,
      perigo: true,
      rotuloConfirmar: "Excluir turma",
      descricao: (
        <>
          <p>
            Vão junto as <strong>matrículas</strong>, as <strong>aulas</strong> e as{" "}
            <strong>presenças e notas</strong> desta turma. O diário do que já foi dado deixa
            de existir.
          </p>
          <p className="text-red-700">Não há como desfazer.</p>
          <p className="text-gray-500">
            Se a turma apenas terminou, o caminho é o <strong>Fechamento</strong>: os alunos
            são encerrados um a um e todo o histórico continua consultável nos relatórios.
          </p>
        </>
      ),
    });
    if (!ok) return;

    const { error } = await supabase.from("turmas").delete().eq("id", t.id);
    if (error) return setMsg({ tipo: "erro", texto: `Não foi possível excluir: ${error.message}` });
    fetchTurmas();
  };

  const turmasPorCurso = CURSOS.reduce<Record<string, Turma[]>>((acc, curso) => {
    acc[curso] = turmas.filter(t => t.curso === curso);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {dialogo}
      {/* Conceito */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>Cada turma representa um <strong>grupo de entrada</strong> — alunos que ingressaram juntos. Em qualquer semestre letivo coexistem até 3 turmas ativas por curso/turno. <span className="text-blue-600">Clique em um card para ver e gerenciar os alunos da turma.</span></p>
        </div>
      </div>

      {/* Totalizador de alunos */}
      {!loading && (() => {
        const totalGeral = turmas.reduce((s, t) => s + (t._alunos_count ?? 0), 0);
        const totalAnimacao = turmas.filter(t => t.curso === "Animação").reduce((s, t) => s + (t._alunos_count ?? 0), 0);
        const totalCineTV = turmas.filter(t => t.curso === "Cine/TV").reduce((s, t) => s + (t._alunos_count ?? 0), 0);
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalGeral}</p>
              <p className="text-xs text-gray-500 mt-0.5">alunos no total</p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{totalAnimacao}</p>
              <p className="text-xs text-gray-500 mt-0.5">Animação</p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{totalCineTV}</p>
              <p className="text-xs text-gray-500 mt-0.5">Cine/TV</p>
            </div>
          </div>
        );
      })()}

      {/* Criar turma — accordion fechado por default */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormAberto(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Turma
          </span>
          {formAberto ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {formAberto && (
          <div className="px-6 pb-6 space-y-4 border-t pt-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-gray-700">Semestre de entrada</Label>
                <Input
                  className="w-full text-gray-800"
                  placeholder="ex: 2026/2"
                  value={form.entrada}
                  onChange={e => setForm(f => ({ ...f, entrada: e.target.value }))}
                />
                <p className="text-xs text-gray-400">Quando este grupo começou o curso</p>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-700">Curso</Label>
                <Select value={form.curso} onValueChange={v => setForm(f => ({ ...f, curso: v }))}>
                  <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                  <SelectContent>{CURSOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-700">Turno</Label>
                <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                  <SelectTrigger className="w-full text-gray-800"><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
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
          </div>
        )}
      </div>

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

            // Ordena por módulo (1,2,3) e dentro de cada um Manhã antes de Noite
            const ORDEM_ROTULO = ["Módulo 1", "Módulo 2", "Módulo 3", "Ainda não iniciou", "Curso concluído"];
            const ORDEM_TURNO = ["Manhã", "Noite"];
            const sorted = [...lista].sort((a, b) => {
              const sA = ORDEM_ROTULO.indexOf(rotuloDoModulo(a.entrada, semestreAtual));
              const sB = ORDEM_ROTULO.indexOf(rotuloDoModulo(b.entrada, semestreAtual));
              if (sA !== sB) return sA - sB;
              return ORDEM_TURNO.indexOf(a.turno) - ORDEM_TURNO.indexOf(b.turno);
            });

            // Agrupa por módulo para exibir em linhas separadas. O módulo em
            // número acompanha o rótulo, porque é dele que sai a cor.
            const grupos: Record<string, { modulo: number | null; turmas: Turma[] }> = {};
            sorted.forEach(t => {
              const rotulo = rotuloDoModulo(t.entrada, semestreAtual);
              if (!grupos[rotulo]) grupos[rotulo] = { modulo: moduloAtual(t.entrada, semestreAtual), turmas: [] };
              grupos[rotulo].turmas.push(t);
            });

            return (
              <div key={curso} className="space-y-4">
                <p className="text-white font-bold text-lg border-b border-white/20 pb-2">{curso}</p>

                {ORDEM_ROTULO.filter(r => grupos[r]?.turmas.length).map(rotulo => (
                  <div key={rotulo} className="space-y-2">
                    {/* Rótulo da linha do módulo */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeModulo(grupos[rotulo].modulo)}`}>{rotulo}</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Cards da linha: Manhã | Noite */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {grupos[rotulo].turmas.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTurmaSelecionada(t)}
                          className={`${cardBgModulo(grupos[rotulo].modulo)} rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left w-full group cursor-pointer`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div>
                                <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{t.turno}</p>
                              <p className="text-xs text-gray-500">Entrada: {t.entrada}</p>
                            </div>
                              <p className="text-xs text-gray-600 flex items-center gap-1 pt-1">
                                <Users className="h-3 w-3" />
                                {t._alunos_count} aluno{t._alunos_count !== 1 ? "s" : ""}
                                <span className="ml-auto text-blue-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver alunos →</span>
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleExcluir(t); }}
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
