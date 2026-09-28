/**
 * Baixa as fontes do Google Fonts e grava no próprio site (src/assets/fonts), com o
 * @font-face em src/css/_fontes.css (base do 077).
 *
 * O mockup aprovado da Criatto usa uma sans larga e pesada, em caixa alta, nos títulos
 * ("IDEIAS SÓLIDAS EM OBRAS REAIS.") e uma sans limpa no texto. Ficou assim (base do 078):
 * - 'Archivo' variável, largura de 100% a 125% e peso de 500 a 800, num arquivo só:
 *   títulos em 125% / 800 (a Archivo Expanded ExtraBold do prompt do mockup) e menu,
 *   botões e rótulos em 100% a 112% / 600 a 700.
 * - 'Manrope' variável de 400 a 700: texto corrido.
 * - Fallbacks com size-adjust medidos contra a fonte real (Arial Black pros títulos,
 *   Arial pro resto): enquanto a fonte chega, o texto ocupa quase o mesmo espaço e a
 *   linha não quebra diferente (CLS).
 *
 * O CSS do Google pedido sem user agent de navegador devolve TTF estático, que o
 * opentype.js lê pra medir; com user agent de navegador, WOFF2 variável cortado por
 * alfabeto (vale o bloco latin).
 *
 * Uso: node scripts/baixar-fontes.mjs   (ou npm run fontes)
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import subsetFont from 'subset-font'
import opentype from 'opentype.js'

const CACHE = 'scripts/.cache'
mkdirSync('src/assets/fonts', { recursive: true })
mkdirSync(CACHE, { recursive: true })
mkdirSync('src/css', { recursive: true })

// letras do site: ASCII, Latin-1 (acentos do português) e a pontuação tipográfica usada
let LETRAS = ''
for (let c = 0x20; c <= 0x7e; c++) LETRAS += String.fromCharCode(c)
for (let c = 0xa0; c <= 0xff; c++) LETRAS += String.fromCharCode(c)
LETRAS += '‘’“”•…·→★©'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function baixar(familia, arq, { navegador = false } = {}) {
  const destino = `${CACHE}/${arq}`
  if (existsSync(destino)) return readFileSync(destino)
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${familia}`, navegador ? { headers: { 'User-Agent': UA } } : {})).text()
  const bloco = navegador ? [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].find(([, sub]) => sub === 'latin')?.[2] : css
  const url = bloco?.match(/url\((https:[^)]+)\)/)?.[1]
  if (!url) throw new Error(`sem url de fonte para ${familia}:\n${css.slice(0, 300)}`)
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  writeFileSync(destino, buf)
  console.log('baixada', arq, Math.round(buf.length / 1024) + ' KB')
  return buf
}

const kb = (b) => (b.length / 1024).toFixed(1) + ' KB'
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

// largura média de um texto de referência, em em
const AMOSTRA_TITULO = 'CONSTRUÍMOS UTI. IMAGINE O CUIDADO COM SUA CASA. DO ALICERCE AO ACABAMENTO, UMA CONSTRUTORA SÓ. ONDE ERRAR NÃO É UMA OPÇÃO. TRANSFORMAÇÕES QUE VALORIZAM.'
const AMOSTRA_TEXTO = 'Construção de casas e reforma de apartamentos de alto padrão em Goiânia. A equipe que entrega hospitais cuida da sua obra, com prazo e custo sob controle, do planejamento à entrega da chave.'
const largura = (fonte, texto) => fonte.getAdvanceWidth(texto, fonte.unitsPerEm) / fonte.unitsPerEm

function fallback(nome, fonte, local, arqLocal, amostra) {
  const ref = opentype.parse(ab(readFileSync(arqLocal)))
  const ajuste = largura(fonte, amostra) / largura(ref, amostra)
  const upm = fonte.unitsPerEm
  const hhea = fonte.tables.hhea
  const pct = (v) => (v * 100).toFixed(2) + '%'
  return `@font-face {
  font-family: '${nome}';
  src: ${local.map((l) => `local('${l}')`).join(', ')};
  size-adjust: ${pct(ajuste)};
  ascent-override: ${pct(hhea.ascender / upm / ajuste)};
  descent-override: ${pct(Math.abs(hhea.descender) / upm / ajuste)};
  line-gap-override: ${pct((hhea.lineGap || 0) / upm / ajuste)};
}`
}

const saida = ['/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */']

// ---------------------------------------------------------------- Archivo variável (títulos, menu, botões)
const archivo = await baixar('Archivo:wdth,wght@100..125,500..800', 'archivo-var-latin.woff2', { navegador: true })
let archivoWoff2
try {
  archivoWoff2 = await subsetFont(archivo, LETRAS, { targetFormat: 'woff2', variationAxes: { wdth: { min: 100, max: 125, default: 100 }, wght: { min: 500, max: 800, default: 500 } } })
} catch (e) {
  console.log('aviso: subset-font não limitou os eixos, vai a variável inteira:', e.message)
  archivoWoff2 = await subsetFont(archivo, LETRAS, { targetFormat: 'woff2' })
}
writeFileSync('src/assets/fonts/archivo-var.woff2', archivoWoff2)
console.log('ok archivo-var.woff2', kb(archivoWoff2))
saida.push(`@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 500 800;
  font-stretch: 100% 125%;
  font-display: swap;
  src: url('/assets/fonts/archivo-var.woff2') format('woff2');
}`)
// medidas: a instância 125/800 (títulos) contra a Arial Black; a 100/600 (menu e botões) contra a Arial negrito
const archivoTitulo = opentype.parse(ab(await baixar('Archivo:wdth,wght@125,800', 'archivo-125-800.ttf')))
const archivoUtil = opentype.parse(ab(await baixar('Archivo:wght@600', 'archivo-100-600.ttf')))
saida.push(fallback('Archivo Titulo fallback', archivoTitulo, ['Arial Black', 'ArialMT-Black'], 'C:/Windows/Fonts/ariblk.ttf', AMOSTRA_TITULO))
saida.push(fallback('Archivo fallback', archivoUtil, ['Arial Bold', 'Arial-BoldMT', 'Arial'], 'C:/Windows/Fonts/arialbd.ttf', AMOSTRA_TITULO))

// ---------------------------------------------------------------- Manrope variável 400 a 700 (texto)
const manrope = await baixar('Manrope:wght@400..700', 'manrope-var-latin.woff2', { navegador: true })
let manropeWoff2
try {
  manropeWoff2 = await subsetFont(manrope, LETRAS, { targetFormat: 'woff2', variationAxes: { wght: { min: 400, max: 700, default: 400 } } })
} catch (e) {
  console.log('aviso: subset-font não limitou o eixo, vai a variável inteira:', e.message)
  manropeWoff2 = await subsetFont(manrope, LETRAS, { targetFormat: 'woff2' })
}
writeFileSync('src/assets/fonts/manrope-var.woff2', manropeWoff2)
console.log('ok manrope-var.woff2', kb(manropeWoff2))
saida.push(`@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/assets/fonts/manrope-var.woff2') format('woff2');
}`)
const manrope400 = opentype.parse(ab(await baixar('Manrope:wght@400', 'manrope-400.ttf')))
saida.push(fallback('Manrope fallback', manrope400, ['Arial', 'Helvetica', 'Roboto'], 'C:/Windows/Fonts/arial.ttf', AMOSTRA_TEXTO))

writeFileSync('src/css/_fontes.css', saida.join('\n') + '\n')
console.log('src/css/_fontes.css gravado')
const cap = (f) => f.tables.os2.sCapHeight / f.unitsPerEm
console.log(`altura de maiúscula: Archivo 125/800 ${cap(archivoTitulo).toFixed(3)} em, Manrope ${cap(manrope400).toFixed(3)} em`)
