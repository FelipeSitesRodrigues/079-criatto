/**
 * Servidor estático de dist/ em http://localhost:3079, sem cache (base do 073).
 * Comprime texto com gzip, como a Vercel faz, pra o Lighthouse local medir
 * o peso que o celular vai baixar de verdade.
 * Uso: node scripts/serve.mjs [porta]
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const PORTA = Number(process.argv[2] || 3079)
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.avif': 'image/avif',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

createServer(async (req, res) => {
  try {
    let rota = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (rota.endsWith('/')) rota += 'index.html'
    let arq = path.join(DIST, rota)
    if (!arq.startsWith(DIST)) throw Object.assign(new Error('fora'), { code: 'ENOENT' })
    const st = await stat(arq).catch(() => null)
    if (st?.isDirectory()) arq = path.join(arq, 'index.html')
    let corpo = await readFile(arq)
    const tipo = TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream'
    const cab = { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' }
    // vídeo pede pedaços (Range): o Safari não toca sem isso e o "ver de novo" volta ao início por aqui
    const faixa = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
    if (faixa && tipo.startsWith('video/')) {
      const total = corpo.length
      const ini = faixa[1] ? Number(faixa[1]) : total - Number(faixa[2])
      const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), total - 1) : total - 1
      res.writeHead(206, { ...cab, 'Content-Range': `bytes ${ini}-${fim}/${total}`, 'Content-Length': fim - ini + 1 })
      return res.end(corpo.subarray(ini, fim + 1))
    }
    if (/^(text\/|application\/(json|xml)|image\/svg)/.test(tipo) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      corpo = gzipSync(corpo)
      cab['Content-Encoding'] = 'gzip'
      cab.Vary = 'Accept-Encoding'
    }
    res.writeHead(200, cab)
    res.end(corpo)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404')
  }
}).listen(PORTA, () => console.log(`servindo dist/ em http://localhost:${PORTA}`))
