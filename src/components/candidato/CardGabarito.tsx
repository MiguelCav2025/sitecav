import { ClipboardCheck } from "lucide-react";

export interface GabaritoPublicado {
  id: string;
  semestre: string;
  curso: string | null;
  titulo: string | null;
  observacao: string | null;
  itens: { numero: number; resposta: string }[];
}

/**
 * Gabarito da prova, no topo da página de resultados, para o candidato
 * conferir as próprias respostas.
 */
export default function CardGabarito({ gabaritos }: { gabaritos: GabaritoPublicado[] }) {
  const comItens = gabaritos.filter(g => g.itens.length > 0);
  if (comItens.length === 0) return null;

  return (
    <div className="mx-auto mb-12 max-w-4xl space-y-6">
      {comItens.map(g => (
        <section key={g.id} className="rounded-2xl bg-white p-6 shadow-2xl md:p-8">
          <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <ClipboardCheck className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-900">
                  {g.titulo || "Gabarito da prova"}
                </h2>
                <p className="text-sm text-gray-500">
                  {g.semestre}
                  {g.curso && ` · ${g.curso}`}
                  {` · ${g.itens.length} questões`}
                </p>
              </div>
            </div>
            {!g.curso && (
              <span className="self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:self-auto">
                Válido para os dois cursos
              </span>
            )}
          </header>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {g.itens.map(item => (
              <li
                key={item.numero}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-900 text-xs font-bold text-white">
                  {item.numero}
                </span>
                <span className="min-w-0 break-words text-sm font-semibold text-gray-800">
                  {item.resposta}
                </span>
              </li>
            ))}
          </ul>

          {g.observacao && (
            <p className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-600">
              {g.observacao}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
