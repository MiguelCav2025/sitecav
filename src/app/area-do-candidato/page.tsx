"use client"

import { CheckCircle, Users, GraduationCap, Calendar, Mail } from 'lucide-react';

// Dados dos aprovados
const animacaoManha = [
    "Danil Kallai Meneses Mugnani",
    "Daniele Correia da Cunha",
    "Elias Tomé Junior",
    "Emmanuel Victor Genuino Silva",
    "Erick Andreassa",
    "Estela Takahashi Silveira de Araujo",
    "Fabio Marque Santana",
    "Gabriel Morais Lemes",
    "Gabriel Silva Scheffer Mori",
    "Janine Ierullo Silva",
    "Katrina Pietra Gonçalves de Almeida",
    "Luiza Rodrigues Pacca",
    "Nicolas Nakama",
    "Robson Cordeiro",
    "Vinícius Ferreira Tunes",
    "William Cavalini"
];

const animacaoNoite = [
    "Adilson Carvalho Lins",
    "Ana Clara Lima Manoel",
    "Ângelo Spindola Vó",
    "Bruno Eduardo da Silva Lima",
    "Danilo Koji da Silva Mesquita",
    "Davi Abreu De Carvalho",
    "Gabriel Alberto Ferreira",
    "Gustavo Rosseb do Nascimento Nogueira",
    "Isabella Santos da Penha",
    "Jefferson Monteiro dos Santos",
    "Miguel Macedo Triani",
    "Pedro Henrique Mendes de Oliveira Lima",
    "Theo Silva dos Santos",
    "Vyctor Nobrega Barbieri"
];

const cineTvManha = [
    "Amanda de Andrade Braga",
    "Anna Clara de Oliveira Silva",
    "Beatriz Seifert da Rocha",
    "Gabriel Freger Lima",
    "Joelma Schmidt Alves",
    "João Pedro Bazani Lopes",
    "Kelly Barbosa Costa Da Silva",
    "Lucas Montiel Bucof Astolfi",
    "Luis Eduardo Pinto Souza",
    "Natalia Muniz Dornelas",
    "Pedro Guilherme Brandão Baio Gomes",
    "Sophia Alves de Oliveira Silva"
];

const cineTvNoite = [
    "Amanda Silva Mendes",
    "Anita Sampaio Zanutto",
    "André Luiz Ferreira Luciano",
    "Bianca Santos Pereira",
    "Carla Nakajuni",
    "Dagoberto Trevizan",
    "Daniel de Oliveira Santos",
    "Diogo Alves Viana",
    "Dominik Marcelle Silva",
    "Edilene Kayene Valdemiro Oliveira",
    "Eduarda Rocha Silva",
    "Emely Vittoria Gomes Carvalho",
    "Gabriel Morganti Santelo Ferreira",
    "Iris de Araujo Miranda",
    "João Carlos Barbosa de Souza",
    "Lucca Gomes Xavier",
    "Marcos Vinicius Carneiro de Jesus",
    "Morena Flor Murias Dantas",
    "Natália Fernandes Almeida",
    "Paulo Henrique dos Santos Braz",
    "Ualisson Sena Bezerra",
    "Vitor Casagrande Morassi",
    "Vitória Bezerra da Silva"
];

// Componente de Tabela de Aprovados
const TabelaAprovados = ({ titulo, periodo, aprovados, corDestaque }: { 
    titulo: string, 
    periodo: string,
    aprovados: string[],
    corDestaque: string 
}) => (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className={`${corDestaque} px-6 py-4`}>
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
                <span className="text-sm font-medium">{aprovados.length} aprovado{aprovados.length > 1 ? 's' : ''}</span>
            </div>
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
                        {aprovados.map((nome, index) => (
                            <tr key={index} className="hover:bg-blue-50 transition-colors">
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${corDestaque} text-white text-sm font-bold`}>
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-800 font-medium">
                                    {nome}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default function ResultadoProcessoSeletivoPage() {
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
                    <p className="text-xl md:text-2xl text-orange-400 font-semibold">
                        CAV 2026/1 – 1º Semestre de 2026
                    </p>
                </div>

                {/* Aviso Importante */}
                <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-12 max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <div className="flex-shrink-0 bg-orange-100 p-3 rounded-full">
                            <Mail className="h-8 w-8 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-blue-900 mb-2">
                                Atenção Candidatos Aprovados
                            </h2>
                            <p className="text-gray-700 leading-relaxed">
                                Entraremos em contato através do <strong>e-mail cadastrado no processo de inscrição</strong>, no início de fevereiro, para informar sobre datas, horários e documentos para a matrícula no curso.
                            </p>
                            <div className="mt-4 flex items-center gap-2 bg-blue-50 p-3 rounded-lg">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <span className="text-blue-800 font-semibold">
                                    Início do ano letivo: 26 de fevereiro de 2026
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção Animação */}
                <div className="mb-12">
                    <h2 className="text-3xl font-bold text-white text-center mb-8 flex items-center justify-center gap-3">
                        <span className="bg-purple-500 w-3 h-3 rounded-full"></span>
                        Curso de Animação
                        <span className="bg-purple-500 w-3 h-3 rounded-full"></span>
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <TabelaAprovados 
                            titulo="Animação" 
                            periodo="Manhã"
                            aprovados={animacaoManha}
                            corDestaque="bg-purple-600"
                        />
                        <TabelaAprovados 
                            titulo="Animação" 
                            periodo="Noite"
                            aprovados={animacaoNoite}
                            corDestaque="bg-purple-800"
                        />
                    </div>
                </div>

                {/* Seção Cine/TV */}
                <div className="mb-12">
                    <h2 className="text-3xl font-bold text-white text-center mb-8 flex items-center justify-center gap-3">
                        <span className="bg-orange-500 w-3 h-3 rounded-full"></span>
                        Curso de Cine/TV
                        <span className="bg-orange-500 w-3 h-3 rounded-full"></span>
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <TabelaAprovados 
                            titulo="Cine/TV" 
                            periodo="Manhã"
                            aprovados={cineTvManha}
                            corDestaque="bg-orange-500"
                        />
                        <TabelaAprovados 
                            titulo="Cine/TV" 
                            periodo="Noite"
                            aprovados={cineTvNoite}
                            corDestaque="bg-orange-700"
                        />
                    </div>
                </div>

                {/* Rodapé com Total */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                    <p className="text-white text-lg">
                        <span className="font-bold text-orange-400">
                            {animacaoManha.length + animacaoNoite.length + cineTvManha.length + cineTvNoite.length}
                        </span>
                        {" "}candidatos aprovados no total
                    </p>
                    <p className="text-blue-200 text-sm mt-2">
                        Parabéns a todos os aprovados! Nos vemos em 2026.
                    </p>
                </div>
            </div>
        </div>
    );
}
