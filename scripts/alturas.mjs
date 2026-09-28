/**
 * Mede a altura do CONTEÚDO de cada seção abaixo do hero (altura menos o padding vertical),
 * nas larguras dos degraus do src/css/99-desempenho.css. É o número do contain-intrinsic-size
 * (o navegador soma o padding por cima: bug do 076). Rodar de novo quando uma seção mudar
 * muito de tamanho e atualizar o CSS.
 *
 * Uso: node scripts/alturas.mjs   (com o servidor no ar)
 */
import puppeteer from 'puppeteer-core'
const SECOES = ['.servicos', '.sobre', '.obras', '.antes', '.alta', '.como', '.resultados', '.cta', '.rodape']
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const p = await b.newPage()
  for (const w of [1440, 1100, 800, 390]) {
    await p.setViewport({ width: w, height: 900, isMobile: w < 600, hasTouch: w < 600 })
    await p.goto(process.env.BASE_URL ?? 'http://localhost:3079/', { waitUntil: 'networkidle2' })
    const r = await p.evaluate((sels) => {
      document.documentElement.classList.add('cv-pronto')
      return sels.map((s) => {
        const el = document.querySelector(s)
        const cs = getComputedStyle(el)
        return `${s} ${Math.round(el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))}`
      })
    }, SECOES)
    console.log(`${w}: ${r.join(' | ')}`)
  }
} finally {
  await b.close()
}
