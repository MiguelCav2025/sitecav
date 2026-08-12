"use client";

import { AREAS, areaDaSecao, type SecaoAdmin } from "@/lib/admin-navegacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Navegação do painel em dois níveis: primeiro a área (Site, Escola,
 * Sistema), depois a seção. Antes eram 13 opções num dropdown único,
 * misturando o site institucional com a gestão da escola.
 */
export default function NavegacaoAdmin({
  secao,
  onSelecionar,
}: {
  secao: string;
  onSelecionar: (secao: string) => void;
}) {
  const area = areaDaSecao(secao);
  const secaoAtual = area.secoes.find(s => s.value === secao);

  return (
    <nav className="space-y-4">
      {/* Nível 1 — área */}
      <div className="flex flex-wrap gap-2">
        {AREAS.map(a => {
          const ativa = a.value === area.value;
          const Icone = a.icone;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onSelecionar(a.secoes[0].value)}
              aria-current={ativa ? "true" : undefined}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                ativa
                  ? "bg-orange-500 text-white shadow"
                  : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              }`}
            >
              <Icone className="h-4 w-4 shrink-0" />
              {a.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-blue-200">{area.ajuda}</p>

      {/* Nível 2 — seção. No celular vira lista suspensa. */}
      <div className="sm:hidden">
        <Select value={secao} onValueChange={onSelecionar}>
          <SelectTrigger className="min-h-12 w-full rounded-lg border border-gray-400 bg-white px-4 text-base font-semibold text-gray-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {area.secoes.map(s => (
              <SelectItem key={s.value} value={s.value} className="font-semibold">
                {s.passo ? `${s.passo}. ${s.label}` : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="hidden flex-wrap gap-2 sm:flex">
        {area.secoes.map(s => (
          <li key={s.value}>
            <BotaoSecao secao={s} ativa={s.value === secao} onSelecionar={onSelecionar} />
          </li>
        ))}
      </ul>

      {secaoAtual && (
        <p className="text-xs text-blue-200/70">{secaoAtual.ajuda}</p>
      )}
    </nav>
  );
}

function BotaoSecao({
  secao,
  ativa,
  onSelecionar,
}: {
  secao: SecaoAdmin;
  ativa: boolean;
  onSelecionar: (secao: string) => void;
}) {
  const Icone = secao.icone;
  return (
    <button
      type="button"
      onClick={() => onSelecionar(secao.value)}
      title={secao.ajuda}
      aria-current={ativa ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        ativa
          ? "bg-white font-semibold text-gray-900 shadow-sm"
          : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
      }`}
    >
      {secao.passo !== undefined ? (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            ativa ? "bg-blue-900 text-white" : "bg-white/20 text-white"
          }`}
        >
          {secao.passo}
        </span>
      ) : (
        <Icone className="h-4 w-4 shrink-0" />
      )}
      {secao.label}
    </button>
  );
}
