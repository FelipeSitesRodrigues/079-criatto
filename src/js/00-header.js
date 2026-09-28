// Menu do celular: tela cheia, fecha no link, no Esc (devolvendo o foco pro botão) e
// quando a tela passa pro tamanho de computador. Enquanto aberto, o resto da página
// fica inerte e sem rolagem, e o Tab gira entre o botão e os itens do menu. (base do 078)
;(() => {
  const topo = document.getElementById('topo')
  const botao = topo?.querySelector('.topo__menu')
  const menu = document.getElementById('menu')
  if (!topo || !botao || !menu) return
  const fundo = [document.querySelector('main'), document.querySelector('.rodape'), document.querySelector('.zap-flutuante'), topo.querySelector('.marca')].filter(Boolean)
  const aberto = () => topo.classList.contains('topo--aberto')

  const abrir = (sim) => {
    topo.classList.toggle('topo--aberto', sim)
    botao.setAttribute('aria-expanded', String(sim))
    botao.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu')
    document.documentElement.style.overflow = sim ? 'hidden' : ''
    fundo.forEach((el) => (el.inert = sim))
    if (sim) menu.querySelector('a')?.focus({ preventScroll: true })
  }

  botao.addEventListener('click', () => abrir(!aberto()))
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) abrir(false)
  })
  document.addEventListener('keydown', (e) => {
    if (!aberto()) return
    if (e.key === 'Escape') {
      abrir(false)
      botao.focus()
      return
    }
    if (e.key !== 'Tab') return
    const lista = [botao, ...menu.querySelectorAll('a[href]')]
    const i = lista.indexOf(document.activeElement)
    if (e.shiftKey && i <= 0) {
      e.preventDefault()
      lista[lista.length - 1].focus()
    } else if (!e.shiftKey && i === lista.length - 1) {
      e.preventDefault()
      lista[0].focus()
    }
  })
  matchMedia('(min-width: 64em)').addEventListener('change', (m) => m.matches && abrir(false))
})()
