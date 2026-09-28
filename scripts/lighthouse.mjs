/**
 * Lighthouse local no Chrome da máquina, celular e computador, com o resumo no terminal.
 * O servidor (scripts/serve.mjs) comprime com gzip como a Vercel, então o peso medido é
 * o que o celular baixa de verdade. Relatórios em lighthouse/<nome>.json.
 *
 * Uso: node scripts/lighthouse.mjs [celular|computador|ambos] [nome-do-arquivo]
 *      METODO=devtools node scripts/lighthouse.mjs celular   (limitação real, não simulada: o
 *      simulado multiplica a carga da máquina e oscila, memória do 076)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'

const modo = process.argv[2] || 'ambos'
const nome = process.argv[3] || ''
const BASE = process.env.BASE_URL ?? 'http://localhost:3079/'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
mkdirSync('lighthouse', { recursive: true })

for (const m of modo === 'ambos' ? ['celular', 'computador'] : [modo]) {
  const saida = `lighthouse/${m}${nome ? '-' + nome : ''}.json`
  const args = ['node_modules/lighthouse/cli/index.js', BASE, '--quiet', '--output=json', `--output-path=${saida}`, '--chrome-flags=--headless=new --no-first-run', '--only-categories=performance,accessibility,best-practices,seo']
  if (m === 'computador') args.push('--preset=desktop')
  if (process.env.METODO) args.push(`--throttling-method=${process.env.METODO}`)
  try {
    execFileSync(process.execPath, args, { env: { ...process.env, CHROME_PATH: CHROME }, stdio: 'ignore' })
  } catch {
    /* no Windows o Lighthouse às vezes falha ao apagar a pasta temporária do Chrome depois de gravar: o relatório fica */
  }
  const r = JSON.parse(readFileSync(saida, 'utf8'))
  const a = r.audits
  console.log(`\n${m.toUpperCase()}  ` + Object.values(r.categories).map((c) => `${c.id} ${Math.round(c.score * 100)}`).join(' · '))
  console.log('  ' + ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map((k) => `${k.split('-').map((p) => p[0]).join('').toUpperCase()} ${a[k].displayValue}`).join(' · '))
  const ruins = Object.entries(a).filter(([, x]) => x.score !== null && x.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(x.scoreDisplayMode))
  for (const [id, x] of ruins) console.log(`  x ${id} (${x.score}) ${x.displayValue || ''}`)
}
