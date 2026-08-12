# sitecav — orientações para trabalhar neste repositório

Site institucional e sistema de gestão acadêmica do **CAV** (Centro de
Audiovisual de São Bernardo do Campo). Está **no ar**, em domínio da prefeitura,
com alunos e professores reais. Toda mudança chega em gente.

`docs/PLANO-DE-AJUSTES.md` é o documento vivo do resgate: problemas (P*),
decisões (D*), dúvidas em aberto (N*) e o registro de cada fase concluída.
**Ler antes de mexer** — muita regra daqui não se deduz do código.

## Como o trabalho acontece

- **Decidir antes de codar.** Dúvida de regra acadêmica vira pergunta numerada
  no plano. Quem responde é o coordenador do CAV, via o mantenedor. Regra
  inventada sem perguntar já se provou errada mais de uma vez.
- **Migração eu não aplico.** Todo SQL vai para `docs/MIGRACOES.sql`, em fases
  idempotentes com rollback comentado e um histórico de aplicação no topo. Quem
  roda no editor do Supabase é o mantenedor.
- **Nada pela metade.** Se algo ficou de fora, dizer qual e por quê.

## Regras do domínio que não estão óbvias no código

- 2 cursos (Animação, Cine/TV) × 3 módulos × 2 turnos = 12 turmas possíveis.
- **Aprovação tem dois níveis** (`src/lib/aprovacao.ts`): passa *na disciplina*
  com média ≥ 6 **e** ≥ 70% de presença; passa *no semestre* só quem passou em
  **todas** as disciplinas. Retido tem precedência sobre indefinido.
- **Banca só a partir do módulo 2.** O primeiro módulo não tem.
- Um aluno pode cursar **duas turmas ao mesmo tempo** — por isso a matrícula
  vive em tabela própria, e não numa coluna em `alunos`.
- **Datas de aula não escorregam.** Feriado não empurra as aulas seguintes; a
  aula daquele dia simplesmente não acontece.
- O diário de sala é **exclusivo do professor**. O coordenador não preenche.
- Chamada fechada **não reabre**, e o recálculo de grade nunca toca nela
  (`src/lib/recalculo-grade.ts`).

## Segurança — o que já foi consertado, para não regredir

- **Administrador é concessão explícita**: constar em `administradores` com
  `ativo = true`. Já foi "autenticado e não é professor", regra que promovia
  qualquer conta órfã ou importada. A checagem existe em três lugares e os três
  precisam concordar: `src/middleware.ts`, `src/lib/auth/require-admin.ts` e
  `is_admin()` no banco.
- **Nenhuma senha é definida por terceiros.** O professor recebe link de uso
  único por e-mail e cria a própria senha (`/api/admin/enviar-acesso` →
  `/auth/confirmar`). Não reintroduzir senha provisória.
- Rota nova sob `/api/admin/**` começa com `requireAdmin()`. Sem exceção.
- A service_role key só existe em código de servidor (`src/lib/supabase/admin.ts`).
  Nunca importar em componente client.

## Armadilha conhecida do ambiente

A API de **listagem** do Supabase Auth (`listUsers`) responde **500** neste
projeto — é falha do lado do Supabase. `generate_link`, `verifyOtp`,
`updateUserById` e o login funcionam. Não escrever nada que dependa de listar
usuários; usar `professores.user_id` / `administradores.user_id`.

## Comandos

```bash
npm test          # node --test, sem dependência de teste
npx tsc --noEmit  # checagem de tipos
npm run build     # pare o dev server antes: o build apaga .next embaixo dele
```

Lógica de regra vai em `src/lib/*.ts`, pura e testável, **fora** dos
componentes — foi assim que o cálculo de semestre parou de existir em quatro
cópias divergentes.

No Windows: mensagem de commit sempre em arquivo (`git commit -F`), e edição de
código nunca por cmdlet do PowerShell — os acentos corrompem.
