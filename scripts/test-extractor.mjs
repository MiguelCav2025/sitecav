/**
 * Teste da função de extração de nomes do processo seletivo.
 * Rodas com: node scripts/test-extractor.mjs
 *
 * Simula diferentes formatos de DOCX que podem chegar.
 */

// --- Copia inline da lógica (sem depender do TS) ---

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function detectarCurso(linha) {
  const norm = normalizarTexto(linha);
  if (norm.includes("animac")) return "Animação";
  if (norm.includes("cine") || norm.includes("tv")) return "Cine/TV";
  return null;
}

function detectarPeriodo(linha) {
  const norm = normalizarTexto(linha);
  if (norm.includes("manha") || norm.includes("matutino")) return "Manhã";
  if (norm.includes("noite") || norm.includes("noturno")) return "Noite";
  return null;
}

function isLinhaVazia(linha) {
  return linha.trim().length === 0;
}

function isNumeroOuCabecalho(linha) {
  const norm = linha.trim();
  if (/^\d+[.\-)]?\s*$/.test(norm)) return true;
  if (/^(nº|no\.|nome|candidato|classificação|resultado|aprovad|reprovad)/i.test(norm)) return true;
  return false;
}

function extrairNomes(texto) {
  const linhas = texto.split(/\r?\n/);
  const candidatos = [];
  let cursoAtual = "";
  let periodoAtual = "";
  let ordem = 1;
  let dentroDeLista = false;

  for (const linha of linhas) {
    const linhaTrimada = linha.trim();
    if (isLinhaVazia(linhaTrimada)) { dentroDeLista = false; continue; }

    const cursoDet = detectarCurso(linhaTrimada);
    if (cursoDet && linhaTrimada.length < 60) {
      cursoAtual = cursoDet; ordem = 1; dentroDeLista = false;
      const periodoDet = detectarPeriodo(linhaTrimada);
      if (periodoDet) { periodoAtual = periodoDet; dentroDeLista = true; }
      continue;
    }

    const periodoDet = detectarPeriodo(linhaTrimada);
    if (periodoDet && linhaTrimada.length < 40) {
      periodoAtual = periodoDet; ordem = 1; dentroDeLista = true; continue;
    }

    if (isNumeroOuCabecalho(linhaTrimada)) continue;

    const matchComNumero = linhaTrimada.match(/^(\d+)[.\-)\s]+(.+)$/);
    if (matchComNumero && cursoAtual && periodoAtual) {
      const nome = matchComNumero[2].trim();
      if (nome.length > 3 && nome.split(" ").length >= 2) {
        candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome, ordem: parseInt(matchComNumero[1]) });
        dentroDeLista = true; continue;
      }
    }

    if (dentroDeLista && cursoAtual && periodoAtual &&
      linhaTrimada.split(" ").length >= 2 &&
      linhaTrimada.length > 5 && linhaTrimada.length < 100 &&
      !/[<>{}\[\]|\\=+*&^%$#@!]/.test(linhaTrimada)) {
      candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome: linhaTrimada, ordem: ordem++ });
    }
  }
  return candidatos;
}

// --- Utilitários de teste ---

let passou = 0;
let falhou = 0;

function assert(descricao, condicao, detalhes) {
  if (condicao) {
    console.log(`  ✅ ${descricao}`);
    passou++;
  } else {
    console.error(`  ❌ ${descricao}`);
    if (detalhes) console.error(`     → ${detalhes}`);
    falhou++;
  }
}

function secao(titulo) {
  console.log(`\n📋 ${titulo}`);
}

// ─── CASO 1: Formato simples com cabeçalhos separados ─────────────────────────
secao("Caso 1: Formato simples — cabeçalhos separados, nomes em lista");

const caso1 = `
RESULTADO DO PROCESSO SELETIVO CAV 2026/1

ANIMAÇÃO
Manhã
Danil Kallai Meneses Mugnani
Daniele Correia da Cunha
Elias Tomé Junior
Gabriel Morais Lemes

Noite
Adilson Carvalho Lins
Ana Clara Lima Manoel
Bruno Eduardo da Silva Lima

CINE/TV
Manhã
Amanda de Andrade Braga
Anna Clara de Oliveira Silva
Beatriz Seifert da Rocha

Noite
Amanda Silva Mendes
Anita Sampaio Zanutto
André Luiz Ferreira Luciano
`;

const r1 = extrairNomes(caso1);
assert("Animação/Manhã tem 4 candidatos", r1.filter(c => c.curso === "Animação" && c.periodo === "Manhã").length === 4,
  `encontrou: ${r1.filter(c => c.curso === "Animação" && c.periodo === "Manhã").length}`);
assert("Animação/Noite tem 3 candidatos", r1.filter(c => c.curso === "Animação" && c.periodo === "Noite").length === 3);
assert("Cine/TV Manhã tem 3 candidatos", r1.filter(c => c.curso === "Cine/TV" && c.periodo === "Manhã").length === 3);
assert("Cine/TV Noite tem 3 candidatos", r1.filter(c => c.curso === "Cine/TV" && c.periodo === "Noite").length === 3);
assert("Total: 13 candidatos", r1.length === 13, `encontrou: ${r1.length}`);
assert("Não inclui o título 'RESULTADO DO PROCESSO'", !r1.some(c => c.nome.includes("RESULTADO")));

// ─── CASO 2: Formato numerado ──────────────────────────────────────────────────
secao("Caso 2: Formato com numeração (1. Nome, 2. Nome...)");

const caso2 = `
Animação - Manhã

1. Gabriel Silva Scheffer Mori
2. Janine Ierullo Silva
3. Katrina Pietra Gonçalves de Almeida
4. Luiza Rodrigues Pacca

Animação - Noite

1. Danilo Koji da Silva Mesquita
2. Davi Abreu De Carvalho
3. Gabriel Alberto Ferreira
`;

const r2 = extrairNomes(caso2);
assert("Detecta curso e período na mesma linha (Animação - Manhã)", r2.filter(c => c.curso === "Animação" && c.periodo === "Manhã").length === 4,
  `encontrou: ${r2.filter(c => c.curso === "Animação" && c.periodo === "Manhã").length}`);
assert("Detecta curso e período na mesma linha (Animação - Noite)", r2.filter(c => c.curso === "Animação" && c.periodo === "Noite").length === 3);
assert("Nome não inclui o número", !r2.some(c => /^\d+\./.test(c.nome)));
assert("Ordem preservada nos numerados", r2.find(c => c.nome === "Janine Ierullo Silva")?.ordem === 2);

// ─── CASO 3: Formato com cabeçalho de tabela ───────────────────────────────────
secao("Caso 3: Com cabeçalhos de coluna (Nº / Nome / Candidato)");

const caso3 = `
CINE/TV
Noite

Nº  Nome
1   João Carlos Barbosa de Souza
2   Lucca Gomes Xavier
3   Marcos Vinicius Carneiro de Jesus

Nome do Candidato
Ana Lima da Silva
Pedro Souza Ferreira
`;

const r3 = extrairNomes(caso3);
assert("Ignora linha 'Nº  Nome'", !r3.some(c => c.nome === "Nº  Nome"));
assert("Ignora linha 'Nome do Candidato'", !r3.some(c => c.nome.includes("Nome do Candidato")));
assert("Extrai nomes após cabeçalho", r3.filter(c => c.curso === "Cine/TV" && c.periodo === "Noite").length > 0,
  `encontrou: ${r3.filter(c => c.curso === "Cine/TV" && c.periodo === "Noite").length}`);

// ─── CASO 4: Títulos em maiúsculas ─────────────────────────────────────────────
secao("Caso 4: Títulos em MAIÚSCULAS (ANIMAÇÃO, CINE TV, MANHÃ)");

const caso4 = `
ANIMAÇÃO
MANHÃ
Erick Andreassa
Estela Takahashi Silveira de Araujo
Fabio Marque Santana

CINE TV
NOITE
Carla Nakajuni
Dagoberto Trevizan
`;

const r4 = extrairNomes(caso4);
assert("Detecta ANIMAÇÃO em maiúsculas", r4.some(c => c.curso === "Animação"));
assert("Detecta MANHÃ em maiúsculas", r4.some(c => c.periodo === "Manhã"));
assert("Detecta CINE TV", r4.some(c => c.curso === "Cine/TV"));
assert("Detecta NOITE em maiúsculas", r4.some(c => c.periodo === "Noite"));

// ─── CASO 5: Falsos positivos ──────────────────────────────────────────────────
secao("Caso 5: Não captura textos que não são nomes");

const caso5 = `
Animação
Manhã
João Silva Santos
Centro de Audiovisual de São Bernardo do Campo
Resultado do Processo Seletivo 2026
aprovados na prova
CAV – 1º Semestre
Maria Fernanda Costa
`;

const r5 = extrairNomes(caso5);
assert("Ignora 'aprovados na prova' (cabeçalho)", !r5.some(c => c.nome.toLowerCase().includes("aprovados na prova")));
assert("Captura nomes válidos (João e Maria)", r5.some(c => c.nome === "João Silva Santos") && r5.some(c => c.nome === "Maria Fernanda Costa"),
  `nomes: ${r5.map(c => c.nome).join(", ")}`);

// ─── RESULTADO FINAL ───────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Resultado: ${passou} passou | ${falhou} falhou`);
if (falhou === 0) {
  console.log("✅ Todos os testes passaram!\n");
} else {
  console.log(`⚠️  ${falhou} teste(s) falharam — revisar lógica de extração.\n`);
  process.exit(1);
}
