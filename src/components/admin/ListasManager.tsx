"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TurmasManager from "./listas/TurmasManager";
import AlunosManager from "./listas/AlunosManager";
import ProfessoresManager from "./listas/ProfessoresManager";
import AulasManager from "./listas/AulasManager";
import { Users, GraduationCap, BookOpen, UserCheck } from "lucide-react";

export default function ListasManager() {
  const [subTab, setSubTab] = useState("turmas");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Gestão de Listas e Chamadas</h2>
        <p className="text-sm text-gray-500 mt-1">Cadastre turmas, alunos, professores e aulas para controle de presença.</p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="turmas" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-sm">
            <GraduationCap className="h-4 w-4" /> Turmas
          </TabsTrigger>
          <TabsTrigger value="alunos" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-sm">
            <Users className="h-4 w-4" /> Alunos
          </TabsTrigger>
          <TabsTrigger value="professores" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-sm">
            <UserCheck className="h-4 w-4" /> Professores
          </TabsTrigger>
          <TabsTrigger value="aulas" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-sm">
            <BookOpen className="h-4 w-4" /> Aulas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="turmas" className="mt-4"><TurmasManager /></TabsContent>
        <TabsContent value="alunos" className="mt-4"><AlunosManager /></TabsContent>
        <TabsContent value="professores" className="mt-4"><ProfessoresManager /></TabsContent>
        <TabsContent value="aulas" className="mt-4"><AulasManager /></TabsContent>
      </Tabs>
    </div>
  );
}
