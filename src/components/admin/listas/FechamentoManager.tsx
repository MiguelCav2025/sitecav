"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo, MODULOS_DO_CURSO } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { NOTA_MINIMA, PRESENCA_MINIMA, type Situacao } from "@/lib/aprovacao";
import { encerrarMatricula, reabrirMatricula } from "@/lib/matriculas";
import {
  montarFechamento, resumirFechamento, pendenciasDaTurma, situacaoSugerida,
  type AlunoParaFechar, type Desfecho, type LinhaDesempenho, type MatriculaAberta,
} from "@/lib/fechamento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmacao } from "@/components/ui/confirmar";
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

interface Decidido {
  matriculaId: string;
  alunoId: string;
  nome: string;
  situacao: string;
  modulo: number;
}

const ROTULO_SITUACAO: Record<string, string> = {
  aprovado: "Aprovado", retido: "Retido", desistente: "Desistente", concluido: "Concluído",
};

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
  const { semestre: semestreAtual } = useSemestreVigente();
  const { confirmar, dialogo } = useConfirmacao();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [alunos, setAlunos] = useState<AlunoParaFechar[]>([]);
  const [decididos, setDecididos] = useState<Decidido[]>([]);
  const [abonosPorAluno, setAbonosPorAluno] = useState<Map<string, number>>(new Map());
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
  const modulo = turma ? moduloAtual(turma.entrada, semestreAtual) : null;

  const carregar = useCallback(async () => {
    if (!turmaId) { setAlunos([]); return; }
    setCarregando(true);

    // Duas fontes de propósito: a lista de quem decidir vem das matrículas em
    // andamento, e as notas vêm da view. Aluno sem nada lançado não aparece na
    // view — se a lista saísse de lá, ele sumiria da tela.
    const [{ data: mats }, { data: desempenho }, { data: aulasData }] = await Promise.all([
      supabase.from("matriculas")
        .select("id, modulo, situacao, aluno:alunos(id, nome)")
        .eq("turma_id", turmaId),
      supabase.from("vw_desempenho_aluno").select("*").eq("turma_id", turmaId),
      supabase.from("aulas").select("id").eq("turma_id", turmaId),
    ]);

    const linhas = ((mats ?? []) as unknown as {
      id: string; modulo: number; situacao: string; aluno: { id: string; nome: string } | null;
    }[]).filter(m => m.aluno);

    // Só quem ainda está cursando entra na lista de decidir; os já encerrados
    // ficam à parte, para o coordenador ver o que decidiu e poder desfazer.
    const emAberto: MatriculaAberta[] = linhas
      .filter(m => m.situacao === "cursando")
      .map(m => ({ matriculaId: m.id, alunoId: m.aluno!.id, nome: m.aluno!.nome }));

    // Abonos concedidos nas aulas desta turma. O número por aluno basta aqui:
    // ele serve para avisar que a frequência oficial não conta a história toda.
    const idsDasAulas = ((aulasData ?? []) as { id: string }[]).map(a => a.id);
    const porAluno = new Map<string, number>();
    if (idsDasAulas.length > 0) {
      const { data: abonos } = await supabase
        .from("abonos").select("aluno_id").in("aula_id", idsDasAulas);
      for (const a of (abonos ?? []) as { aluno_id: string }[]) {
        porAluno.set(a.aluno_id, (porAluno.get(a.aluno_id) ?? 0) + 1);
      }
    }

    setAbonosPorAluno(porAluno);
    setDecididos(linhas
      .filter(m => m.situacao !== "cursando")
      .map(m => ({ matriculaId: m.id, alunoId: m.aluno!.id, nome: m.aluno!.nome, situacao: m.situacao, modulo: m.modulo }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    setAlunos(montarFechamento(emAberto, (desempenho ?? []) as LinhaDesempenho[]));
    setCarregando(false);
  }, [supabase, turmaId]);

  useEffect(() => { carregar(); }, [carregar]);

  // No último módulo, passar é CONCLUIR o curso — não "ser aprovado para o
  // semestre que vem", que não existe. O botão muda de nome junto.
  const ehUltimoModulo = modulo !== null && modulo >= MODULOS_DO_CURSO;
  const desfechoPositivo: Desfecho = ehUltimoModulo ? "concluido" : "aprovado";

  const decidir = async (a: AlunoParaFechar, situacao: Desfecho) => {
    const sugerida = situacaoSugerida(a.avaliacao, modulo ?? 1);
    const contraria = sugerida !== null && sugerida !== situacao;

    const rotulo = situacao === "retido" ? "Reter"
      : situacao === "concluido" ? "Formar" : "Aprovar";
    const abonos = abonosPorAluno.get(a.alunoId) ?? 0;

    const ok = await confirmar({
      titulo: `${rotulo} ${a.nome}?`,
      perigo: contraria || a.avaliacao.situacao === "indefinido",
      rotuloConfirmar: `${rotulo} ${a.nome.split(" ")[0]}`,
      descricao: (
        <>
          {contraria && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
              Pelas notas e frequência ele está como{" "}
              <strong>{ESTILO[a.avaliacao.situacao].rotulo.toLowerCase()}</strong>, e você vai
              encerrar como <strong>{situacao}</strong>. A decisão é sua e fica registrada com
              o cálculo do sistema ao lado.
            </p>
          )}

          {a.avaliacao.situacao === "indefinido" && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
              <p className="font-medium text-gray-700">Ainda falta lançar:</p>
              <ul className="mt-1 space-y-0.5">
                {a.avaliacao.pendencias.map(p => (
                  <li key={p} className="flex gap-1.5"><span className="text-gray-400">•</span>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {abonos > 0 && (
            <p className="text-amber-800">
              Ele tem <strong>{abonos} falta(s) abonada(s)</strong> que não entram na frequência
              calculada. Vale conferir no relatório antes de decidir.
            </p>
          )}

          {situacao === "concluido" && (
            <p className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-purple-900">
              Este é o <strong>último módulo</strong>: {a.nome.split(" ")[0]} <strong>conclui o
              curso</strong>. Não volta no semestre que vem — sai das turmas ativas e passa a
              constar entre os formados.
            </p>
          )}

          <p>
            A matrícula é encerrada com a data de hoje e sai da lista de decidir. Dá para
            desfazer depois, em <strong>Já decididos</strong>.
          </p>

          {situacao === "retido" && (
            <p>
              Ele passa a aparecer em <strong>Aguardando rematrícula</strong>: refaz o mesmo
              módulo na turma que começou um semestre depois desta — não nesta, que vai avançar.
            </p>
          )}
        </>
      ),
    });
    if (!ok) return;

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

  const desfazer = async (d: Decidido) => {
    const ok = await confirmar({
      titulo: `Desfazer a decisão sobre ${d.nome}?`,
      rotuloConfirmar: "Desfazer",
      descricao: (
        <>
          <p>
            A matrícula volta a <strong>cursando</strong> e ele reaparece na lista de decidir.
          </p>
          <p>
            A data do encerramento e a observação são apagadas — inclusive o registro de que a
            decisão contrariou o cálculo, se foi o caso.
          </p>
        </>
      ),
    });
    if (!ok) return;

    setDecidindo(d.matriculaId);
    const { erro } = await reabrirMatricula(supabase, d.matriculaId);
    setDecidindo(null);
    if (erro) return aviso("erro", `Não foi possível desfazer: ${erro}`);
    aviso("ok", `${d.nome} voltou para a lista.`);
    carregar();
  };

  const resumo = resumirFechamento(alunos);
  const pendencias = pendenciasDaTurma(alunos);
  const retidos = decididos.filter(d => d.situacao === "retido");

  return (
    <div className="space-y-6">
      {dialogo}
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
                  {t.curso} · {t.turno} · entrada {t.entrada} — {rotuloModulo(moduloAtual(t.entrada, semestreAtual))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {turma && (
            <p className="text-sm text-gray-500">
              Fechando o <strong>{rotuloModulo(modulo).toLowerCase()}</strong> de {turma.curso} {turma.turno},
              turma que entrou em {turma.entrada}.
              {ehUltimoModulo && (
                <span className="ml-1 text-purple-700">
                  É o último módulo: quem passar <strong>conclui o curso</strong>.
                </span>
              )}
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
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {a.nome}
                            {/* A frequência calculada NÃO desconta o abono: a falta
                                aconteceu. Este aviso existe para o coordenador não
                                decidir com meia informação — que era o risco real,
                                já que o sistema nunca retém sozinho. */}
                            {(abonosPorAluno.get(a.alunoId) ?? 0) > 0 && (
                              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 border border-amber-200">
                                {abonosPorAluno.get(a.alunoId)} falta(s) abonada(s)
                              </span>
                            )}
                          </td>
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
                                className={`h-7 text-xs ${ehUltimoModulo
                                  ? "text-purple-700 border-purple-200 hover:bg-purple-50"
                                  : "text-green-700 border-green-200 hover:bg-green-50"}`}
                                disabled={decidindo === a.matriculaId}
                                onClick={() => decidir(a, desfechoPositivo)}
                              >
                                {decidindo === a.matriculaId
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : ehUltimoModulo ? "Formar" : "Aprovar"}
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

      {decididos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-gray-400" /> Já decididos
            </CardTitle>
            <p className="text-sm text-gray-500">
              O que já foi encerrado nesta turma. Errou? Desfaça — a matrícula volta
              para a lista de cima e a decisão anterior é apagada.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {decididos.map(d => (
                  <tr key={d.matriculaId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{d.nome}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        d.situacao === "aprovado" ? "bg-green-50 text-green-700"
                        : d.situacao === "retido" ? "bg-red-50 text-red-700"
                        : "bg-gray-100 text-gray-600"}`}>
                        {ROTULO_SITUACAO[d.situacao] ?? d.situacao}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs text-gray-600"
                        disabled={decidindo === d.matriculaId}
                        onClick={() => desfazer(d)}
                      >
                        {decidindo === d.matriculaId
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : "Desfazer"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {retidos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-4 w-4" /> Aguardando rematrícula
            </CardTitle>
            <p className="text-sm text-gray-500">
              Quem foi retido refaz o mesmo módulo — mas <strong>não nesta turma</strong>,
              que vai avançar. Ele entra na turma que começou um semestre depois, que é a
              que estará neste módulo quando o próximo semestre começar.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-gray-600">
              {retidos.map(d => (
                <li key={d.matriculaId} className="flex gap-2">
                  <span className="text-amber-500">•</span>
                  {d.nome} — refaz o módulo {d.modulo}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              A matrícula nova só deve nascer quando o próximo semestre começar. Criá-la
              agora faria o aluno aparecer na chamada de uma turma que ainda cursa outro
              módulo. Até lá ele fica nesta lista — ela se esvazia sozinha conforme cada
              um for rematriculado pela aba Turmas.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
