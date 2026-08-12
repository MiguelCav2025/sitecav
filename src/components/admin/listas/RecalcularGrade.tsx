"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarClock, Check, Loader2, Lock, Plus, Trash2, ArrowRight } from "lucide-react";
import { semestreLetivo } from "@/lib/calendario-escolar";
import { planejarRecalculoDaGrade, resumirPlano, planoVazio, type PlanoRecalculo } from "@/lib/recalculo-grade";

interface Cronograma {
  id: string;
  semestre: string;
  data_inicio: string;
  data_fim: string;
  feriados: string[];
}

interface AulaDaGrade {
  id: string;
  numero: number;
  data_aula: string | null;
  chamada_aberta: boolean;
  turma: { id: string; turno: string; semestre: string };
  professor: { id: string; nome: string } | null;
}

const DIAS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
];

const formatarData = (iso: string | null) => {
  if (!iso) return "sem data";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Plano de uma turma, junto do contexto necessário para aplicá-lo. */
interface PlanoDaTurma {
  turmaId: string;
  rotulo: string;
  semestreLetivoDaTurma: string;
  cronograma: Cronograma | null;
  professorId: string | null;
  plano: PlanoRecalculo | null;
}

/**
 * Permite ao coordenador acertar o dia da semana e o total de aulas de uma
 * disciplina depois de criada, e reposicionar as datas quando os feriados do
 * cronograma mudam.
 *
 * A regra que governa tudo: **aula com chamada fechada nunca é tocada**. Ela é
 * o registro do que aconteceu. Nada é gravado sem o coordenador ver antes,
 * turma por turma, exatamente o que vai mudar.
 */
export default function RecalcularGrade({
  disciplina,
  aulas,
  cronogramas,
  onAplicado,
}: {
  disciplina: { id: string; nome: string; dia_da_semana: number | null; total_aulas: number; semestre_do_curso: number };
  aulas: AulaDaGrade[];
  cronogramas: Cronograma[];
  onAplicado: () => void;
}) {
  const supabase = createClient();
  const [dia, setDia] = useState(String(disciplina.dia_da_semana ?? ""));
  const [total, setTotal] = useState(String(disciplina.total_aulas));
  const [previa, setPrevia] = useState<PlanoDaTurma[] | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const turmas = useMemo(() => {
    const mapa = new Map<string, AulaDaGrade["turma"]>();
    for (const a of aulas) if (!mapa.has(a.turma.id)) mapa.set(a.turma.id, a.turma);
    return [...mapa.values()];
  }, [aulas]);

  const diaNum = Number(dia);
  const totalNum = Number(total);
  const parametrosValidos = DIAS.some(d => d.value === dia) && Number.isInteger(totalNum) && totalNum >= 1;

  const calcularPrevia = () => {
    setErro(null);
    const planos: PlanoDaTurma[] = turmas.map(turma => {
      const semLetivo = semestreLetivo(turma.semestre, disciplina.semestre_do_curso);
      const cronograma = cronogramas.find(c => c.semestre === semLetivo) ?? null;
      const aulasDaTurma = aulas.filter(a => a.turma.id === turma.id);
      const professorId = aulasDaTurma.find(a => a.professor?.id)?.professor?.id ?? null;

      return {
        turmaId: turma.id,
        rotulo: `${turma.turno} — entrada ${turma.semestre}`,
        semestreLetivoDaTurma: semLetivo,
        cronograma,
        professorId,
        plano: cronograma
          ? planejarRecalculoDaGrade(aulasDaTurma, {
              periodo: cronograma,
              diaDaSemana: diaNum,
              totalAulas: totalNum,
            })
          : null,
      };
    });
    setPrevia(planos);
  };

  const aplicar = async () => {
    if (!previa) return;
    setAplicando(true);
    setErro(null);

    try {
      for (const item of previa) {
        if (!item.plano) continue;
        const { atualizar, criar, remover } = item.plano;

        for (const a of atualizar) {
          const { error } = await supabase.from("aulas").update({ data_aula: a.para }).eq("id", a.id);
          if (error) throw new Error(`Aula ${a.numero} de ${item.rotulo}: ${error.message}`);
        }

        if (remover.length > 0) {
          const { error } = await supabase.from("aulas").delete().in("id", remover.map(r => r.id));
          if (error) throw new Error(`Ao remover aulas de ${item.rotulo}: ${error.message}`);
        }

        if (criar.length > 0) {
          const { error } = await supabase.from("aulas").insert(
            criar.map(c => ({
              turma_id: item.turmaId,
              disciplina_id: disciplina.id,
              numero: c.numero,
              data_aula: c.data_aula,
              professor_id: item.professorId,
              semana: Math.ceil(c.numero / 3),
            })),
          );
          if (error) throw new Error(`Ao criar aulas de ${item.rotulo}: ${error.message}`);
        }
      }

      const { error } = await supabase
        .from("disciplinas")
        .update({ dia_da_semana: diaNum, total_aulas: totalNum })
        .eq("id", disciplina.id);
      if (error) throw new Error(`Ao salvar a disciplina: ${error.message}`);

      setPrevia(null);
      onAplicado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao aplicar.");
    } finally {
      setAplicando(false);
    }
  };

  const nadaMuda = previa?.every(p => !p.plano || planoVazio(p.plano)) ?? false;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-gray-800">Acertar a grade</h4>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Mudou feriado no cronograma, ou o dia da aula? Recalcule as datas aqui.
        Aulas com chamada já fechada nunca são alteradas.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-700">Dia da semana</Label>
          <Select value={dia} onValueChange={v => { setDia(v); setPrevia(null); }}>
            <SelectTrigger className="text-gray-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-700">Total de aulas</Label>
          <Input
            type="number"
            min="1"
            className="text-gray-800"
            value={total}
            onChange={e => { setTotal(e.target.value); setPrevia(null); }}
          />
        </div>
      </div>

      {!previa && (
        <Button size="sm" variant="outline" onClick={calcularPrevia} disabled={!parametrosValidos}>
          Ver o que muda
        </Button>
      )}

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {previa && (
        <div className="mt-4 space-y-3">
          {previa.map(item => (
            <div key={item.turmaId} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm font-semibold text-gray-800">{item.rotulo}</p>

              {!item.cronograma ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Sem cronograma cadastrado para o semestre {item.semestreLetivoDaTurma || "?"} — nada a recalcular.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-gray-500">{resumirPlano(item.plano!)}</p>

                  {item.plano!.avisos.map((aviso, i) => (
                    <p key={i} className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {aviso}
                    </p>
                  ))}

                  <ul className="mt-2 space-y-1 text-xs">
                    {item.plano!.atualizar.map(a => (
                      <li key={a.id} className="flex items-center gap-1.5 text-gray-600">
                        <ArrowRight className="h-3 w-3 shrink-0 text-blue-500" />
                        Aula {a.numero}: {formatarData(a.de)} <span className="text-gray-400">→</span>{" "}
                        <strong className="font-semibold text-gray-800">{formatarData(a.para)}</strong>
                      </li>
                    ))}
                    {item.plano!.criar.map(c => (
                      <li key={`novo-${c.numero}`} className="flex items-center gap-1.5 text-green-700">
                        <Plus className="h-3 w-3 shrink-0" /> Aula {c.numero} será criada em {formatarData(c.data_aula)}
                      </li>
                    ))}
                    {item.plano!.remover.map(r => (
                      <li key={r.id} className="flex items-center gap-1.5 text-red-700">
                        <Trash2 className="h-3 w-3 shrink-0" /> Aula {r.numero} será removida
                      </li>
                    ))}
                    {item.plano!.preservadas.length > 0 && (
                      <li className="flex items-center gap-1.5 text-gray-400">
                        <Lock className="h-3 w-3 shrink-0" />
                        {item.plano!.preservadas.length} aula(s) com chamada fechada permanecem como estão
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={aplicar} disabled={aplicando || nadaMuda}>
              {aplicando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {nadaMuda ? "Nada a aplicar" : "Aplicar mudanças"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPrevia(null)} disabled={aplicando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
