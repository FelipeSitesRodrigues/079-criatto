// Comparador de antes e depois (base do 078). Quem arrasta é um <input type="range">
// invisível que cobre a foto inteira: mouse, dedo e teclado (setas, Home, End) já vêm
// dele, sem ouvir pointermove. Aqui só entra o --pos (o recorte do "depois" e a linha) e
// o texto que o leitor de tela fala. Quando a linha pula (clique longe, teclado), ela
// desliza; no arrasto, segue o dedo sem atraso.
;(() => {
  for (const fig of document.querySelectorAll('[data-comp]')) {
    const faixa = fig.querySelector('.comp__faixa')
    if (!faixa) continue
    let anterior = Number(faixa.value)
    let arrastando = false
    let soltar = 0

    const aplicar = () => {
      const v = Number(faixa.value)
      // salto grande sem arrasto = clique ou teclado: anima
      fig.classList.toggle('comp--pulando', !arrastando && Math.abs(v - anterior) > 4)
      anterior = v
      fig.style.setProperty('--pos', `${v}%`)
      faixa.setAttribute('aria-valuetext', v <= 3 ? 'só o depois' : v >= 97 ? 'só o antes' : `${v}% antes, ${100 - v}% depois`)
      clearTimeout(soltar)
      soltar = setTimeout(() => fig.classList.remove('comp--pulando'), 460)
    }
    faixa.addEventListener('input', aplicar)
    faixa.addEventListener('pointerdown', () => {
      // o primeiro input de um clique pula até o ponto; os seguintes são arrasto
      requestAnimationFrame(() => {
        arrastando = true
        fig.classList.add('comp--arrastando')
      })
    })
    const fim = () => {
      arrastando = false
      fig.classList.remove('comp--arrastando')
    }
    faixa.addEventListener('pointerup', fim)
    faixa.addEventListener('pointercancel', fim)
    faixa.addEventListener('blur', fim)
  }
})()
