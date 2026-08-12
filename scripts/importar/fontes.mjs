/**
 * Leitura das fontes que o coordenador entrega: a grade curricular (.docx) e
 * as listas de presença (.xlsx).
 *
 * Este módulo só LÊ e normaliza. Não conhece o banco, não grava nada. Assim
 * dá para conferir o que foi entendido antes de qualquer escrita.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const mammoth = require("mammoth");
const ExcelJS = require("exceljs");

export const PASTA_PADRAO = "docs/DADOS ATUAIS";

export const CURSOS = { ANIMACAO: "Animação", CINE_TV: "Cine/TV" };
export const TURNOS = { MANHA: "Manhã", NOITE: "Noite" };

/** Dias como o `Date.getDay()` usa. */
const DIA_POR_ABREVIACAO = {
  "2ª": 1, SEG: 1,
  "3ª": 2, TER: 2,
  "4ª": 3, QUA: 3,
  "5ª": 4, QUI: 4,
  "6ª": 5, SEX: 5,
};

/** Tira acento e caixa, para comparar nomes escritos de formas diferentes. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Título em caixa mista, para gravar bonito no banco. */
export function capitalizar(texto) {
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "para", "a", "à", "em", "com"]);
  return String(texto ?? "").trim().toLowerCase().split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ── Grade curricular (.docx) ─────────────────────────────────────────────────

/**
 * A grade é uma tabela: cada linha é um dia da semana e traz, em sequência,
 * 6 disciplinas (Animação 1-2-3, Cine/TV 1-2-3), depois os 6 professores,
 * depois as 6 salas. O extrator de texto entrega célula por célula, então a
 * leitura é posicional.
 */
export async function lerGrade(pasta = PASTA_PADRAO) {
  const arquivo = readdirSync(pasta).find(f => f.toLowerCase().endsWith(".docx"));
  if (!arquivo) return { itens: [], avisos: ["Nenhum .docx encontrado na pasta."] };

  const { value } = await mammoth.extractRawText({ path: path.join(pasta, arquivo) });
  const linhas = value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const itens = [];
  const avisos = [];
  const COLUNAS = [
    { curso: CURSOS.ANIMACAO, modulo: 1 }, { curso: CURSOS.ANIMACAO, modulo: 2 }, { curso: CURSOS.ANIMACAO, modulo: 3 },
    { curso: CURSOS.CINE_TV, modulo: 1 }, { curso: CURSOS.CINE_TV, modulo: 2 }, { curso: CURSOS.CINE_TV, modulo: 3 },
  ];

  for (let i = 0; i < linhas.length; i++) {
    const dia = DIA_POR_ABREVIACAO[linhas[i]];
    if (dia === undefined) continue;

    const bloco = linhas.slice(i + 1, i + 1 + 18);
    if (bloco.length < 18) {
      avisos.push(`Linha do dia "${linhas[i]}" incompleta na grade: ${bloco.length} de 18 células.`);
      continue;
    }

    COLUNAS.forEach((col, c) => {
      itens.push({
        diaDaSemana: dia,
        curso: col.curso,
        modulo: col.modulo,
        disciplina: bloco[c].trim(),
        professor: bloco[6 + c].trim(),
        sala: bloco[12 + c].trim(),
      });
    });
    i += 18;
  }

  return { arquivo, itens, avisos };
}

// ── Listas de presença (.xlsx) ───────────────────────────────────────────────

/**
 * O nome da aba carrega módulo, curso, turno e dia — e é a fonte mais
 * confiável do arquivo. O texto dentro da planilha tem erro de cópia: há aba
 * "Noite" cujo cabeçalho diz "MANHÃ".
 */
export function lerNomeDaAba(nome) {
  const limpo = String(nome ?? "").trim();
  const modulo = Number(/^(\d)\s*º/.exec(limpo)?.[1]);

  const n = normalizar(limpo);
  const curso = n.includes("ANIMA") ? CURSOS.ANIMACAO
    : /CINE|TV/.test(n) ? CURSOS.CINE_TV
    : null;
  const turno = n.includes("MANHA") ? TURNOS.MANHA
    : n.includes("NOITE") ? TURNOS.NOITE
    : null;

  const abrev = /-\s*([A-ZÇÃÕÁÉÍÓÚ]{3})\s*$/i.exec(limpo)?.[1];
  const diaDaSemana = abrev ? DIA_POR_ABREVIACAO[normalizar(abrev)] ?? null : null;

  return {
    modulo: Number.isInteger(modulo) && modulo >= 1 && modulo <= 3 ? modulo : null,
    curso, turno, diaDaSemana,
  };
}

const textoDaCelula = (c) => {
  const v = c?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v) return String(v.text).trim();
    if ("richText" in v) return v.richText.map(t => t.text).join("").trim();
    if ("result" in v) return String(v.result).trim();
  }
  return String(v).trim();
};

/** Só o primeiro e-mail, quando a célula traz vários separados por ; ou vírgula. */
const primeiroEmail = (texto) => {
  const m = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(String(texto ?? ""));
  return m ? m[0].toLowerCase() : null;
};

/**
 * Endereços da própria escola que aparecem numa linha de cabeçalho das
 * planilhas, junto do total de aulas. Sem isto o CAV entra como aluno de
 * todas as turmas.
 */
const EMAILS_INSTITUCIONAIS = /(nucleocav|operacoescav|reservascav|supervis[aã]ogeralcav)@/i;

/** Nome de pessoa tem ao menos dois termos. Serve para descartar lixo de planilha. */
const pareceNomeDePessoa = (nome) => {
  const limpo = String(nome ?? "").trim();
  return limpo.length >= 5 && limpo.split(/\s+/).filter(p => p.length > 1).length >= 2;
};

export async function lerPlanilhas(pasta = PASTA_PADRAO) {
  const arquivos = readdirSync(pasta).filter(f => f.toLowerCase().endsWith(".xlsx")).sort();
  const turmasDeAula = [];
  const avisos = [];

  for (const arquivo of arquivos) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(pasta, arquivo));

    for (const ws of wb.worksheets) {
      const cabecalhoAba = lerNomeDaAba(ws.name);
      if (!cabecalhoAba.modulo || !cabecalhoAba.curso || !cabecalhoAba.turno) {
        avisos.push(`${arquivo} → aba "${ws.name}": não consegui ler módulo/curso/turno do nome.`);
        continue;
      }

      // Linha 1 traz "DISCIPLINA - Nº CURSO - TURNO - PROFESSOR"
      const titulo = textoDaCelula(ws.getRow(1).getCell(1));
      const partes = titulo.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
      const disciplina = partes[0] ?? "";
      const professor = partes.length >= 4 ? partes[partes.length - 1] : "";

      // A linha de cabeçalho é a que tem "Nome" e "e-mail"
      let linhaCabecalho = 0;
      for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
        const valores = ws.getRow(r).values.map(v => normalizar(textoDaCelula({ value: v })));
        if (valores.includes("NOME") && valores.some(v => v.includes("MAIL"))) { linhaCabecalho = r; break; }
      }
      if (!linhaCabecalho) {
        avisos.push(`${arquivo} → aba "${ws.name}": não achei a linha de cabeçalho (Nome / e-mail).`);
        continue;
      }

      const alunos = [];
      let descartadas = 0;
      for (let r = linhaCabecalho + 1; r <= ws.rowCount; r++) {
        const linha = ws.getRow(r);
        const nome = textoDaCelula(linha.getCell(2));
        const bruto = textoDaCelula(linha.getCell(3));

        if (EMAILS_INSTITUCIONAIS.test(bruto)) continue; // linha de contato do CAV
        if (!nome) continue;                              // linha vazia
        if (!pareceNomeDePessoa(nome)) { descartadas++; continue; }

        alunos.push({ nome: nome.trim(), email: primeiroEmail(bruto) });
      }
      if (descartadas > 0) {
        avisos.push(`${arquivo} → aba "${ws.name}": ${descartadas} linha(s) com nome estranho foram ignoradas.`);
      }

      turmasDeAula.push({
        arquivo,
        aba: ws.name.trim(),
        ...cabecalhoAba,
        disciplina: disciplina.trim(),
        professor: professor.trim(),
        alunos,
      });
    }
  }

  return { arquivos, turmasDeAula, avisos };
}

/**
 * Semestre de entrada de uma turma que hoje está no módulo informado.
 * Turma no 3º módulo em 2026/2 entrou em 2025/2.
 */
export function entradaDaTurma(semestreAtual, modulo) {
  const [ano, sem] = semestreAtual.split("/").map(Number);
  const total = ano * 2 + (sem - 1) - (modulo - 1);
  return `${Math.floor(total / 2)}/${(total % 2) + 1}`;
}
