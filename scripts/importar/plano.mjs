/**
 * Monta o plano de importação e mostra exatamente o que seria gravado.
 *
 *   node scripts/importar/plano.mjs [semestre]
 *
 * NÃO grava nada. É a última conferência antes de zerar e repovoar o banco.
 *
 * REGRA COMBINADA COM O COORDENADOR: a grade curricular é a fonte oficial.
 * As planilhas contribuem apenas com as listas de alunos; quando divergem da
 * grade em nome, dia ou professor, vale a grade.
 */
import {
  lerGrade, lerPlanilhas, entradaDaTurma, normalizar, capitalizar, PASTA_PADRAO,
} from "./fontes.mjs";

const SEMESTRE_ATUAL = process.argv[2] ?? "2026/2";
const DIAS = { 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta" };

const titulo = (t) => console.log(`\n${"=".repeat(74)}\n${t}\n${"=".repeat(74)}`);
const item = (t) => console.log(`  ${t}`);

/**
 * Disciplinas que existem nos dois cursos ganham sufixo, a pedido do
 * coordenador: são matérias diferentes, com professores diferentes.
 */
const RENOMEAR_POR_CURSO = new Set(["EDICAO DE SOM"]);

function nomeCanonico(disciplinaDaGrade, curso) {
  const base = capitalizar(disciplinaDaGrade);
  return RENOMEAR_POR_CURSO.has(normalizar(disciplinaDaGrade))
    ? `${base} - ${curso}`
    : base;
}

const sufixoRomano = (s) => /\b(I{1,3})$/.exec(normalizar(s).trim())?.[1] ?? "";

/** Termos do nome, sem acento, sem preposição e sem o sufixo de módulo. */
function termos(nome) {
  const semRomano = normalizar(nome).replace(/\bI{1,3}$/, "").trim();
  return new Set(
    semRomano.split(/[^A-Z0-9]+/)
      .filter(t => t.length > 1 && !["DE", "DA", "DO", "PARA", "E", "EM", "COM", "A"].includes(t)),
  );
}

/** Proporção de termos em comum, de 0 a 1. */
function semelhanca(a, b) {
  const x = termos(a);
  const y = termos(b);
  if (x.size === 0 || y.size === 0) return 0;
  const comuns = [...x].filter(t => y.has(t)).length;
  return comuns / new Set([...x, ...y]).size;
}

/**
 * Quanto uma célula da grade combina com uma aba de planilha.
 *
 * Nome e dia se complementam, e é preciso dos dois:
 *
 *   · a aba de Edição de Som traz o DIA errado, e só o nome a salva;
 *   · a aba de Práticas foi renomeada e não parece com a grade, e só o dia
 *     a salva;
 *   · a aba de Produção traz o módulo certo mas o algarismo desatualizado,
 *     e por isso o sufixo romano é ignorado no nome — dentro de um mesmo
 *     módulo só existe uma Produção, então ele é redundante.
 */
function pontuar(celula, aba) {
  const nomeDaAba = aba.disciplina || aba.arquivo;
  let nota = semelhanca(celula.disciplina, nomeDaAba);
  if (celula.diaDaSemana === aba.diaDaSemana) nota += 0.45;
  // Desempate leve quando o algarismo também bate
  const r = sufixoRomano(celula.disciplina);
  if (r && r === sufixoRomano(nomeDaAba)) nota += 0.1;
  return nota;
}

const grade = await lerGrade(PASTA_PADRAO);
const planilhas = await lerPlanilhas(PASTA_PADRAO);
const pendencias = [];

// ── Entidades derivadas da grade ─────────────────────────────────────────────
const salas = [...new Set(grade.itens.map(i => i.sala).filter(Boolean))]
  .map(capitalizar).sort();

const professores = [...new Map(
  grade.itens.filter(i => i.professor).map(i => [normalizar(i.professor), i.professor.trim()]),
).values()].sort();

const disciplinas = grade.itens.map(i => ({
  nome: nomeCanonico(i.disciplina, i.curso),
  curso: i.curso,
  semestreDoCurso: i.modulo,
  diaDaSemana: i.diaDaSemana,
  professor: i.professor.trim(),
  sala: capitalizar(i.sala),
}));

// ── Turmas e alunos, das planilhas ───────────────────────────────────────────
const turmas = new Map();
const naoCasadas = [];
const celulasCasadas = new Set();

for (const t of planilhas.turmasDeAula) {
  // Casamento por curso + módulo + nome. O dia da aba NÃO é usado: há aba
  // com o dia errado, e a grade é quem manda.
  const candidatas = grade.itens.filter(g => g.curso === t.curso && g.modulo === t.modulo);
  let melhor = null, melhorNota = 0;
  for (const c of candidatas) {
    const s = pontuar(c, t);
    if (s > melhorNota) { melhorNota = s; melhor = c; }
  }

  if (!melhor || melhorNota < 0.5) {
    naoCasadas.push({ ...t, melhorNota });
    continue;
  }

  celulasCasadas.add(`${melhor.curso}|${melhor.modulo}|${melhor.diaDaSemana}`);

  const chave = `${t.curso}|${t.turno}|${t.modulo}`;
  if (!turmas.has(chave)) {
    turmas.set(chave, {
      curso: t.curso, turno: t.turno, modulo: t.modulo,
      entrada: entradaDaTurma(SEMESTRE_ATUAL, t.modulo),
      nome: `${t.curso} ${t.turno} ${entradaDaTurma(SEMESTRE_ATUAL, t.modulo)}`,
      alunos: new Map(), disciplinas: new Set(),
    });
  }
  const turma = turmas.get(chave);
  turma.disciplinas.add(nomeCanonico(melhor.disciplina, melhor.curso));
  for (const a of t.alunos) {
    const id = a.email ?? `nome:${normalizar(a.nome)}`;
    if (!turma.alunos.has(id)) turma.alunos.set(id, a);
  }
}

// ── Alunos únicos ────────────────────────────────────────────────────────────
const alunos = new Map();
for (const t of turmas.values()) {
  for (const [id, a] of t.alunos) {
    if (!alunos.has(id)) alunos.set(id, { nome: a.nome, email: a.email, turmas: [] });
    alunos.get(id).turmas.push(t.nome);
  }
}

// ── Relatório ────────────────────────────────────────────────────────────────
titulo(`PLANO DE IMPORTAÇÃO  ·  semestre ${SEMESTRE_ATUAL}  ·  a grade manda`);

item(`salas ......... ${salas.length}`);
item(`professores ... ${professores.length}`);
item(`turmas ........ ${turmas.size}`);
item(`disciplinas ... ${disciplinas.length}`);
item(`alunos ........ ${alunos.size}`);
item(`matrículas .... ${[...alunos.values()].reduce((s, a) => s + a.turmas.length, 0)}`);

titulo("DISCIPLINAS COMO SERÃO GRAVADAS");
for (const d of disciplinas.sort((a, b) =>
  a.curso.localeCompare(b.curso) || a.semestreDoCurso - b.semestreDoCurso || a.diaDaSemana - b.diaDaSemana)) {
  console.log(
    `  ${d.curso.padEnd(9)} ${d.semestreDoCurso}º ${DIAS[d.diaDaSemana].padEnd(8)} ` +
    `${d.nome.padEnd(38)} ${d.professor.padEnd(22)} ${d.sala}`,
  );
}

titulo("TURMAS");
console.log("  turma                              alunos  disciplinas");
console.log("  " + "-".repeat(56));
for (const t of [...turmas.values()].sort((a, b) => a.nome.localeCompare(b.nome))) {
  console.log(`  ${t.nome.padEnd(34)} ${String(t.alunos.size).padStart(6)}  ${t.disciplinas.size}`);
  if (t.disciplinas.size < 5) {
    pendencias.push(`${t.nome} tem só ${t.disciplinas.size} disciplina(s) — a grade prevê 5.`);
  }
}

const semAlunos = [...turmas.values()].filter(t => t.alunos.size === 0);
for (const t of semAlunos) pendencias.push(`${t.nome} ficaria sem nenhum aluno.`);

// Turma prevista na grade que não apareceu em planilha nenhuma
for (const curso of ["Animação", "Cine/TV"]) {
  for (const modulo of [1, 2, 3]) {
    for (const turno of ["Manhã", "Noite"]) {
      if (!turmas.has(`${curso}|${turno}|${modulo}`)) {
        pendencias.push(`Não há planilha para ${curso} ${turno} ${modulo}º módulo — essa turma não será criada.`);
      }
    }
  }
}

const semPlanilha = grade.itens.filter(
  i => !celulasCasadas.has(`${i.curso}|${i.modulo}|${i.diaDaSemana}`),
);
titulo(`DISCIPLINAS DA GRADE SEM LISTA DE PRESENÇA (${semPlanilha.length})`);
if (semPlanilha.length === 0) item("Nenhuma — todas têm planilha.");
else {
  item("Serão criadas, mas ninguém ficará matriculado nelas:");
  semPlanilha.forEach(i => {
    item(`  ${i.curso} ${i.modulo}º ${DIAS[i.diaDaSemana]} — ${nomeCanonico(i.disciplina, i.curso)} (${i.professor})`);
    pendencias.push(`Falta a lista de presença de "${nomeCanonico(i.disciplina, i.curso)}" (${i.curso} ${i.modulo}º).`);
  });
}

titulo("ALUNOS EM MAIS DE UMA TURMA");
const multi = [...alunos.values()].filter(a => a.turmas.length > 1);
if (multi.length === 0) item("Nenhum.");
else multi.forEach(a => item(`${a.nome} (${a.email ?? "sem e-mail"}): ${a.turmas.join("  +  ")}`));

titulo("DISCIPLINAS COM NOME REPETIDO NOS DOIS CURSOS");
const porNome = new Map();
for (const d of disciplinas) {
  const k = normalizar(d.nome.replace(/ - (Animação|Cine\/TV)$/, ""));
  if (!porNome.has(k)) porNome.set(k, new Set());
  porNome.get(k).add(d.curso);
}
const repetidas = [...porNome].filter(([, cursos]) => cursos.size > 1);
if (repetidas.length === 0) item("Nenhuma.");
else {
  item("O coordenador pediu o sufixo do curso para Edição de Som. Estas estão no mesmo caso:");
  repetidas.forEach(([k]) => {
    const jaTratada = RENOMEAR_POR_CURSO.has(k);
    item(`  ${jaTratada ? "✓ já com sufixo" : "? sem sufixo"}  ${capitalizar(k)}`);
    if (!jaTratada) pendencias.push(`"${capitalizar(k)}" existe nos dois cursos — quer o sufixo também?`);
  });
}

if (naoCasadas.length) {
  titulo(`ABAS QUE NÃO CASARAM COM A GRADE (${naoCasadas.length})`);
  naoCasadas.forEach(t => {
    item(`${t.arquivo} → "${t.aba}": ${t.curso} ${t.modulo}º, disciplina "${t.disciplina || "(sem título)"}"`);
    pendencias.push(`Aba "${t.aba}" de ${t.arquivo} não casou com a grade.`);
  });
}

const avisos = [...grade.avisos, ...planilhas.avisos];
if (avisos.length) {
  titulo(`AVISOS DE LEITURA (${avisos.length})`);
  avisos.forEach(a => item(a));
}

titulo("PENDÊNCIAS ANTES DE GRAVAR");
if (pendencias.length === 0) console.log("  Nenhuma.");
else [...new Set(pendencias)].forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

console.log("\nNada foi gravado.\n");
