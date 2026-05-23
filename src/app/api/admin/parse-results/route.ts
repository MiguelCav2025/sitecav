import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { extrairNomes } from "./extractor";

export type { CandidatoExtraido } from "./extractor";

// pdf-parse não exporta default em ESM — usar require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let textoExtraido = "";

    if (file.name.endsWith(".docx")) {
      const resultado = await mammoth.extractRawText({ buffer });
      textoExtraido = resultado.value;
    } else if (file.name.endsWith(".pdf")) {
      const resultado = await pdfParse(buffer);
      textoExtraido = resultado.text;
    } else {
      return NextResponse.json({ error: "Formato não suportado. Use .docx ou .pdf" }, { status: 400 });
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
