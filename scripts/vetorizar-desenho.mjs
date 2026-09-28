/**
 * Prepara o desenho do CTA final ("IMAGEM DESENHO - VAMOS TIRAR O SEU PROJETO DO PAPEL.png",
 * 2048x768, traço preto em fundo transparente) pra animação de desenho sendo feito à caneta,
 * de baixo pra cima.
 *
 * O que aparece na tela é sempre o PNG do Felipe. O vetor só desenha uma MÁSCARA: as linhas
 * de centro do desenho, com traço largo, crescendo (stroke-dashoffset) e revelando o PNG por
 * onde passam. Vetor visível foi testado e descartado: linhas paralelas coladas (caixilho de
 * janela desenhado com traço duplo) viravam um traço ondulado. Com a máscara, a arte final é
 * a original, pixel por pixel, e o efeito de linha sendo criada continua.
 *
 * Por que linha de centro e não contorno: o potrace devolve o contorno de cada traço (uma
 * forma fina fechada). Animado, o contorno é desenhado duas vezes, ida e volta. Aqui cada
 * traço vira UMA polilinha no meio dele, como a caneta passou.
 *
 *  1. alfa > limiar vira bitmap; manchas pequenas saem
 *  2. afinamento de Zhang-Suen até 1 px (esqueleto)
 *  3. grafo: pontas e cruzamentos viram nós; cada trecho entre dois nós vira uma polilinha
 *  4. espinhos do afinamento (ponta curta saindo de cruzamento) saem
 *  5. trechos que se continuam em linha reta num cruzamento são emendados: a parede inteira
 *     vira um traço só, em vez de um pedaço por janela que cruza
 *  6. Ramer-Douglas-Peucker simplifica (o desenho é quase só reta)
 *  7. cada traço começa pela ponta de baixo (ou pela esquerda, se for deitado) e ganha um
 *     "tempo" pela altura: o chão sai primeiro, o telhado por último
 *  8. SVG: <mask> com os traços agrupados em 18 faixas de tempo (cada faixa é um <path>
 *     composto com o dasharray do maior traço dela: o tracejado recomeça a cada subpath,
 *     conferido no Chrome, então todos os traços da faixa crescem juntos, na mesma
 *     velocidade) e, no fim, um retângulo branco que acende a máscara inteira, pra não sobrar
 *     traço fino de fora. A máscara recorta o <image> do PNG.
 *
 * Saída em src/assets/img (o build copia pra dist):
 *   desenho.svg              ~10 KB, a máscara e o <image>
 *   desenho-traco-800.png    24 KB, PNG com paleta de 16 tons (celular)
 *   desenho-traco-1400.png   59 KB (computador em tela 2x)
 * O 09-cta.js busca o SVG quando a faixa chega perto da tela, escolhe o PNG pela largura,
 * troca o <img> pelo SVG e anima quando a faixa aparece.
 *
 * Uso: node scripts/vetorizar-desenho.mjs [--previa]   (--previa grava .tmp/desenho-previa.png:
 *      o original com os traços da máscara por cima, pra ver se ela cobre o desenho todo)
 */
import sharp from 'sharp'
import fs, { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const R = '../079 - CRIATTO/Recursos Site'
const ARQ = readdirSync(R).find((n) => n.normalize('NFC').startsWith('IMAGEM DESENHO'))
if (!ARQ) throw new Error('falta o desenho do CTA em Recursos Site')

const LIMIAR = 96 // alfa mínimo pra contar como traço
const MANCHA = 12 // componente com menos pixels que isso é sujeira
const ESPINHO = 7 // ponta solta mais curta que isso, saindo de cruzamento, é artefato
const CURTO = 4 // traço final mais curto que isso sai
const EPS = 1.4 // tolerância do Douglas-Peucker, em px
const RETA = Math.cos((14 * Math.PI) / 180) // continuação em linha reta: até 14 graus de desvio
const FAIXAS = 18 // grupos de tempo (elementos animados)

// ---------------------------------------------------------------- 1. bitmap
const { data: alfa, info } = await sharp(path.join(R, ARQ)).extractChannel(3).raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const img = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) img[i] = alfa[i] > LIMIAR ? 1 : 0

const viz8 = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]
const dentro = (i) => {
  const x = i % W
  return x > 0 && x < W - 1 && i > W && i < W * (H - 1)
}

// componentes pequenos saem
{
  const rot = new Int32Array(W * H)
  let atual = 0
  const pilha = []
  for (let i = 0; i < W * H; i++) {
    if (!img[i] || rot[i]) continue
    atual++
    const membros = []
    pilha.push(i)
    rot[i] = atual
    while (pilha.length) {
      const p = pilha.pop()
      membros.push(p)
      if (!dentro(p)) continue
      for (const d of viz8) {
        const q = p + d
        if (img[q] && !rot[q]) {
          rot[q] = atual
          pilha.push(q)
        }
      }
    }
    if (membros.length < MANCHA) for (const p of membros) img[p] = 0
  }
}

// ---------------------------------------------------------------- 2. esqueleto
// Zhang-Suen
const esq = img.slice()
{
  const marca = []
  let mudou = true
  while (mudou) {
    mudou = false
    for (const passo of [0, 1]) {
      marca.length = 0
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x
          if (!esq[i]) continue
          const p2 = esq[i - W], p3 = esq[i - W + 1], p4 = esq[i + 1], p5 = esq[i + W + 1]
          const p6 = esq[i + W], p7 = esq[i + W - 1], p8 = esq[i - 1], p9 = esq[i - W - 1]
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (b < 2 || b > 6) continue
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let a = 0
          for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) a++
          if (a !== 1) continue
          if (passo === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue
          marca.push(i)
        }
      if (marca.length) mudou = true
      for (const i of marca) esq[i] = 0
    }
  }
}

// ---------------------------------------------------------------- 3. grafo
const grau = new Uint8Array(W * H)
let nEsq = 0
for (let i = 0; i < W * H; i++) {
  if (!esq[i] || !dentro(i)) {
    esq[i] = 0
    continue
  }
  nEsq++
  let n = 0
  for (const d of viz8) n += esq[i + d]
  grau[i] = n
}
const ehNo = (i) => esq[i] && grau[i] !== 2

// cruzamentos vizinhos viram um nó só (aglomerado)
const aglo = new Int32Array(W * H).fill(-1)
const nos = [] // {x, y, pixels}
for (let i = 0; i < W * H; i++) {
  if (!ehNo(i) || aglo[i] >= 0) continue
  const id = nos.length
  const pix = []
  const pilha = [i]
  aglo[i] = id
  while (pilha.length) {
    const p = pilha.pop()
    pix.push(p)
    for (const d of viz8) {
      const q = p + d
      if (ehNo(q) && aglo[q] < 0) {
        aglo[q] = id
        pilha.push(q)
      }
    }
  }
  const x = pix.reduce((s, p) => s + (p % W), 0) / pix.length
  const y = pix.reduce((s, p) => s + Math.floor(p / W), 0) / pix.length
  nos.push({ x, y, pixels: pix })
}

// trechos: de cada pixel de nó, anda pelos pixels de grau 2 até outro nó
const visto = new Uint8Array(W * H)
const trechos = [] // {pix: [...], a, b}  (a/b = id do nó, ou -1 em laço)
function andar(inicio, primeiro) {
  const pix = [inicio, primeiro]
  let ant = inicio
  let atual = primeiro
  visto[primeiro] = 1
  while (!ehNo(atual)) {
    let prox = -1
    for (const d of viz8) {
      const q = atual + d
      if (q === ant || !esq[q]) continue
      if (ehNo(q) && aglo[q] === aglo[inicio] && pix.length < 3) continue
      if (ehNo(q) || !visto[q]) {
        prox = q
        break
      }
    }
    if (prox < 0) break
    if (!ehNo(prox)) visto[prox] = 1
    pix.push(prox)
    ant = atual
    atual = prox
  }
  return pix
}
for (const no of nos)
  for (const p of no.pixels)
    for (const d of viz8) {
      const q = p + d
      if (!esq[q] || ehNo(q) || visto[q]) continue
      const pix = andar(p, q)
      const fim = pix[pix.length - 1]
      trechos.push({ pix, a: aglo[p], b: ehNo(fim) ? aglo[fim] : -1 })
    }
// laços sem nó (retângulo fechado desenhado de uma vez)
for (let i = 0; i < W * H; i++) {
  if (!esq[i] || ehNo(i) || visto[i]) continue
  visto[i] = 1
  const pix = [i]
  let ant = -1
  let atual = i
  for (;;) {
    let prox = -1
    for (const d of viz8) {
      const q = atual + d
      if (q !== ant && esq[q] && !visto[q]) {
        prox = q
        break
      }
    }
    if (prox < 0) break
    visto[prox] = 1
    pix.push(prox)
    ant = atual
    atual = prox
  }
  pix.push(i)
  trechos.push({ pix, a: -1, b: -1 })
}

// ---------------------------------------------------------------- utilidades de polilinha
const pt = (i) => [i % W, Math.floor(i / W)]
function rdp(p, eps) {
  if (p.length < 3) return p
  const [x1, y1] = p[0]
  const [x2, y2] = p[p.length - 1]
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  let max = -1
  let idx = 0
  for (let k = 1; k < p.length - 1; k++) {
    const d = Math.abs(dy * p[k][0] - dx * p[k][1] + x2 * y1 - y2 * x1) / len
    if (d > max) {
      max = d
      idx = k
    }
  }
  if (max <= eps) return [p[0], p[p.length - 1]]
  return [...rdp(p.slice(0, idx + 1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)]
}
// média móvel curta: tira a escadinha de pixel das retas inclinadas (pontas ficam onde estão)
function suavizar(p, r = 2) {
  if (p.length < 2 * r + 2) return p
  return p.map((q, k) => {
    if (k === 0 || k === p.length - 1) return q
    const a = Math.max(0, k - r)
    const b = Math.min(p.length - 1, k + r)
    let sx = 0, sy = 0
    for (let j = a; j <= b; j++) { sx += p[j][0]; sy += p[j][1] }
    return [sx / (b - a + 1), sy / (b - a + 1)]
  })
}
const comprimento = (p) => p.reduce((s, q, k) => (k ? s + Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) : 0), 0)

// ---------------------------------------------------------------- 4. espinhos
const semEspinho = trechos.filter((t) => !(t.b === -1 && t.a !== -1 && t.pix.length < ESPINHO))

// cada trecho vira uma lista de pontos
const tracos = semEspinho.map((t) => ({ pts: t.pix.map(pt), a: t.a, b: t.b, vivo: true }))

// ---------------------------------------------------------------- 5. emenda em linha reta
// direção de saída de um traço a partir de uma ponta, olhando ~14 px pra dentro dele
function saida(t, ponta) {
  const p = ponta === 'a' ? t.pts : [...t.pts].reverse()
  const [x0, y0] = p[0]
  let alvo = p[p.length - 1]
  let acum = 0
  for (let k = 1; k < p.length; k++) {
    acum += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1])
    alvo = p[k]
    if (acum >= 14) break
  }
  const dx = alvo[0] - x0
  const dy = alvo[1] - y0
  const n = Math.hypot(dx, dy) || 1
  return [dx / n, dy / n]
}
let emendas = 0
for (let volta = 0; volta < 4; volta++) {
  let mexeu = false
  for (let n = 0; n < nos.length; n++) {
    const pontas = []
    for (const t of tracos) {
      if (!t.vivo || t.a === t.b) continue
      if (t.a === n) pontas.push({ t, ponta: 'a' })
      if (t.b === n) pontas.push({ t, ponta: 'b' })
    }
    if (pontas.length < 2) continue
    const pares = []
    for (let i = 0; i < pontas.length; i++)
      for (let j = i + 1; j < pontas.length; j++) {
        if (pontas[i].t === pontas[j].t) continue
        const u = saida(pontas[i].t, pontas[i].ponta)
        const v = saida(pontas[j].t, pontas[j].ponta)
        const cos = u[0] * v[0] + u[1] * v[1]
        if (cos < -RETA) pares.push({ i, j, cos })
      }
    pares.sort((m, k) => m.cos - k.cos)
    const usado = new Set()
    for (const { i, j } of pares) {
      if (usado.has(i) || usado.has(j)) continue
      usado.add(i)
      usado.add(j)
      const A = pontas[i]
      const B = pontas[j]
      // A termina no nó n, B começa no nó n
      const pa = A.ponta === 'b' ? A.t.pts : [...A.t.pts].reverse()
      const pb = B.ponta === 'a' ? B.t.pts : [...B.t.pts].reverse()
      const outraA = A.ponta === 'b' ? A.t.a : A.t.b
      const outraB = B.ponta === 'a' ? B.t.b : B.t.a
      tracos.push({ pts: [...pa, ...pb.slice(1)], a: outraA, b: outraB, vivo: true })
      A.t.vivo = false
      B.t.vivo = false
      emendas++
      mexeu = true
    }
  }
  if (!mexeu) break
}

// ---------------------------------------------------------------- 6 e 7. simplifica, orienta e dá o tempo
let finais = tracos
  .filter((t) => t.vivo)
  .map((t) => ({ ...t, pts: rdp(suavizar(t.pts), EPS) }))
  .filter((t) => comprimento(t.pts) >= CURTO)
for (const t of finais) {
  const [x0, y0] = t.pts[0]
  const [x1, y1] = t.pts[t.pts.length - 1]
  const deitado = Math.abs(y1 - y0) < Math.abs(x1 - x0) * 0.35
  // vertical e inclinado: começa por baixo; deitado: pela esquerda
  if ((deitado && x1 < x0) || (!deitado && y1 > y0)) t.pts.reverse()
  t.base = Math.max(...t.pts.map((p) => p[1]))
  t.len = comprimento(t.pts)
}
// tempo: do chão (y maior) pro alto; o que é mais baixo começa antes
finais.sort((m, n) => n.base - m.base)

// caixa do desenho (com folga pra espessura)
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const t of finais)
  for (const [x, y] of t.pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
const folga = 4
const vb = [Math.floor(minX - folga), Math.floor(minY - folga), Math.ceil(maxX - minX + folga * 2), Math.ceil(maxY - minY + folga * 2)]
const f1 = (v) => Math.round(v * 10) / 10

// ---------------------------------------------------------------- 8. SVG: máscara em faixas revelando o desenho original
// O que aparece na tela é sempre o PNG do Felipe (desenho-traco.webp), nunca o vetor: o vetor
// só desenha a MÁSCARA, com traço largo (MASCARA px) pra cobrir as linhas duplas e o
// antisserrilhado. No fim, um retângulo branco entra na máscara e garante o desenho inteiro.
const MASCARA = 11
const porFaixa = Math.ceil(finais.length / FAIXAS)
const grupos = []
for (let g = 0; g < FAIXAS; g++) {
  const sel = finais.slice(g * porFaixa, (g + 1) * porFaixa)
  if (!sel.length) continue
  const d = sel.map((t) => 'M' + t.pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')).join('')
  const maior = Math.ceil(Math.max(...sel.map((t) => t.len)) + MASCARA)
  grupos.push({ g, d, maior, n: sel.length })
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="desenho" aria-hidden="true" focusable="false"><mask id="desenho-mascara" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g fill="none" stroke="#fff" stroke-width="${MASCARA}" stroke-linecap="round" stroke-linejoin="round">${grupos
  .map((q) => `<path class="desenho__faixa" style="--i:${q.g};--l:${q.maior}" stroke-dasharray="${q.maior} ${q.maior}" d="${q.d}"/>`)
  .join('')}</g><rect class="desenho__fim" width="${W}" height="${H}" fill="#fff"/></mask><image href="/assets/img/desenho-traco-1400.png" width="${W}" height="${H}" mask="url(#desenho-mascara)"/></svg>`

mkdirSync('src/assets/img', { recursive: true })
writeFileSync('src/assets/img/desenho.svg', svg)
// PNG com paleta de 16 tons: arte de linha preta com transparência fica em 1/3 do WebP
// (1400 px pro computador em tela 2x, 800 px pro celular; o 09-cta.js escolhe)
for (const f of ['desenho-traco.webp', 'desenho-traco-900.webp']) fs.rmSync(path.join('src/assets/img', f), { force: true })
for (const larg of [800, 1400]) {
  const nome = `desenho-traco-${larg}.png`
  const info = await sharp(path.join(R, ARQ)).resize({ width: larg, kernel: 'lanczos3' }).png({ palette: true, colors: 16, compressionLevel: 9, effort: 10 }).toFile(path.join('src/assets/img', nome))
  console.log(`${nome} ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`)
}
console.log(`${ARQ}: ${W}x${H}, esqueleto ${nEsq} px, ${nos.length} nós, ${trechos.length} trechos, ${emendas} emendas`)
console.log(`${finais.length} traços em ${grupos.length} faixas animadas, caixa do desenho ${vb.join(' ')}`)
console.log(`desenho.svg ${(svg.length / 1024).toFixed(1)} KB`)

// prévia: o original sobre o laranja e, por cima, os traços da máscara em branco translúcido
// (mostra se a máscara cobre o desenho todo)
if (process.argv.includes('--previa')) {
  mkdirSync('.tmp', { recursive: true })
  const laranja = { r: 244, g: 102, b: 28, alpha: 1 }
  const mascaraVisivel = svg
    .replace(/<mask[^>]*>/, '')
    .replace(/<rect[^>]*\/>/, '')
    .replace('</mask>', '')
    .replace(/<image[^>]*\/>/, '')
    .replace('class="desenho"', `width="${W}" height="${H}"`)
    .replace(/stroke="#fff"/, 'stroke="rgb(255,255,255)" stroke-opacity="0.45"')
    .replace(/ stroke-dasharray="[^"]*"/g, '')
  await sharp({ create: { width: W, height: H, channels: 4, background: laranja } })
    .composite([{ input: path.join(R, ARQ) }, { input: Buffer.from(mascaraVisivel) }])
    .png()
    .toFile('.tmp/desenho-previa.png')
  console.log('prévia em .tmp/desenho-previa.png (branco = por onde a máscara passa)')
}
