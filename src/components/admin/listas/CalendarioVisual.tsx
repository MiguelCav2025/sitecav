"use client";

import { feriadosNoPeriodo } from "@/lib/feriados";

/**
 * O semestre desenhado mês a mês.
 *
 * Uma lista de datas soltas não responde as perguntas que o coordenador faz de
 * verdade: "a emenda do aniversário está marcada?", "sobrou alguma semana sem
 * aula nenhuma?", "por que esta disciplina tem 17 e a outra 19?". Vendo o mês,
 * as respostas ficam óbvias — e um feriado digitado no dia errado salta aos
 * olhos, coisa que numa lista de `20/08/2026` não acontece.
 */

const DIAS_CABECALHO = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Os meses tocados pelo período, do primeiro ao último. */
function mesesDoPeriodo(inicio: string, fim: string): { ano: number; mes: number }[] {
  const [anoI, mesI] = inicio.split("-").map(Number);
  const [anoF, mesF] = fim.split("-").map(Number);

  const saida: { ano: number; mes: number }[] = [];
  let ano = anoI, mes = mesI;
  // O teto evita laço infinito se as datas vierem invertidas.
  while ((ano < anoF || (ano === anoF && mes <= mesF)) && saida.length < 24) {
    saida.push({ ano, mes });
    if (mes === 12) { mes = 1; ano++; } else mes++;
  }
  return saida;
}

type Celula = { dia: number; data: string; tipo: string; titulo?: string } | null;

/** Quebra as células em linhas de sete, completando a última semana. */
function semanas(celulas: Celula[]): Celula[][] {
  const linhas: Celula[][] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    const linha = celulas.slice(i, i + 7);
    while (linha.length < 7) linha.push(null);
    linhas.push(linha);
  }
  return linhas;
}

export default function CalendarioVisual({
  inicio,
  fim,
  feriados,
}: {
  inicio: string;
  fim: string;
  feriados: readonly string[];
}) {
  if (!inicio || !fim || inicio > fim) return null;

  const marcados = new Set(feriados);
  const conhecidos = new Map(feriadosNoPeriodo(inicio, fim).map(f => [f.data, f.nome]));

  let letivos = 0;

  const meses = mesesDoPeriodo(inicio, fim).map(({ ano, mes }) => {
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
    const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const vazios = primeiro.getUTCDay();

    const celulas: Celula[] = Array.from({ length: vazios }, () => null);

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const data = iso(ano, mes, dia);
      const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
      const dentro = data >= inicio && data <= fim;
      const fimDeSemana = dow === 0 || dow === 6;

      let tipo = "fora";
      let titulo: string | undefined;

      if (!dentro) tipo = "fora";
      else if (fimDeSemana) tipo = "fds";
      else if (marcados.has(data)) {
        tipo = "feriado";
        titulo = conhecidos.get(data) ?? "Data da escola";
      } else { tipo = "letivo"; letivos++; }

      celulas.push({ dia, data, tipo, titulo });
    }

    return { ano, mes, celulas };
  });

  const CORES: Record<string, string> = {
    letivo:  "bg-green-100 text-green-800",
    feriado: "bg-red-100 text-red-700 font-semibold",
    fds:     "text-gray-300",
    fora:    "text-gray-200",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-200" />
          {letivos} dias de aula
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-200" />
          {feriados.length} sem aula
        </span>
        <span className="text-gray-400">Passe o mouse num dia vermelho para ver o motivo.</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map(({ ano, mes, celulas }) => (
          <div key={`${ano}-${mes}`} className="rounded-lg border border-gray-200 p-2">
            <p className="mb-1 text-center text-xs font-semibold capitalize text-gray-600">
              {MESES[mes - 1]} <span className="font-normal text-gray-400">{ano}</span>
            </p>

            {/* Tabela, e não grid: um calendário É uma tabela, e assim as sete
                colunas não dependem de nenhuma classe utilitária pegar. */}
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  {DIAS_CABECALHO.map((d, i) => (
                    <th key={i} className="pb-1 text-center text-[10px] font-normal text-gray-400">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanas(celulas).map((semana, i) => (
                  <tr key={i}>
                    {semana.map((c, j) =>
                      c === null ? (
                        <td key={`v${j}`} />
                      ) : (
                        <td key={c.data} className="p-px">
                          <span
                            title={c.titulo}
                            className={`block rounded py-0.5 text-center text-[11px] leading-4 ${CORES[c.tipo]} ${
                              c.tipo === "feriado" ? "cursor-help" : ""}`}
                          >
                            {c.dia}
                          </span>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
