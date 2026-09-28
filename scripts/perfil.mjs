/**
 * Perfil da thread principal no carregamento, com a CPU 4x mais lenta (como o
 * Lighthouse de celular). Grava o trace do Chrome e resume os eventos que mais pesam e
 * as tarefas longas (> 50 ms), que viram TBT.
 *
 * Foi assim que se achou o que derrubava o celular pra 67: animações de clip-path e de
 * background-position na abertura (não vão pra GPU) e o layout da página inteira antes
 * de pintar a foto do hero (resolvido com content-visibility nas seções de baixo).
 *
 * Uso: node scripts/perfil.mjs [url] [saida.json] [largura] [reduzir]
 *   node scripts/perfil.mjs http://localhost:3079/ .tmp/trace.json 412
 *   node scripts/perfil.mjs http://localhost:3079/ .tmp/trace.json 412 reduzir   (sem animação, pra comparar)
 *   REDE=lenta node scripts/perfil.mjs ...   (rede do Lighthouse de celular: 150 ms e 1,6 Mbps)
 */
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
const [url = "http://localhost:3079/", out = ".tmp/trace.json", largura = "412", reduzir = ""] = process.argv.slice(2)
mkdirSync(path.dirname(out), { recursive: true })
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const p = await b.newPage()
await p.setViewport({ width: +largura, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true })
if (reduzir) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const cdp = await p.createCDPSession()
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
if (process.env.REDE === 'lenta') {
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
}
await p.tracing.start({ path: out, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu'] })
await p.goto(url, { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, process.env.REDE === 'lenta' ? 7000 : 5000))
await p.tracing.stop()
await b.close()
const t = JSON.parse(readFileSync(out, 'utf8'))
const ev = t.traceEvents || t
const main = ev.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
const pid = main.pid, tid = main.tid
const soma = {}
let tarefas = []
for (const e of ev) {
  if (e.pid !== pid || e.tid !== tid || e.ph !== 'X' || !e.dur) continue
  soma[e.name] = (soma[e.name] || 0) + e.dur / 1000
  if (e.name === 'RunTask' && e.dur > 50000) tarefas.push(e)
}
console.log('top eventos na thread principal (ms, somando aninhados):')
for (const [n, d] of Object.entries(soma).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log('  ', n.padEnd(40), d.toFixed(0))
console.log('tarefas > 50 ms:', tarefas.length)
// o que tem dentro das 3 maiores tarefas
tarefas.sort((a, b) => b.dur - a.dur)
for (const tk of tarefas.slice(0, 3)) {
  const dentro = {}
  for (const e of ev) if (e.pid === pid && e.tid === tid && e.ph === 'X' && e.ts >= tk.ts && e.ts + (e.dur || 0) <= tk.ts + tk.dur && e !== tk && e.dur) dentro[e.name] = (dentro[e.name] || 0) + e.dur / 1000
  console.log(`tarefa ${(tk.dur / 1000).toFixed(0)} ms em ${((tk.ts - ev.find((e) => e.name === 'navigationStart')?.ts || 0) / 1000).toFixed(0)} ms:`, Object.entries(dentro).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, d]) => `${n} ${d.toFixed(0)}`).join(' | '))
}
