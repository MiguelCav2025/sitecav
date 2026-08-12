/**
 * Gera os ícones do PWA a partir do logo do CAV.
 *
 *   node scripts/gerar-icones-pwa.mjs
 *
 * O logo é largo (800x350) e transparente, então cada ícone é montado sobre um
 * quadrado na cor da marca. Ícones "maskable" usam uma área útil menor porque o
 * Android recorta as bordas em formatos variados (círculo, squircle...).
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO = "public/images/LOGO LARANJA CAV.png";
const DESTINO = "public/icons";
const FUNDO = { r: 0x17, g: 0x25, b: 0x54, alpha: 1 }; // blue-950, o mesmo do header do app

/**
 * Proporção da largura do ícone ocupada pelo logo. O logo é bem largo
 * (2.3:1), então ocupar pouca largura deixa o texto ilegível no tamanho de
 * um ícone de tela inicial. Daí os valores altos.
 */
const OCUPACAO = { normal: 0.9, maskable: 0.66 };

async function gerar(tamanho, arquivo, modo = "normal") {
  const larguraLogo = Math.round(tamanho * OCUPACAO[modo]);

  const logo = await sharp(LOGO)
    .resize({ width: larguraLogo, fit: "inside", withoutEnlargement: false })
    .toBuffer();

  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: FUNDO },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${DESTINO}/${arquivo}`);

  console.log(`  ${arquivo.padEnd(28)} ${tamanho}x${tamanho}  (logo a ${Math.round(OCUPACAO[modo] * 100)}%)`);
}

await mkdir(DESTINO, { recursive: true });
console.log("Gerando ícones do PWA:");
await gerar(192, "icon-192.png");
await gerar(512, "icon-512.png");
await gerar(512, "icon-maskable-512.png", "maskable");
await gerar(180, "apple-touch-icon.png");
console.log("Pronto.");
