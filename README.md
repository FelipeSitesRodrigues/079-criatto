# 079 Criatto Construtora

Site da Criatto Construtora, construtora de casas e reformas de alto padrão do Usley Sardinha
em Goiânia/GO (CNPJ de 2010, 16 anos). HTML, CSS e JavaScript estáticos, montados por um
`build.mjs` em Node e servidos de `dist/`. Feito a partir dos mockups aprovados, desktop e
celular (`../079 - CRIATTO/Recursos Site/DESKTOP/` e `MOBILE/`), com a copy do `copy-site.md`.

Lighthouse local (2026-09-25): **computador 100 · 100 · 100 · 100**; **celular 99 a 100 · 100 ·
100 · 100** (TBT 0 ms, CLS 0). O número oficial é o do PageSpeed depois do deploy.

## Rodar

```bash
npm install          # só na primeira vez (sharp, puppeteer-core, cheerio, phosphor, lighthouse)
npm run build        # monta dist/index.html
npm run serve        # http://localhost:3079 (ou dois cliques em ABRIR-SITE.bat)
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run build` | monta `dist/` a partir de `src/` e avisa o que está pendente |
| `npm run publicar` | o mesmo, do zero, apagando os previews (antes de subir) |
| `npm run serve` | servidor local na porta 3079, com gzip como a Vercel |
| `npm run testar` | 88 verificações: 13 larguras, animações, menu, âncoras, galeria, comparadores, esteira, desenho, WhatsApp, imagens e console |
| `npm run lighthouse` | Lighthouse de celular e de computador (`METODO=devtools` pra limitação real) |
| `npm run imagens` | gera as imagens (AVIF e WebP) a partir da pasta de recursos do cliente |
| `npm run desenho` | vetoriza o desenho do CTA final (máscara da animação) |
| `npm run fontes` | baixa e recorta as fontes (Archivo e Manrope) |
| `node scripts/og.mjs` | refaz a imagem de compartilhamento (1200 x 630) |
| `node scripts/alturas.mjs` | mede as seções pro `99-desempenho.css` |
| `node scripts/print.mjs / --largura 390 --inteira` | print da página (movimento reduzido; `--movimento` liga) |
| `node scripts/perfil.mjs` | trace da thread principal com a CPU 4x mais lenta (`REDE=lenta` limita a rede) |

## Estrutura

- `src/index.html` é o molde; cada seção é um parcial em `src/partials/` (00 a 10, na ordem
  do mockup), com CSS e JS de mesmo nome em `src/css/` e `src/js/`. `99-desempenho.css` guarda
  as alturas reservadas das seções.
- `src/dados/servicos.json` gera os 8 cartões (cada um com o WhatsApp do próprio serviço e a
  lista do rodapé), `obras.json` a galeria com os filtros, `antes-depois.json` os 4
  comparadores e `logos.json` a esteira de clientes.
- `site.config.json` guarda contato, endereço, CNPJ, horário e as mensagens de WhatsApp. O
  build lista as `pendencias` a cada execução.
- `dist/` vai versionado: a Vercel só serve a pasta, sem instalar nem buildar (`vercel.json`).
  Depois de mexer em `src/`, rodar `npm run publicar` e commitar.

## O desenho do CTA final

O desenho do Felipe (`IMAGEM DESENHO - VAMOS TIRAR O SEU PROJETO DO PAPEL.png`) se desenha
sozinho quando a faixa aparece, de baixo pra cima, como caneta técnica. O que aparece na tela
é sempre o PNG original: `scripts/vetorizar-desenho.mjs` tira as linhas de centro do desenho e
monta uma máscara SVG (10 KB) que cresce por `stroke-dashoffset` e vai revelando o PNG. Roda
uma vez, só com a faixa na tela, e não pesa no carregamento (o SVG só é buscado quando a faixa
chega perto). Sem JS ou pra quem pede menos movimento, fica o PNG parado.

## Decisões que não estão no mockup

- **Copy (v2.0, 2026-09-28):** o Usley aprovou o design e pediu o texto todo revisado:
  português formal, no registro do site antigo, sem comparar casa com hospital e com
  residencial, hospitalar e corporativo/comercial cada um no seu lugar. Todos os textos estão
  na tabela da v2.0 no topo do `copy-site.md`. O "Construímos UTI" saiu do site, do schema e
  da imagem de compartilhamento (`node scripts/og.mjs`). O menu trocou "Diferenciais" (que
  apontava pra seção hospitalar) por "Como trabalhamos".
- **Serviços 7 e 8** (Projetos personalizados e Consultoria e planejamento) não estão na copy:
  entraram pelo mockup e pelas imagens que o Felipe gerou, com o texto do próprio mockup.
- **Resultados:** o mockup tinha 3 depoimentos inventados. Sem avaliação real, a faixa mostra
  os clientes da equipe (Rede D'Or, DASA, Itaú, Banco do Brasil, Porto Seguro, Norte Energia)
  em preto e branco, numa esteira contínua (pedido do Usley). As setas empurram a esteira.
- **Galeria de obras:** fotos reais (legendas conferidas no portfólio do site antigo). A única
  residencial é a casa gerada por IA, marcada "Ilustrativa", sem nome de condomínio nem cidade.
  "Ver todas as obras" transforma o carrossel em grade.
- **Antes e depois:** o terceiro card é "Obra comercial" (nome do arquivo do Felipe; o mockup
  dizia "Condomínio de luxo", mas a imagem é o prédio da Porto Seguro). A seção leva a legenda
  "Imagens meramente ilustrativas".
- **Header:** o telefone abre o WhatsApp (o número é de WhatsApp; `tel:` no computador abre
  seletor de aplicativo). Entre 1024 e 1279 px o número vira só o ícone.
- **Rodapé:** só WhatsApp e e-mail nos ícones (a Criatto não tem Instagram nem Facebook).
- **WhatsApp flutuante:** não aparece no mockup; entra depois do hero e some em cima do CTA
  final e do rodapé.
- **Hero no celular:** segue o mockup mobile (título e subtítulo em cima do céu da foto, a casa
  embaixo e os botões depois dela).

## Desempenho

- CSS e JS embutidos no HTML (30 KB com gzip), fontes próprias recortadas no português
  (Archivo variável 49 KB, pré-carregada; Manrope 21 KB), imagens em AVIF com WebP de reserva.
- As seções abaixo do hero usam `content-visibility: auto`, com a altura reservada medida (sem
  o padding, bug do 076). O primeiro clique numa âncora desenha tudo e confere a posição no fim
  da rolagem.
- **Celular:** a seção de serviços fica pulada até a primeira pintura (classe `js-abrindo`,
  tirada por um script no `<head>`). Sem isso ela era montada junto com o hero, as fotos dos
  cartões terminavam de baixar antes da foto do hero aparecer e o LCP simulado subia de 1,9
  pra 2,3 s.
- A foto do hero no celular tem versão de 760 px (o Lighthouse usa 412 px em tela 1,75x) e AVIF
  mais leve (35 KB): ela é o LCP.

A copy, os mockups e a memória do projeto ficam na pasta `sites/079 - CRIATTO/`.
