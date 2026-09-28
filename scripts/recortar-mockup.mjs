/**
 * Recorta os mockups aprovados por seção, na largura do print: referencias/desktop/<secao>.png
 * em 1440 e referencias/mobile/<secao>.png em 390. É o que o scripts/revisar.mjs põe ao
 * lado do print do site.
 *
 * Desktop (727 x 2164): limites medidos pela troca de cor das colunas de margem
 * (preto, vermelho, branco). O mockup não tem o bloco 09 (objeções): ele entrou pelo
 * prompt de execução e segue a linguagem das outras seções pretas.
 * Mobile (724 x 2172): oito telas de celular, quatro em cima e quatro embaixo. Cada
 * seção sai da tela onde ela aparece, com os limites medidos do mesmo jeito.
 *
 * Uso: node scripts/recortar-mockup.mjs
 */
import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const R = '../078 - Garagemk/Recursos Site'
const achar = (rel) => {
  let atual = R
  for (const parte of rel.split('/')) atual = path.join(atual, readdirSync(atual).find((n) => n.normalize('NFC') === parte.normalize('NFC')))
  return atual
}
const DESK = achar('DESKTOP/MOCKUP REFERÊNCIA DESKTOP.png')
const MOB = achar('MOBILE/MOCKUP REFERÊNCIA MOBILE.png')
mkdirSync('referencias/desktop', { recursive: true })
mkdirSync('referencias/mobile', { recursive: true })

const desktop = {
  '00-header': [0, 37],
  '01-hero': [0, 279],
  '02-prova': [279, 331],
  '03-sobre': [331, 561],
  '04-lavagem': [561, 844],
  '05-pintura': [844, 1042],
  '06-antes-depois': [1042, 1244],
  '07-diferenciais': [1244, 1360],
  '08-processo': [1360, 1442],
  '11-duvidas': [1442, 1633],
  '10-depoimentos': [1633, 1775],
  '12-cta': [1775, 1896],
  '13-rodape': [1896, 2164],
  'pagina-inteira': [0, 2164],
}
for (const [nome, [t, b]] of Object.entries(desktop))
  await sharp(DESK).extract({ left: 0, top: t, width: 727, height: b - t }).resize({ width: 1440, kernel: 'lanczos3' }).toFile(`referencias/desktop/${nome}.png`)

// telas do celular: [x inicial, x final] de cada uma
const TELA = { p1: [11, 178], p2: [194, 354], p3: [371, 537], p4: [548, 713], b1: [11, 178], b2: [193, 356], b3: [371, 537], b4: [548, 713] }
const mobile = {
  '01-hero': [['p1', 16, 518]],
  '02-prova': [['p1', 518, 770]],
  '03-sobre': [['p1', 770, 1640]],
  '04-lavagem': [['p2', 45, 1636]],
  '05-pintura': [['p3', 16, 1004]],
  '06-antes-depois': [['p3', 1004, 1640]],
  '07-diferenciais': [['p4', 44, 523]],
  '08-processo': [['p4', 523, 966]],
  '11-duvidas': [['p4', 966, 1640]],
  '10-depoimentos': [['b1', 1659, 2137]],
  '12-cta': [['b2', 1658, 2150]],
  '13-rodape': [['b3', 1660, 2150], ['b4', 1660, 2150]],
}
const L = 390
for (const [nome, partes] of Object.entries(mobile)) {
  const pedacos = []
  for (const [tela, t, b] of partes) {
    const [x0, x1] = TELA[tela]
    pedacos.push(await sharp(MOB).extract({ left: x0, top: t, width: x1 - x0, height: b - t }).resize({ width: L, kernel: 'lanczos3' }).toBuffer({ resolveWithObject: true }))
  }
  const altura = pedacos.reduce((s, p) => s + p.info.height, 0)
  let y = 0
  await sharp({ create: { width: L, height: altura, channels: 3, background: '#000' } })
    .composite(pedacos.map((p) => ({ input: p.data, left: 0, top: (y += p.info.height) - p.info.height })))
    .png()
    .toFile(`referencias/mobile/${nome}.png`)
}
console.log('ok referencias/desktop e referencias/mobile')
