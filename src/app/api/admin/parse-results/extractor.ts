export interface CandidatoExtraido {
  curso: string;
  periodo: string;
  nome: string;
  ordem: number;
}

function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function detectarCurso(linha: string): string | null {
  const norm = normalizarTexto(linha);
  if (norm.includes("animac")) return "Animação";
  if (norm.includes("cine") || norm.includes("tv")) return "Cine/TV";
  return null;
}

export function detectarPeriodo(linha: string): string | null {
  const norm = normalizarTexto(linha);
  if (norm.includes("manha") || norm.includes("manhã") || norm.includes("matutino")) return "Manhã";
  if (norm.includes("noite") || norm.includes("noturno")) return "Noite";
  return null;
}

function isLinhaVazia(linha: string): boolean {
  return linha.trim().length === 0;
}

function isNumeroOuCabecalho(linha: string): boolean {
  const norm = linha.trim();
  if (/^\d+[.\-)]?\s*$/.test(norm)) return true;
  if (/^(nº|no\.|nome|candidato|classificação|resultado|aprovad|reprovad)/i.test(norm)) return true;
  return false;
}

export function extrairNomes(texto: string): CandidatoExtraido[] {
  const linhas = texto.split(/\r?\n/);
  const candidatos: CandidatoExtraido[] = [];

  let cursoAtual = "";
  let periodoAtual = "";
  let ordem = 1;
  let dentroDeLista = false;

  for (const linha of linhas) {
    const linhaTrimada = linha.trim();

    if (isLinhaVazia(linhaTrimada)) {
      dentroDeLista = false;
      continue;
    }

    // Detectar seção de curso
    const cursoDet = detectarCurso(linhaTrimada);
    if (cursoDet && linhaTrimada.length < 60) {
      cursoAtual = cursoDet;
      ordem = 1;
      dentroDeLista = false;

      const periodoDet = detectarPeriodo(linhaTrimada);
      if (periodoDet) {
        periodoAtual = periodoDet;
        dentroDeLista = true;
      }
      continue;
    }

    // Detectar período
    const periodoDet = detectarPeriodo(linhaTrimada);
    if (periodoDet && linhaTrimada.length < 40) {
      periodoAtual = periodoDet;
      ordem = 1;
      dentroDeLista = true;
      continue;
    }

    // Ignorar cabeçalhos
    if (isNumeroOuCabecalho(linhaTrimada)) continue;

    // Linha com número + nome (ex: "1. João Silva" ou "1 João Silva")
    const matchComNumero = linhaTrimada.match(/^(\d+)[.\-)\s]+(.+)$/);
    if (matchComNumero && cursoAtual && periodoAtual) {
      const nome = matchComNumero[2].trim();
      const numOrdem = parseInt(matchComNumero[1]);
      if (nome.length > 3 && nome.split(" ").length >= 2) {
        candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome, ordem: numOrdem });
        dentroDeLista = true;
        continue;
      }
    }

    // Nome simples na lista
    if (
      dentroDeLista &&
      cursoAtual &&
      periodoAtual &&
      linhaTrimada.split(" ").length >= 2 &&
      linhaTrimada.length > 5 &&
      linhaTrimada.length < 100 &&
      !/[<>{}\[\]|\\=+*&^%$#@!]/.test(linhaTrimada)
    ) {
      candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome: linhaTrimada, ordem: ordem++ });
    }
  }

  return candidatos;
}
