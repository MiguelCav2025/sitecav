"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { NOTA_MINIMA } from "@/lib/aprovacao";
import { buscarAlunosDaTurma } from "@/lib/matriculas";

interface Aluno {
  id: string;
  nome: string;
}

/**
 * Lançamento das notas de uma disciplina numa turma.
 *
 * Diferente da chamada, a nota **pode ser corrigida** depois (D33): o campo
 * continua aberto e o professor regrava quando quiser.
 *
 * O professor vê apenas a nota que ele mesmo atribui. A nota da banca e a
 * média final são do coordenador (D37).
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
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      const [{ alunos: daTurma }, { data: notasData }] = await Promise.all([
        buscarAlunosDaTurma(supabase, turmaId),
        supabase.from("notas_disciplina").select("aluno_id, nota")
          .eq("disciplina_id", disciplinaId).eq("turma_id", turmaId),
      ]);

      setAlunos(daTurma.map(a => ({ id: a.id, nome: a.nome })));
      const mapa: Record<string, string> = {};
      for (const n of notasData ?? []) {
        mapa[(n as { aluno_id: string }).aluno_id] = String((n as { nota: number }).nota);
      }
      setNotas(mapa);
      setCarregando(false);
    };
    carregar();
  }, [disciplinaId, turmaId, supabase]);

  const alterar = (alunoId: string, valor: string) => {
    // Aceita vírgula, que é como se digita nota no Brasil
    setNotas(prev => ({ ...prev, [alunoId]: valor.replace(",", ".") }));
    setSalvoEm(null);
  };

  const notaInvalida = (valor: string) => {
    if (valor.trim() === "") return false;
    const n = Number(valor);
    return !Number.isFinite(n) || n < 0 || n > 10;
  };

  const temInvalida = Object.values(notas).some(notaInvalida);

  const salvar = async () => {
    if (temInvalida) {
      setErro("Há nota fora da faixa de 0 a 10.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const preenchidas = Object.entries(notas).filter(([, v]) => v.trim() !== "");
    const vazias = Object.entries(notas).filter(([, v]) => v.trim() === "").map(([id]) => id);

    if (preenchidas.length > 0) {
      const { error } = await supabase.from("notas_disciplina").upsert(
        preenchidas.map(([aluno_id, valor]) => ({
          aluno_id,
          disciplina_id: disciplinaId,
          turma_id: turmaId,
          nota: Number(valor),
          lancada_por: professorId,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "aluno_id,disciplina_id,turma_id" },
      );
      if (error) {
        setErro(`Não foi possível salvar: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    // Campo esvaziado significa retirar a nota lançada antes
    if (vazias.length > 0) {
      const { error } = await supabase.from("notas_disciplina").delete()
        .eq("disciplina_id", disciplinaId).eq("turma_id", turmaId).in("aluno_id", vazias);
      if (error) {
        setErro(`Não foi possível remover notas apagadas: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);
    setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (alunos.length === 0) {
    return (
      <div className="rounded-xl bg-white/10 p-6 text-center text-white/60">
        Nenhum aluno cadastrado nesta turma.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/60">
        Nota de 0 a 10. A média com a banca e a situação final ficam com a coordenação.
        Você pode corrigir uma nota depois de salvar.
      </p>

      {erro && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/20 p-3 text-sm text-red-100">
          {erro}
        </div>
      )}

      <div className="space-y-2">
        {alunos.map(aluno => {
          const valor = notas[aluno.id] ?? "";
          const invalida = notaInvalida(valor);
          const abaixo = valor !== "" && !invalida && Number(valor) < NOTA_MINIMA;
          return (
            <div
              key={aluno.id}
              className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-white">{aluno.nome}</span>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={e => alterar(aluno.id, e.target.value)}
                placeholder="—"
                aria-label={`Nota de ${aluno.nome}`}
                className={`w-20 shrink-0 rounded-lg px-3 py-2 text-center text-base font-semibold focus:outline-none focus:ring-2
                  ${invalida
                    ? "bg-red-100 text-red-800 ring-2 ring-red-400"
                    : abaixo
                      ? "bg-amber-100 text-amber-900 focus:ring-orange-400"
                      : "bg-white/95 text-gray-900 focus:ring-orange-400"}`}
              />
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
