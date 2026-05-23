"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TurmasManager from "./listas/TurmasManager";
import ProfessoresManager from "./listas/ProfessoresManager";
import DisciplinasManager from "./listas/DisciplinasManager";
import CronogramaManager from "./listas/CronogramaManager";
import { GraduationCap, BookOpen, UserCheck, CalendarDays, ArrowRight } from "lucide-react";

const PASSOS: { num: number; label: string; sub: string; tab: "cronograma" | "turmas" | "disciplinas" | "professores" }[] = [
  { num: 1, label: "Cronograma", sub: "datas do semestre e feriados", tab: "cronograma" },
  { num: 2, label: "Crie as Turmas", sub: "clique no card para adicionar alunos", tab: "turmas" },
  { num: 3, label: "Crie as Disciplinas", sub: "defina nome, semestre e nº de aulas", tab: "disciplinas" },
  { num: 4, label: "Cadastre Professores", sub: "vincule às disciplinas deles", tab: "professores" },
];

export default function ListasManager() {
  const [subTab, setSubTab] = useState<"cronograma" | "turmas" | "disciplinas" | "professores">("turmas");

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
      <Tabs value={subTab} onValueChange={v => setSubTab(v as "cronograma" | "turmas" | "disciplinas" | "professores")}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-white/10 border border-white/20 p-1 rounded-xl">
          <TabsTrigger
            value="cronograma"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <CalendarDays className="h-4 w-4" /> Cronograma
          </TabsTrigger>
          <TabsTrigger
            value="turmas"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <GraduationCap className="h-4 w-4" /> Turmas e Alunos
          </TabsTrigger>
          <TabsTrigger
            value="disciplinas"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <BookOpen className="h-4 w-4" /> Disciplinas
          </TabsTrigger>
          <TabsTrigger
            value="professores"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:font-semibold"
          >
            <UserCheck className="h-4 w-4" /> Professores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cronograma" className="mt-4"><CronogramaManager /></TabsContent>
        <TabsContent value="turmas" className="mt-4"><TurmasManager /></TabsContent>
        <TabsContent value="disciplinas" className="mt-4"><DisciplinasManager /></TabsContent>
        <TabsContent value="professores" className="mt-4"><ProfessoresManager /></TabsContent>
      </Tabs>
    </div>
  );
}
