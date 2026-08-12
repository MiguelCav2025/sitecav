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
      // Usa o arquivo interno da lib para evitar o problema de carregamento
      // de arquivos de teste que o entry point principal do pdf-parse faz
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const resultado = await pdfParse(buffer);
      textoExtraido = resultado.text;
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
