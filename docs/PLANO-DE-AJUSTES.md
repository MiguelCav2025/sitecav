# Plano de Ajustes — Site CAV

> Documento de trabalho. Última atualização: 12/08/2026 — rodada 3.

---

## 0. Regras de trabalho

1. **Nada é implementado enquanto houver dúvida aberta na seção 8.** Primeiro a lógica, depois o código.
2. **Este documento é atualizado a cada rodada** e a cada fase implementada.
3. **SQL não sai aos pedaços.** Vai sendo montado em [`docs/MIGRACOES.sql`](MIGRACOES.sql), revisado, e só é aplicado quando eu disser que está pronto.
4. **Código modular, UI bem feita, nada pela metade.** Sem atalho.

IDs: `F` feito · `P` problema · `D` decisão · `N` dúvida aberta · `I` implicação

---

## 1. O que já foi feito

| ID | Item | Status |
|---|---|---|
| F1 | Projeto resgatado (`MiguelCav2025/sitecav`), build e dev rodando | ✅ |
| F2 | `.env.local` com as 4 variáveis | ✅ |
| F3 | 5 rotas `/api/admin/*` exigindo sessão **e** papel de admin | ✅ |
| F4 | `middleware.ts` protegendo páginas restritas no servidor | ✅ |
| F5 | `next.config.mjs` + `.ts` fundidos (o `.ts` era ignorado) | ✅ |
| F6 | Removidos `page.tsx.bak` e config duplicada | ✅ |
| F7 | RLS ligado em `photo_gallery` e `process_data` | ✅ |
| F8 | Função `public.is_admin()` criada (ainda inerte) | ✅ |
| F9 | Policies de storage para `downloads` e `site-assets` | ✅ |
| F10 | Git fixado na conta `MiguelCav2025`, isolado de Goli/Cinehub | ✅ |

### Fase 1 — Integridade da chamada e diário de sala ✅

| Item | O que foi feito |
|---|---|
| SQL | `conteudo_ministrado` e `chamada_fechada_em`; triggers do `D6`; check dos 30 caracteres; `descricao` removida |
| `professor/dashboard` | Campo de conteúdo com contador e mínimo de 30 (`D4`) |
| `professor/dashboard` | Fechar chamada pede confirmação e avisa que não há volta (`D6`) |
| `professor/dashboard` | `data_aula` preservada; fechamento vai para `chamada_fechada_em` (`D7`) |
| `professor/dashboard` | Aula fechada não é mais clicável; vira card de registro, com o conteúdo resumido (`D22`) |
| `professor/dashboard` | Presença agora verifica erro e **desfaz** o botão verde se o banco recusar (`P4`) |

### Fase 2 — Professor é regente, não dono ✅

| Item | O que foi feito |
|---|---|
| SQL | `professores.user_id` + `ativo`; FK do `id` para `auth.users` removida; `is_admin()` por `user_id` |
| SQL | `aulas.disciplina_id` → `CASCADE`; `aulas.professor_id` → `RESTRICT` |
| SQL | Travas: aula fechada não troca de professor; disciplina com histórico não se apaga; `disciplinas.ativa` |
| Consultas de professor | `require-admin`, login do admin, login do professor, troca de senha e dashboard passam a buscar por `user_id` |
| `professor/login` | Professor inativo não entra, mas mantém o histórico |
| `ProfessoresManager` | Criação grava `user_id`; **Desativar** preserva o histórico; **Excluir** só funciona para quem nunca teve aula |
| `DisciplinasManager` | Reatribuir regente afeta **só as aulas ainda abertas** |
| `Disciplinas`/`Aulas` | Listas de professor mostram apenas os ativos |

**Verificado:** build limpo, type-check limpo, 11 páginas públicas em 200, rotas de API em 401 sem sessão, páginas restritas redirecionando. Dados conferidos: 17 professores todos com login preservado, 960 aulas, **zero órfãs**.

### Fase 3 — RLS: admin e professor deixam de ser a mesma coisa ✅

| Item | O que foi feito |
|---|---|
| Funções | `professor_atual()`, `professor_leciona_turma()`, `professor_leciona_disciplina()`, `professor_dono_da_aula()`, `aula_ainda_aberta()` — todas `SECURITY DEFINER` |
| `professores` | Admin total; professor lê **só a própria linha** |
| `aulas` | Admin total; professor lê só as dele e só atualiza as **abertas** |
| `turmas` / `disciplinas` | Admin total; professor lê só onde tem aula |
| `alunos` | Admin total; professor lê só os alunos das **turmas em que leciona** |
| `presencas` | Admin total; professor grava só nas **suas aulas ainda abertas** |
| Conteúdo do site | Escrita passou de "qualquer autenticado" para **`is_admin()`** em 12 tabelas; leitura pública intacta |
| Triggers de coluna | RLS controla linhas, não colunas: dois triggers impedem o professor de se reativar, mudar nome/e-mail, ou alterar a data planejada da aula |

**Verificado com a chave anon** (a mesma que vai no navegador): 0 de 166 alunos, 0 de 960 aulas, 0 de 17 professores, 0 de 12 turmas, 0 de 30 disciplinas. Leitura pública do site idêntica em todas as tabelas com dados. 11 páginas em 200.

> ⚠️ **Não testei com sessão real de professor** — não tenho credencial e não vou pedir senha. As policies com escopo de professor estão verificadas por construção, mas convém você entrar como professor e confirmar que ele vê as disciplinas dele e consegue fechar uma chamada.

### Fase 4 — PWA instalável ✅

| Item | O que foi feito |
|---|---|
| Ícones | `scripts/gerar-icones-pwa.mjs` gera 192, 512, maskable-512 e apple-touch a partir do logo do CAV, sobre o azul da marca. Versionado para poder regerar |
| `manifest.webmanifest` | `display: standalone`, `start_url: /professor/dashboard`, **`scope: /professor/`** |
| Escopo | O manifest é declarado só no layout do professor — o site institucional **não** oferece instalação a visitantes. Verificado página a página |
| iOS | `apple-mobile-web-app-capable`, título e `apple-touch-icon` no layout do professor |
| `InstalarApp` | Componente próprio em `components/pwa/`. Some sozinho se já instalado; usa o `beforeinstallprompt` no Android para instalar com um clique; instruções do Safari no iOS; instruções genéricas no resto |
| Primeiro acesso | O componente aparece na tela de troca de senha (`D28`) |

**Sem service worker**, conforme `D1` — não há offline. Isso é o suficiente para instalar no iOS; no Android moderno também, mas convém confirmar num aparelho real (ver `N15`).

> ⚠️ **Não verifiquei visualmente** a tela de primeiro acesso: ela exige sessão de professor. O componente está compilado no bundle, mas o teste de tela é seu.

### Fase 5 — Gabarito do processo seletivo ✅

| Item | O que foi feito |
|---|---|
| SQL | `gabaritos` + `gabarito_itens`, com RLS: leitura pública só do que está publicado, escrita só admin |
| Rascunho | Gabarito nasce **despublicado**. Só aparece no site depois de publicado, e não deixa publicar sem respostas cadastradas |
| `lib/gabarito.ts` | Parser do gabarito colado em texto livre + detector de buracos na numeração. **11 testes passando** |
| `GabaritoManager` | Entrada em massa por colagem (`1-A 2-B`, `1. A, 2) B`, misturados), tabela editável, aviso de questões faltando |
| `CardGabarito` | Card público no topo da página de resultados, com grade responsiva de número → resposta |
| Admin | Fica na aba **Processo Seletivo**, que é a mesma página pública que ele controla |

**Resiliente ao deploy fora de ordem:** a página de resultados foi testada com a tabela ainda inexistente e respondeu 200 — a consulta falha, o código cai para lista vazia e o card não aparece. Como o site está no ar em modo "resultados", isso importa.

### Fase 6 — Reorganização do admin ✅

| Item | O que foi feito |
|---|---|
| `lib/admin-navegacao.ts` | A estrutura do painel vira dado: áreas, seções, ícones, textos de ajuda e a ordem dos passos |
| `NavegacaoAdmin` | Navegação em dois níveis — área (Site / Escola / Sistema) e depois seção. No celular a lista de seções vira dropdown |
| Escola numerada | Cronograma (1) → Turmas (2) → Disciplinas (3) → Professores (4) → Relatórios (5) |
| `admin/dashboard` | Reescrito: some o dropdown único de 13 opções e o código morto de breakpoint; cada seção mapeia direto para o seu manager |
| Arquivos removidos | `ListasManager` (absorvido pela navegação), `AulasManager` e `AlunosManager` |

**Verificado visualmente** em desktop e mobile, por página temporária de preview — já removida — porque `/admin/dashboard` exige sessão de coordenador.

#### Correção ao diagnóstico do `P1`

`AulasManager` e `AlunosManager` **não eram importados em lugar nenhum**: o `ListasManager` só renderizava Cronograma, Turmas, Disciplinas e Professores. Ou seja, a tela que criava aulas sem `disciplina_id` nunca foi alcançável pela interface — o risco era um arquivo morto ser religado no futuro. Agora foi apagado.

### P20 — A rota de importar resultados estava quebrada para PDF 🔴 corrigido

O código importava `pdf-parse/lib/pdf-parse.js`, um caminho interno da **versão 1** da biblioteca. A versão instalada é a **2.4.5**, que não expõe mais esse subcaminho no `exports` — então a importação falhava no build **e** falharia em execução. Só o `.docx` funcionava.

Reescrito para a API v2 (`new PDFParse({ data }).getText()`), validado com um PDF gerado no teste.

E apareceu um efeito colateral: a v2 insere marcadores `-- 1 of 3 --` entre as páginas, e o extrator de nomes os aceita como se fossem candidatos. Sem tratar, **cada quebra de página viraria um aprovado fantasma** na lista publicada. A rota passa a limpar esses marcadores; comprovado por teste que reproduz o bug e confirma a correção.

> ⚠️ **Correção de um relato meu:** eu havia afirmado que a fusão do `next.config` tinha resolvido o erro do `pdf-parse`. Estava errado — eu tinha olhado só o fim da saída do build, e esse erro aparece no início. A fusão do config foi necessária, mas não era a causa.

> Nada commitado. Tudo no working tree. Produção intocada.

---

## 2. Como o sistema funciona hoje

### 2.1 Os três "semestre"

| Campo | O que é | Exemplo |
|---|---|---|
| `turmas.semestre` | Semestre de **entrada** da turma (coorte) | `2025/1` |
| `disciplinas.semestre_do_curso` | Em qual dos 3 semestres **do curso** a matéria é dada | `2` |
| `cronogramas.semestre` | Semestre **letivo** — calendário real, com feriados | `2026/1` |

Turma que entrou em `2025/2` cursando disciplina do `2º semestre` → letivo `2026/1` → busca o cronograma → gera as datas. **Matemática conferida e correta.**

### 2.2 Datas das aulas — está certo como está

A aula tem **dia fixo na semana**. Se cai feriado, aquela aula **não acontece** — a disciplina termina com menos aulas. As datas **nunca deslizam**. Se o total pedido for maior que os dias disponíveis, as aulas sobrando ficam sem data.

### 2.3 Vínculo professor ↔ disciplina

Não existe tabela ligando os dois. É derivado de `aulas.professor_id` + `aulas.disciplina_id`. A tabela `professor_turmas` existe mas nenhum código usa.

### 2.4 Índices confirmados

- `presencas_aula_id_aluno_id_key` UNIQUE `(aula_id, aluno_id)`
- `aulas_turma_disciplina_numero_unique` UNIQUE `(turma_id, disciplina_id, numero)`

---

## 3. Problemas

| ID | Problema | Gravidade |
|---|---|---|
| **P2** | Professor não tem onde registrar o conteúdo dado | 🔴 |
| **P7** | No banco, professor e admin são a mesma coisa. Com a chave anon (pública), professor lê e altera **todos** os alunos, presenças e o site inteiro | 🔴 |
| **P13** | Admin com 13 abas misturando site institucional e gestão acadêmica | 🔴 |
| **P15** | Progressão é da turma, não do aluno. Não existe reprovar um aluno | 🔴 |
| **P3** | Fechar chamada sobrescreve `data_aula`, destruindo a data do cronograma | 🟠 |
| **P4** | Escritas de presença não verificam erro — botão fica verde mesmo se falhar | 🟠 |
| **P14** | Mudar dia da semana / total de aulas / feriados não regenera as datas | 🟠 |
| **P1** | Duas telas criam aulas; a de Listas cria sem `disciplina_id` (0 casos em produção) | 🟡 |
| **P6** | `chamada_aberta = true` significa **finalizada**. Nome invertido | 🟡 |
| **P8** | PWA não existe (sem manifest, ícones ou service worker) | 🟡 |
| **P9** | `/api/admin/list-users` retorna "Database error finding users" | 🟡 |
| **P10** | Regra de semestre duplicada em dois arquivos | 🟡 |
| **P11** | "Semestre atual" fixo em julho, ignorando o cronograma | 🟡 |
| **P12** | `professor_turmas` sem uso; bucket `project-images` órfão | 🟡 |
| **P16** | `aulas.descricao` ficou **sem dono** (ver `D5`) | 🟡 |
| **P18** | `aulas.disciplina_id` tem `ON DELETE SET NULL`: **apagar uma disciplina transforma as aulas dela em órfãs** — exatamente o cenário do `P1`, por outro caminho. E entra em contradição direta com tornar a coluna `NOT NULL` na fase 5 | 🔴 |
| **P19** | `aulas.professor_id` tem `ON DELETE SET NULL`: apagar um professor apaga a **autoria do diário de sala**. O conteúdo da aula fica órfão, sem dizer quem lecionou | 🟠 |
| **P5** | ~~`upsert` sem índice único~~ — índice existe | ⛔ |
| **P17** | ~~"Excluir aula" mentiria sobre remover presenças~~ — `presencas_aula_id_fkey` **é** `CASCADE`. O aviso está correto | ⛔ |

---

## 4. Decisões

### Chamada e diário de sala

| ID | Decisão |
|---|---|
| **D2** | Registro do conteúdo em campo **novo**, separado |
| **D4** | Conteúdo **obrigatório**, mínimo **30 caracteres**, com aviso na tela |
| **D5** | ⚠️ **CORRIGIDA:** o coordenador **não** preenche conteúdo. **Só o professor.** O campo começa vazio |
| **D6** | Chamada fechada é **definitiva**. Ninguém reabre. Abono é processo físico |
| **D7** | `data_aula` = data planejada (cronograma), nunca sobrescrita. Campo novo para o fechamento real |
| **D22** | Aula fechada **não é mais clicável** no app do professor. Aparece como fechada |

### Grade e calendário

| ID | Decisão |
|---|---|
| **D8** | Coordenador edita os **feriados** do semestre |
| **D9** / **D17** | Coordenador edita o **total de aulas** da disciplina |
| **D14** | Datas **não deslizam**. Feriado = uma aula a menos |
| **D12** | Semestre atual vem do **cronograma**, não do corte fixo de julho |
| **D23** | Recálculo da grade **nunca toca em aula fechada**, e mostra um resumo antes de confirmar |

### Estrutura do curso

| ID | Decisão |
|---|---|
| **D10** | Curso tem sempre **3 semestres**, nos cursos Cine/TV e Animação |
| **D11** | O 1º semestre é formado pelos **aprovados no processo seletivo** |
| **D13** | **Só um caminho** para criar aulas: dentro da disciplina |
| **N6** | ✅ Aprovada a reorganização do admin (seção 7) |

### Notas e aprovação

| ID | Decisão |
|---|---|
| **D18** | Cada professor lança a nota da **sua** disciplina. O aluno tem várias notas por semestre |
| **D19** | A nota da **banca** é uma só por semestre, vinda do **grupo** do aluno |
| **D20** | Nota final da disciplina = `(nota do professor + nota da banca) ÷ 2`, aprovado com **≥ 6** |
| **D21** | **Grupo = equipe dentro da turma** (ex.: 5 alunos que fazem um filme juntos). Todos recebem a **mesma** nota de banca |
| **D16** | Presença: **≥ 70% das aulas efetivamente dadas** |
| **D24** | **A progressão é por aluno, não por turma.** Nem todos passam de semestre |
| **D25** | No fim do semestre o coordenador tem uma tela com os alunos **abaixo do esperado** (nota ou presença) e decide, um a um, aprovar ou reter |
| **D26** | Desistente **sai da turma**, mas o histórico dele é preservado |
| **D27** | Relatório: fazer primeiro o mais **rápido** (CSV), melhorar depois |
| **D29** | ✅ **Tabela de matrículas aprovada** (seção 6) |
| **D30** | ⭐ **Os dados acadêmicos ainda são de teste** — turmas, alunos, aulas e presenças não estão em uso real. Podemos migrar e reestruturar à vontade. **O site institucional, esse sim, está no ar** e exige cuidado |
| **D31** | **Gabarito:** lista de itens `número → resposta`, com a resposta em **texto livre** — a maioria é `12-C`, mas alguns podem ser por extenso |
| **D32** | **Apagar `aulas.descricao`.** O diário de sala é responsabilidade exclusiva do professor; o coordenador só acompanha |

### PWA

| ID | Decisão |
|---|---|
| **D1** | Só instalável (manifest, ícones, tela cheia). Sem offline |
| **D28** | No **primeiro acesso**, o PWA explica como instalar o ícone **e** obriga a troca de senha |
| **D3** | Escopo do professor no RLS deriva de `aulas.professor_id` |

---

## 5. O PWA do professor — fluxo acordado

1. Coordenador cria o professor com senha provisória.
2. **Primeiro acesso:** explica como instalar o ícone **e** obriga troca de senha.
3. Professor vê **suas disciplinas** → turmas → aulas.
4. Clica na aula aberta → **lista de alunos**.
5. Faz a **chamada**.
6. Escreve o **conteúdo ministrado** (mín. 30 caracteres, campo vazio, só ele preenche).
7. **Fecha a chamada** → grava tudo, sem volta. A aula deixa de ser clicável.
8. Alimenta os **relatórios do coordenador**.
9. Professor **nunca** acessa o admin.

| Etapa | Situação |
|---|---|
| Login | ✅ existe |
| Troca de senha no 1º acesso | ✅ existe |
| Instruções de instalação | ❌ |
| Disciplinas → turmas → aulas | ✅ existe |
| Chamada | ✅ existe (falta tratar erro) |
| Campo de conteúdo | ❌ |
| Aula fechada não clicável | ❌ |
| Trava de reabertura no banco | ❌ |

---

## 6. P15 — A mudança mais profunda: progressão por aluno

Hoje o sistema assume que **a turma inteira avança junta**: `semestre_do_curso` é calculado a partir da data de entrada da turma. Não existe o conceito de um aluno ficar para trás.

Pelo `D24`/`D25`, isso precisa mudar: o aluno tem **sua própria** posição no curso e **sua própria** situação.

### O problema do histórico

Se um aluno reprova no 1º semestre e repete, ele passa a estudar com a **turma seguinte**. Se simplesmente trocarmos o `turma_id` dele, as presenças e notas antigas continuam existindo (elas apontam para a aula/disciplina, não para a turma atual) — mas fica impossível responder "quem era aluno desta turma no semestre passado", porque a resposta mudou.

### Proposta: tabela de matrículas

Em vez de o aluno pertencer a uma turma, ele tem **matrículas** ao longo do tempo:

```
matriculas
├── aluno_id
├── turma_id
├── semestre_do_curso      (1, 2 ou 3)
├── situacao               (cursando / aprovado / retido / desistente / concluido)
├── iniciada_em
└── encerrada_em
```

Assim: reprovou no 1º semestre → a matrícula vira `retido` e abre-se uma **nova** matrícula na turma seguinte, também no 1º semestre. O histórico fica inteiro e datado. Desistente → matrícula vira `desistente` e é encerrada; ele some das chamadas futuras sem perder nada do passado.

É mais trabalho agora, mas é o que permite responder "o que aconteceu com esse aluno" daqui a dois anos. Ver `N9`.

---

## 6-B. O professor é regente, não dono (P18 / P19)

Regra de domínio: **a disciplina não pertence ao professor.** Ele é o regente dela naquele período. A cada ~1 ano e meio entra edital novo, professores saem e outros assumem. Um pode dar 3 disciplinas, outro só 1. Nada disso pode quebrar o histórico.

### O que quebra hoje

| Situação | O que acontece hoje | Deveria |
|---|---|---|
| Trocar o professor de uma disciplina no meio do semestre | A tela atualiza **todas** as aulas, inclusive as já fechadas — o diário de sala muda de autor retroativamente | Só as aulas **ainda não dadas** mudam de professor |
| Professor sai da escola e o login é apagado | `professores.id` **é** o `auth.users.id`. Apagar o login apaga o professor, que por `SET NULL` apaga a autoria das aulas | O professor vira inativo e o histórico permanece |
| Apagar uma disciplina | As aulas viram órfãs (`SET NULL`), com chamadas e diários pendurados no nada | Disciplina com aula fechada **não se apaga** — desativa |

### Desenho proposto

**1. Separar o professor do login.** Hoje `professores.id` é o próprio `auth.users.id`, então a vida do registro está amarrada à vida da credencial. Passar a ter `id` próprio e um `user_id` **opcional** apontando para `auth.users`. Sair do edital = revogar o login e marcar `ativo = false`; o registro e todo o histórico continuam.

**2. Congelar a autoria da aula.** Nenhuma aula fechada muda de `professor_id`. Trava no banco, não só na UI.

**3. Reatribuição só olha para a frente.** Trocar o regente afeta apenas as aulas ainda abertas.

**4. Exclusão vira desativação onde há histórico.**
- `aulas.professor_id` → `ON DELETE RESTRICT` (não se apaga professor com aula lecionada)
- `aulas.disciplina_id` → `ON DELETE CASCADE` + trava impedindo apagar disciplina que tenha aula fechada

Assim "apagar" só funciona para corrigir engano recente. O que tem história se desativa.

---

## 7. Reorganização do admin (aprovada)

```
SITE                          ESCOLA
├── Banners                   ├── 1. Cronograma do semestre
├── Portfólio                 │      (início, fim, feriados)
├── Projetos do CAV           ├── 2. Turmas
├── Galeria                   │      └── alunos dentro da turma
├── Oficinas                  ├── 3. Disciplinas
├── Educadores                │      └── aulas + professor dentro
├── Downloads                 ├── 4. Professores
├── Processo Seletivo         ├── 5. Fechamento de semestre
│     └── gabarito            └── 6. Relatórios
├── Filmografia
└── Bibliografia
```

A aula deixa de ser aba solta e passa a viver **dentro da disciplina** — onde já é criada corretamente hoje. Isso resolve `P1` por construção, sem trava no banco. A numeração comunica a sequência: sem cronograma não há datas, sem turma não há alunos, sem disciplina não há aulas.

---

## 8. Dúvidas

✅ **Nenhuma dúvida bloqueante.** `N9`, `N10` e `N11` foram respondidas (viraram `D29`, `D31` e `D32`). A implementação está liberada.

- ~~**N14**~~ — ✅ **Aprovado** o desenho da seção 6-B, incluindo separar o registro do professor do login.

- **N15 🔍** — Testar num **celular real** (um Android e um iPhone): o app instala e abre em tela cheia? Se o Android não oferecer instalação, a solução é um service worker mínimo, **sem cache** — não é offline, é só o que alguns navegadores exigem para liberar a instalação.
- **N16 🔍** — Entrar com uma **conta de professor** e confirmar: vê só as disciplinas dele, consegue fechar uma chamada, e a tela de primeiro acesso mostra o convite de instalação.

Dois pontos menores, com default assumido — só me avise se discordar:

- **N12** — O gabarito é **um por semestre** ou **um por curso** (Animação e Cine/TV podem ter provas diferentes)? *Default assumido:* o gabarito tem um campo `curso` **opcional** — em branco vale para os dois, preenchido vale só para um. Assim atende os dois casos sem decidir agora.
- **N13** — `P19`: apagar um professor apaga a autoria do diário de sala. *Default assumido:* na fase 10, trocar a FK para impedir a exclusão de professor que já tenha aula lecionada, e passar a **desativar** em vez de apagar.

### O gabarito (pedido 10)

Aparece no topo de `/area-do-candidato` **somente** quando `process_data.page_mode = "resultados"` — o mesmo botão que o coordenador já usa para virar a página de "Processo Seletivo" para "Resultados".

```
gabaritos                      gabarito_itens
├── semestre    (ex: 2026/1)   ├── gabarito_id
├── curso       (opcional)     ├── numero      (int)
├── titulo                     ├── resposta    (text — "C" ou por extenso)
└── is_active                  └── unique(gabarito_id, numero)
```

---

## 9. Fases de implementação

Cada fase só começa quando a anterior estiver revisada. O documento é atualizado ao fim de cada uma.

| Fase | O que entra | Depende de |
|---|---|---|
| ~~**1**~~ | ~~Integridade da chamada + conteúdo no PWA~~ | ✅ **CONCLUÍDA** |
| ~~**2**~~ | ~~Professor regente + integridade de exclusões~~ | ✅ **CONCLUÍDA** |
| ~~**3**~~ | ~~RLS das tabelas de dados pessoais~~ — fechou o `P7` inteiro, incluindo o conteúdo do site | ✅ **CONCLUÍDA** |
| ~~**4**~~ | ~~PWA instalável + primeiro acesso~~ | ✅ **CONCLUÍDA** |
| ~~**5**~~ | ~~Gabarito do processo seletivo~~ | ✅ **CONCLUÍDA** |
| ~~**6**~~ | ~~Reorganização do admin~~ — resolveu `P13` e `P1`, e de quebra o `P20` | ✅ **CONCLUÍDA** |
| **7** | Cronograma editável + recálculo seguro (`P14`,`D8`,`D9`,`D23`) | ← próxima |
| **8** | Grupos, notas e banca (`D18`–`D21`) | — |
| **9** | Fechamento de semestre e progressão por aluno (`P15`,`D24`–`D26`,`D29`) | — |
| **10** | Relatórios (`D27`) | fases 8 e 9 |
| **11** | Limpezas (`P6`,`P10`,`P11`,`P12`,`P16`) e investigar `P9` | — |

> A fase 2 subiu de posição porque a função `is_admin()` e todo o RLS consultam a tabela `professores`. Reestruturar depois obrigaria a refazer as policies.

> As policies de RLS das tabelas novas entram **junto** com a fase que as cria, não depois.

---

## 10. Migração

Montada em [`docs/MIGRACOES.sql`](MIGRACOES.sql), por fase, revisada antes de aplicar.

| Fase | O que a migração precisa fazer |
|---|---|
| 1 | `conteudo_ministrado` e `chamada_fechada_em` em `aulas`; travas do `D6`; **apagar `descricao`** (`D32`) |
| 3 | Policies com `is_admin()` + escopo do professor |
| 4 | `gabaritos` + `gabarito_itens` |
| 5 | `disciplina_id` **NOT NULL** em `aulas` — exige trocar a FK de `SET NULL` para `CASCADE` antes (`P18`) |
| 7 | `grupos`, `grupo_alunos`, `notas_disciplina` |
| 8 | `matriculas` + migrar o vínculo atual `alunos.turma_id` |
| 10 | Remover `professor_turmas` e o bucket `project-images`; FK de professor (`P19`) |

> `D30`: como os dados acadêmicos são de teste, as migrações podem ser destrutivas sem cerimônia. O cuidado fica com as tabelas do **site**, que estão no ar.
