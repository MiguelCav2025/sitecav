"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moduloAtual, rotuloModulo } from "@/lib/calendario-escolar";
import { useSemestreVigente } from "@/hooks/useSemestreVigente";
import { PRESENCA_MINIMA } from "@/lib/aprovacao";
import { buscarMatriculasDaTurma, type MatriculaDaTurma } from "@/lib/matriculas";
import {
  frequenciaPorDisciplina, resumirFrequencia, montarDiario, aulasPendentesDeChamada, limparParaCSV,
  type AulaFechada, type AulaPendente, type LinhaFrequencia, type LinhaDoDiario, type RegistroPresenca,
} from "@/lib/relatorios";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, BarChart3, Users, BookOpen, AlertCircle, CheckCircle } from "lucide-react";

interface Turma { id: string; nome: string; entrada: string; curso: string; turno: string; }

type Relatorio = "frequencia" | "diario" | "pendencias";

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  cursando:   { rotulo: "Cursando",   cor: "bg-blue-50 text-blue-700" },
  aprovado:   { rotulo: "Aprovado",   cor: "bg-green-50 text-green-700" },
  retido:     { rotulo: "Retido",     cor: "bg-red-50 text-red-700" },
  desistente: { rotulo: "Desistente", cor: "bg-gray-100 text-gray-500" },
  concluido:  { rotulo: "Concluído",  cor: "bg-purple-50 text-purple-700" },
};

const labelTurma = (t: Turma, semestreAtual: string | null) =>
  `${t.curso} · ${t.turno} · ${rotuloModulo(moduloAtual(t.entrada, semestreAtual))} (entrada ${t.entrada})`;

const formatarData = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/**
 * Relatórios de presença e diário de sala.
 *
 * A frequência aqui é **por disciplina**, não a média da turma: a regra do CAV
 * exige 70% em cada matéria (D38), e a média escondia justamente o aluno que
 * some de uma disciplina e comparece nas outras.
 */
export default function RelatoriosManager() {
  const supabase = createClient();
  const { semestre: semestreAtual } = useSemestreVigente();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSel, setTurmaSel] = useState("");
  const [relatorio, setRelatorio] = useState<Relatorio>("frequencia");
  const [carregando, setCarregando] = useState(false);

  const [frequencia, setFrequencia] = useState<LinhaFrequencia[]>([]);
  const [diario, setDiario] = useState<LinhaDoDiario[]>([]);
  const [pendentes, setPendentes] = useState<AulaPendente[]>([]);
  const [alunosDaTurma, setAlunosDaTurma] = useState<MatriculaDaTurma[]>([]);
  const [totalAulasDaTurma, setTotalAulasDaTurma] = useState(0);

  useEffect(() => {
    supabase.from("turmas").select("id, nome, entrada, curso, turno").order("nome")
      .then(({ data }) => setTurmas((data ?? []) as Turma[]));
  }, [supabase]);

  const carregar = useCallback(async () => {
    if (!turmaSel) { setFrequencia([]); setDiario([]); setPendentes([]); return; }
    setCarregando(true);

    // TODAS as matrículas, não só as em andamento: no instante em que o módulo
    // é fechado, todo mundo deixa de estar "cursando" — e era exatamente aí que
    // a turma sumia do relatório, justamente quando ela mais interessa.
    const [{ matriculas }, { data: aulasData }] = await Promise.all([
      buscarMatriculasDaTurma(supabase, turmaSel),
      supabase.from("aulas")
        .select("id, numero, data_aula, conteudo_ministrado, chamada_finalizada, disciplina:disciplinas(id, nome), professor:professores(nome)")
        .eq("turma_id", turmaSel)
        .order("numero"),
    ]);

    const todasAulas = ((aulasData ?? []) as unknown as {
      id: string; numero: number; data_aula: string | null; conteudo_ministrado: string | null;
      chamada_finalizada: boolean;
      disciplina: { id: string; nome: string } | null; professor: { nome: string } | null;
    }[])
      .filter(a => a.disciplina)
      .map(a => ({
        id: a.id,
        disciplina_id: a.disciplina!.id,
        disciplina: a.disciplina!.nome,
        numero: a.numero,
        data_aula: a.data_aula,
        conteudo_ministrado: a.conteudo_ministrado,
        professor: a.professor?.nome ?? null,
        finalizada: a.chamada_finalizada,
      }));

    const fechadas: AulaFechada[] = todasAulas.filter(a => a.finalizada);

    let presencas: RegistroPresenca[] = [];
    if (fechadas.length > 0) {
      const { data } = await supabase.from("presencas")
        .select("aula_id, aluno_id, presente")
        .in("aula_id", fechadas.map(a => a.id));
      presencas = (data ?? []) as RegistroPresenca[];
    }

    const hoje = new Date().toISOString().slice(0, 10);
    setAlunosDaTurma(matriculas);
    setFrequencia(frequenciaPorDisciplina(matriculas, fechadas, presencas));
    setDiario(montarDiario(fechadas));
    setPendentes(aulasPendentesDeChamada(todasAulas, hoje));
    setTotalAulasDaTurma(todasAulas.length);
    setCarregando(false);
  }, [supabase, turmaSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const baixarCSV = (linhas: Record<string, unknown>[], nome: string) => {
    if (linhas.length === 0) return;
    const cabecalho = Object.keys(linhas[0]).join(";");
    const corpo = linhas.map(l => Object.values(l).join(";"));
    // BOM para o Excel abrir os acentos corretamente.
    const blob = new Blob(["﻿" + [cabecalho, ...corpo].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nome}.csv`;
    a.click();
  };

  const turma = turmas.find(t => t.id === turmaSel);
  const resumo = resumirFrequencia(frequencia);
  const aulasFechadas = diario.length;
  const encerrados = alunosDaTurma.filter(a => a.situacao !== "cursando").length;
  const situacaoPorAluno = Object.fromEntries(alunosDaTurma.map(a => [a.id, a.situacao]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-400" /> Relatórios
        </h2>
        <p className="text-sm text-blue-200 mt-1">
          Frequência por disciplina, o que foi dado em cada aula e o que ficou para trás.
          A turma continua aqui depois de fechada — o módulo encerrado é o que mais interessa relatar.
        </p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Turma</p>
        <Select value={turmaSel} onValueChange={setTurmaSel}>
          <SelectTrigger className="w-full text-gray-800">
            <SelectValue placeholder="Selecione uma turma..." />
          </SelectTrigger>
          <SelectContent>
            {turmas.map(t => <SelectItem key={t.id} value={t.id}>{labelTurma(t, semestreAtual)}</SelectItem>)}
          </SelectContent>
        </Select>

        {turmaSel && (
          <>
            <div className="flex gap-2 pt-1 flex-wrap">
              {([
                ["frequencia", "Frequência", Users, 0],
                ["diario", "Diário de sala", BookOpen, 0],
                ["pendencias", "Chamadas em atraso", AlertCircle, pendentes.length],
              ] as const).map(([v, rot, Icone, aviso]) => (
                <button
                  key={v}
                  onClick={() => setRelatorio(v)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    relatorio === v
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  <Icone className="h-4 w-4" /> {rot}
                  {aviso > 0 && (
                    <span className={`rounded-full px-1.5 text-xs font-bold ${
                      relatorio === v ? "bg-white text-blue-700" : "bg-amber-500 text-white"}`}>
                      {aviso}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {encerrados > 0 && (
              <p className="text-xs text-gray-500">
                {encerrados} de {alunosDaTurma.length} aluno(s) já com matrícula encerrada —
                continuam nos relatórios, com a situação ao lado do nome.
              </p>
            )}
          </>
        )}
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-white/60 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !turmaSel ? null : relatorio === "pendencias" ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Chamadas em atraso</p>
              <p className="text-xs text-gray-500">
                Aulas cuja data já passou e o professor ainda não fechou a chamada.
              </p>
            </div>
            {pendentes.length > 0 && (
              <button
                onClick={() => baixarCSV(
                  pendentes.map(p => ({
                    disciplina: p.disciplina, aula: p.numero, data: formatarData(p.data),
                    professor: limparParaCSV(p.professor), dias_de_atraso: p.diasAtras,
                  })),
                  `chamadas-em-atraso-${turma?.curso}-${turma?.turno}`.replace(/[^\w-]/g, "_"),
                )}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>

          {pendentes.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Nenhuma chamada em atraso nesta turma.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Disciplina</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Aula</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Professor</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendentes.map(p => (
                    <tr key={`${p.disciplina}-${p.numero}`} className={p.diasAtras > 14 ? "bg-red-50" : "hover:bg-gray-50"}>
                      <td className="px-3 py-2 text-xs text-gray-700">{formatarData(p.data)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{p.disciplina}</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">{p.numero}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{p.professor ?? "—"}</td>
                      <td className={`px-3 py-2 text-right text-xs font-semibold ${p.diasAtras > 14 ? "text-red-600" : "text-amber-600"}`}>
                        {p.diasAtras === 0 ? "hoje" : `${p.diasAtras} dia${p.diasAtras > 1 ? "s" : ""}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-3 py-2 border-t">
                A mais antiga vem primeiro — é a que corre mais risco de ninguém lembrar o que foi dado.
                Vermelho: mais de duas semanas.
              </p>
            </div>
          )}
        </div>
      ) : aulasFechadas === 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-1">
          <p className="text-gray-700 font-medium">Nenhuma chamada finalizada nesta turma.</p>
          <p className="text-sm text-gray-500">
            {totalAulasDaTurma > 0
              ? `A turma tem ${totalAulasDaTurma} aulas na grade, mas nenhuma teve a chamada fechada ainda. Não há frequência a medir.`
              : "A turma ainda não tem aulas na grade."}
          </p>
          {pendentes.length > 0 && (
            <p className="text-sm text-amber-700 pt-1">
              {pendentes.length} aula(s) já aconteceram sem chamada — veja em <strong>Chamadas em atraso</strong>.
            </p>
          )}
        </div>
      ) : relatorio === "frequencia" ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Frequência por disciplina</p>
              <p className="text-xs text-gray-500">
                {resumo.alunos} aluno(s) × {resumo.disciplinas} disciplina(s) com chamada fechada.
                Mínimo exigido: {PRESENCA_MINIMA}% <strong>em cada matéria</strong>.
              </p>
            </div>
            <button
              onClick={() => baixarCSV(
                frequencia.map(l => ({
                  aluno: l.aluno, disciplina: l.disciplina, aulas_dadas: l.aulasDadas,
                  presencas: l.presencas, faltas: l.faltas, percentual: l.percentual,
                  situacao: l.abaixoDoMinimo ? "abaixo do minimo" : "ok",
                })),
                `frequencia-${turma?.curso}-${turma?.turno}`.replace(/[^\w-]/g, "_"),
              )}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          {resumo.emRisco > 0 ? (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-800">
              <strong>{resumo.emRisco} aluno(s) abaixo de {PRESENCA_MINIMA}%</strong> em ao menos uma
              disciplina: {resumo.nomesEmRisco.join(", ")}.
            </div>
          ) : (
            <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-800 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Ninguém abaixo do mínimo até aqui.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aluno</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Disciplina</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Aulas</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-green-600">Presenças</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-red-400">Faltas</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {frequencia.map(l => (
                  <tr key={`${l.alunoId}-${l.disciplinaId}`} className={l.abaixoDoMinimo ? "bg-red-50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2 text-xs font-medium text-gray-800">
                      {l.aluno}
                      {/* A situação ao lado do nome é o que permite ler o
                          relatório de um módulo já fechado sem se perguntar
                          por que ninguém está mais "cursando". */}
                      {situacaoPorAluno[l.alunoId] && situacaoPorAluno[l.alunoId] !== "cursando" && (
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${SITUACAO[situacaoPorAluno[l.alunoId]]?.cor ?? ""}`}>
                          {SITUACAO[situacaoPorAluno[l.alunoId]]?.rotulo ?? situacaoPorAluno[l.alunoId]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{l.disciplina}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{l.aulasDadas}</td>
                    <td className="px-3 py-2 text-center font-semibold text-green-600">{l.presencas}</td>
                    <td className="px-3 py-2 text-center font-semibold text-red-500">{l.faltas}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-bold ${l.abaixoDoMinimo ? "text-red-600" : "text-gray-700"}`}>
                        {l.percentual}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 px-3 py-2 border-t flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-400" />
            Vermelho = abaixo de {PRESENCA_MINIMA}%, o mesmo corte que retém o aluno na disciplina.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Diário de sala</p>
              <p className="text-xs text-gray-500">
                O que foi dado em cada aula já fechada. Quem escreve é o professor.
              </p>
            </div>
            <button
              onClick={() => baixarCSV(
                diario.map(d => ({
                  disciplina: d.disciplina, aula: d.numero, data: formatarData(d.data),
                  professor: limparParaCSV(d.professor), conteudo: limparParaCSV(d.conteudo),
                })),
                `diario-${turma?.curso}-${turma?.turno}`.replace(/[^\w-]/g, "_"),
              )}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          {/* O contador que existia aqui — "aulas fechadas sem conteúdo" — seria
              sempre zero: o banco impede fechar a chamada sem 30 caracteres de
              diário. A pendência real é a aula que passou e não foi fechada, e
              ela agora tem aba própria. */}
          {pendentes.length > 0 && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
              Faltam <strong>{pendentes.length} chamada(s)</strong> de aulas que já aconteceram —
              o diário delas ainda não existe.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Disciplina</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Aula</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Professor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Conteúdo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {diario.map(d => (
                  <tr key={`${d.disciplina}-${d.numero}`} className={d.semConteudo ? "bg-amber-50/60" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2 text-xs text-gray-700">{d.disciplina}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{d.numero}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatarData(d.data)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{d.professor ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {d.conteudo ?? <span className="text-amber-700 italic">não registrado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
