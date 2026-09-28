/**
 * Teste de cliques e de layout do site, no Chrome da máquina (puppeteer-core).
 * Base do 078, adaptado à Criatto.
 *
 * - Estouro horizontal em 13 larguras, de 320 a 1920.
 * - Revelação no scroll: rola na roda do mouse, como gente de verdade, e todo
 *   [data-revela] e [data-revela-lista] precisa ganhar .visivel (bug do 067).
 * - Topo: ganha o preto com vidro depois de rolar; o WhatsApp flutuante aparece depois do
 *   hero e some em cima do CTA final.
 * - Menu do celular: abre, marca aria-expanded, põe o foco dentro, deixa o resto inerte,
 *   fecha no link (e a seção fica logo abaixo do header) e no Esc (foco volta pro botão).
 * - Âncoras do menu (computador e celular) param com a seção logo abaixo do header.
 * - Obras: filtros (Hospitalar mostra só hospital), setas, "ver todas" (vira grade) e o
 *   "Ver obras hospitalares" da seção de alta complexidade (filtra e rola até a galeria).
 * - Comparadores: teclado e mouse mexem a linha (--pos).
 * - Esteira de clientes: anda na tela, pausa com o mouse em cima, a seta empurra.
 * - Desenho do CTA: o SVG entra e os traços terminam desenhados.
 * - Todo link de WhatsApp: número certo, nova aba e mensagem; os dos cartões com o nome do
 *   serviço na mensagem (regra da casa).
 * - Imagens: nenhuma quebrada, todas com alt, nenhuma esticada. Um h1 só. Console limpo.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3079'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const servicos = JSON.parse(readFileSync(new URL('../src/dados/servicos.json', import.meta.url), 'utf8')).itens
const obras = JSON.parse(readFileSync(new URL('../src/dados/obras.json', import.meta.url), 'utf8')).itens
const NAVEGADOR = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const tela = (w) => ({ width: w, height: w < 768 ? 844 : 900, isMobile: w < 768, hasTouch: w < 768 })

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))
  // ERR_ABORTED é o srcset/picture trocando de candidato quando a janela muda, não arquivo faltando
  page.on('requestfailed', (r) => !/wa\.me|instagram|google/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED' && erros.push(`falhou: ${r.url()} (${r.failure()?.errorText})`))
  const irPara = async (id) => {
    await page.evaluate((i) => {
      document.documentElement.classList.add('cv-pronto')
      document.documentElement.style.scrollBehavior = 'auto'
      document.getElementById(i).scrollIntoView({ behavior: 'instant' })
    }, id)
    await espera(700)
  }

  console.log('\nLarguras (estouro horizontal)')
  for (const w of [320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1366, 1440, 1536, 1920]) {
    await page.setViewport(tela(w))
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const r = await page.evaluate(() => {
      document.documentElement.classList.add('cv-pronto')
      const W = document.documentElement.clientWidth
      const fora = [...document.body.querySelectorAll('*')]
        .filter((el) => {
          const q = el.getBoundingClientRect()
          if (!q.width || q.right <= W + 1) return false
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) return false
          return !el.closest('.pular')
        })
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
      return { sw: document.documentElement.scrollWidth, iw: W, fora }
    })
    ok(r.sw <= r.iw && !r.fora.length, `${w}px sem rolagem lateral (${r.sw}/${r.iw})${r.fora.length ? ' passam da borda: ' + r.fora.join(', ') : ''}`)
  }

  console.log('\nRevelação no scroll, topo e botão flutuante')
  for (const w of [1440, 390]) {
    await page.setViewport(tela(w))
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const inicio = await page.evaluate(() => ({ rolado: document.getElementById('topo').classList.contains('topo--rolado'), zap: document.querySelector('.zap-flutuante').classList.contains('visivel') }))
    ok(!inicio.rolado && !inicio.zap, `${w}px: no topo, header transparente e sem o WhatsApp flutuante`)
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    let viuZap = false
    for (let y = 0; y < altura; y += 140) {
      await page.mouse.wheel({ deltaY: 140 })
      await espera(20)
      if (!viuZap && y > altura / 3) viuZap = await page.evaluate(() => document.querySelector('.zap-flutuante').classList.contains('visivel'))
    }
    await espera(1500)
    const presos = await page.evaluate(() => [...document.querySelectorAll('[data-revela]:not(.visivel), [data-revela-lista]:not(.visivel)')].filter((e) => e.checkVisibility()).map((e) => `${e.tagName.toLowerCase()}.${e.classList[0] || '?'}`))
    ok(presos.length === 0, `${w}px: todo elemento animado aparece${presos.length ? ` (presos: ${presos.join(', ')})` : ''}`)
    const fim = await page.evaluate(() => ({ rolado: document.getElementById('topo').classList.contains('topo--rolado'), zap: document.querySelector('.zap-flutuante').classList.contains('visivel') }))
    ok(fim.rolado, `${w}px: depois de rolar, header com o preto e o vidro`)
    ok(viuZap && !fim.zap, `${w}px: WhatsApp flutuante aparece no meio da página e some no fim (CTA e rodapé já têm o botão)`)
  }

  console.log('\nMenu do celular')
  await page.setViewport(tela(390))
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.click('.topo__menu')
  await espera(550)
  let e = await page.evaluate(() => {
    const b = document.querySelector('.topo__menu')
    const painel = document.getElementById(b.getAttribute('aria-controls'))
    return { aria: b.getAttribute('aria-expanded'), visivel: painel.checkVisibility({ visibilityProperty: true }), focoDentro: painel.contains(document.activeElement), inerte: document.querySelector('main').inert, alt: Math.round(painel.getBoundingClientRect().height) }
  })
  ok(e.aria === 'true' && e.visivel && e.alt > 700, `abre em tela cheia e marca aria-expanded=true (painel ${e.alt}px)`)
  ok(e.focoDentro, 'foco vai pra dentro do menu')
  ok(e.inerte, 'o resto da página fica inerte enquanto o menu está aberto')
  await page.evaluate(() => document.querySelector('#menu a[href="#servicos"]').click())
  await espera(1800)
  e = await page.evaluate(() => ({ aria: document.querySelector('.topo__menu').getAttribute('aria-expanded'), y: Math.round(document.getElementById('servicos').getBoundingClientRect().top), inerte: document.querySelector('main').inert, header: document.getElementById('topo').offsetHeight }))
  ok(e.aria === 'false' && !e.inerte, 'fecha ao tocar num link e devolve a página')
  ok(e.y >= e.header - 2 && e.y < e.header + 30, `rola até Serviços sem ficar escondido sob o header (topo em ${e.y}px, header ${e.header}px)`)
  // rolado, o header tem vidro fosco: o menu aberto precisa cobrir a tela inteira mesmo assim
  await page.click('.topo__menu')
  await espera(550)
  e = await page.evaluate(() => Math.round(document.getElementById('menu').getBoundingClientRect().height))
  ok(e > 700, `com a página rolada, o menu aberto continua em tela cheia (${e}px)`)
  await page.keyboard.press('Escape')
  await espera(400)
  e = await page.evaluate(() => ({ aria: document.querySelector('.topo__menu').getAttribute('aria-expanded'), foco: document.activeElement?.matches('.topo__menu') }))
  ok(e.aria === 'false' && e.foco, 'Esc fecha e devolve o foco pro botão')

  console.log('\nÂncoras do menu')
  for (const w of [1440, 390]) {
    await page.setViewport(tela(w))
    for (const alvo of ['servicos', 'obras', 'sobre', 'como-funciona', 'contato']) {
      await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
      if (w < 768) {
        await page.click('.topo__menu')
        await espera(500)
      }
      await page.evaluate((a) => document.querySelector(`#menu a[href="#${a}"]`).click(), alvo)
      await espera(2300)
      const r = await page.evaluate((a) => ({ top: Math.round(document.getElementById(a).getBoundingClientRect().top), y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, header: document.getElementById('topo').offsetHeight }), alvo)
      const noFim = r.y >= r.max - 2
      ok((r.top >= r.header - 2 && r.top <= r.header + 30) || (noFim && r.top >= r.header - 2), `${w}px: #${alvo} para logo abaixo do header (${r.top}px${noFim ? ', fim da página' : ''})`)
    }
  }

  console.log('\nGaleria de obras')
  for (const w of [1440, 390]) {
    await page.setViewport(tela(w))
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await irPara('obras')
    const conta = () => page.evaluate(() => [...document.querySelectorAll('.obra')].filter((o) => !o.hidden).length)
    ok((await conta()) === obras.length, `${w}px: TODOS mostra as ${obras.length} obras`)
    await page.click('[data-filtro="hospitalar"]')
    await espera(500)
    const hosp = obras.filter((o) => o.categoria === 'hospitalar').length
    e = await page.evaluate(() => ({ n: [...document.querySelectorAll('.obra')].filter((o) => !o.hidden).length, cats: [...new Set([...document.querySelectorAll('.obra:not([hidden])')].map((o) => o.dataset.categoria))], aceso: document.querySelector('[data-filtro="hospitalar"]').getAttribute('aria-pressed') }))
    ok(e.n === hosp && e.cats.join() === 'hospitalar' && e.aceso === 'true', `${w}px: filtro Hospitalar mostra só as ${hosp} obras de hospital e fica aceso`)
    await page.click('[data-filtro="todos"]')
    await espera(500)
    const x0 = await page.evaluate(() => document.querySelector('.obras__trilho').scrollLeft)
    await page.click('.obras__seta--prox')
    await espera(900)
    const x1 = await page.evaluate(() => document.querySelector('.obras__trilho').scrollLeft)
    ok(x1 > x0 + 50, `${w}px: a seta da direita anda o carrossel (${Math.round(x0)} → ${Math.round(x1)})`)
    await page.click('[data-obras-todas]')
    await espera(600)
    e = await page.evaluate(() => {
      const itens = [...document.querySelectorAll('.obra')]
      const linhas = new Set(itens.map((o) => Math.round(o.getBoundingClientRect().top))).size
      return { grade: document.getElementById('obras').classList.contains('obras--grade'), linhas, texto: document.querySelector('[data-obras-todas]').textContent.trim(), sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth }
    })
    ok(e.grade && e.linhas > 1 && e.texto === 'Ver menos obras' && e.sw <= e.iw, `${w}px: "ver todas" vira grade (${e.linhas} linhas) e o botão vira "${e.texto}"`)
  }
  await page.setViewport(tela(1440))
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await irPara('diferenciais')
  await page.click('.alta__btn')
  await espera(2200)
  e = await page.evaluate(() => ({ top: Math.round(document.getElementById('obras').getBoundingClientRect().top), header: document.getElementById('topo').offsetHeight, aceso: document.querySelector('[data-filtro="hospitalar"]').getAttribute('aria-pressed') }))
  ok(e.aceso === 'true' && e.top >= e.header - 2 && e.top < e.header + 30, `"Ver obras hospitalares" filtra por hospital e rola até a galeria (${e.top}px)`)

  console.log('\nComparadores de antes e depois')
  await page.setViewport(tela(1440))
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await irPara('antes-e-depois')
  const comps = await page.$$('[data-comp]')
  ok(comps.length === 4, `${comps.length} comparadores (4, como no mockup)`)
  await page.focus('[data-comp] .comp__faixa')
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  await espera(200)
  e = await page.evaluate(() => ({ pos: document.querySelector('[data-comp]').style.getPropertyValue('--pos'), texto: document.querySelector('[data-comp] .comp__faixa').getAttribute('aria-valuetext') }))
  ok(e.pos === '60%', `teclado: 10 x seta pra direita leva a linha a 60% (${e.pos}, "${e.texto}")`)
  const caixa = await (await comps[1].$('.comp__palco')).boundingBox()
  await page.mouse.move(caixa.x + caixa.width * 0.5, caixa.y + caixa.height / 2)
  await page.mouse.down()
  await page.mouse.move(caixa.x + caixa.width * 0.25, caixa.y + caixa.height / 2, { steps: 8 })
  await page.mouse.up()
  await espera(300)
  e = await page.evaluate(() => {
    const f = document.querySelectorAll('[data-comp]')[1]
    return { pos: parseFloat(f.style.getPropertyValue('--pos')), clip: getComputedStyle(f.querySelector('.comp__foto--depois')).clipPath, imgs: [...document.querySelectorAll('[data-comp] img')].every((i) => i.complete && i.naturalWidth > 0) }
  })
  ok(e.pos > 20 && e.pos < 30, `mouse: arrastar até 1/4 leva a linha a ~25% (${e.pos}%, recorte ${e.clip})`)
  ok(e.imgs, 'fotos dos comparadores carregadas')

  console.log('\nEsteira de clientes')
  await irPara('resultados')
  await espera(800)
  const posicao = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.clientes__trilho')).transform).m41)
  const p0 = await posicao()
  await espera(1200)
  const p1 = await posicao()
  ok(p1 < p0 - 20, `anda sozinha pra esquerda (${Math.round(p0)} → ${Math.round(p1)} px em 1,2 s)`)
  const janela = await page.$('.clientes__janela')
  const jb = await janela.boundingBox()
  await page.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2)
  await espera(300)
  const p2 = await posicao()
  await espera(900)
  const p3 = await posicao()
  ok(Math.abs(p3 - p2) < 2, `pausa com o mouse em cima (${Math.round(p2)} → ${Math.round(p3)})`)
  await page.mouse.move(5, 5)
  await espera(300)
  const p4 = await posicao()
  await page.click('.clientes__seta--prox')
  await espera(600)
  const p5 = await posicao()
  ok(p5 < p4 - 90, `a seta da direita empurra a esteira (${Math.round(p4)} → ${Math.round(p5)})`)
  const cartoes = await page.evaluate(() => ({ total: document.querySelectorAll('.cliente').length, lidos: document.querySelectorAll('.cliente:not([aria-hidden])').length }))
  ok(cartoes.lidos === 6 && cartoes.total === 12, `6 clientes na leitura e a cópia da esteira escondida (${cartoes.lidos}/${cartoes.total})`)

  console.log('\nDesenho do CTA')
  for (const w of [1440, 390]) {
    await page.setViewport(tela(w))
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      document.documentElement.classList.add('cv-pronto')
      document.documentElement.style.scrollBehavior = 'auto'
      scrollTo(0, document.getElementById('contato').offsetTop - innerHeight - 200)
    })
    await espera(1200)
    await irPara('contato')
    await espera(4800)
    e = await page.evaluate(() => {
      const svg = document.querySelector('[data-desenho] svg.desenho')
      const faixas = svg ? [...svg.querySelectorAll('.desenho__faixa')] : []
      return { svg: !!svg, anima: svg?.classList.contains('desenho--anima'), faixas: faixas.length, prontas: faixas.filter((f) => Math.abs(parseFloat(getComputedStyle(f).strokeDashoffset)) < 1).length, fim: svg ? getComputedStyle(svg.querySelector('.desenho__fim')).opacity : '?', img: !!document.querySelector('[data-desenho] img') }
    })
    ok(e.svg && e.anima && e.faixas > 10 && e.prontas === e.faixas && e.fim === '1' && !e.img, `${w}px: o desenho entra e termina inteiro (${e.prontas}/${e.faixas} faixas, máscara final ${e.fim})`)
  }

  console.log('\nLinks de WhatsApp')
  await page.setViewport(tela(1440))
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => ({ href: a.href, origem: a.dataset.zap || '', servico: a.dataset.servico || '', alvo: a.target, texto: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim() })),
  )
  const origens = links.map((l) => l.origem)
  ok(new Set(origens).size === origens.length && !origens.includes(''), `todo link tem data-zap único${new Set(origens).size !== origens.length ? ': repetidos ' + origens.filter((o, i) => origens.indexOf(o) !== i).join(', ') : ''}`)
  const deServico = links.filter((l) => l.servico)
  ok(deServico.length === servicos.length, `${deServico.length} cartões de serviço com WhatsApp próprio (de ${servicos.length})`)
  for (const l of links) {
    const u = new URL(l.href)
    const numero = u.pathname.replace(/\//g, '')
    const msg = u.searchParams.get('text') || ''
    const s = servicos.find((x) => x.nome === l.servico)
    const servicoOk = !l.servico || (s && msg.includes(`*${s.mensagem}*`))
    ok(numero === cfg.whatsapp && l.alvo === '_blank' && msg && servicoOk, `${l.origem.padEnd(24)} "${l.texto.slice(0, 30)}" -> ${msg.slice(0, 80)}`)
  }

  console.log('\nÂncoras, h1 e imagens')
  await page.evaluate(async () => {
    document.documentElement.classList.add('cv-pronto')
    const imgs = [...document.images]
    imgs.forEach((i) => (i.loading = 'eager'))
    await Promise.race([Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r })))), new Promise((r) => setTimeout(r, 8000))])
  })
  const ancoras = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))].filter((h) => h.length > 1).map((h) => [h, !!document.querySelector(h)]))
  for (const [h, existe] of ancoras) ok(existe, `${h} existe`)
  const estrutura = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    semAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    quebradas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(-40)),
    esticadas: [...document.images]
      .filter((i) => i.naturalWidth > 1 && i.getBoundingClientRect().width > 0 && getComputedStyle(i).objectFit !== 'cover' && getComputedStyle(i).objectFit !== 'contain')
      .map((i) => {
        const r = i.getBoundingClientRect()
        return { src: i.currentSrc.split('/').pop(), dif: Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight) / (i.naturalWidth / i.naturalHeight) }
      })
      .filter((x) => x.dif > 0.03)
      .map((x) => `${x.src} (${(x.dif * 100).toFixed(0)}%)`),
  }))
  ok(estrutura.h1 === 1, `um h1 só (${estrutura.h1})`)
  ok(estrutura.semAlt === 0, `toda imagem tem alt (${estrutura.semAlt} sem)`)
  ok(estrutura.quebradas.length === 0, `nenhuma imagem quebrada${estrutura.quebradas.length ? ': ' + estrutura.quebradas.join(', ') : ''}`)
  ok(estrutura.esticadas.length === 0, `nenhuma imagem esticada${estrutura.esticadas.length ? ': ' + estrutura.esticadas.join(', ') : ''}`)

  console.log('\nConsole')
  ok(erros.length === 0, `sem erros no console${erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0
