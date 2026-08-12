/**
 * Lê a grade e as listas de presença e mostra o que foi entendido.
 *
 *   node scripts/importar/relatorio.mjs [semestre]
 *
 * NÃO grava nada. A ideia é conferir antes de zerar e repovoar o banco:
 * conferência depois da destruição não serve para nada.
 */
import {
  lerGrade, lerPlanilhas, entradaDaTurma, normalizar, PASTA_PADRAO,
} from "./fontes.mjs";

const SEMESTRE_ATUAL = process.argv[2] ?? "2026/2";
const DIAS = { 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta" };

const titulo = (t) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);
const item = (t) => console.log(`  ${t}`);

const grade = await lerGrade(PASTA_PADRAO);
const planilhas = await lerPlanilhas(PASTA_PADRAO);
const problemas = [];

titulo(`FONTES  ·  semestre letivo ${SEMESTRE_ATUAL}`);
item(`grade: ${grade.arquivo ?? "não encontrada"} → ${grade.itens.length} células`);
item(`planilhas: ${planilhas.arquivos.length} arquivos → ${planilhas.turmasDeAula.length} abas`);

// ── Salas ────────────────────────────────────────────────────────────────────
const salas = [...new Set(grade.itens.map(i => i.sala).filter(Boolean))].sort();
titulo(`SALAS (${salas.length})`);
salas.forEach(s => item(s));

// ── Professores ──────────────────────────────────────────────────────────────
const profsGrade = new Map();
for (const i of grade.itens) if (i.professor) profsGrade.set(normalizar(i.professor), i.professor);
const profsPlanilha = new Map();
for (const t of planilhas.turmasDeAula) if (t.professor) profsPlanilha.set(normalizar(t.professor), t.professor);

titulo(`PROFESSORES  ·  grade ${profsGrade.size}  ·  planilhas ${profsPlanilha.size}`);
[...profsGrade.values()].sort().forEach(p => item(p));

const soNaPlanilha = [...profsPlanilha].filter(([k]) => !profsGrade.has(k));
if (soNaPlanilha.length) {
  console.log("\n  Aparecem nas planilhas mas não na grade (podem ser a mesma pessoa escrita diferente):");
  soNaPlanilha.forEach(([, v]) => item(`  · ${v}`));
  problemas.push(`${soNaPlanilha.length} professor(es) só nas planilhas`);
}

// ── Turmas ───────────────────────────────────────────────────────────────────
const turmas = new Map();
for (const t of planilhas.turmasDeAula) {
  const chave = `${t.curso}|${t.turno}|${t.modulo}`;
  if (!turmas.has(chave)) {
    turmas.set(chave, {
      curso: t.curso, turno: t.turno, modulo: t.modulo,
      entrada: entradaDaTurma(SEMESTRE_ATUAL, t.modulo),
      alunos: new Map(), disciplinas: new Set(),
    });
  }
  const turma = turmas.get(chave);
  turma.disciplinas.add(t.disciplina);
  for (const a of t.alunos) {
    const id = a.email ?? `sem-email:${normalizar(a.nome)}`;
    if (!turma.alunos.has(id)) turma.alunos.set(id, a);
  }
}

titulo(`TURMAS (${turmas.size})`);
console.log("  curso            turno   módulo  entrada   alunos  disciplinas");
console.log("  " + "-".repeat(64));
for (const t of [...turmas.values()].sort((a, b) =>
  a.curso.localeCompare(b.curso) || a.modulo - b.modulo || a.turno.localeCompare(b.turno))) {
  console.log(
    `  ${t.curso.padEnd(16)} ${t.turno.padEnd(7)} ${String(t.modulo).padEnd(7)} ` +
    `${t.entrada.padEnd(9)} ${String(t.alunos.size).padStart(6)}  ${t.disciplinas.size}`,
  );
  if (t.alunos.size === 0) problemas.push(`Turma ${t.curso} ${t.turno} ${t.modulo}º sem alunos`);
}

// ── Disciplinas ──────────────────────────────────────────────────────────────
titulo(`DISCIPLINAS NA GRADE (${grade.itens.length})`);
for (const i of grade.itens.sort((a, b) =>
  a.curso.localeCompare(b.curso) || a.modulo - b.modulo || a.diaDaSemana - b.diaDaSemana)) {
  console.log(`  ${i.curso.padEnd(10)} ${i.modulo}º  ${DIAS[i.diaDaSemana].padEnd(8)} ${i.disciplina.padEnd(42)} ${i.professor.padEnd(22)} ${i.sala}`);
}

// ── Divergências entre grade e planilhas ─────────────────────────────────────
const chaveGrade = new Map(grade.itens.map(i => [`${i.curso}|${i.modulo}|${i.diaDaSemana}`, i]));

/** Distância de edição, para pegar erro de digitação como Camila/Camilla. */
function distancia(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    anterior = atual;
  }
  return anterior[n];
}

/**
 * Nome escrito de outro jeito, ou coisa realmente diferente?
 *
 * Compara sem acento, sem pontuação e sem espaço — assim "PÓS-PRODUÇÃO" e
 * "PÓS PRODUÇÃO" viram iguais. Depois tolera um errinho de digitação.
 */
function ehVariacao(a, b) {
  const compacta = (s) => normalizar(s).replace(/[^A-Z0-9]/g, "");
  const x = compacta(a);
  const y = compacta(b);
  if (!x || !y) return false;
  if (x === y) return true;

  // Sufixo romano é o número do módulo: PRODUÇÃO I e PRODUÇÃO II são
  // disciplinas diferentes. Sem esta checagem o `includes` abaixo trataria
  // uma como variação da outra, porque "PRODUCAOII" contém "PRODUCAOI".
  const romano = (s) => /\b(I{1,3})$/.exec(normalizar(s).trim())?.[1] ?? "";
  const ra = romano(a);
  const rb = romano(b);
  if (ra && rb && ra !== rb) return false;

  if (x.includes(y) || y.includes(x)) return true;

  // Uma letra a mais ou a menos em nome curto: Camila x Camilla
  const menor = Math.min(x.length, y.length);
  if (menor >= 6 && distancia(x, y) <= Math.max(1, Math.floor(menor / 10))) return true;

  // Primeiro nome em comum cobre "ANDRÉ" vs "André Valle"
  const [px] = normalizar(a).split(" ");
  const [py] = normalizar(b).split(" ");
  return px.length >= 4 && px === py;
}

const variacoes = new Map();
const conflitos = new Map();

for (const t of planilhas.turmasDeAula) {
  const onde = `${t.curso} ${t.modulo}º ${DIAS[t.diaDaSemana] ?? "?"}`;
  const g = chaveGrade.get(`${t.curso}|${t.modulo}|${t.diaDaSemana}`);

  if (!g) {
    conflitos.set(`sem-celula|${onde}`,
      `${onde}: a planilha "${t.arquivo}" traz aba para este horário, mas a grade não tem nada aqui.`);
    continue;
  }

  if (normalizar(g.disciplina) !== normalizar(t.disciplina)) {
    const alvo = ehVariacao(g.disciplina, t.disciplina) ? variacoes : conflitos;
    alvo.set(`disc|${onde}`,
      `${onde} — grade: "${g.disciplina}"  ·  planilha: "${t.disciplina}"`);
  }

  if (g.professor && t.professor && normalizar(g.professor) !== normalizar(t.professor)) {
    const alvo = ehVariacao(g.professor, t.professor) ? variacoes : conflitos;
    alvo.set(`prof|${onde}`,
      `${onde} (${g.disciplina}) — grade: "${g.professor}"  ·  planilha: "${t.professor}"`);
  }
}

titulo(`CONFLITOS REAIS (${conflitos.size})  ·  precisam de decisão`);
if (conflitos.size === 0) item("Nenhum.");
else [...conflitos.values()].sort().forEach(v => item(`✗ ${v}`));
if (conflitos.size > 0) problemas.push(`${conflitos.size} conflito(s) real(is) entre grade e planilhas`);

titulo(`VARIAÇÕES DE ESCRITA (${variacoes.size})  ·  mesma coisa, grafada diferente`);
if (variacoes.size === 0) item("Nenhuma.");
else [...variacoes.values()].sort().forEach(v => item(`~ ${v}`));

// ── Alunos ───────────────────────────────────────────────────────────────────
const porEmail = new Map();
const semEmail = [];
for (const t of planilhas.turmasDeAula) {
  for (const a of t.alunos) {
    if (a.email) {
      if (!porEmail.has(a.email)) porEmail.set(a.email, new Set());
      porEmail.get(a.email).add(a.nome);
    } else {
      semEmail.push({ nome: a.nome, onde: `${t.curso} ${t.modulo}º ${t.turno}` });
    }
  }
}

titulo(`ALUNOS  ·  ${porEmail.size} e-mails distintos  ·  ${semEmail.length} lançamento(s) sem e-mail`);

// Aluno em mais de uma turma: é o caso de quem termina um curso e começa outro
const turmasPorEmail = new Map();
for (const t of turmas.values()) {
  for (const [id] of t.alunos) {
    if (id.startsWith("sem-email:")) continue;
    if (!turmasPorEmail.has(id)) turmasPorEmail.set(id, []);
    turmasPorEmail.get(id).push(`${t.curso} ${t.modulo}º ${t.turno}`);
  }
}
const emDuasTurmas = [...turmasPorEmail].filter(([, ts]) => ts.length > 1);
if (emDuasTurmas.length) {
  console.log(`\n  Em mais de uma turma (${emDuasTurmas.length}) — o modelo já suporta:`);
  emDuasTurmas.forEach(([email, ts]) => item(`  · ${email}: ${ts.join("  +  ")}`));
}

const nomesDivergentes = [...porEmail].filter(([, nomes]) => nomes.size > 1);
if (nomesDivergentes.length) {
  console.log("  Mesmo e-mail com grafias diferentes de nome (vou usar a primeira):");
  nomesDivergentes.forEach(([email, nomes]) => item(`  · ${email}: ${[...nomes].join(" | ")}`));
  problemas.push(`${nomesDivergentes.length} e-mail(s) com nome grafado de formas diferentes`);
}

if (semEmail.length) {
  console.log("\n  Sem e-mail — só dá para casar pelo nome, que é menos confiável:");
  semEmail.slice(0, 20).forEach(a => item(`  · ${a.nome} (${a.onde})`));
  if (semEmail.length > 20) item(`  ... e mais ${semEmail.length - 20}`);
  problemas.push(`${semEmail.length} aluno(s) sem e-mail`);
}

// ── Avisos de leitura ────────────────────────────────────────────────────────
const avisos = [...grade.avisos, ...planilhas.avisos];
if (avisos.length) {
  titulo(`AVISOS DE LEITURA (${avisos.length})`);
  avisos.forEach(a => item(a));
}

// ── Resumo ───────────────────────────────────────────────────────────────────
titulo("O QUE PRECISA DE DECISÃO ANTES DE IMPORTAR");
if (problemas.length === 0) console.log("  Nada. As fontes estão consistentes.");
else problemas.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
console.log("\nNada foi gravado. Este relatório só lê.\n");
