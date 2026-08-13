import {
  Images, Film, Building2, Camera, Palette, Users, Download, ClipboardList,
  Video, BookOpen, CalendarDays, GraduationCap, BookMarked, UserCheck,
  BarChart3, Settings, Award, DoorOpen, type LucideIcon,
} from "lucide-react";

export interface SecaoAdmin {
  /** Identificador usado na URL (?tab=). */
  value: string;
  label: string;
  /** Frase curta que explica o que se faz aqui. */
  ajuda: string;
  icone: LucideIcon;
  /** Só na área Escola: a ordem em que as coisas precisam ser feitas. */
  passo?: number;
}

export interface AreaAdmin {
  value: "site" | "escola" | "sistema";
  label: string;
  ajuda: string;
  icone: LucideIcon;
  secoes: SecaoAdmin[];
}

/**
 * O admin tinha 13 abas num nível só, misturando o conteúdo do site
 * institucional com a gestão da escola. Separar em áreas e, dentro da escola,
 * numerar na ordem do trabalho: sem cronograma não há datas, sem turma não há
 * alunos, sem disciplina não há aulas.
 */
export const AREAS: AreaAdmin[] = [
  {
    value: "site",
    label: "Site",
    ajuda: "Conteúdo que aparece para o público.",
    icone: Building2,
    secoes: [
      { value: "banners",                label: "Banners",           ajuda: "Imagens do carrossel da home",        icone: Images },
      { value: "portfolio",              label: "Portfólio",         ajuda: "Trabalhos dos alunos",                icone: Film },
      { value: "institutional_projects", label: "Projetos do CAV",   ajuda: "Projetos institucionais",             icone: Building2 },
      { value: "photo_gallery",          label: "Galeria",           ajuda: "Fotos da home",                       icone: Camera },
      { value: "oficinas",               label: "Oficinas",          ajuda: "Oficinas avulsas e inscrições",       icone: Palette },
      { value: "arte_educadores",        label: "Educadores",        ajuda: "Equipe de arte-educadores",           icone: Users },
      { value: "downloads",              label: "Downloads",         ajuda: "Documentos para o público baixar",    icone: Download },
      { value: "process_data",           label: "Processo Seletivo", ajuda: "Datas, resultados e gabarito",        icone: ClipboardList },
      { value: "ref_videos",             label: "Filmografia",       ajuda: "Vídeos de referência por curso",      icone: Video },
      { value: "ref_biblio",             label: "Bibliografia",      ajuda: "Leituras de referência por curso",    icone: BookOpen },
    ],
  },
  {
    value: "escola",
    label: "Escola",
    ajuda: "Gestão acadêmica. Siga a ordem numerada na primeira vez que configurar um semestre.",
    icone: GraduationCap,
    // "Módulo" é onde o aluno está no curso (1, 2 ou 3); "semestre" é o período
    // do calendário (2026/2). A aba se chamava Cronograma e falava das duas
    // coisas — ver D46 no plano.
    secoes: [
      { passo: 1, value: "cronograma",  label: "Calendário letivo", ajuda: "Início, fim e feriados do semestre", icone: CalendarDays },
      { passo: 2, value: "turmas",      label: "Turmas",      ajuda: "Turmas e os alunos de cada uma",       icone: GraduationCap },
      { passo: 3, value: "disciplinas", label: "Disciplinas", ajuda: "Matérias, aulas e professor de cada",  icone: BookMarked },
      { passo: 4, value: "professores", label: "Professores", ajuda: "Contas de acesso ao app",              icone: UserCheck },
      { passo: 5, value: "grupos",      label: "Notas e Banca", ajuda: "Grupos da banca e situação do aluno", icone: Award },
      { passo: 6, value: "relatorios",  label: "Relatórios",  ajuda: "Presença e conteúdo das aulas",        icone: BarChart3 },
    ],
  },
  {
    value: "sistema",
    label: "Sistema",
    ajuda: "Configurações e usuários do painel.",
    icone: Settings,
    secoes: [
      { value: "admin", label: "Administradores", ajuda: "Quem tem acesso ao painel", icone: Settings },
      // Sala é configuração de infraestrutura, não tarefa recorrente de
      // semestre — por isso fica aqui e não entre os passos da Escola.
      { value: "salas", label: "Salas",           ajuda: "Espaços onde as aulas acontecem", icone: DoorOpen },
    ],
  },
];

export const TODAS_AS_SECOES: SecaoAdmin[] = AREAS.flatMap(a => a.secoes);

export const SECAO_PADRAO = "banners";

/** Descobre a que área uma seção pertence, para a URL guardar só a seção. */
export function areaDaSecao(secao: string): AreaAdmin {
  return AREAS.find(a => a.secoes.some(s => s.value === secao)) ?? AREAS[0];
}

export function secaoValida(valor: string | null | undefined): string {
  return TODAS_AS_SECOES.some(s => s.value === valor) ? (valor as string) : SECAO_PADRAO;
}
