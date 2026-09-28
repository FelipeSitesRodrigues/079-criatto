/**
 * Imagem de compartilhamento (1200 x 630), a prévia que aparece quando alguém manda o link
 * no WhatsApp, Instagram ou Facebook. Montada em HTML com as fontes, a casa do hero e o logo
 * do próprio site, fotografada pelo Chrome e gravada em src/assets/img/og-criatto.jpg (o
 * build copia pra dist). Base do 078.
 *
 * Precisa do build feito e do servidor: node scripts/serve.mjs
 * Uso: node scripts/og.mjs
 */
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3079'
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face{font-family:A;font-weight:500 800;font-stretch:100% 125%;src:url(/assets/fonts/archivo-var.woff2)}
@font-face{font-family:M;font-weight:400 700;src:url(/assets/fonts/manrope-var.woff2)}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0B0B0B;position:relative;font-family:M}
.cena{position:absolute;right:-40px;top:0;height:630px;width:1060px;object-fit:cover;object-position:62% 45%}
.veu{position:absolute;inset:0;background:linear-gradient(90deg,#0B0B0B 0%,rgb(11 11 11/.94) 30%,rgb(11 11 11/.4) 54%,transparent 70%),linear-gradient(0deg,rgb(11 11 11/.75),transparent 30%)}
.txt{position:absolute;left:64px;top:52px;width:720px}
.logo{width:150px}
.nome{display:block;width:150px;margin-top:3px;text-align:center;padding-left:.46em;color:#F4661C;font:600 9.5px/1 A;font-stretch:112%;letter-spacing:.46em;text-transform:uppercase}
.rot{margin-top:34px;font:500 17px/1.3 A;letter-spacing:.06em;text-transform:uppercase;color:rgb(255 255 255/.9)}
h1{margin-top:14px;font:800 56px/.98 A;font-stretch:112%;letter-spacing:-.006em;text-transform:uppercase;color:#fff}
h1 span{color:#F4661C}
.pe{display:flex;gap:26px;margin-top:30px;font:600 17px/1.3 M;color:rgb(255 255 255/.86)}
.pe b{color:#F4661C;font:800 17px/1.3 A;font-stretch:106%;text-transform:uppercase;letter-spacing:.02em}
.faixa{position:absolute;left:0;right:0;bottom:0;height:8px;background:#F4661C}
</style></head><body>
<img class="cena" src="/assets/img/hero-desk-1280.webp" alt="">
<div class="veu"></div>
<div class="txt">
  <img class="logo" src="/assets/img/logo-320.webp" alt=""><span class="nome">Construtora</span>
  <p class="rot">Construtora de alto padrão em Goiânia</p>
  <h1>Engenharia e<br>construção de<br><span>alto padrão.</span></h1>
  <p class="pe"><span><b>16 anos</b> em Goiânia</span><span><b>Residencial</b></span><span><b>Hospitalar</b></span><span><b>Corporativo</b> e comercial</span></p>
</div>
<div class="faixa"></div>
</body></html>`

mkdirSync('dist/preview', { recursive: true })
writeFileSync('dist/preview/og.html', html)
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await p.goto(`${BASE}/preview/og.html`, { waitUntil: 'networkidle0' })
  await p.evaluate(() => document.fonts.ready)
  const png = await p.screenshot({ type: 'png' })
  const info = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile('src/assets/img/og-criatto.jpg')
  console.log(`ok src/assets/img/og-criatto.jpg ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`)
} finally {
  await b.close()
  rmSync('dist/preview/og.html', { force: true })
}
