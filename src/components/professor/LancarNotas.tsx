"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronDown, ChevronUp, Loader2, Wand2 } from "lucide-react";
import { NOTA_MINIMA } from "@/lib/aprovacao";
import { buscarAlunosDaTurma } from "@/lib/matriculas";

interface Aluno {
  id: string;
  nome: string;
}

/** O que o professor digita para um aluno. Tudo texto: o campo aceita vírgula. */
interface Lancamento {
  final: string;
  n1: string;
  n2: string;
  n3: string;
  n4: string;
}

const vazio = (): Lancamento => ({ final: "", n1: "", n2: "", n3: "", n4: "" });
const PARCIAIS = ["n1", "n2", "n3", "n4"] as const;

const paraNumero = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const foraDaFaixa = (v: string) => {
  const n = paraNumero(v);
  return n !== null && (Number.isNaN(n) || n < 0 || n > 10);
};

/** Média das parciais preenchidas, arredondada a uma casa. */
function mediaDasParciais(l: Lancamento): number | null {
  const valores = PARCIAIS
    .map(p => paraNumero(l[p]))
    .filter((n): n is number => n !== null && !Number.isNaN(n));
  if (valores.length === 0) return null;
  const soma = valores.reduce((s, n) => s + n, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

/**
 * Lançamento das notas de uma disciplina numa turma.
 *
 * A **nota final** é a que decide a aprovação e é a que o coordenador precisa.
 * As quatro parciais são opcionais e servem de apoio: se preenchidas, o botão
 * sugere a média, mas quem manda é o que o professor gravar como final.
 *
 * A nota pode ser corrigida depois de salva, diferente da chamada (D33).
 */
export default function LancarNotas({
  disciplinaId,
  turmaId,
  professorId,
}: {
  disciplinaId: string;
  turmaId: string;
  professorId: string;
}) {
  const supabase = createClient();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [lancamentos, setLancamentos] = useState<Record<string, Lancamento>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      const [{ alunos: daTurma }, { data: notasData }] = await Promise.all([
        buscarAlunosDaTurma(supabase, turmaId),
        supabase.from("notas_disciplina")
          .select("aluno_id, nota, nota1, nota2, nota3, nota4")
          .eq("disciplina_id", disciplinaId).eq("turma_id", turmaId),
      ]);

      setAlunos(daTurma.map(a => ({ id: a.id, nome: a.nome })));

      const mapa: Record<string, Lancamento> = {};
      for (const n of (notasData ?? []) as Record<string, number | null>[]) {
        const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
        mapa[n.aluno_id as unknown as string] = {
          final: texto(n.nota), n1: texto(n.nota1), n2: texto(n.nota2),
          n3: texto(n.nota3), n4: texto(n.nota4),
        };
      }
      setLancamentos(mapa);
      setCarregando(false);
    };
    carregar();
  }, [disciplinaId, turmaId, supabase]);

  const alterar = (alunoId: string, campo: keyof Lancamento, valor: string) => {
    setLancamentos(prev => ({
      ...prev,
      [alunoId]: { ...(prev[alunoId] ?? vazio()), [campo]: valor },
    }));
    setSalvoEm(null);
  };

  const usarMedia = (alunoId: string) => {
    const media = mediaDasParciais(lancamentos[alunoId] ?? vazio());
    if (media === null) return;
    alterar(alunoId, "final", String(media).replace(".", ","));
  };

  const temInvalida = Object.values(lancamentos).some(
    l => foraDaFaixa(l.final) || PARCIAIS.some(p => foraDaFaixa(l[p])),
  );

  const salvar = async () => {
    if (temInvalida) return setErro("Há nota fora da faixa de 0 a 10.");
    setErro(null);
    setSalvando(true);

    const num = (v: string) => {
      const n = paraNumero(v);
      return n === null || Number.isNaN(n) ? null : n;
    };

    const comFinal = Object.entries(lancamentos).filter(([, l]) => num(l.final) !== null);
    const semFinal = Object.entries(lancamentos).filter(([, l]) => num(l.final) === null).map(([id]) => id);

    if (comFinal.length > 0) {
      const { error } = await supabase.from("notas_disciplina").upsert(
        comFinal.map(([aluno_id, l]) => ({
          aluno_id,
          disciplina_id: disciplinaId,
          turma_id: turmaId,
          nota: num(l.final),
          nota1: num(l.n1), nota2: num(l.n2), nota3: num(l.n3), nota4: num(l.n4),
          lancada_por: professorId,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "aluno_id,disciplina_id,turma_id" },
      );
      if (error) { setErro(`Não foi possível salvar: ${error.message}`); setSalvando(false); return; }
    }

    // Final apagada significa retirar a nota, não gravar zero
    if (semFinal.length > 0) {
      const { error } = await supabase.from("notas_disciplina").delete()
        .eq("disciplina_id", disciplinaId).eq("turma_id", turmaId).in("aluno_id", semFinal);
      if (error) { setErro(`Não foi possível remover notas apagadas: ${error.message}`); setSalvando(false); return; }
    }

    setSalvando(false);
    setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  };

  if (carregando) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div>;
  }

  if (alunos.length === 0) {
    return <div className="rounded-xl bg-white/10 p-6 text-center text-white/60">Nenhum aluno matriculado nesta turma.</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/60">
        A <strong className="text-white">nota final</strong> é a que vale. As parciais são opcionais —
        toque na seta para abri-las e usar a média como sugestão.
      </p>

      {erro && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/20 p-3 text-sm text-red-100">{erro}</div>
      )}

      <div className="space-y-2">
        {alunos.map(aluno => {
          const l = lancamentos[aluno.id] ?? vazio();
          const aberto = abertos[aluno.id] ?? false;
          const invalida = foraDaFaixa(l.final);
          const nFinal = paraNumero(l.final);
          const abaixo = nFinal !== null && !Number.isNaN(nFinal) && nFinal < NOTA_MINIMA;
          const media = mediaDasParciais(l);

          return (
            <div key={aluno.id} className="rounded-xl border border-white/20 bg-white/10">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setAbertos(p => ({ ...p, [aluno.id]: !aberto }))}
                  aria-label={aberto ? "Fechar parciais" : "Abrir parciais"}
                  className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                <span className="min-w-0 flex-1 truncate font-medium text-white">{aluno.nome}</span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={l.final}
                  onChange={e => alterar(aluno.id, "final", e.target.value)}
                  placeholder="—"
                  aria-label={`Nota final de ${aluno.nome}`}
                  className={`w-20 shrink-0 rounded-lg px-3 py-2 text-center text-base font-semibold focus:outline-none focus:ring-2
                    ${invalida
                      ? "bg-red-100 text-red-800 ring-2 ring-red-400"
                      : abaixo
                        ? "bg-amber-100 text-amber-900 focus:ring-orange-400"
                        : "bg-white/95 text-gray-900 focus:ring-orange-400"}`}
                />
              </div>

              {aberto && (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <div className="grid grid-cols-4 gap-2">
                    {PARCIAIS.map((p, i) => (
                      <div key={p}>
                        <label className="mb-1 block text-center text-[11px] text-white/50">Nota {i + 1}</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={l[p]}
                          onChange={e => alterar(aluno.id, p, e.target.value)}
                          placeholder="—"
                          className={`w-full rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
                            ${foraDaFaixa(l[p]) ? "bg-red-100 text-red-800 ring-2 ring-red-400" : "bg-white/95 text-gray-900"}`}
                        />
                      </div>
                    ))}
                  </div>

                  {media !== null && (
                    <button
                      type="button"
                      onClick={() => usarMedia(aluno.id)}
                      className="mt-2 flex items-center gap-1.5 text-xs text-orange-300 hover:text-orange-200"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      Usar a média das parciais ({String(media).replace(".", ",")}) como nota final
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={salvar}
          disabled={salvando || temInvalida}
          className="flex-1 bg-orange-500 py-6 text-base font-bold text-white hover:bg-orange-600"
        >
          {salvando ? "Salvando..." : "Salvar notas"}
        </Button>
        {salvoEm && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-green-300">
            <CheckCircle className="h-4 w-4" /> {salvoEm}
          </span>
        )}
      </div>
    </div>
  );
}
