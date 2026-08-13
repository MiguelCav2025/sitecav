"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo } from "@/lib/calendario-escolar";
import { NOTA_MINIMA, PRESENCA_MINIMA, type Situacao } from "@/lib/aprovacao";
import { encerrarMatricula } from "@/lib/matriculas";
import {
  montarFechamento, resumirFechamento, pendenciasDaTurma, situacaoSugerida,
  type AlunoParaFechar, type LinhaDesempenho, type MatriculaAberta,
} from "@/lib/fechamento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronRight, Loader2, Scale, XCircle, HelpCircle,
} from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  entrada: string;
  curso: string;
  turno: string;
}

const ESTILO: Record<Situacao, { cor: string; rotulo: string; Icone: typeof CheckCircle }> = {
  aprovado:   { cor: "bg-green-50 text-green-700 border-green-200", rotulo: "Aprovado",   Icone: CheckCircle },
  retido:     { cor: "bg-red-50 text-red-700 border-red-200",       rotulo: "Retido",     Icone: XCircle },
  indefinido: { cor: "bg-gray-100 text-gray-600 border-gray-200",   rotulo: "Indefinido", Icone: HelpCircle },
};

/**
 * Fechamento do módulo.
 *
 * O sistema calcula, o coordenador decide (D25). Nada é encerrado em lote: a
 * decisão é aluno por aluno, com o motivo à vista — reter alguém por engano
 * custa um semestre da vida de uma pessoa.
 */
export default function FechamentoManager() {
  const supabase = createClient();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [alunos, setAlunos] = useState<AlunoParaFechar[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const aviso = (tipo: "ok" | "erro", texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 7000);
  };

  useEffect(() => {
    supabase.from("turmas").select("id, nome, entrada, curso, turno").order("nome")
      .then(({ data }) => setTurmas((data ?? []) as Turma[]));
  }, [supabase]);

  const turma = turmas.find(t => t.id === turmaId) ?? null;
  const modulo = turma ? moduloAtual(turma.entrada) : null;

  const carregar = useCallback(async () => {
    if (!turmaId) { setAlunos([]); return; }
    setCarregando(true);

    // Duas fontes de propósito: a lista de quem decidir vem das matrículas em
    // andamento, e as notas vêm da view. Aluno sem nada lançado não aparece na
    // view — se a lista saísse de lá, ele sumiria da tela.
    const [{ data: mats }, { data: desempenho }] = await Promise.all([
      supabase.from("matriculas")
        .select("id, aluno:alunos(id, nome)")
        .eq("turma_id", turmaId).eq("situacao", "cursando"),
      supabase.from("vw_desempenho_aluno").select("*").eq("turma_id", turmaId),
    ]);

    const matriculas: MatriculaAberta[] = ((mats ?? []) as unknown as
      { id: string; aluno: { id: string; nome: string } | null }[])
      .filter(m => m.aluno)
      .map(m => ({ matriculaId: m.id, alunoId: m.aluno!.id, nome: m.aluno!.nome }));

    setAlunos(montarFechamento(matriculas, (desempenho ?? []) as LinhaDesempenho[]));
    setCarregando(false);
  }, [supabase, turmaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (a: AlunoParaFechar, situacao: "aprovado" | "retido") => {
    const sugerida = situacaoSugerida(a.avaliacao);
    const contraria = sugerida !== null && sugerida !== situacao;

    const texto = contraria
      ? `${a.nome} está como ${ESTILO[a.avaliacao.situacao].rotulo.toUpperCase()} pelas notas e frequência, ` +
        `e você vai encerrar como ${situacao.toUpperCase()}.\n\nConfirma?`
      : a.avaliacao.situacao === "indefinido"
        ? `Ainda falta lançar coisas para ${a.nome}:\n\n${a.avaliacao.pendencias.join("\n")}\n\n` +
          `Encerrar como ${situacao.toUpperCase()} mesmo assim?`
        : `Encerrar a matrícula de ${a.nome} como ${situacao.toUpperCase()}?`;

    if (!confirm(texto)) return;

    setDecidindo(a.matriculaId);
    const observacao = contraria || a.avaliacao.situacao === "indefinido"
      ? `Decisão do coordenador. Cálculo do sistema: ${a.avaliacao.situacao}.`
      : undefined;

    const { erro } = await encerrarMatricula(supabase, a.matriculaId, situacao, observacao);
    setDecidindo(null);

    if (erro) return aviso("erro", `Não foi possível encerrar: ${erro}`);
    aviso("ok", `${a.nome} encerrado como ${situacao}.`);
    carregar();
  };

  const resumo = resumirFechamento(alunos);
  const pendencias = pendenciasDaTurma(alunos);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Scale className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona</p>
          <p>
            Passa na disciplina quem tem média <strong>{NOTA_MINIMA} ou mais</strong> e{" "}
            <strong>{PRESENCA_MINIMA}% de presença</strong>. Passa no módulo quem passou em{" "}
            <strong>todas</strong> — ficar abaixo numa única matéria retém o aluno.
          </p>
          <p>
            O sistema calcula e mostra o motivo; <strong>quem decide é você</strong>. Falta
            lançar alguma coisa? O aluno fica como <em>indefinido</em> — nunca como reprovado,
            porque esquecimento de lançamento não pode virar retenção.
          </p>
        </div>
      </div>

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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Turma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger className="w-full max-w-md text-gray-800">
              <SelectValue placeholder="Escolha a turma a fechar" />
            </SelectTrigger>
            <SelectContent>
              {turmas.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.curso} · {t.turno} · entrada {t.entrada} — {rotuloModulo(moduloAtual(t.entrada))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {turma && (
            <p className="text-sm text-gray-500">
              Fechando o <strong>{rotuloModulo(modulo).toLowerCase()}</strong> de {turma.curso} {turma.turno},
              turma que entrou em {turma.entrada}.
            </p>
          )}
        </CardContent>
      </Card>

      {carregando ? (
        <div className="flex items-center gap-2 text-white/60 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !turmaId ? null : alunos.length === 0 ? (
        <p className="text-sm text-white/60 italic">
          Nenhum aluno cursando esta turma. Se todos já foram encerrados, o módulo está fechado.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {([
              ["aprovado", resumo.aprovados],
              ["retido", resumo.retidos],
              ["indefinido", resumo.indefinidos],
            ] as [Situacao, number][]).map(([s, n]) => (
              <div key={s} className={`rounded-xl border px-4 py-2 ${ESTILO[s].cor}`}>
                <p className="text-2xl font-bold">{n}</p>
                <p className="text-xs">{ESTILO[s].rotulo}</p>
              </div>
            ))}
            <div className="rounded-xl border border-white/20 px-4 py-2 text-white/80">
              <p className="text-2xl font-bold">{resumo.total}</p>
              <p className="text-xs">cursando</p>
            </div>
          </div>

          {pendencias.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4" /> Falta lançar
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Enquanto isto existir, há aluno sem resultado. Cada item aparece uma vez,
                  por mais alunos que ele afete.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-gray-600">
                  {pendencias.map(p => (
                    <li key={p} className="flex gap-2">
                      <span className="text-amber-500">•</span>{p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="w-8 px-2 py-3" />
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Aluno</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Situação</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Motivo</th>
                    <th className="w-52 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alunos.map(a => {
                    const estilo = ESTILO[a.avaliacao.situacao];
                    const expandido = aberto === a.alunoId;
                    return (
                      // Fragment com key: a linha do aluno e a de detalhe são
                      // irmãs no <tbody>, então o item da lista é o par.
                      <Fragment key={a.alunoId}>
                        <tr className="hover:bg-gray-50 align-top">
                          <td className="px-2 py-3">
                            <button
                              onClick={() => setAberto(expandido ? null : a.alunoId)}
                              className="text-gray-400 hover:text-gray-700"
                              title={expandido ? "Recolher" : "Ver disciplina por disciplina"}
                            >
                              {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{a.nome}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${estilo.cor}`}>
                              <estilo.Icone className="h-3 w-3" /> {estilo.rotulo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {a.avaliacao.motivos[0] ?? "—"}
                            {a.avaliacao.motivos.length > 1 && (
                              <span className="text-gray-400"> (+{a.avaliacao.motivos.length - 1})</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                disabled={decidindo === a.matriculaId}
                                onClick={() => decidir(a, "aprovado")}
                              >
                                {decidindo === a.matriculaId
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : "Aprovar"}
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                disabled={decidindo === a.matriculaId}
                                onClick={() => decidir(a, "retido")}
                              >
                                Reter
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {expandido && (
                          <tr className="bg-gray-50/60">
                            <td />
                            <td colSpan={4} className="px-4 pb-4">
                              {a.avaliacao.disciplinas.length === 0 ? (
                                <p className="text-xs text-gray-500 italic py-2">
                                  Nenhuma nota lançada para este aluno.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="py-1 text-left font-medium">Disciplina</th>
                                      <th className="py-1 text-left font-medium">Nota final</th>
                                      <th className="py-1 text-left font-medium">Presença</th>
                                      <th className="py-1 text-left font-medium">Situação</th>
                                      <th className="py-1 text-left font-medium">Motivo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {a.avaliacao.disciplinas.map(d => (
                                      <tr key={d.disciplinaId} className="border-t border-gray-200">
                                        <td className="py-1.5 text-gray-700">{d.disciplina}</td>
                                        <td className={`py-1.5 ${d.notaFinal !== null && d.notaFinal < NOTA_MINIMA ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                          {d.notaFinal ?? "—"}
                                        </td>
                                        <td className={`py-1.5 ${d.percentual !== null && d.percentual < PRESENCA_MINIMA ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                          {d.percentual === null ? "—" : `${d.percentual}%`}
                                        </td>
                                        <td className="py-1.5">
                                          <span className={`rounded-full border px-1.5 py-0.5 ${ESTILO[d.situacao].cor}`}>
                                            {ESTILO[d.situacao].rotulo}
                                          </span>
                                        </td>
                                        <td className="py-1.5 text-gray-500">{d.motivos.join(" ") || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-sm text-blue-200">
            {resumo.prontoParaFechar
              ? "Todos têm resultado calculado. Encerre um a um — a matrícula encerrada guarda a data e o motivo."
              : `${resumo.indefinidos} aluno(s) ainda sem resultado. Dá para decidir mesmo assim, mas o sistema registra que foi decisão sua.`}
          </p>
        </>
      )}
    </div>
  );
}
