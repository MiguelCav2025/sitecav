import { createBrowserClient } from '@supabase/ssr'

/**
 * O cliente do navegador, um só para a aba inteira.
 *
 * Antes cada chamada criava um objeto novo. Como os componentes fazem
 * `const supabase = createClient()` no corpo, a identidade mudava a cada
 * render — e todo `useCallback`/`useEffect` que tem `supabase` nas
 * dependências passava a rodar de novo, buscando os mesmos dados, o que
 * causava outro render. Era o "carrega e um segundo depois recarrega" que
 * aparecia ao trocar de aba.
 *
 * Guardar a instância também preserva a sessão e o canal de refresh do token,
 * em vez de recriá-los a cada render.
 */
// O tipo sai daqui, e não de `ReturnType<typeof createBrowserClient>`: aquele
// perde os genéricos e faz todo `.then(({ data }) => ...)` do projeto virar
// `any`, apagando a checagem justamente onde ela mais serve.
function novoCliente() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let instancia: ReturnType<typeof novoCliente> | null = null

export function createClient() {
  instancia ??= novoCliente()
  return instancia
}