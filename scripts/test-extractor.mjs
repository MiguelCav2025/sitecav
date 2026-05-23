/**
 * Teste da função de extração de nomes do processo seletivo.
 * Rode com: node scripts/test-extractor.mjs
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

function isApenasNumero(linha) {
  return /^\d+[.\-)]*\s*$/.test(linha.trim());
}

function isCabecalhoTabela(linha) {
  return /^(nº|no\.|nome|candidato|classificação|resultado|aprovad|reprovad|ord)/i.test(linha.trim());
}

function pareceNome(linha) {
  const t = linha.trim();
  if (t.length < 5 || t.length > 100) return false;
  if (t.split(" ").length < 2) return false;
  if (/[<>{}\[\]|\\=+*&^%$#@!]/.test(t)) return false;
  const palavras = t.split(" ");
  const maiusculas = palavras.filter(p => p.length > 2 && p === p.toUpperCase()).length;
  if (maiusculas === palavras.length && t.length > 20) return false;
  return true;
}

function extrairNomes(texto) {
  const linhas = texto.split(/\r?\n/);
  const candidatos = [];
  let cursoAtual = "", periodoAtual = "", ordemContador = 1;

  const linhasProcessadas = [];
  for (let i = 0; i < linhas.length; i++) {
    const atual = linhas[i].trim();
    const proxima = (linhas[i + 1] ?? "").trim();
    if (isApenasNumero(atual) && pareceNome(proxima)) {
      linhasProcessadas.push(`${atual} ${proxima}`);
      i++;
    } else {
      linhasProcessadas.push(atual);
    }
  }

  for (const linhaTrimada of linhasProcessadas) {
    if (linhaTrimada.length === 0) continue;
    if (isCabecalhoTabela(linhaTrimada)) continue;
    if (isApenasNumero(linhaTrimada)) continue;

    const cursoDet = detectarCurso(linhaTrimada);
    if (cursoDet && linhaTrimada.length < 60) {
      cursoAtual = cursoDet; ordemContador = 1;
      const periodoDet = detectarPeriodo(linhaTrimada);
      periodoAtual = periodoDet ?? "";
      continue;
    }

    const periodoDet = detectarPeriodo(linhaTrimada);
    if (periodoDet && linhaTrimada.length < 40) {
      periodoAtual = periodoDet; ordemContador = 1; continue;
    }

    if (!cursoAtual || !periodoAtual) continue;

    const matchComNumero = linhaTrimada.match(/^(\d+)[.\-)\s]+(.+)$/);
    if (matchComNumero) {
      const nome = matchComNumero[2].trim();
      if (pareceNome(nome)) {
        candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome, ordem: parseInt(matchComNumero[1]) });
        continue;
      }
    }

    if (pareceNome(linhaTrimada)) {
      candidatos.push({ curso: cursoAtual, periodo: periodoAtual, nome: linhaTrimada, ordem: ordemContador++ });
    }
  }
  return candidatos;
}

// --- Utilitários ---
let passou = 0, falhou = 0;

function assert(desc, cond, detalhes) {
  if (cond) { console.log(`  ✅ ${desc}`); passou++; }
  else { console.error(`  ❌ ${desc}`); if (detalhes) console.error(`     → ${detalhes}`); falhou++; }
}
function secao(t) { console.log(`\n📋 ${t}`); }

// ─── CASO 1: Formato simples com cabeçalhos separados ─────────────────────────
secao("Caso 1: Cabeçalhos separados, nomes em lista contínua");
const r1 = extrairNomes(`
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

Noite
Amanda Silva Mendes
Anita Sampaio Zanutto
`);
assert("Animação/Manhã: 4", r1.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length===4, r1.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length);
assert("Animação/Noite: 3", r1.filter(c=>c.curso==="Animação"&&c.periodo==="Noite").length===3);
assert("Cine/TV Manhã: 2", r1.filter(c=>c.curso==="Cine/TV"&&c.periodo==="Manhã").length===2);
assert("Cine/TV Noite: 2", r1.filter(c=>c.curso==="Cine/TV"&&c.periodo==="Noite").length===2);

// ─── CASO 2: Linhas em branco DENTRO da lista (bug original) ──────────────────
secao("Caso 2: Linhas em branco DENTRO da lista — nomes não podem ser perdidos");
const r2 = extrairNomes(`
ANIMAÇÃO MANHÃ

Danil Kallai Meneses Mugnani

Daniele Correia da Cunha

Elias Tomé Junior

Gabriel Morais Lemes

ANIMAÇÃO NOITE

Adilson Carvalho Lins

Ana Clara Lima Manoel
`);
assert("Animação/Manhã: 4 (com linhas em branco entre nomes)", r2.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length===4, r2.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length);
assert("Animação/Noite: 2", r2.filter(c=>c.curso==="Animação"&&c.periodo==="Noite").length===2);

// ─── CASO 3: Número na linha, nome na linha seguinte ─────────────────────────
secao("Caso 3: Número na linha separada do nome (formato de tabela exportada)");
const r3 = extrairNomes(`
ANIMAÇÃO MANHÃ
01
Danil Kallai Meneses Mugnani
02
Daniele Correia da Cunha
16
Vinicius Ferreira Tunes
17
William Cavalini

ANIMAÇÃO NOITE
01
Adilson Carvalho Lins
`);
assert("Detecta Vinicius (número 16 separado)", r3.some(c=>c.nome==="Vinicius Ferreira Tunes"), r3.map(c=>c.nome).join(", "));
assert("Detecta William Cavalini", r3.some(c=>c.nome==="William Cavalini"));
assert("Animação/Manhã: 4", r3.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length===4, r3.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length);
assert("Animação/Noite: 1", r3.filter(c=>c.curso==="Animação"&&c.periodo==="Noite").length===1);

// ─── CASO 4: Formato numerado na mesma linha ──────────────────────────────────
secao("Caso 4: Número e nome na mesma linha");
const r4 = extrairNomes(`
Animação - Manhã
1. Gabriel Silva Scheffer Mori
2. Janine Ierullo Silva
3. Katrina Pietra Gonçalves de Almeida

Cine/TV - Noite
1. Amanda Silva Mendes
2. Anita Sampaio Zanutto
`);
assert("Animação/Manhã: 3", r4.filter(c=>c.curso==="Animação"&&c.periodo==="Manhã").length===3);
assert("Cine/TV Noite: 2", r4.filter(c=>c.curso==="Cine/TV"&&c.periodo==="Noite").length===2);
assert("Nome sem número", !r4.some(c=>/^\d+\./.test(c.nome)));

// ─── CASO 5: Maiúsculas e cabeçalhos a ignorar ───────────────────────────────
secao("Caso 5: Títulos ALL CAPS não viram candidatos");
const r5 = extrairNomes(`
ANIMAÇÃO
MANHÃ
João Silva Santos
Maria Fernanda Costa

CINE/TV
NOITE
Pedro Souza Ferreira
`);
assert("ANIMAÇÃO não vira candidato", !r5.some(c=>c.nome==="ANIMAÇÃO"));
assert("MANHÃ não vira candidato", !r5.some(c=>c.nome==="MANHÃ"));
assert("João capturado", r5.some(c=>c.nome==="João Silva Santos"));
assert("Pedro capturado", r5.some(c=>c.nome==="Pedro Souza Ferreira"));

// ─── RESULTADO ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Resultado: ${passou} passou | ${falhou} falhou`);
if (falhou === 0) { console.log("✅ Todos os testes passaram!\n"); }
else { console.log(`⚠️  ${falhou} falhou\n`); process.exit(1); }
