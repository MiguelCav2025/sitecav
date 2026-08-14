"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirmacao } from "@/components/ui/confirmar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle, AlertTriangle, CheckCircle, Info, Loader2, Plus, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { moduloAtual, rotuloModulo, MODULOS_DO_CURSO } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { buscarAlunosDaTurma } from "@/lib/matriculas";
import {
  avaliarModulo,
  moduloTemBanca,
  type AvaliacaoDaDisciplina,
  type DesempenhoDisciplina,
  type Situacao,
} from "@/lib/aprovacao";

interface Turma { id: string; nome: string; entrada: string; curso: string; turno: string; }
interface Aluno { id: string; nome: string; }
interface Grupo {
  id: string;
  nome: string;
  nota_banca: number | null;
  integrantes: string[]; // aluno_id
}

const virgula = (n: number) => String(n).replace(".", ",");

/**
 * Explica de onde a média saiu. A nota da banca é a mesma em todas as
 * disciplinas do módulo; o que muda de uma para outra é a parte do professor.
 */
function composicaoDaNota(d: AvaliacaoDaDisciplina): string {
  const partes: string[] = [];

  if (d.notaProfessor !== null && d.notaBanca !== null && d.notaFinal !== null) {
    partes.push(`Professor ${virgula(d.notaProfessor)} + banca ${virgula(d.notaBanca)} → média ${virgula(d.notaFinal)}`);
  } else if (d.notaProfessor !== null) {
    partes.push(`Professor ${virgula(d.notaProfessor)}, banca pendente`);
  } else {
    partes.push("Nota do professor pendente");
  }

  partes.push(d.percentual !== null ? `Frequência ${d.percentual}%` : "Sem chamada fechada");
  return `${partes.join(". ")}.`;
}

const SITUACAO_ESTILO: Record<Situacao, { rotulo: string; classe: string }> = {
  aprovado:   { rotulo: "Aprovado",   classe: "bg-green-100 text-green-700" },
  retido:     { rotulo: "Retido",     classe: "bg-red-100 text-red-700" },
  indefinido: { rotulo: "Pendente",   classe: "bg-gray-100 text-gray-600" },
};

/**
 * Grupos da banca e a nota que ela atribui.
 *
 * A banca avalia o **grupo**, e todos os integrantes recebem a mesma nota
 * (D21). Por isso a nota fica no grupo, não no aluno.
 *
 * A tabela de situação abaixo é só leitura: registrar a aprovação ou retenção
 * do aluno é a fase seguinte, que precisa da tabela de matrículas.
 */
export default function GruposEBancaManager() {
  const supabase = createClient();
  const { semestre: semestreVigenteAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [modulo, setModulo] = useState("1");

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [desempenho, setDesempenho] = useState<(DesempenhoDisciplina & { aluno_id: string })[]>([]);

  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [novoGrupo, setNovoGrupo] = useState("");

  const aviso = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 6000);
  };

  useEffect(() => {
    supabase.from("turmas").select("id, nome, entrada, curso, turno").order("nome")
      .then(({ data }) => setTurmas((data ?? []) as Turma[]));
  }, [supabase]);

  // Ao escolher a turma, sugere o módulo em que ela está agora
  const escolherTurma = (id: string) => {
    setTurmaId(id);
    const t = turmas.find(x => x.id === id);
    const atual = t ? moduloAtual(t.entrada, semestreVigenteAtual) : null;
    if (atual !== null && atual >= 1 && atual <= MODULOS_DO_CURSO) setModulo(String(atual));
  };

  const carregar = useCallback(async () => {
    if (!turmaId) return;
    setCarregando(true);

    const [{ alunos: daTurma }, { data: gruposData }, { data: vwData }] = await Promise.all([
      buscarAlunosDaTurma(supabase, turmaId),
      supabase.from("grupos").select("id, nome, nota_banca, grupo_alunos(aluno_id)")
        .eq("turma_id", turmaId).eq("modulo", Number(modulo)).order("nome"),
      supabase.from("vw_desempenho_aluno")
        .select("aluno_id, disciplina_id, disciplina, modulo, nota_professor, nota_banca, nota_final, aulas_dadas, presencas")
        .eq("turma_id", turmaId).eq("modulo", Number(modulo)),
    ]);

    setAlunos(daTurma.map(a => ({ id: a.id, nome: a.nome })));
    setGrupos(((gruposData ?? []) as unknown as (Omit<Grupo, "integrantes"> & { grupo_alunos: { aluno_id: string }[] })[])
      .map(g => ({ id: g.id, nome: g.nome, nota_banca: g.nota_banca, integrantes: (g.grupo_alunos ?? []).map(i => i.aluno_id) })));
    setDesempenho((vwData ?? []) as (DesempenhoDisciplina & { aluno_id: string })[]);
    setCarregando(false);
  }, [turmaId, modulo, supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  const grupoDoAluno = useMemo(() => {
    const mapa = new Map<string, Grupo>();
    for (const g of grupos) for (const id of g.integrantes) mapa.set(id, g);
    return mapa;
  }, [grupos]);

  const semGrupo = alunos.filter(a => !grupoDoAluno.has(a.id));

  const criarGrupo = async () => {
    if (!novoGrupo.trim()) return aviso("erro", "Dê um nome ao grupo.");
    const { error } = await supabase.from("grupos").insert([{
      turma_id: turmaId, modulo: Number(modulo), nome: novoGrupo.trim(),
    }]);
    if (error) return aviso("erro", `Erro ao criar: ${error.message}`);
    setNovoGrupo("");
    carregar();
  };

  const excluirGrupo = async (g: Grupo) => {
    const ok = await confirmar({
      titulo: `Excluir o grupo "${g.nome}"?`,
      perigo: true,
      rotuloConfirmar: "Excluir grupo",
      descricao: (
        <>
          <p>Os integrantes ficam <strong>sem grupo</strong>, e a nota da banca que ele tinha se perde.</p>
          <p>Sem grupo não há nota de banca, então a situação deles volta a ficar pendente no fechamento.</p>
        </>
      ),
    });
    if (!ok) return;
    const { error } = await supabase.from("grupos").delete().eq("id", g.id);
    if (error) return aviso("erro", `Erro ao excluir: ${error.message}`);
    carregar();
  };

  const adicionarAoGrupo = async (grupoId: string, alunoId: string) => {
    const { error } = await supabase.from("grupo_alunos").insert([{ grupo_id: grupoId, aluno_id: alunoId }]);
    // A trava do banco impede o aluno de estar em dois grupos do mesmo módulo
    if (error) return aviso("erro", error.message);
    carregar();
  };

  const removerDoGrupo = async (grupoId: string, alunoId: string) => {
    const { error } = await supabase.from("grupo_alunos").delete()
      .eq("grupo_id", grupoId).eq("aluno_id", alunoId);
    if (error) return aviso("erro", `Erro ao remover: ${error.message}`);
    carregar();
  };

  const salvarNota = async (grupoId: string, valor: string) => {
    const limpo = valor.trim().replace(",", ".");
    const nota = limpo === "" ? null : Number(limpo);
    if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > 10)) {
      return aviso("erro", "A nota da banca precisa estar entre 0 e 10.");
    }
    const { error } = await supabase.from("grupos")
      .update({ nota_banca: nota, updated_at: new Date().toISOString() }).eq("id", grupoId);
    if (error) return aviso("erro", `Erro ao salvar a nota: ${error.message}`);
    aviso("ok", nota === null ? "Nota da banca removida." : `Nota ${nota} salva — vale para todo o grupo.`);
    carregar();
  };

  const nomePorId = useMemo(() => new Map(alunos.map(a => [a.id, a.nome])), [alunos]);

  return (
    <div className="space-y-6">
      {dialogo}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
          msg.tipo === "ok"
            ? "border border-green-200 bg-green-50 text-green-800"
            : "border border-red-200 bg-red-50 text-red-800"}`}>
          {msg.tipo === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.texto}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Turma e módulo</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-gray-700">Turma</Label>
            <Select value={turmaId} onValueChange={escolherTurma}>
              <SelectTrigger className="text-gray-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {/* Mesmo rótulo do Fechamento e dos Relatórios. Aqui aparecia o
                    nome cru ("Animação Manhã 2025/2"), e o 2025/2 lido como
                    módulo — que é o engano que a Fase 14 veio desfazer. */}
                {turmas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.curso} · {t.turno} · {rotuloModulo(moduloAtual(t.entrada, semestreVigenteAtual))} (entrada {t.entrada})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-700">
              Módulo
              <span className="ml-2 text-xs font-normal text-gray-400">
                vem preenchido com o atual; mude para ver a banca de um módulo anterior
              </span>
            </Label>
            <Select value={modulo} onValueChange={setModulo}>
              <SelectTrigger className="text-gray-800"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: MODULOS_DO_CURSO }, (_, i) => String(i + 1)).map(s => (
                  <SelectItem key={s} value={s}>Módulo {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!turmaId ? (
        <p className="text-sm italic text-white/50">Selecione uma turma para montar os grupos.</p>
      ) : carregando ? (
        <div className="flex items-center gap-2 py-4 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !moduloTemBanca(Number(modulo)) ? (
        /* O 1º módulo não tem banca (D19). A tela oferecia grupos assim mesmo, e
           acusava "11 alunos sem grupo" — uma pendência inventada, para uma
           avaliação que não existe naquele módulo. A nota final ali é a do
           professor, e é só isso que o fechamento espera. */
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="space-y-1">
              <p className="font-medium text-gray-800">O módulo 1 não tem banca.</p>
              <p className="text-sm text-gray-600">
                A banca começa no <strong>módulo 2</strong>. Aqui a nota final da disciplina é a
                que o professor lança — não há grupo a montar nem nota de banca a esperar.
              </p>
              <p className="text-sm text-gray-500">
                Para ver a situação desta turma, use a aba <strong>Fechamento</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grupos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Grupos da banca
              </CardTitle>
              <p className="text-sm text-gray-500">
                A banca avalia o grupo: a nota vale para todos os integrantes. Um grupo pode ter uma pessoa só.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  className="text-gray-800"
                  placeholder="Nome do grupo (ex.: Curta A)"
                  value={novoGrupo}
                  onChange={e => setNovoGrupo(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") criarGrupo(); }}
                />
                <Button onClick={criarGrupo}><Plus className="mr-2 h-4 w-4" /> Criar</Button>
              </div>

              {grupos.length === 0 ? (
                <p className="text-sm italic text-gray-400">Nenhum grupo neste módulo.</p>
              ) : (
                grupos.map(g => (
                  <div key={g.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-gray-800">{g.nome}</p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-500">Nota da banca</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          defaultValue={g.nota_banca ?? ""}
                          placeholder="—"
                          onBlur={e => {
                            const atual = g.nota_banca === null ? "" : String(g.nota_banca);
                            if (e.target.value.trim() !== atual) salvarNota(g.id, e.target.value);
                          }}
                          className="h-9 w-20 text-center font-semibold text-gray-800"
                        />
                        <button onClick={() => excluirGrupo(g)} className="p-1 text-red-400 hover:text-red-600" title="Excluir grupo">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {g.integrantes.length === 0 && (
                        <span className="text-xs italic text-gray-400">Sem integrantes</span>
                      )}
                      {g.integrantes.map(id => (
                        <span key={id} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800">
                          {nomePorId.get(id) ?? "—"}
                          <button onClick={() => removerDoGrupo(g.id, id)} className="text-blue-400 hover:text-blue-700">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {semGrupo.length > 0 && (
                      <Select value="" onValueChange={alunoId => adicionarAoGrupo(g.id, alunoId)}>
                        <SelectTrigger className="h-9 text-sm text-gray-700">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <UserPlus className="h-3.5 w-3.5" /> Adicionar aluno
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {semGrupo.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))
              )}

              {semGrupo.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>{semGrupo.length}</strong> aluno(s) sem grupo: {semGrupo.map(a => a.nome).join(", ")}.
                    Sem grupo não há nota de banca, e a situação deles fica pendente.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Situação por aluno */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situação no módulo</CardTitle>
              <p className="text-sm text-gray-500">
                Somente leitura. Registrar a aprovação ou retenção vem na próxima etapa.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Aluno</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Grupo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Semestre</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Por disciplina</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alunos.map(a => {
                    const doAluno = desempenho.filter(d => d.aluno_id === a.id);
                    const r = avaliarModulo(doAluno);
                    const estilo = SITUACAO_ESTILO[r.situacao];
                    return (
                      <tr key={a.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{a.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{grupoDoAluno.get(a.id)?.nome ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilo.classe}`}>
                            {estilo.rotulo}
                          </span>
                          <p className="mt-1 max-w-52 text-xs text-gray-400">
                            {r.motivos[0] ?? r.pendencias[0] ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {r.disciplinas.length === 0 ? (
                            <span className="text-xs italic text-gray-400">Nenhuma nota lançada</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {r.disciplinas.map(d => (
                                <span
                                  key={d.disciplinaId}
                                  title={composicaoDaNota(d)}
                                  className={`cursor-help rounded-lg px-2 py-1 text-xs ${SITUACAO_ESTILO[d.situacao].classe}`}
                                >
                                  <strong className="font-semibold">{d.disciplina}</strong>
                                  {d.notaFinal !== null && ` · ${virgula(d.notaFinal)}`}
                                  {d.percentual !== null && ` · ${d.percentual}%`}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
