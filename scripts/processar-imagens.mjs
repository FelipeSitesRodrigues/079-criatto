/**
 * Gera as imagens do site a partir de "../079 - CRIATTO/Recursos Site", em src/assets/img,
 * em AVIF e WebP e em várias larguras pra srcset. Grava src/assets/img/manifesto.json com
 * largura e altura de cada arquivo (pro width/height do <img>, sem salto de layout). Base do 078.
 *
 * - Hero: a casa à noite, deitada no computador (DESKTOP/IMAGEM HERO DESKTOP) e em pé no
 *   celular (MOBILE/IMAGEM HERO MOBILE), as duas feitas pelo Felipe pro mockup.
 * - Logo (01 LOGO, letra branca: só em fundo escuro) e favicons (01 LOGO - ICONE).
 * - Sobre: detalhe da entrada da mesma casa do hero, como no mockup.
 * - Serviços: 8 cartões (src/dados/servicos.json), 16:9 no foco de cada um.
 * - Obras: a galeria (src/dados/obras.json), 3:2. As fotos do hospital vieram alaranjadas
 *   (balanço de branco da câmera): "neutralizar" puxa a média das cores pro cinza, com a
 *   força do JSON (0 a 1), sem apagar a luz quente de verdade do ambiente.
 * - Antes e depois: os 4 pares (src/dados/antes-depois.json), os dois lados no mesmo 16:9.
 * - Alta complexidade: a sala de tomografia do Hospital Santa Luzia, 2:1.
 * - Logos de cliente: preto sobre transparente, a partir dos PNGs do site antigo (uns vêm
 *   preto no branco, outros branco no preto).
 * - Concreto: a textura das seções claras de concreto (antes e depois, resultados), um
 *   ladrilho sem emenda.
 *
 * O desenho do CTA final sai do scripts/vetorizar-desenho.mjs (desenho.svg e desenho-traco-*.png)
 * e a imagem de compartilhamento do scripts/og.mjs: os dois ficam quando este roda de novo.
 * No fim ele chama o scripts/marca-contorno.mjs (o marcador laranja dos rótulos).
 *
 * Uso: node scripts/processar-imagens.mjs   (ou npm run imagens)
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const R = '../079 - CRIATTO/Recursos Site'
const OUT = 'src/assets/img'
const PRETO = { r: 11, g: 11, b: 11 } // #0B0B0B, o preto obra da paleta

// acha o arquivo mesmo que o nome venha com acento em outra normalização (NFC/NFD)
function achar(relativo) {
  let atual = R
  for (const parte of relativo.split('/')) {
    const nome = readdirSync(atual).find((n) => n.normalize('NFC') === parte.normalize('NFC'))
    if (!nome) throw new Error(`falta o arquivo: ${atual}/${parte}`)
    atual = path.join(atual, nome)
  }
  return atual
}

// esvazia a pasta; ficam o desenho do CTA (vetorizar-desenho.mjs) e a imagem de compartilhamento (og.mjs)
mkdirSync(OUT, { recursive: true })
const manifestoAntigo = existsSync(path.join(OUT, 'manifesto.json')) ? JSON.parse(readFileSync(path.join(OUT, 'manifesto.json'), 'utf8')) : {}
const fica = (f) => f.startsWith('og-') || f.startsWith('desenho') || f.startsWith('marca-')
for (const f of readdirSync(OUT)) if (!fica(f)) rmSync(path.join(OUT, f), { recursive: true, force: true })
mkdirSync('src/raiz', { recursive: true })
const manifesto = Object.fromEntries(Object.entries(manifestoAntigo).filter(([f]) => fica(f)))

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}

// uma imagem (arquivo ou buffer) em várias larguras, AVIF e WebP
async function variantes(origem, nome, larguras, { q = 74, alfa = false, avif = null } = {}) {
  for (const w of larguras) {
    for (const f of ['avif', 'webp']) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      p =
        f === 'avif'
          ? p.avif(avif || { quality: Math.round(q - 22), effort: 7, chromaSubsampling: '4:4:4' })
          : p.webp({ quality: q, effort: 6, smartSubsample: true, ...(alfa ? { alphaQuality: 90 } : {}) })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

// abre, gira pelo EXIF e aplica um recorte relativo [x, y, largura, altura] (0 a 1)
async function abrir(relativo, recorte) {
  const buf = await sharp(achar(relativo)).rotate().toBuffer()
  if (!recorte) return buf
  const m = await sharp(buf).metadata()
  const [x, y, w, h] = recorte
  return sharp(buf)
    .extract({ left: Math.round(x * m.width), top: Math.round(y * m.height), width: Math.round(w * m.width), height: Math.round(h * m.height) })
    .toBuffer()
}

// recorte na proporção pedida (largura inteira ou altura inteira), centrado no foco
async function proporcao(buf, razao, focoY = 0.5, focoX = 0.5) {
  const m = await sharp(buf).metadata()
  let w = m.width
  let h = Math.round(w / razao)
  if (h > m.height) {
    h = m.height
    w = Math.round(h * razao)
  }
  const top = Math.max(0, Math.min(m.height - h, Math.round(focoY * m.height - h / 2)))
  const left = Math.max(0, Math.min(m.width - w, Math.round(focoX * m.width - w / 2)))
  return sharp(buf).extract({ left, top, width: w, height: h }).toBuffer()
}

// balanço de branco pelo "mundo cinza": a média de cada canal vai na direção da média geral
async function neutralizar(buf, forca) {
  if (!forca) return buf
  const { channels } = await sharp(buf).stats()
  const [r, g, b] = channels.slice(0, 3).map((c) => c.mean)
  const media = (r + g + b) / 3
  const ganho = [r, g, b].map((c) => 1 + (media / c - 1) * forca)
  return sharp(buf).linear(ganho, [0, 0, 0]).toBuffer()
}

// ---------------------------------------------------------------- hero
await variantes(achar('DESKTOP/IMAGEM HERO DESKTOP.png'), 'hero-desk', [960, 1280, 1672], { q: 72 })
// 760: o Lighthouse de celular é 412 px em tela 1,75x (721 px), e a de 720 ficava 1 px curta
// AVIF mais leve (é o LCP do celular): qualidade 40 em 4:2:0 não faz faixa no céu e cai de 50 pra 35 KB
await variantes(achar('MOBILE/IMAGEM HERO MOBILE.png'), 'hero-cel', [480, 640, 760, 941], { q: 70, avif: { quality: 40, effort: 8, chromaSubsampling: '4:2:0' } })

// ---------------------------------------------------------------- logo e favicons
const logo = await sharp(achar('01 LOGO.png')).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
console.log(`logo recortado: ${logo.info.width}x${logo.info.height}`)
await variantes(logo.data, 'logo', [160, 240, 320, 480], { q: 88, alfa: true })

const simbolo = await sharp(achar('01 LOGO - ICONE - FAVICON.png')).trim({ threshold: 1 }).png().toBuffer()
const quadrado = async (lado, fundo, margem) => {
  const util = Math.round(lado * (1 - margem * 2))
  const ic = await sharp(simbolo).resize({ width: util, height: util, fit: 'inside' }).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } }).composite([{ input: ic, gravity: 'center' }])
}
const preto = { ...PRETO, alpha: 1 }
const pngIcone = { palette: true, quality: 92, compressionLevel: 9, effort: 10 }
await (await quadrado(32, preto, 0.08)).png(pngIcone).toFile('src/raiz/favicon-32.png')
await (await quadrado(180, preto, 0.16)).png(pngIcone).toFile('src/raiz/apple-touch-icon.png')
await (await quadrado(192, preto, 0.16)).png(pngIcone).toFile('src/raiz/icon-192.png')
await (await quadrado(512, preto, 0.16)).png(pngIcone).toFile('src/raiz/icon-512.png')
// favicon.ico com o PNG de 32 embutido (o formato ICO aceita PNG desde o Vista)
const png32 = await (await quadrado(32, preto, 0.08)).png(pngIcone).toBuffer()
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18)
writeFileSync('src/raiz/favicon.ico', Buffer.concat([ico, png32]))

// ---------------------------------------------------------------- sobre: a entrada da casa do hero
// o mockup mostra um detalhe da mesma casa (fachada, ripado de madeira e a luz da entrada)
{
  const casa = await abrir('DESKTOP/IMAGEM HERO DESKTOP.png', [0.5, 0.2, 0.5, 0.72])
  await variantes(await proporcao(casa, 1.39, 0.55, 0.55), 'sobre', [560, 836], { q: 74 })
}

// ---------------------------------------------------------------- serviços: 16:9 no foco
{
  const { itens } = JSON.parse(readFileSync('src/dados/servicos.json', 'utf8'))
  for (const s of itens) {
    let buf = await abrir(s.foto.arquivo, s.foto.recorte)
    buf = await neutralizar(buf, s.foto.neutralizar)
    await variantes(await proporcao(buf, 16 / 9, s.foto.focoY ?? 0.5), `serv-${s.id}`, [420, 700], { q: 72 })
  }
}

// ---------------------------------------------------------------- obras: 3:2
{
  const { itens } = JSON.parse(readFileSync('src/dados/obras.json', 'utf8'))
  for (const o of itens) {
    let buf = await abrir(o.arquivo, o.recorte)
    buf = await neutralizar(buf, o.neutralizar)
    await variantes(await proporcao(buf, 3 / 2, o.focoY ?? 0.5), `obra-${o.id}`, [420, 700], { q: 72 })
  }
}

// ---------------------------------------------------------------- antes e depois: mesmo 16:9 nos dois lados
{
  const { itens } = JSON.parse(readFileSync('src/dados/antes-depois.json', 'utf8'))
  for (const p of itens) {
    for (const lado of ['antes', 'depois']) {
      const buf = await sharp(achar(p[lado].arquivo)).resize({ width: 1600, height: 900, fit: 'cover', position: 'centre' }).toBuffer()
      await variantes(buf, `ad-${p.id}-${lado}`, [420, 700], { q: 72 })
    }
  }
}

// ---------------------------------------------------------------- alta complexidade: a tomografia
{
  let buf = await abrir('IMAGENS SERVIÇOS/fotos folder/escolhidas/obras hospitalares/TOMOGRAFIA HSL - OBRA CDI.JPG')
  buf = await neutralizar(buf, 0.35)
  await variantes(await proporcao(buf, 2, 0.56), 'tomografia', [640, 960, 1280], { q: 74 })
}

// ---------------------------------------------------------------- logos de cliente: preto sobre transparente
{
  const { itens } = JSON.parse(readFileSync('src/dados/logos.json', 'utf8'))
  for (const l of itens) {
    const { data, info } = await sharp(achar(l.arquivo)).flatten({ background: l.inverter ? '#000' : '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true })
    const rgba = Buffer.alloc(info.width * info.height * 4)
    for (let i = 0; i < info.width * info.height; i++) {
      const v = data[i * info.channels]
      // traço = o que se afasta do fundo; o resto fica transparente
      const a = l.inverter ? v : 255 - v
      rgba[i * 4 + 3] = a < 18 ? 0 : Math.min(255, Math.round((a - 18) * 1.08))
    }
    const png = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer()
    for (const f of ['webp', 'avif']) {
      const p = sharp(png).resize({ width: 320, withoutEnlargement: true })
      await gravar(f === 'webp' ? p.webp({ lossless: true, effort: 6 }) : p.avif({ quality: 70, effort: 7 }), `cliente-${l.id}-320.${f}`)
    }
  }
}

// ---------------------------------------------------------------- concreto: ladrilho sem emenda
// ruído montado 3x3 (o mesmo bloco repetido), desfocado e recortado no meio: as bordas do
// recorte casam com as do vizinho. Duas escalas: grão fino e manchas largas.
{
  const L = 360
  const ruido = async (sigma, desfoque) => {
    const bloco = await sharp({ create: { width: L, height: L, channels: 1, noise: { type: 'gaussian', mean: 128, sigma } } }).raw().toBuffer()
    const grande = await sharp({ create: { width: L * 3, height: L * 3, channels: 3, background: '#808080' } })
      .composite(Array.from({ length: 9 }, (_, i) => ({ input: bloco, raw: { width: L, height: L, channels: 1 }, left: (i % 3) * L, top: Math.floor(i / 3) * L })))
      .blur(desfoque)
      .extract({ left: L, top: L, width: L, height: L })
      .toColourspace('b-w')
      .raw()
      .toBuffer()
    return grande // 1 canal
  }
  const fino = await ruido(60, 0.6)
  const largo = await ruido(120, 18)
  const px = Buffer.alloc(L * L * 3)
  // concreto #ECE8E2 com variação pequena: manchas ±6 e grão ±3
  for (let i = 0; i < L * L; i++) {
    const d = ((largo[i] - 128) / 128) * 7 + ((fino[i] - 128) / 128) * 3.2
    px[i * 3] = Math.max(0, Math.min(255, 236 + d))
    px[i * 3 + 1] = Math.max(0, Math.min(255, 232 + d))
    px[i * 3 + 2] = Math.max(0, Math.min(255, 226 + d * 0.9))
  }
  await gravar(sharp(px, { raw: { width: L, height: L, channels: 3 } }).webp({ quality: 70, effort: 6 }), `concreto-${L}.webp`)
}

// marcador dos rótulos (contorno do símbolo do logo)
await import('./marca-contorno.mjs')

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
const total = Object.values(manifesto).reduce((s, m) => s + m.kb, 0)
console.log(`${Object.keys(manifesto).length} arquivos em ${OUT} (${total} KB no total), manifesto.json gravado`)
for (const [n, m] of Object.entries(manifesto)) console.log(`  ${n.padEnd(36)} ${String(m.w).padStart(5)}x${String(m.h).padEnd(5)} ${m.kb} KB`)
console.log('favicons em src/raiz:', readdirSync('src/raiz').join(', '))
