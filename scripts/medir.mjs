/**
 * Mede caixas de elementos na página (getBoundingClientRect + estilos), sem print.
 * Uso: node scripts/medir.mjs <largura> "<seletor>" ["<seletor>" ...] [--altura 900]
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const largura = Number(args[0])
const i = args.indexOf('--altura')
const altura = i > -1 ? Number(args[i + 1]) : largura < 600 ? 844 : 900
const seletores = args.slice(1).filter((a, j, arr) => a !== '--altura' && arr[j - 1] !== '--altura')
const NAV = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const b = await puppeteer.launch({ executablePath: NAV, headless: true })
try {
  const p = await b.newPage()
  await p.setViewport({ width: largura, height: altura, deviceScaleFactor: 1, isMobile: largura < 600, hasTouch: largura < 600 })
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await p.goto(process.env.BASE_URL ?? 'http://localhost:3079/', { waitUntil: 'networkidle2' })
  const r = await p.evaluate((sels) => sels.map((s) => {
    const el = document.querySelector(s)
    if (!el) return `${s}: não encontrado`
    const q = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return `${s}: x ${Math.round(q.left)}..${Math.round(q.right)} (w ${Math.round(q.width)}) y ${Math.round(q.top + scrollY)} h ${Math.round(q.height)} | margin ${cs.marginLeft} ${cs.marginRight} | display ${cs.display} | ${el.currentSrc ? 'src ' + el.currentSrc.split('/').pop() + ' natural ' + el.naturalWidth + 'x' + el.naturalHeight : ''}`
  }), seletores)
  console.log(`viewport ${largura}x${altura}, scrollWidth ${await p.evaluate(() => document.documentElement.scrollWidth)}`)
  console.log(r.join('\n'))
} finally {
  await b.close()
}
