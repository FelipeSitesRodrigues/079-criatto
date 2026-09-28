/**
 * Build do site da Criatto Construtora. HTML, CSS e JS estático em dist/ (base do 078).
 *
 *   node build.mjs                          página inteira em dist/index.html
 *   node build.mjs --preview 04-obras       só aquela seção, em dist/preview/04-obras.html
 *   node build.mjs --preview 00-header,01-hero
 *   node build.mjs --publicar               página inteira do zero, sem os previews (antes de subir)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o arquivo de cada seção, com o
 *   mesmo nome do parcial, em ordem de nome. Entra minificado num <style>.
 * - JS: mesma regra, em src/js, num <script> no fim do <body>. Cada arquivo é um IIFE.
 * - Dados em src/dados/*.json viram HTML no build (sai tudo no HTML, pro Google ler):
 *   <!-- @servicos --> os 8 cartões, cada um com o WhatsApp do próprio serviço;
 *   <!-- @servicos-rodape --> a lista do rodapé; <!-- @obras --> e <!-- @obras-filtros -->
 *   a galeria; <!-- @antes-depois --> os comparadores; <!-- @logos --> a esteira de clientes.
 * - {{wa:chave}} vira o link do WhatsApp com a mensagem mensagens.chave do config.
 *   {{cfg.caminho}} puxa qualquer valor do config; {{ano}} é o ano atual.
 * - <!-- @se cfg.caminho --> ... <!-- /@se --> só fica se o valor do config existir.
 * - <i data-i="nome" data-w="light" class="..."></i> vira <svg><use> apontando pro
 *   sprite de ícones (Phosphor), montado só com os ícones usados.
 * - <img data-img="nome" sizes="..." alt="..."> vira <picture> com AVIF e WebP em
 *   srcset, width e height, a partir de src/assets/img/manifesto.json.
 *   data-img-max="640" limita o src de reserva. Direção de arte: data-desk="nome"
 *   (+ data-desk-sizes e data-desk-media, padrão (min-width: 64em)) põe outra imagem
 *   a partir daquela largura de tela.
 * - {{marca-mascara}} (no CSS) vira o contorno do símbolo do logo em data URI: é o
 *   marcador laranja antes de cada rótulo de seção.
 * - <!-- @schema --> recebe o JSON-LD (construtora local, serviços e área atendida).
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem
 *   destino, marcador {{...}} que sobrou, CSS com chave desbalanceada, mais de um h1
 *   e o que ainda falta o cliente confirmar.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const dados = (nome) => JSON.parse(readFileSync(P('src/dados', `${nome}.json`), 'utf8')).itens
const servicos = dados('servicos')
const obras = dados('obras')
const antesDepois = dados('antes-depois')
const logos = dados('logos')
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')) || f.startsWith('99-'))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

// Minificação conservadora: só comentário e espaço redundante. Não mexe em espaço
// perto de ":" ou ">", que muda o sentido de seletor (".a :is(.b)").
function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
}

function valor(caminho, avisar = true) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined && avisar) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const wa = (msg) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`
function linkWa(chave) {
  const msg = cfg.mensagens[chave]
  if (!msg) avisos.push(`mensagem de WhatsApp sem chave no config: ${chave}`)
  return wa(msg || '')
}
// mensagem de orçamento de um serviço (regra da casa: cada serviço com a sua)
const waServico = (s) => wa(cfg.mensagens.servico.replace('{servico}', s.mensagem))

// ---------------------------------------------------------------- ícones (sprite com <use>)
const usados = new Map()
function icone(nome, peso = 'light', classe = '') {
  const id = `i-${nome}-${peso}`
  if (!usados.has(id)) {
    const arq = P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const miolo = readFileSync(arq, 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim()
    usados.set(id, `<symbol id="${id}" viewBox="0 0 256 256">${miolo}</symbol>`)
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`
}

// ---------------------------------------------------------------- imagens (<picture> com AVIF e WebP)
function versoes(nome, ext) {
  return Object.entries(manifesto)
    .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.${ext}$`)) || [])[1]) }))
    .filter((v) => v.w)
    .sort((a, b) => a.w - b.w)
}
const srcset = (vs) => vs.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
const attr = (s, nome) => (s.match(new RegExp(`\\s${nome}="([^"]*)"`)) || [])[1]
const semAttr = (s, ...nomes) => nomes.reduce((t, n) => t.replace(new RegExp(`\\s${n}="[^"]*"`, 'g'), ''), s)

function fontesDe(nome, sizes, media = '') {
  const va = versoes(nome, 'avif')
  const vw = versoes(nome, 'webp')
  if (!vw.length) avisos.push(`imagem sem arquivo no manifesto: ${nome}`)
  const maior = vw[vw.length - 1]?.m || { w: 1, h: 1 }
  const mq = media ? ` media="${media}"` : ''
  return [
    va.length ? `<source${mq} type="image/avif" srcset="${srcset(va)}" sizes="${sizes}" width="${maior.w}" height="${maior.h}">` : '',
    `<source${mq} type="image/webp" srcset="${srcset(vw)}" sizes="${sizes}" width="${maior.w}" height="${maior.h}">`,
  ].join('')
}

function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    let attrs = antes + depois
    const sizes = attr(attrs, 'sizes') || '100vw'
    const desk = attr(attrs, 'data-desk')
    const deskSizes = attr(attrs, 'data-desk-sizes') || sizes
    const deskMedia = attr(attrs, 'data-desk-media') || '(min-width: 64em)'
    const max = Number(attr(attrs, 'data-img-max') || Infinity)
    const classePicture = attr(attrs, 'data-picture')
    attrs = semAttr(attrs, 'data-desk', 'data-desk-sizes', 'data-desk-media', 'data-img-max', 'data-picture', 'sizes')
    const fontes = desk ? [fontesDe(desk, deskSizes, deskMedia)] : []
    const vw = versoes(nome, 'webp')
    const va = versoes(nome, 'avif')
    if (!vw.length) {
      avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
      return tag
    }
    const principal = [...vw].reverse().find((v) => v.w <= max) || vw[0]
    if (va.length) fontes.push(`<source type="image/avif" srcset="${srcset(va)}" sizes="${sizes}">`)
    const img = `<img src="/assets/img/${principal.arq}" srcset="${srcset(vw)}" sizes="${sizes}" width="${principal.m.w}" height="${principal.m.h}"${attrs}>`
    return `<picture${classePicture ? ` class="${classePicture}"` : ''}>${fontes.join('')}${img}</picture>`
  })
}

// ---------------------------------------------------------------- serviços (src/dados/servicos.json)
// O botão redondo com a seta é o WhatsApp daquele serviço (regra da casa), com o nome do
// serviço no rótulo pra leitor de tela. A área de toque dele cobre o cartão inteiro (::after
// no CSS), mas continua sendo um link só.
const cardServico = (s, i) => `
          <li class="serv" style="--i:${i % 4}">
            <span class="serv__foto${s.foto.ia ? ' serv__foto--ia' : ''}"><img data-img="serv-${s.id}" data-img-max="420" sizes="(min-width: 80em) 300px, (min-width: 64em) 23vw, (min-width: 40em) 46vw, 92vw" alt="${esc(s.alt)}" loading="lazy" decoding="async"></span>
            <div class="serv__corpo">
              <h3 class="serv__nome">${esc(s.nome)}</h3>
              <p class="serv__desc">${esc(s.descricao)}</p>
              <a class="serv__zap" href="${esc(waServico(s))}" target="_blank" rel="noopener" data-zap="servico-${s.id}" data-servico="${esc(s.nome)}" aria-label="Pedir orçamento de ${esc(s.nome.toLowerCase())} pelo WhatsApp">${icone('arrow-right', 'bold')}</a>
            </div>
          </li>`
const htmlServicos = () => `<ul class="servs" role="list" data-revela-lista>${servicos.map(cardServico).join('')}
        </ul>`

const htmlServicosRodape = () =>
  servicos
    .filter((s) => s.rodape)
    .sort((a, b) => a.rodape - b.rodape)
    .map((s) => `<li><a href="#servicos">${esc(s.rodapeNome || s.nome)}</a></li>`)
    .join('\n              ')

// ---------------------------------------------------------------- obras (src/dados/obras.json)
const CATEGORIAS = [
  ['todos', 'Todos'],
  ['residencial', 'Residencial'],
  ['corporativo', 'Corporativo'],
  ['hospitalar', 'Hospitalar'],
  ['comercial', 'Comercial'],
]
const htmlObrasFiltros = () =>
  CATEGORIAS.map(
    ([id, nome], i) =>
      `<button class="filtro" type="button" data-filtro="${id}" aria-pressed="${i === 0}">${nome}</button>`,
  ).join('\n            ')
const htmlObras = () =>
  obras
    .map(
      (o) => `
            <li class="obra" data-categoria="${o.categoria}">
              <figure>
                <span class="obra__foto">
                  <img data-img="obra-${o.id}" data-img-max="420" sizes="(min-width: 80em) 300px, (min-width: 64em) 23vw, (min-width: 40em) 46vw, 86vw" alt="${esc(o.alt)}" loading="lazy" decoding="async">
                  ${o.ia ? '<span class="obra__selo">Ilustrativa</span>' : ''}
                </span>
                <figcaption><strong class="obra__nome">${esc(o.titulo)}</strong><span class="obra__local">${esc(o.local)}</span></figcaption>
              </figure>
            </li>`,
    )
    .join('')

// ---------------------------------------------------------------- antes e depois (src/dados/antes-depois.json)
// Comparador de arrastar (base do 078): as duas fotos empilhadas, o "depois" por cima
// recortado por clip-path a partir da variável --pos, e um <input type=range> invisível
// por cima de tudo (teclado, leitor de tela e toque de graça). O JS só atualiza --pos.
const htmlAntesDepois = () =>
  antesDepois
    .map(
      (p, i) => `
          <li class="comp-card" style="--i:${i}">
            <figure class="comp" data-comp style="--pos:50%">
              <div class="comp__palco">
                <img data-img="ad-${p.id}-antes" data-img-max="420" sizes="(min-width: 80em) 300px, (min-width: 64em) 23vw, (min-width: 40em) 46vw, 92vw" alt="${esc(p.antes.alt)}" loading="lazy" decoding="async" data-picture="comp__foto comp__foto--antes">
                <img data-img="ad-${p.id}-depois" data-img-max="420" sizes="(min-width: 80em) 300px, (min-width: 64em) 23vw, (min-width: 40em) 46vw, 92vw" alt="${esc(p.depois.alt)}" loading="lazy" decoding="async" data-picture="comp__foto comp__foto--depois">
                <span class="comp__linha" aria-hidden="true"><span class="comp__alca">${icone('caret-left', 'bold')}${icone('caret-right', 'bold')}</span></span>
                <span class="comp__tag comp__tag--antes" aria-hidden="true">Antes</span>
                <span class="comp__tag comp__tag--depois" aria-hidden="true">Depois</span>
                <input class="comp__faixa" type="range" min="0" max="100" value="50" step="1" aria-label="Comparar antes e depois: ${esc(p.titulo.toLowerCase())}" aria-valuetext="metade antes, metade depois">
              </div>
              <figcaption class="comp__texto"><strong class="comp__nome">${esc(p.titulo)}</strong><span class="comp__desc">${esc(p.texto)}</span></figcaption>
            </figure>
          </li>`,
    )
    .join('')

// ---------------------------------------------------------------- logos de cliente (src/dados/logos.json)
// Cartões brancos com a logo em preto. O JS duplica a lista pra esteira fechar o laço;
// as cópias ficam fora da leitura (aria-hidden).
const htmlLogos = () =>
  logos
    .map((l) => {
      const vw = versoes(`cliente-${l.id}`, 'webp')[0]
      const va = versoes(`cliente-${l.id}`, 'avif')[0]
      if (!vw) {
        avisos.push(`logo de cliente sem arquivo: ${l.id}`)
        return ''
      }
      return `
              <li class="cliente">
                <picture>${va ? `<source type="image/avif" srcset="/assets/img/${va.arq}">` : ''}<img class="cliente__logo" src="/assets/img/${vw.arq}" width="${vw.m.w}" height="${vw.m.h}" alt="${esc(l.nome)}" loading="lazy" decoding="async" style="--escala:${l.escala}"></picture>
                <span class="cliente__area">${esc(l.area)}</span>
              </li>`
    })
    .join('')

// ---------------------------------------------------------------- marcador dos rótulos (contorno do símbolo)
const marcaMascara = () => {
  const arq = P('src/assets/img/marca-contorno.png')
  if (!existsSync(arq)) {
    avisos.push('falta src/assets/img/marca-contorno.png (npm run imagens)')
    return 'none'
  }
  return `url("data:image/png;base64,${readFileSync(arq).toString('base64')}")`
}

// ---------------------------------------------------------------- dados estruturados (GEO e Google)
function schema() {
  const e = cfg.endereco
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const negocio = {
    '@type': 'GeneralContractor',
    '@id': base ? `${base}/#negocio` : '#negocio',
    name: cfg.nome,
    legalName: cfg.razaoSocial,
    taxID: cfg.cnpj,
    foundingDate: cfg.fundacao,
    founder: { '@type': 'Person', name: cfg.dono },
    description:
      'A Criatto Construtora é uma construtora de Goiânia, fundada em 2010, que constrói casas de alto padrão, reforma apartamentos e casas e executa obras hospitalares, corporativas e comerciais em Goiânia e região.',
    slogan: 'Construímos UTI. Imagine o cuidado com sua casa.',
    telephone: cfg.telefone,
    email: cfg.email,
    address: { '@type': 'PostalAddress', streetAddress: e.ruaSchema, addressLocality: e.cidade, addressRegion: e.uf, postalCode: e.cep, addressCountry: 'BR' },
    openingHours: cfg.horarioSchema,
    areaServed: [{ '@type': 'City', name: 'Goiânia' }, { '@type': 'AdministrativeArea', name: 'Região Metropolitana de Goiânia' }],
    knowsAbout: ['construção de casas de alto padrão', 'reforma de apartamento', 'reforma e ampliação de casas', 'obras hospitalares', 'obras corporativas e comerciais', 'instalações elétricas e hidráulicas', 'prevenção de incêndio', 'acabamento de obra'],
    makesOffer: servicos.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.nome, description: s.descricao, areaServed: 'Goiânia e região' } })),
  }
  if (base) Object.assign(negocio, { url: `${base}/`, image: `${base}/assets/img/og-criatto.jpg`, logo: `${base}/icon-512.png` })
  const site = { '@type': 'WebSite', '@id': base ? `${base}/#site` : '#site', name: cfg.nome, inLanguage: 'pt-BR', publisher: { '@id': negocio['@id'] } }
  if (base) site.url = `${base}/`
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [negocio, site] })}</script>`
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes('00-header') ? '<!-- @parcial 00-header -->' : ''
    const rodape = parciais.includes('10-rodape') ? '<!-- @parcial 10-rodape -->' : ''
    const meio = parciais
      .filter((n) => n !== '00-header' && n !== '10-rodape')
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(/<!--\s*@parcial 00-header\s*-->[\s\S]*<!--\s*@parcial 10-rodape\s*-->/, `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`)
  }
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  html = html
    .replace('<!-- @servicos -->', htmlServicos)
    .replace('<!-- @servicos-rodape -->', htmlServicosRodape)
    .replace('<!-- @obras-filtros -->', htmlObrasFiltros)
    .replace('<!-- @obras -->', htmlObras)
    .replace('<!-- @antes-depois -->', htmlAntesDepois)
    .replace('<!-- @logos -->', htmlLogos)
  html = html.replace(/<!--\s*@se\s+cfg\.([\w.]+)\s*-->([\s\S]*?)<!--\s*\/@se\s*-->/g, (_, c, dentro) => (valor(c, false) ? dentro : ''))
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @head-parciais -->', cabeca.join('\n  '))
  // o JS entra antes dos marcadores, pra ele também poder usar {{cfg.caminho}}
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js', parciais))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css', parciais)).replace('{{marca-mascara}}', marcaMascara)}</style>`)
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{wa:([\w-]+)\}\}/g, (_, chave) => esc(linkWa(chave)))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = html.replace('<!-- @schema -->', schema)
  html = imagens(html)
  html = html.replace('<!-- @sprite -->', () => `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">${[...usados.values()].join('')}</svg>`)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base
      ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-criatto.jpg">`
      : '<meta property="og:image" content="/assets/img/og-criatto.jpg">',
  )
  return html
}

function verificar(html, rotulo) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`[${rotulo}] marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '?').slice(0, 60)
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  if (!argPreview)
    $('a[href^="#"]').each((_, el) => {
      const alvo = $(el).attr('href').slice(1)
      if (alvo && !ids[alvo]) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
    })
  if (!argPreview && $('h1').length !== 1) avisos.push(`[${rotulo}] ${$('h1').length} h1 na página (precisa ser 1)`)
}

// ---------------------------------------------------------------- execução
// No --publicar, dist sai do zero: a cópia só acrescenta, então arquivo que saiu de
// src/assets ficaria esquecido em dist e iria pro GitHub.
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
if (!argPreview) {
  const html = montar(null)
  verificar(html, 'página')
  gravar(path.join(DIST, 'index.html'), html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  gravar(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /preview/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`)
  if (base) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
  gravar(
    path.join(DIST, 'site.webmanifest'),
    JSON.stringify({ name: cfg.nome, short_name: 'Criatto', start_url: '/', display: 'standalone', background_color: '#0B0B0B', theme_color: '#0B0B0B', icons: [192, 512].map((s) => ({ src: `/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }),
  )
  if (existsSync(P('src/404.html'))) gravar(path.join(DIST, '404.html'), readFileSync(P('src/404.html'), 'utf8'))
  if (!base) avisos.push('dominio vazio no site.config.json: sem canonical, sem sitemap e og:image relativo')
  for (const p of cfg.pendencias || []) avisos.push(`pendente: ${p}`)
  if (process.argv.includes('--publicar')) rmSync(path.join(DIST, 'preview'), { recursive: true, force: true })
  console.log(`ok dist/index.html ${kb(html)} (${usados.size} ícones no sprite)`)
} else {
  const nome = argPreview.join('+')
  const html = montar(argPreview)
  verificar(html, `preview ${nome}`)
  gravar(path.join(DIST, `preview/${nome}.html`), html)
  console.log(`ok /preview/${nome}.html ${kb(html)}`)
}
if (avisos.length) console.log(`AVISOS:\n  ${[...new Set(avisos)].join('\n  ')}`)
