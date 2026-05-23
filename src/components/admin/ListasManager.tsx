"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TurmasManager from "./listas/TurmasManager";
import AlunosManager from "./listas/AlunosManager";
import ProfessoresManager from "./listas/ProfessoresManager";
import AulasManager from "./listas/AulasManager";
import { Users, GraduationCap, BookOpen, UserCheck, ArrowRight } from "lucide-react";

const PASSOS = [
  { num: 1, label: "Crie as Turmas", sub: "ex: Animação Manhã 2026/2", tab: "turmas" },
  { num: 2, label: "Adicione os Alunos", sub: "por turma, ou importe do PS", tab: "alunos" },
  { num: 3, label: "Crie as Aulas", sub: "selecione a turma e gere as aulas", tab: "aulas" },
  { num: 4, label: "Cadastre Professores", sub: "vinculando às turmas deles", tab: "professores" },
];

export default function ListasManager() {
  const [subTab, setSubTab] = useState("turmas");

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-bold text-white">Gestão de Listas e Chamadas</h2>
        <p className="text-sm text-blue-200 mt-1">Configure turmas, alunos, aulas e professores para habilitar o controle de presença.</p>
      </div>

      {/* Guia de fluxo */}
      <div className="bg-white/10 border border-white/20 rounded-xl p-4">
        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider mb-3">Ordem de configuração</p>
        <div className="flex flex-wrap items-center gap-2">
          {PASSOS.map((p, i) => (
            <div key={p.num} className="flex items-center gap-2">
              <button
                onClick={() => setSubTab(p.tab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer
                  ${subTab === p.tab
                    ? "bg-orange-500 text-white font-semibold shadow"
                    : "bg-white/10 text-white hover:bg-white/20"
                  }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${subTab === p.tab ? "bg-white/30" : "bg-white/20"}`}>
                  {p.num}
                </span>
                <div className="text-left">
                  <p className="leading-none">{p.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{p.sub}</p>
                </div>
              </button>
              {i < PASSOS.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-white/30 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-white/10 border border-white/20 p-1 rounded-xl">
          <TabsTrigger
            value="turmas"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <GraduationCap className="h-4 w-4" /> Turmas
          </TabsTrigger>
          <TabsTrigger
            value="alunos"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <Users className="h-4 w-4" /> Alunos
          </TabsTrigger>
          <TabsTrigger
            value="aulas"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <BookOpen className="h-4 w-4" /> Aulas
          </TabsTrigger>
          <TabsTrigger
            value="professores"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <UserCheck className="h-4 w-4" /> Professores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="turmas" className="mt-4"><TurmasManager /></TabsContent>
        <TabsContent value="alunos" className="mt-4"><AlunosManager /></TabsContent>
        <TabsContent value="aulas" className="mt-4"><AulasManager /></TabsContent>
        <TabsContent value="professores" className="mt-4"><ProfessoresManager /></TabsContent>
      </Tabs>
    </div>
  );
}
