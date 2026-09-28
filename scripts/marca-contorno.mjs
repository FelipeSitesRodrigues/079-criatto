/**
 * Contorno do símbolo do logo (o prédio de pilares e vigas), usado como marcador laranja
 * antes de cada rótulo de seção, como no mockup. Sai em src/assets/img/marca-contorno.png
 * (só o alfa importa: o CSS usa como máscara e pinta com a cor do contexto). O build
 * embute o arquivo no CSS em data URI ({{marca-mascara}}), sem requisição a mais.
 *
 * Uso: node scripts/marca-contorno.mjs   (o processar-imagens.mjs também chama)
 */
import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import path from 'node:path'

const R = '../079 - CRIATTO/Recursos Site'
const arq = readdirSync(R).find((n) => n.normalize('NFC').startsWith('01 LOGO - ICONE'))
const ALT = 96 // altura de trabalho (o marcador aparece com ~22 px)
const TRACO = 6 // espessura do contorno, em px da altura de trabalho

const { data, info } = await sharp(path.join(R, arq)).trim({ threshold: 1 }).resize({ height: ALT - TRACO * 2 }).extend({ top: TRACO, bottom: TRACO, left: TRACO, right: TRACO, background: { r: 0, g: 0, b: 0, alpha: 0 } }).extractChannel(3).raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const cheio = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[y * W + x] > 127
const out = Buffer.alloc(W * H * 2)
const r = TRACO / 2
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    // borda: pixel perto (até r) de um pixel cheio E de um vazio
    let temCheio = false
    let temVazio = false
    for (let dy = -r; dy <= r && !(temCheio && temVazio); dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        if (cheio(x + dx, y + dy)) temCheio = true
        else temVazio = true
      }
    const i = (y * W + x) * 2
    out[i] = 255
    out[i + 1] = temCheio && temVazio ? 255 : 0
  }
const info2 = await sharp(out, { raw: { width: W, height: H, channels: 2 } }).png({ compressionLevel: 9 }).toFile('src/assets/img/marca-contorno.png')
console.log(`marca-contorno.png ${info2.width}x${info2.height} ${info2.size} bytes`)
