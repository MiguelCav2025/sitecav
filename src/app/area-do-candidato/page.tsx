import { createSupabaseServerClient as createClient } from "@/lib/supabase/server";
import { CheckCircle, Users, GraduationCap, Calendar, Mail, ExternalLink, MapPin, Clock, ClipboardList } from "lucide-react";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProcessData {
  inscription_start_date: string;
  inscription_end_date: string;
  semester: string;
  exam_date: string;
  exam_time: string;
  exam_location: string;
  result_date: string;
  inscription_link: string;
  page_mode: string;
}

interface Resultado {
  id: string;
  curso: string;
  periodo: string;
  nome: string;
  ordem: number;
  semestre: string;
}

// ─── Subcomponente: Tabela de aprovados ───────────────────────────────────────

function TabelaAprovados({
  titulo,
  periodo,
  aprovados,
  cor,
}: {
  titulo: string;
  periodo: string;
  aprovados: Resultado[];
  cor: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className={`${cor} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-white" />
            <h3 className="text-xl font-bold text-white">{titulo}</h3>
          </div>
          <span className="bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full">
            {periodo}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 text-gray-600">
          <Users className="h-5 w-5" />
          <span className="text-sm font-medium">
            {aprovados.length} aprovado{aprovados.length !== 1 ? "s" : ""}
          </span>
        </div>
        {aprovados.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">
            Nenhum aprovado cadastrado para esta turma.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    Nº
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nome do Candidato
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aprovados.map((r, index) => (
                  <tr key={r.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${cor} text-white text-sm font-bold`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{r.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponente: Página de Resultados ──────────────────────────────────────

function PaginaResultados({ resultados }: { resultados: Resultado[] }) {
  const semestre = resultados[0]?.semestre ?? "";

  const filtrar = (curso: string, periodo: string) =>
    resultados
      .filter((r) => r.curso === curso && r.periodo === periodo)
      .sort((a, b) => a.ordem - b.ordem);

  const animacaoManha = filtrar("Animação", "Manhã");
  const animacaoNoite = filtrar("Animação", "Noite");
  const cineTvManha = filtrar("Cine/TV", "Manhã");
  const cineTvNoite = filtrar("Cine/TV", "Noite");

  const total = animacaoManha.length + animacaoNoite.length + cineTvManha.length + cineTvNoite.length;

  return (
    <div className="bg-blue-900 min-h-screen pt-18 py-8 px-4 md:px-12">
      <div className="container mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-3 bg-green-500 text-white px-6 py-2 rounded-full mb-6">
            <CheckCircle className="h-6 w-6" />
            <span className="font-semibold">Resultado Oficial</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Resultado do Processo Seletivo
          </h1>
          {semestre && (
            <p className="text-xl md:text-2xl text-orange-400 font-semibold">
              CAV {semestre}
            </p>
          )}
        </div>

        {/* Aviso */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-12 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="flex-shrink-0 bg-orange-100 p-3 rounded-full">
              <Mail className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-2">Atenção Candidatos Aprovados</h2>
              <p className="text-gray-700 leading-relaxed">
                Entraremos em contato através do{" "}
                <strong>e-mail cadastrado no processo de inscrição</strong> para informar sobre
                datas, horários e documentos para a matrícula no curso.
              </p>
            </div>
          </div>
        </div>

        {/* Animação */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8 flex items-center justify-center gap-3">
            <span className="bg-purple-500 w-3 h-3 rounded-full" />
            Curso de Animação
            <span className="bg-purple-500 w-3 h-3 rounded-full" />
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <TabelaAprovados titulo="Animação" periodo="Manhã" aprovados={animacaoManha} cor="bg-purple-600" />
            <TabelaAprovados titulo="Animação" periodo="Noite" aprovados={animacaoNoite} cor="bg-purple-800" />
          </div>
        </div>

        {/* Cine/TV */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8 flex items-center justify-center gap-3">
            <span className="bg-orange-500 w-3 h-3 rounded-full" />
            Curso de Cine/TV
            <span className="bg-orange-500 w-3 h-3 rounded-full" />
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <TabelaAprovados titulo="Cine/TV" periodo="Manhã" aprovados={cineTvManha} cor="bg-orange-500" />
            <TabelaAprovados titulo="Cine/TV" periodo="Noite" aprovados={cineTvNoite} cor="bg-orange-700" />
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
          <p className="text-white text-lg">
            <span className="font-bold text-orange-400">{total}</span> candidatos aprovados no total
          </p>
          <p className="text-blue-200 text-sm mt-2">Parabéns a todos os aprovados!</p>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponente: Página de Processo Seletivo ───────────────────────────────

function PaginaProcessoSeletivo({ dados }: { dados: ProcessData }) {
  return (
    <div className="bg-blue-900 min-h-screen pt-18 py-8 px-4 md:px-12">
      <div className="container mx-auto">

        {/* Cabeçalho */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-2 rounded-full mb-6">
            <ClipboardList className="h-6 w-6" />
            <span className="font-semibold">Inscrições Abertas</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Processo Seletivo CAV
          </h1>
          {dados.semester && (
            <p className="text-xl md:text-2xl text-orange-400 font-semibold">{dados.semester}</p>
          )}
        </div>

        {/* Período de inscrições — largura total */}
        {(dados.inscription_start_date || dados.inscription_end_date) && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Período de Inscrições
            </h2>
            <p className="text-gray-700 text-lg">
              De <strong>{dados.inscription_start_date}</strong> até{" "}
              <strong>{dados.inscription_end_date}</strong>
            </p>
            <p className="mt-2 text-gray-600 text-sm">
              Os cursos são gratuitos e terão duração de 03 (três) semestres, com aulas e
              atividades diárias nos períodos matutino (9h00 às 12h00) ou noturno (19h00 às
              22h00), em <strong>FORMATO PRESENCIAL</strong>, no CAV — Rua Helena Jacquey, 208 –
              Rudge Ramos – São Bernardo do Campo/SP.
            </p>
          </div>
        )}

        {/* Requisitos / Vagas / Etapas — 3 colunas no desktop */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Requisitos</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
              <li>Ter, no mínimo, 16 anos de idade completos na data de matrícula</li>
              <li>Estar cursando ou ter finalizado o Ensino Médio</li>
              <li>Disponibilidade para frequentar o curso em regime presencial diário</li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Vagas</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
              <li>Animação | Manhã: 30 vagas</li>
              <li>Animação | Noite: 30 vagas</li>
              <li>Cine/TV | Manhã: 30 vagas</li>
              <li>Cine/TV | Noite: 30 vagas</li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Etapas</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700 text-sm">
              <li>
                <strong>Prova diagnóstica</strong> — questões de múltipla escolha e dissertativas.
                Pontuação máxima: 100 pts.
              </li>
              <li>
                <strong>Entrevista</strong> — aplicada se necessário como critério de desempate.
              </li>
            </ol>
            <p className="mt-3 text-xs text-gray-500">
              Vagas remanescentes serão abertas ao público mediante entrevista.
            </p>
          </div>
        </div>

        {/* Data da prova + Documentos — 2 colunas */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {(dados.exam_date || dados.exam_time || dados.exam_location) && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Local e Data da Prova
              </h2>
              <div className="space-y-3 text-gray-800 text-sm">
                {dados.exam_date && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span><strong>Data:</strong> {dados.exam_date}</span>
                  </p>
                )}
                {dados.exam_time && (
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span><strong>Horário:</strong> {dados.exam_time}</span>
                  </p>
                )}
                {dados.exam_location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span><strong>Local:</strong> {dados.exam_location}</span>
                  </p>
                )}
                {dados.result_date && (
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span><strong>Resultado:</strong> {dados.result_date}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Documentos para Matrícula</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
              <li>Documento de Identificação com foto</li>
              <li>Documento de comprovação de escolaridade</li>
              <li>Comprovante de Residência</li>
              <li>2 fotos 3×4</li>
            </ul>
            <p className="mt-4 text-sm font-semibold text-red-600">
              Atenção: Trazer documentos ORIGINAIS — usados apenas para consulta e devolvidos
              imediatamente. NÃO TRAZER CÓPIAS.
            </p>
          </div>
        </div>

        {/* Botão de inscrição */}
        {dados.inscription_link && (
          <div className="text-center pb-8">
            <Link
              href={dados.inscription_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-4 px-12 rounded-full text-lg shadow-lg transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl"
            >
              Fazer Inscrição
              <ExternalLink className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal (Server Component) ──────────────────────────────────────

export default async function AreaDoCandidatoPage() {
  const supabase = await createClient();

  // Busca configuração ativa
  const { data: processRows } = await supabase
    .from("process_data")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const processData = processRows?.[0] as ProcessData | undefined;
  const pageMode = processData?.page_mode ?? "processo_seletivo";

  // Se modo resultados, busca candidatos ativos
  let resultados: Resultado[] = [];
  if (pageMode === "resultados") {
    const { data } = await supabase
      .from("resultados_processo")
      .select("*")
      .eq("is_active", true)
      .order("ordem", { ascending: true });
    resultados = (data ?? []) as Resultado[];
  }

  if (pageMode === "resultados") {
    return <PaginaResultados resultados={resultados} />;
  }

  if (!processData) {
    return (
      <div className="bg-blue-900 min-h-screen pt-18 flex items-center justify-center">
        <p className="text-white text-lg">
          Informações do processo seletivo em breve.
        </p>
      </div>
    );
  }

  return <PaginaProcessoSeletivo dados={processData} />;
}
