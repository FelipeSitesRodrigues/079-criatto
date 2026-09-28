// Criatto: comportamento comum a todas as seções. Sem biblioteca e sem ouvir o scroll
// da janela: o que depende de rolagem vai por IntersectionObserver (base do 078).
// Cada seção com comportamento próprio tem o seu arquivo (mesmo nome do parcial).
;(() => {
  const temIO = 'IntersectionObserver' in window

  // ---------------------------------------------------------------- revelação no scroll
  const alvos = document.querySelectorAll('[data-revela], [data-revela-lista]')
  if (!temIO) {
    alvos.forEach((el) => el.classList.add('visivel'))
  } else {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.classList.add('visivel')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    alvos.forEach((el) => io.observe(el))
  }

  // ---------------------------------------------------------------- topo e botão flutuante
  // O topo ganha o preto com vidro quando a página sai do começo (sentinela a 40 px do
  // topo). O WhatsApp flutuante só aparece depois que os botões do hero saem da tela, e
  // some de novo em cima do CTA final e do rodapé (que já têm o botão).
  const topo = document.getElementById('topo')
  const hero = document.getElementById('inicio')
  const zap = document.querySelector('.zap-flutuante')
  const botoesHero = hero?.querySelector('.hero__botoes')
  const fim = document.getElementById('contato')
  if (temIO && hero) {
    const sentinela = document.createElement('div')
    sentinela.setAttribute('aria-hidden', 'true')
    sentinela.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none'
    hero.prepend(sentinela)
    new IntersectionObserver(([e]) => topo?.classList.toggle('topo--rolado', !e.isIntersecting)).observe(sentinela)
    let botoesFora = false
    let noFim = false
    const zapVisivel = () => zap?.classList.toggle('visivel', botoesFora && !noFim)
    new IntersectionObserver(([e]) => {
      botoesFora = !e.isIntersecting && e.boundingClientRect.top < 0
      zapVisivel()
    }).observe(botoesHero || hero)
    if (fim)
      new IntersectionObserver(([e]) => {
        noFim = e.isIntersecting || e.boundingClientRect.top < 0
        zapVisivel()
      }, { rootMargin: '0px 0px -30% 0px' }).observe(fim)
  } else {
    zap?.classList.add('visivel')
  }

  // ---------------------------------------------------------------- âncoras
  // As seções abaixo da dobra usam content-visibility (layout só perto da tela) e, até
  // aparecerem, têm altura estimada: a rolagem até uma âncora distante parava no lugar
  // errado. No primeiro clique numa âncora (ou chegando com #algo no endereço) a página
  // desenha tudo uma vez e só então rola; no fim da rolagem, confere e acerta de uma vez
  // (bug do 076).
  const desenharTudo = () => document.documentElement.classList.add('cv-pronto')
  if (location.hash.length > 1) desenharTudo()
  let pendente = null
  const folga = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  const acertar = () => {
    if (!pendente || Date.now() > pendente.ate) return (pendente = null)
    const alvo = pendente.alvo
    pendente = null
    const dif = alvo.getBoundingClientRect().top - folga()
    if (Math.abs(dif) > 3) scrollBy({ top: dif, behavior: 'instant' })
  }
  if ('onscrollend' in window) addEventListener('scrollend', acertar)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]')
    if (!a || e.defaultPrevented) return
    const id = a.getAttribute('href').slice(1)
    const alvo = id && document.getElementById(id)
    if (!alvo) return
    e.preventDefault()
    desenharTudo()
    requestAnimationFrame(() => {
      pendente = { alvo, ate: Date.now() + 4000 }
      alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      if (!('onscrollend' in window)) setTimeout(acertar, 1400)
      history.pushState(null, '', '#' + id)
      // o foco acompanha (teclado e leitor de tela continuam de onde a página parou)
      if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1')
      alvo.focus({ preventScroll: true })
    })
  })

  // ---------------------------------------------------------------- menu: seção atual acesa
  const links = new Map([...document.querySelectorAll('.menu__lista a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]))
  if (temIO && links.size) {
    // toda seção entra na conta: a que tem link acende o dela e as sem link apagam tudo
    // (antes e depois conta como Obras; como funciona e resultados, como Diferenciais)
    const secoes = [...document.querySelectorAll('main > section[id], footer[id]')]
    const irma = { 'antes-e-depois': 'obras', 'como-funciona': 'diferenciais', resultados: 'diferenciais', rodape: 'contato' }
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          const id = irma[e.target.id] || e.target.id
          links.forEach((a, chave) => a.setAttribute('aria-current', String(chave === id)))
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    secoes.forEach((s) => io.observe(s))
  }

  // ---------------------------------------------------------------- rastreio dos cliques no WhatsApp
  // Todo botão de WhatsApp manda evento com a origem (data-zap) e, nos cartões, o serviço.
  // Vai pro dataLayer (GA4 / Tag Manager) e pro Pixel, se um dia forem instalados.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]')
    if (!a) return
    const origem = a.dataset.zap || a.closest('section, header, footer')?.id || 'pagina'
    const servico = a.dataset.servico
    ;(window.dataLayer = window.dataLayer || []).push({ event: 'whatsapp_clique', origem, servico })
    if (typeof window.fbq === 'function') window.fbq('track', 'Contact', { origem, servico })
  })
})()
