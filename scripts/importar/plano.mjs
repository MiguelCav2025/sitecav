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

const grade = await lerGrade(PASTA_PADRAO);
const todasAsPlanilhas = await lerPlanilhas(PASTA_PADRAO);
const pendencias = [];

// Só as planilhas do semestre que estamos importando. Havia um arquivo do
// 1º semestre na pasta, e ele arrastava o calendário para março.
const deOutroSemestre = todasAsPlanilhas.turmasDeAula.filter(
  t => t.semestreDoArquivo && t.semestreDoArquivo !== SEMESTRE_ATUAL,
);
const planilhas = {
  ...todasAsPlanilhas,
  turmasDeAula: todasAsPlanilhas.turmasDeAula.filter(
    t => t.semestreDoArquivo === SEMESTRE_ATUAL,
  ),
};

/**
 * Disciplina cujo nome existe nos dois cursos ganha sufixo do curso.
 *
 * São matérias diferentes, com professores diferentes — o coordenador pediu
 * isso para a Edição de Som, e o mesmo vale para as demais no mesmo caso.
 */
const NOMES_EM_DOIS_CURSOS = (() => {
  const porNome = new Map();
  for (const i of grade.itens) {
    const k = normalizar(i.disciplina);
    if (!porNome.has(k)) porNome.set(k, new Set());
    porNome.get(k).add(i.curso);
  }
  return new Set([...porNome].filter(([, c]) => c.size > 1).map(([k]) => k));
})();

function nomeCanonico(disciplinaDaGrade, curso) {
  const base = capitalizar(disciplinaDaGrade);
  return NOMES_EM_DOIS_CURSOS.has(normalizar(disciplinaDaGrade))
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

// ── Entidades derivadas da grade ─────────────────────────────────────────────
const salas = [...new Set(grade.itens.map(i => i.sala).filter(Boolean))]
  .map(capitalizar).sort();

const professores = [...new Map(
  grade.itens.filter(i => i.professor).map(i => [normalizar(i.professor), i.professor.trim()]),
).values()].sort();

const disciplinas = grade.itens.map(i => ({
  nome: nomeCanonico(i.disciplina, i.curso),
  curso: i.curso,
  modulo: i.modulo,
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

if (deOutroSemestre.length) {
  const arquivos = [...new Set(deOutroSemestre.map(t => `${t.arquivo} (${t.semestreDoArquivo})`))];
  console.log(`\n  Ignorados por serem de outro semestre (${arquivos.length} arquivo(s)):`);
  arquivos.forEach(a => item(`  · ${a}`));
  pendencias.push(`${arquivos.length} arquivo(s) de outro semestre foram ignorados — conferir se é isso mesmo.`);
  console.log("");
}

item(`salas ......... ${salas.length}`);
item(`professores ... ${professores.length}`);
item(`turmas ........ ${turmas.size}`);
item(`disciplinas ... ${disciplinas.length}`);
item(`alunos ........ ${alunos.size}`);
item(`matrículas .... ${[...alunos.values()].reduce((s, a) => s + a.turmas.length, 0)}`);

titulo("DISCIPLINAS COMO SERÃO GRAVADAS");
for (const d of disciplinas.sort((a, b) =>
  a.curso.localeCompare(b.curso) || a.modulo - b.modulo || a.diaDaSemana - b.diaDaSemana)) {
  console.log(
    `  ${d.curso.padEnd(9)} ${d.modulo}º ${DIAS[d.diaDaSemana].padEnd(8)} ` +
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

// Turma sem aluno não é criada: é o caso da turma que não abriu por falta de
// inscritos. O sistema não precisa registrar o que não existe.
const semAlunos = [...turmas.values()].filter(t => t.alunos.size === 0);
for (const t of semAlunos) {
  turmas.delete(`${t.curso}|${t.turno}|${t.modulo}`);
  item(`  (${t.nome} não será criada — nenhum aluno)`);
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

titulo(`NOMES QUE GANHARAM SUFIXO DO CURSO (${NOMES_EM_DOIS_CURSOS.size})`);
if (NOMES_EM_DOIS_CURSOS.size === 0) item("Nenhum.");
else {
  item("Existem nos dois cursos, com professores diferentes:");
  [...NOMES_EM_DOIS_CURSOS].sort().forEach(k => item(`  ${capitalizar(k)}  →  ... - Animação  /  ... - Cine/TV`));
}

// ── Calendário real, lido das planilhas ──────────────────────────────────────
// Janela do semestre. Há aba de arquivo do 2º semestre que ficou com o
// calendário do 1º — copiaram o arquivo e não trocaram as datas. Sem esta
// janela, essas abas puxam o período inteiro para março.
const [anoSem, metadeSem] = SEMESTRE_ATUAL.split("/").map(Number);
const JANELA = metadeSem === 1
  ? { de: `${anoSem}-01-01`, ate: `${anoSem}-06-30` }
  : { de: `${anoSem}-07-01`, ate: `${anoSem}-12-31` };

const todasAsDatas = new Set();
const abasForaDaJanela = [];

for (const t of planilhas.turmasDeAula) {
  const fora = t.datas.filter(d => d < JANELA.de || d > JANELA.ate);
  if (fora.length > 0) {
    abasForaDaJanela.push({ ...t, fora: fora.length, primeira: fora[0] });
    continue; // não contamina o calendário
  }
  for (const d of t.datas) todasAsDatas.add(d);
}

if (abasForaDaJanela.length) {
  titulo(`ABAS COM O CALENDÁRIO DO SEMESTRE ERRADO (${abasForaDaJanela.length})`);
  item("O arquivo é do semestre certo, mas estas abas ficaram com as datas do anterior:");
  abasForaDaJanela.forEach(t => {
    item(`  · ${t.arquivo}`);
    item(`      aba "${t.aba}" — ${t.fora} data(s) fora da janela, começando em ${t.primeira}`);
    pendencias.push(`Aba "${t.aba}" de ${t.arquivo} está com o calendário do semestre anterior.`);
  });
}
const ordenadas = [...todasAsDatas].sort();
const inicio = ordenadas[0];
const fim = ordenadas[ordenadas.length - 1];

titulo("CALENDÁRIO REAL, SEGUNDO AS PLANILHAS");
item(`período: ${inicio} a ${fim}`);
item(`dias com aula: ${ordenadas.length}`);

// Dia útil dentro do período em que nenhuma turma teve aula = feriado/recesso
const candidatosFeriado = [];
const cursor = new Date(`${inicio}T12:00:00`);
const ultimo = new Date(`${fim}T12:00:00`);
while (cursor <= ultimo) {
  const iso = cursor.toISOString().split("T")[0];
  const dow = cursor.getDay();
  if (dow >= 1 && dow <= 5 && !todasAsDatas.has(iso)) candidatosFeriado.push(iso);
  cursor.setDate(cursor.getDate() + 1);
}

console.log(`\n  Dias úteis no período sem aula em turma nenhuma (${candidatosFeriado.length}):`);
candidatosFeriado.forEach(d => {
  const nome = new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  item(`  · ${d} (${nome})`);
});
pendencias.push(
  `Cronograma 2026/2 cadastrado vai de 2026-08-03 a 2026-11-27 e não tem feriado. ` +
  `As planilhas mostram ${inicio} a ${fim} e ${candidatosFeriado.length} dia(s) úteis sem aula.`,
);

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
