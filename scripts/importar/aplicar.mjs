/**
 * Zera os dados acadêmicos e repovoa a partir da grade e das planilhas.
 *
 *   node scripts/importar/aplicar.mjs              → mostra o que faria
 *   node scripts/importar/aplicar.mjs --confirmar  → executa
 *
 * Sem `--confirmar` nada é tocado. Com ele, a operação é destrutiva e não tem
 * desfazer: os dados acadêmicos atuais são apagados.
 *
 * O que NÃO é apagado: o conteúdo do site (banners, projetos, galeria...),
 * as salas, o cronograma de outros semestres e as contas de administrador.
 */
import { readFileSync } from "node:fs";
import {
  lerGrade, lerPlanilhas, entradaDaTurma, normalizar, capitalizar,
  gerarDatasDoCronograma, PASTA_PADRAO,
} from "./fontes.mjs";

const CONFIRMAR = process.argv.includes("--confirmar");
const SEMESTRE = process.argv.find(a => /^\d{4}\/[12]$/.test(a)) ?? "2026/2";

// Calendário real, apurado a partir das planilhas e confirmado com a coordenação
const CRONOGRAMA = {
  semestre: SEMESTRE,
  data_inicio: "2026-08-03",
  data_fim: "2026-12-14",
  feriados: [
    "2026-08-20", // aniversário de São Bernardo do Campo
    "2026-08-21", // emenda
    "2026-09-07", // Independência
    "2026-10-12", // Nossa Senhora Aparecida
    "2026-10-28", // Dia do Servidor Público
    "2026-11-02", // Finados
    "2026-11-20", // Consciência Negra
  ],
};

// ── Acesso ao banco ──────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
const cabecalhos = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" };

async function rest(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, { ...opcoes, headers: { ...cabecalhos, ...opcoes.headers } });
  if (!r.ok) throw new Error(`${opcoes.method ?? "GET"} ${caminho} → ${r.status} ${await r.text()}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

const inserir = (tabela, linhas) =>
  linhas.length === 0 ? [] :
  rest(tabela, { method: "POST", body: JSON.stringify(linhas), headers: { Prefer: "return=representation" } });

/** Nem toda tabela tem `id`: grupo_alunos usa chave composta. */
const COLUNA_CHAVE = { grupo_alunos: "aluno_id" };

const apagarTudo = (tabela) =>
  rest(`${tabela}?${COLUNA_CHAVE[tabela] ?? "id"}=not.is.null`, { method: "DELETE" });

const titulo = (t) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);
const item = (t) => console.log(`  ${t}`);

// ── Monta o plano ────────────────────────────────────────────────────────────
const grade = await lerGrade(PASTA_PADRAO);
const todas = await lerPlanilhas(PASTA_PADRAO);

const [anoSem, metadeSem] = SEMESTRE.split("/").map(Number);
const JANELA = metadeSem === 1
  ? { de: `${anoSem}-01-01`, ate: `${anoSem}-06-30` }
  : { de: `${anoSem}-07-01`, ate: `${anoSem}-12-31` };

const abas = todas.turmasDeAula.filter(t => t.semestreDoArquivo === SEMESTRE);

const NOMES_EM_DOIS_CURSOS = (() => {
  const porNome = new Map();
  for (const i of grade.itens) {
    const k = normalizar(i.disciplina);
    if (!porNome.has(k)) porNome.set(k, new Set());
    porNome.get(k).add(i.curso);
  }
  return new Set([...porNome].filter(([, c]) => c.size > 1).map(([k]) => k));
})();

const nomeCanonico = (nome, curso) =>
  NOMES_EM_DOIS_CURSOS.has(normalizar(nome)) ? `${capitalizar(nome)} - ${curso}` : capitalizar(nome);

const sufixoRomano = (s) => /\b(I{1,3})$/.exec(normalizar(s).trim())?.[1] ?? "";
const termos = (nome) => new Set(
  normalizar(nome).replace(/\bI{1,3}$/, "").trim().split(/[^A-Z0-9]+/)
    .filter(t => t.length > 1 && !["DE", "DA", "DO", "PARA", "E", "EM", "COM", "A"].includes(t)));

function pontuar(celula, aba) {
  const nomeDaAba = aba.disciplina || aba.arquivo;
  const x = termos(celula.disciplina), y = termos(nomeDaAba);
  const comuns = [...x].filter(t => y.has(t)).length;
  let nota = x.size && y.size ? comuns / new Set([...x, ...y]).size : 0;
  if (celula.diaDaSemana === aba.diaDaSemana) nota += 0.45;
  const r = sufixoRomano(celula.disciplina);
  if (r && r === sufixoRomano(nomeDaAba)) nota += 0.1;
  return nota;
}

/** turma → { alunos, datasPorDisciplina } */
const turmas = new Map();
for (const aba of abas) {
  const candidatas = grade.itens.filter(g => g.curso === aba.curso && g.modulo === aba.modulo);
  let melhor = null, melhorNota = 0;
  for (const c of candidatas) {
    const s = pontuar(c, aba);
    if (s > melhorNota) { melhorNota = s; melhor = c; }
  }
  if (!melhor || melhorNota < 0.5) continue;

  const chave = `${aba.curso}|${aba.turno}|${aba.modulo}`;
  if (!turmas.has(chave)) {
    const entrada = entradaDaTurma(SEMESTRE, aba.modulo);
    turmas.set(chave, {
      curso: aba.curso, turno: aba.turno, modulo: aba.modulo, entrada,
      nome: `${aba.curso} ${aba.turno} ${entrada}`,
      alunos: new Map(), datas: new Map(),
    });
  }
  const turma = turmas.get(chave);

  // Datas boas: dentro da janela do semestre. As abas que ficaram com o
  // calendário do semestre anterior caem para a geração pelo cronograma.
  const dentroDaJanela = aba.datas.filter(d => d >= JANELA.de && d <= JANELA.ate);
  if (dentroDaJanela.length === aba.datas.length && dentroDaJanela.length > 0) {
    turma.datas.set(nomeCanonico(melhor.disciplina, melhor.curso), dentroDaJanela);
  }

  for (const a of aba.alunos) {
    const id = a.email ?? `nome:${normalizar(a.nome)}`;
    if (!turma.alunos.has(id)) turma.alunos.set(id, a);
  }
}

for (const [k, t] of turmas) if (t.alunos.size === 0) turmas.delete(k);

const professores = [...new Map(
  grade.itens.filter(i => i.professor).map(i => [normalizar(i.professor), i.professor.trim()]),
).values()].sort();

const alunos = new Map();
for (const t of turmas.values()) {
  for (const [id, a] of t.alunos) {
    if (!alunos.has(id)) alunos.set(id, { nome: a.nome.trim(), email: a.email });
  }
}

// ── O que será feito ─────────────────────────────────────────────────────────
titulo(CONFIRMAR ? `EXECUTANDO  ·  semestre ${SEMESTRE}` : `SIMULAÇÃO  ·  semestre ${SEMESTRE}`);

const contasAtuais = await rest("professores?select=id,nome,user_id");
const comLogin = contasAtuais.filter(p => p.user_id);

item(`cronograma ..... ${CRONOGRAMA.data_inicio} a ${CRONOGRAMA.data_fim}, ${CRONOGRAMA.feriados.length} feriados`);
item(`professores .... ${professores.length}`);
item(`turmas ......... ${turmas.size}`);
item(`disciplinas .... ${grade.itens.length}`);
item(`alunos ......... ${alunos.size}`);
item(`matrículas ..... ${[...turmas.values()].reduce((s, t) => s + t.alunos.size, 0)}`);

titulo("SERÁ APAGADO");
item("presenças, notas, grupos, matrículas, aulas, disciplinas, turmas, alunos e professores");
item(`e ${comLogin.length} conta(s) de login de professor no Auth`);
console.log("");
item("Apagar a linha do professor sem apagar a conta dele criaria um buraco:");
item("a regra do sistema é «admin = quem está autenticado e não é professor»,");
item("então a conta órfã viraria administradora no próximo login.");

titulo("NÃO SERÁ TOCADO");
item("conteúdo do site, salas, contas de administrador e cronograma de outros semestres");

if (!CONFIRMAR) {
  titulo("NADA FOI ALTERADO");
  console.log("  Para executar de verdade:\n");
  console.log("      node scripts/importar/aplicar.mjs --confirmar\n");
} else {
  await executar();
}

// ── Execução ─────────────────────────────────────────────────────────────────
async function executar() {
titulo("1. REMOVENDO AS CONTAS DE LOGIN DOS PROFESSORES");
const naoRemovidas = [];
for (const p of comLogin) {
  const r = await fetch(`${BASE}/auth/v1/admin/users/${p.user_id}`, { method: "DELETE", headers: cabecalhos });
  if (!r.ok) naoRemovidas.push(p);
  console.log(`  ${r.ok ? "ok  " : "erro"} ${p.nome}`);
}

// Sem conseguir remover as contas, apagar a tabela `professores` promoveria
// todas elas a administradoras. Melhor parar antes de tocar em qualquer dado
// do que terminar num meio-termo perigoso.
if (naoRemovidas.length > 0) {
  titulo("INTERROMPIDO — NENHUM DADO FOI ALTERADO");
  item(`Não consegui remover ${naoRemovidas.length} conta(s) pela API do Supabase.`);
  console.log("");
  item("A API de administração do Auth está retornando 500 neste projeto");
  item('("Database error finding users"), o mesmo erro que quebra a aba Admin.');
  console.log("");
  item("Seguir apagando `professores` deixaria essas contas órfãs — e a regra");
  item("«admin = autenticado e não é professor» as tornaria ADMINISTRADORAS.");
  console.log("");
  item("Rode isto no editor SQL do Supabase e execute o script de novo:");
  console.log("");
  console.log("    delete from auth.users where id in (");
  console.log(naoRemovidas.map(p => `      '${p.user_id}'`).join(",\n"));
  console.log("    );");
  console.log("");
  return;
}

titulo("2. APAGANDO OS DADOS ACADÊMICOS");
// Ordem obrigatória: filho antes do pai. `aulas` leva as presenças junto por
// cascata, e `matriculas` precisa sair antes de `turmas`, cuja FK é RESTRICT.
for (const tabela of [
  "notas_disciplina", "grupo_alunos", "grupos", "matriculas",
  "aulas", "disciplinas", "turmas", "alunos", "professores",
]) {
  await apagarTudo(tabela);
  console.log(`  limpa: ${tabela}`);
}

titulo("3. CRONOGRAMA");
await rest(`cronogramas?semestre=eq.${encodeURIComponent(SEMESTRE)}`, { method: "DELETE" });
await inserir("cronogramas", [CRONOGRAMA]);
console.log(`  ${SEMESTRE}: ${CRONOGRAMA.data_inicio} a ${CRONOGRAMA.data_fim}`);

titulo("4. PROFESSORES");
const profsCriados = await inserir("professores", professores.map(nome => ({ nome, email: "", ativo: true })));
const idPorProfessor = new Map(profsCriados.map(p => [normalizar(p.nome), p.id]));
console.log(`  ${profsCriados.length} criados, todos sem login (a coordenação define os acessos)`);

titulo("5. TURMAS");
const turmasCriadas = await inserir("turmas", [...turmas.values()].map(t => ({
  nome: t.nome, semestre: t.entrada, curso: t.curso, turno: t.turno, ativa: true,
})));
const idPorTurma = new Map();
for (const t of turmas.values()) {
  const criada = turmasCriadas.find(x => x.nome === t.nome);
  if (criada) idPorTurma.set(`${t.curso}|${t.turno}|${t.modulo}`, criada.id);
  console.log(`  ${t.nome}  (${t.alunos.size} alunos)`);
}

titulo("6. SALAS E DISCIPLINAS");
const salas = await rest("salas?select=id,nome");
const idPorSala = new Map(salas.map(s => [normalizar(s.nome), s.id]));

const disciplinasCriadas = await inserir("disciplinas", grade.itens.map(i => ({
  nome: nomeCanonico(i.disciplina, i.curso),
  curso: i.curso,
  semestre_do_curso: i.modulo,
  dia_da_semana: i.diaDaSemana,
  sala_id: idPorSala.get(normalizar(capitalizar(i.sala))) ?? null,
  total_aulas: 16,
  emoji: "📚",
  ativa: true,
})));
console.log(`  ${disciplinasCriadas.length} disciplinas`);
const semSala = disciplinasCriadas.filter(d => !d.sala_id).length;
if (semSala) console.log(`  ⚠ ${semSala} sem sala vinculada`);

titulo("7. AULAS");
let totalAulas = 0, porCronograma = 0;
for (const celula of grade.itens) {
  const disc = disciplinasCriadas.find(d =>
    d.nome === nomeCanonico(celula.disciplina, celula.curso) &&
    d.curso === celula.curso && d.semestre_do_curso === celula.modulo);
  if (!disc) continue;

  for (const turno of ["Manhã", "Noite"]) {
    const turmaId = idPorTurma.get(`${celula.curso}|${turno}|${celula.modulo}`);
    if (!turmaId) continue;

    const turma = turmas.get(`${celula.curso}|${turno}|${celula.modulo}`);
    const reais = turma?.datas.get(disc.nome);
    const datas = reais ?? gerarDatasDoCronograma(CRONOGRAMA, celula.diaDaSemana);
    if (!reais) porCronograma++;

    await inserir("aulas", datas.map((data, i) => ({
      turma_id: turmaId,
      disciplina_id: disc.id,
      numero: i + 1,
      professor_id: idPorProfessor.get(normalizar(celula.professor)) ?? null,
      semana: Math.ceil((i + 1) / 3),
      data_aula: data,
      chamada_aberta: false,
    })));
    totalAulas += datas.length;
  }
}
console.log(`  ${totalAulas} aulas  (${porCronograma} grade(s) geradas pelo cronograma, sem datas na planilha)`);

titulo("8. ALUNOS E MATRÍCULAS");
const alunosCriados = await inserir("alunos", [...alunos.values()].map(a => ({
  nome: a.nome, email: a.email, ativo: true,
})));
const idPorAluno = new Map(alunosCriados.map(a => [a.email ?? `nome:${normalizar(a.nome)}`, a.id]));

const matriculas = [];
for (const t of turmas.values()) {
  const turmaId = idPorTurma.get(`${t.curso}|${t.turno}|${t.modulo}`);
  for (const [chave] of t.alunos) {
    const alunoId = idPorAluno.get(chave);
    if (alunoId && turmaId) {
      matriculas.push({
        aluno_id: alunoId, turma_id: turmaId,
        semestre_do_curso: t.modulo, situacao: "cursando",
      });
    }
  }
}
await inserir("matriculas", matriculas);
console.log(`  ${alunosCriados.length} alunos, ${matriculas.length} matrículas`);

titulo("PRONTO");
item("Confira no painel antes de liberar os acessos dos professores.");
console.log("");
}
