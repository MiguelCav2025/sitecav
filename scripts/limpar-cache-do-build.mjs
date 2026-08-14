import { rmSync } from "node:fs";

/**
 * Apaga o cache incremental antes de cada build.
 *
 * POR QUE ISTO EXISTE
 *
 * O Tailwind 4 varre os arquivos em busca das classes usadas e guarda o
 * resultado. Quando uma classe NOVA aparece num arquivo que ele já visitou,
 * ele não revisita: a classe fica no código, some do CSS gerado, e o elemento
 * renderiza sem cor. Sem erro de build, sem aviso.
 *
 * Num dia isso escondeu um chip inteiro (branco sobre branco), apagou os dias
 * de aula do calendário e derrubou um `grid-cols-7`. Some conteúdo em vez de
 * quebrar, que é o pior modo de falhar — e some só em produção, porque é lá
 * que o cache sobrevive de um deploy para o outro.
 *
 * A correção era um passo manual: "Redeploy" na Vercel com a caixa do cache
 * desmarcada. Um passo manual que depende de alguém lembrar, num projeto no ar
 * com alunos reais, é um bug esperando a primeira distração.
 *
 * O PREÇO
 *
 * Sem `.next/cache`, o build recompila tudo. Aqui isso custa poucos segundos
 * — o projeto é pequeno. É barato perto de uma tela que vai ao ar sem cor.
 *
 * Se um dia o build ficar lento a ponto de incomodar, o caminho não é
 * reativar o cache e voltar a confiar na memória de alguém: é descobrir qual
 * parte do cache pode ficar.
 */
rmSync(".next/cache", { recursive: true, force: true });
console.log("cache do build apagado — o Tailwind vai revarrer tudo");
