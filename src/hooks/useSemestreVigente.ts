"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { semestreVigente, type PeriodoDoSemestre } from "@/lib/calendario-escolar";

/**
 * Qual semestre letivo está valendo, segundo o calendário cadastrado.
 *
 * Existe porque o módulo de uma turma depende disso, e antes a resposta era
 * chutada no código: "antes de julho é o 1º semestre, depois é o 2º". Este ano
 * o semestre começou em 3 de agosto — de 1º de julho até lá, o sistema
 * mostrava a turma inteira um módulo à frente do que ela estava.
 *
 * `null` enquanto carrega ou quando não há calendário cadastrado. Quem consome
 * precisa tratar os dois: sem semestre vigente, o módulo é desconhecido, e
 * mostrar um número inventado seria pior do que mostrar nada.
 */
export function useSemestreVigente(): { semestre: string | null; carregando: boolean } {
  const [semestre, setSemestre] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("cronogramas")
      .select("semestre, data_inicio, data_fim")
      .then(({ data }) => {
        const hoje = new Date().toISOString().slice(0, 10);
        setSemestre(semestreVigente((data ?? []) as PeriodoDoSemestre[], hoje));
        setCarregando(false);
      });
  }, []);

  return { semestre, carregando };
}
