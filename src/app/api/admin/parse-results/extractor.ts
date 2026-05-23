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
  if (norm.includes("manha") || norm.includes("matutino")) return "Manhã";
  if (norm.includes("noite") || norm.includes("noturno")) return "Noite";
  return null;
}

function isApenasNumero(linha: string): boolean {
  return /^\d+[.\-)]*\s*$/.test(linha.trim());
}

function isCabecalhoTabela(linha: string): boolean {
  return /^(nº|no\.|nome|candidato|classificação|resultado|aprovad|reprovad|ord)/i.test(linha.trim());
}

function pareceNome(linha: string): boolean {
  const t = linha.trim();
  if (t.length < 5 || t.length > 100) return false;
  if (t.split(" ").length < 2) return false;
  if (/[<>{}\[\]|\\=+*&^%$#@!]/.test(t)) return false;
  // Evita linhas que são claramente títulos (muitas MAIÚSCULAS seguidas)
  const palavras = t.split(" ");
  const maiusculas = palavras.filter(p => p.length > 2 && p === p.toUpperCase()).length;
  if (maiusculas === palavras.length && t.length > 20) return false;
  return true;
}

export function extrairNomes(texto: string): CandidatoExtraido[] {
  const linhas = texto.split(/\r?\n/);
  const candidatos: CandidatoExtraido[] = [];

  let cursoAtual = "";
  let periodoAtual = "";
  let ordemContador = 1;

  // Pré-processa: junta número + nome quando estão em linhas separadas
  // Formato: "01\nJoão Silva" → "01 João Silva"
  const linhasProcessadas: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const atual = linhas[i].trim();
    const proxima = linhas[i + 1]?.trim() ?? "";

    if (isApenasNumero(atual) && pareceNome(proxima)) {
      // Número na linha atual + nome na próxima: junta
      linhasProcessadas.push(`${atual} ${proxima}`);
      i++; // pula a próxima
    } else {
      linhasProcessadas.push(atual);
    }
  }

  for (const linhaTrimada of linhasProcessadas) {
    // Linha vazia: NÃO reseta a seção, apenas continua
    if (linhaTrimada.length === 0) continue;

    // Ignorar cabeçalhos de tabela
    if (isCabecalhoTabela(linhaTrimada)) continue;

    // Ignorar números soltos (que não foram mesclados com nome)
    if (isApenasNumero(linhaTrimada)) continue;

    // Detectar seção — tenta curso E período na mesma linha
    const cursoDet = detectarCurso(linhaTrimada);
    if (cursoDet && linhaTrimada.length < 60) {
      cursoAtual = cursoDet;
      ordemContador = 1;

      const periodoDet = detectarPeriodo(linhaTrimada);
      if (periodoDet) {
        periodoAtual = periodoDet;
      } else {
        // Curso sem período na linha — período vem na próxima
        periodoAtual = "";
      }
      continue;
    }

    // Detectar apenas período
    const periodoDet = detectarPeriodo(linhaTrimada);
    if (periodoDet && linhaTrimada.length < 40) {
      periodoAtual = periodoDet;
      ordemContador = 1;
      continue;
    }

    // Sem seção definida ainda — pula
    if (!cursoAtual || !periodoAtual) continue;

    // Linha com número + nome na mesma linha ("1. João Silva")
    const matchComNumero = linhaTrimada.match(/^(\d+)[.\-)\s]+(.+)$/);
    if (matchComNumero) {
      const nome = matchComNumero[2].trim();
      if (pareceNome(nome)) {
        candidatos.push({
          curso: cursoAtual,
          periodo: periodoAtual,
          nome,
          ordem: parseInt(matchComNumero[1]),
        });
        continue;
      }
    }

    // Nome simples
    if (pareceNome(linhaTrimada)) {
      candidatos.push({
        curso: cursoAtual,
        periodo: periodoAtual,
        nome: linhaTrimada,
        ordem: ordemContador++,
      });
    }
  }

  return candidatos;
}
