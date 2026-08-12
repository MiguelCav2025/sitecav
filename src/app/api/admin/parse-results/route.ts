import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { extrairNomes } from "./extractor";
import { requireAdmin } from "@/lib/auth/require-admin";

export type { CandidatoExtraido } from "./extractor";

// Força runtime Node.js (necessário para mammoth e pdf-parse no Vercel)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Somente administradores autenticados podem enviar arquivos para processamento
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let textoExtraido = "";

    if (file.name.toLowerCase().endsWith(".docx")) {
      const resultado = await mammoth.extractRawText({ buffer });
      textoExtraido = resultado.value;
    } else if (file.name.toLowerCase().endsWith(".pdf")) {
      // O codigo antigo importava "pdf-parse/lib/pdf-parse.js" — um caminho
      // interno da versao 1 da lib, criado para contornar um bug em que o
      // entry point carregava arquivos de teste. A versao 2 instalada aqui
      // nao expoe mais esse subcaminho no campo `exports`, entao o import
      // falhava no build e falharia tambem em execucao.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const resultado = await parser.getText();
        // A v2 insere um marcador "-- 1 of 3 --" entre as paginas. O extrator
        // de nomes o aceita como se fosse um candidato, entao cada quebra de
        // pagina viraria um aprovado fantasma na lista.
        textoExtraido = resultado.text.replace(/^[ \t]*--[ \t]*\d+[ \t]+of[ \t]+\d+[ \t]*--[ \t]*$/gm, "");
      } finally {
        await parser.destroy();
      }
    } else {
      return NextResponse.json(
        { error: "Formato não suportado. Use .docx ou .pdf" },
        { status: 400 }
      );
    }

    const candidatos = extrairNomes(textoExtraido);

    return NextResponse.json({
      textoExtraido,
      candidatos,
      total: candidatos.length,
    });
  } catch (error) {
    console.error("Erro ao processar arquivo:", error);
    return NextResponse.json({ error: "Erro ao processar o arquivo." }, { status: 500 });
  }
}
