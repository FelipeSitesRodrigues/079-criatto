// Desenho da casa sendo feito à caneta (CTA final).
// O PNG do Felipe fica no HTML (é o que aparece sem JS e pra quem pede menos movimento).
// Quando a faixa chega perto da tela, busca o desenho.svg (scripts/vetorizar-desenho.mjs):
// uma máscara com os traços do desenho, em faixas de baixo pra cima, revelando o mesmo PNG.
// O SVG entra no lugar do <img> com tudo apagado; quando a faixa aparece de verdade, a
// classe desenho--anima faz os traços crescerem (stroke-dashoffset, só CSS) e, no fim, a
// máscara acende inteira pra não sobrar detalhe de fora. Roda uma vez. Se o SVG não vier,
// o PNG volta a aparecer.
;(() => {
  const caixa = document.querySelector('[data-desenho]')
  const img = caixa?.querySelector('.cta__desenho-img')
  if (!caixa || !img) return
  const falhou = () => caixa.classList.add('desenho--falhou')
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window) || !window.fetch) return falhou()

  let pronto = null
  const preparar = async () => {
    const resp = await fetch('/assets/img/desenho.svg')
    if (!resp.ok) throw new Error('desenho.svg ' + resp.status)
    const texto = await resp.text()
    const molde = document.createElement('div')
    molde.innerHTML = texto.trim()
    const svg = molde.querySelector('svg')
    if (!svg) throw new Error('desenho.svg sem <svg>')
    // o PNG revelado: 800 px no celular, 1400 px no computador em tela 2x
    const largura = (caixa.clientWidth || innerWidth) * (window.devicePixelRatio || 1)
    const href = largura > 900 ? '/assets/img/desenho-traco-1400.png' : '/assets/img/desenho-traco-800.png'
    const imagem = svg.querySelector('image')
    imagem?.setAttribute('href', href)
    const pre = new Image()
    pre.src = href
    await pre.decode()
    img.replaceWith(svg)
    return svg
  }

  const perto = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      perto.disconnect()
      pronto = preparar().catch(() => {
        falhou()
        return null
      })
    },
    { rootMargin: '600px 0px' },
  )
  perto.observe(caixa)

  const naTela = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      naTela.disconnect()
      ;(pronto || Promise.resolve(null)).then((svg) => {
        if (!svg) return
        // um quadro com tudo apagado antes de começar, pra animação não pular o início
        requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('desenho--anima')))
      })
    },
    { threshold: 0.35 },
  )
  naTela.observe(caixa)
})()
