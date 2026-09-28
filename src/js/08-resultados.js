// Esteira de clientes (pedido do Usley: todas as logos, em preto e branco, passando).
// A lista é duplicada (cópias fora da leitura) e o trilho anda por transform, com a Web
// Animations API: roda na GPU e não pesa. Passar o mouse ou focar pausa; as setas dão um
// empurrão pra um lado ou pro outro (a velocidade sobe por um instante e volta); fora da
// tela a esteira para. Quem pede menos movimento recebe a lista parada, com rolagem de
// dedo, e as setas andam um cartão.
;(() => {
  const caixa = document.querySelector('[data-clientes]')
  const janela = caixa?.querySelector('.clientes__janela')
  const trilho = caixa?.querySelector('.clientes__trilho')
  if (!caixa || !janela || !trilho || !trilho.children.length) return
  const anterior = caixa.querySelector('[data-anterior]')
  const proximo = caixa.querySelector('[data-proximo]')
  const originais = [...trilho.children]

  const parado = () => {
    caixa.classList.add('clientes--parado')
    const passo = () => (originais[1] ? originais[1].offsetLeft - originais[0].offsetLeft : 260)
    anterior?.addEventListener('click', () => janela.scrollBy({ left: -passo(), behavior: 'auto' }))
    proximo?.addEventListener('click', () => janela.scrollBy({ left: passo(), behavior: 'auto' }))
  }
  if (!('animate' in trilho) || matchMedia('(prefers-reduced-motion: reduce)').matches) return parado()

  // duas voltas da lista: quando a primeira sai inteira pela esquerda, a esteira volta ao
  // começo sem emenda aparente
  for (const it of originais) {
    const c = it.cloneNode(true)
    c.setAttribute('aria-hidden', 'true')
    c.querySelectorAll('img').forEach((img) => (img.alt = ''))
    trilho.append(c)
  }
  const VELOCIDADE = 38 // px por segundo
  let anim = null
  let dentro = false
  let visivel = false
  let empurrao = 0

  const montar = () => {
    const volta = trilho.children[originais.length].offsetLeft - trilho.children[0].offsetLeft
    if (!volta) return
    const duracao = (volta / VELOCIDADE) * 1000
    const tempo = anim ? (anim.currentTime % anim.effect.getTiming().duration) / anim.effect.getTiming().duration : 0
    anim?.cancel()
    anim = trilho.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-volta}px)` }], { duration: duracao, iterations: Infinity })
    // folga pra trás: a seta da esquerda anda a esteira ao contrário sem bater no começo
    anim.currentTime = duracao * (500 + tempo)
    if (!visivel || dentro) anim.pause()
  }
  const tocar = () => anim && visivel && !dentro && anim.playState !== 'running' && anim.play()
  const pausar = () => anim?.pause()

  janela.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return
    dentro = true
    pausar()
  })
  janela.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return
    dentro = false
    tocar()
  })
  caixa.addEventListener('focusin', () => {
    dentro = true
    pausar()
  })
  caixa.addEventListener('focusout', () => {
    dentro = false
    tocar()
  })
  const empurrar = (dir) => {
    if (!anim) return
    anim.updatePlaybackRate(dir * 11)
    anim.play()
    clearTimeout(empurrao)
    empurrao = setTimeout(() => {
      anim.updatePlaybackRate(1)
      if (!visivel || dentro) anim.pause()
    }, 420)
  }
  anterior?.addEventListener('click', () => empurrar(-1))
  proximo?.addEventListener('click', () => empurrar(1))

  // só anda na tela; mede de novo quando a largura muda (os cartões mudam no celular)
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting
    if (!anim && visivel) montar()
    visivel ? tocar() : pausar()
  }).observe(caixa)
  new ResizeObserver(([e]) => e.contentRect.width && anim && montar()).observe(janela)
})()
