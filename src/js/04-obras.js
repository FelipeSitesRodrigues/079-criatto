// Galeria de obras: filtros, carrossel e "ver todas".
// O trilho é scroll-snap nativo (dedo, roda e teclado já funcionam); aqui entram as setas
// (desligadas nas pontas), os pontos do celular (um por cartão visível na página), o
// filtro por tipo e o modo grade. Botões de fora com data-filtrar (o "Ver obras
// hospitalares" da seção de alta complexidade) chegam aqui já com o filtro escolhido.
;(() => {
  const secao = document.getElementById('obras')
  const caixa = secao?.querySelector('[data-obras]')
  const trilho = caixa?.querySelector('.obras__trilho')
  if (!secao || !caixa || !trilho) return
  const itens = [...trilho.children]
  const filtros = [...secao.querySelectorAll('[data-filtro]')]
  const anterior = caixa.querySelector('[data-anterior]')
  const proximo = caixa.querySelector('[data-proximo]')
  const pontos = secao.querySelector('[data-pontos]')
  const todas = secao.querySelector('[data-obras-todas]')
  const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  let visiveis = itens

  const passo = () => {
    const [a, b] = visiveis
    if (!a) return 1
    return (b ? b.offsetLeft - a.offsetLeft : a.offsetWidth) || 1
  }
  const grade = () => secao.classList.contains('obras--grade')

  // setas: apagadas quando não há pra onde ir; somem se tudo cabe na tela
  const atualizarSetas = () => {
    const max = trilho.scrollWidth - trilho.clientWidth
    anterior.disabled = trilho.scrollLeft <= 2
    proximo.disabled = trilho.scrollLeft >= max - 2
    caixa.classList.toggle('obras__carrossel--sem-setas', max <= 2)
  }
  // pontos: uma bolinha por "página" (o que cabe na tela)
  let porVez = 1
  let paginas = 1
  let barra = null
  const montarPontos = () => {
    if (!trilho.clientWidth) return
    porVez = Math.max(1, Math.round((trilho.clientWidth + 1) / passo()))
    paginas = Math.max(1, Math.ceil(visiveis.length / porVez))
    // muitas páginas: barra de progresso (decorativa; setas, dedo e teclado navegam)
    if (paginas > 7) {
      barra = document.createElement('span')
      barra.className = 'obras__barra'
      barra.append(document.createElement('span'))
      pontos.setAttribute('aria-hidden', 'true')
      pontos.replaceChildren(barra)
      marcarPonto()
      return
    }
    barra = null
    pontos.removeAttribute('aria-hidden')
    pontos.replaceChildren(
      ...Array.from({ length: paginas }, (_, i) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'obras__ponto'
        b.setAttribute('aria-label', `Obras, página ${i + 1} de ${paginas}`)
        b.addEventListener('click', () => irPara(i * porVez))
        return b
      }),
    )
    marcarPonto()
  }
  const marcarPonto = () => {
    if (barra) {
      const visivel = Math.min(1, trilho.clientWidth / (trilho.scrollWidth || 1))
      const rolado = trilho.scrollLeft / Math.max(1, trilho.scrollWidth - trilho.clientWidth)
      barra.style.setProperty('--largura', `${visivel * 100}%`)
      barra.style.setProperty('--desloca', `${((rolado * (1 - visivel)) / visivel) * 100}%`)
      return
    }
    const fim = trilho.scrollLeft >= trilho.scrollWidth - trilho.clientWidth - 4
    const atual = fim ? paginas - 1 : Math.min(paginas - 1, Math.round(trilho.scrollLeft / (passo() * porVez)))
    ;[...pontos.children].forEach((p, i) => p.setAttribute('aria-current', String(i === atual)))
  }
  const irPara = (indice) => {
    const alvo = visiveis[Math.max(0, Math.min(indice, visiveis.length - 1))]
    if (!alvo) return
    trilho.scrollTo({ left: alvo.offsetLeft - visiveis[0].offsetLeft, behavior: reduz() ? 'auto' : 'smooth' })
  }
  const indiceAtual = () => Math.round(trilho.scrollLeft / passo())

  anterior.addEventListener('click', () => irPara(indiceAtual() - porVez))
  proximo.addEventListener('click', () => irPara(indiceAtual() + porVez))
  trilho.addEventListener('keydown', (e) => {
    if (grade()) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      irPara(indiceAtual() + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      irPara(indiceAtual() - 1)
    }
  })
  let quadro = 0
  trilho.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        atualizarSetas()
        marcarPonto()
      })
    },
    { passive: true },
  )

  // filtro: esconde o que não é do tipo, volta pro começo e os cartões entram de novo
  const filtrar = (tipo) => {
    filtros.forEach((f) => f.setAttribute('aria-pressed', String(f.dataset.filtro === tipo)))
    let n = 0
    for (const it of itens) {
      const mostra = tipo === 'todos' || it.dataset.categoria === tipo
      it.hidden = !mostra
      if (mostra) it.style.setProperty('--n', String(n++))
    }
    visiveis = itens.filter((it) => !it.hidden)
    trilho.scrollLeft = 0
    secao.classList.remove('obras--filtrou')
    void secao.offsetWidth
    secao.classList.add('obras--filtrou')
    montarPontos()
    atualizarSetas()
  }
  filtros.forEach((f) => f.addEventListener('click', () => filtrar(f.dataset.filtro)))
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtrar]')
    if (b) filtrar(b.dataset.filtrar)
  })

  // "ver todas": carrossel vira grade (e volta)
  todas?.addEventListener('click', () => {
    const abrir = !grade()
    secao.classList.toggle('obras--grade', abrir)
    todas.setAttribute('aria-expanded', String(abrir))
    todas.textContent = abrir ? 'Ver menos obras' : 'Ver todas as obras'
    trilho.scrollLeft = 0
    if (!abrir) secao.scrollIntoView({ behavior: reduz() ? 'auto' : 'smooth', block: 'start' })
    montarPontos()
    atualizarSetas()
  })

  // a largura vem do ResizeObserver: ler clientWidth antes obrigaria o navegador a montar a
  // seção antes da hora (ela está em content-visibility até chegar perto da tela)
  new ResizeObserver(([e]) => {
    if (!e.contentRect.width) return
    montarPontos()
    atualizarSetas()
  }).observe(trilho)
})()
