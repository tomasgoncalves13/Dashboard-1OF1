# Estilo de Legendas em Vídeos — Especificação

Regras de edição de legendas para vídeos orgânicos/ads do 1OF1, definidas e validadas em vídeos de teste (Caneleiras Embutidas, "Festa no fds"). Usar como padrão em próximos vídeos, salvo indicação em contrário.

## Fonte e aspeto do texto
- Arial Bold, branco, contorno preto (`stroke_width` ≈ 5-6px) — legível sobre qualquer fundo.
- Frases de CTA/promo (descontos, códigos, drops) usam **dourado** (`#D4AF37`) no ponto-chave (ex: "50% DE DESCONTO"), o resto fica branco — segue a regra da marca ("frases douradas só para CTAs supremos").

## Posicionamento
- Tudo centrado no ecrã, na horizontal e na vertical (não em lower-third).
- Hook/pergunta inicial: fonte grande, quebra para 2 linhas, bloco centrado.
- Lista de vantagens (✅): bloco centrado, empilhado (ver abaixo).
- Bloco de promo/CTA no fim: centrado, hierarquia por tamanho (kicker pequeno → headline grande dourada → sublinhas menores), tudo centrado horizontalmente linha a linha.

## Emoji inline
- O ✅ (ou outro emoji) escreve-se dentro da própria frase, ao mesmo tamanho visual do texto — nunca como ícone grande separado.
- Implementação (Pillow/macOS): renderizar o emoji com a fonte Apple Color Emoji (`/System/Library/Fonts/Apple Color Emoji.ttc`) — só aceita tamanhos fixos (20/32/40/48/64/96/160px) — depois fazer resize para ≈1.35× a altura da caixa do texto ("cap height"), para ficar proporcional à letra ao lado.

## Sincronização com a música
- Detectar batidas/"pum" reais do áudio com `aubiotrack` (aubio CLI), não usar intervalos fixos arbitrários.
- Padrão rápido (1 legenda por batida): usar cada batida detetada (~0.5s de intervalo típico).
- Padrão espaçado (usado nas vantagens): saltar ~4 batidas entre cada entrada (~2s de intervalo).

## Padrão de "vantagens" (✅ lista)
- Não é troca (uma sai, outra entra) — é **acumulação**: a 1ª aparece e fica; ~2s depois a 2ª aparece por baixo (as duas visíveis); depois a 3ª por baixo dessa; depois a 4ª. As 4 ficam visíveis em simultâneo, em posições fixas (slots) empilhadas de cima para baixo.
- Saída: as 4 desaparecem todas ao mesmo tempo, exatamente na **batida seguinte da mesma grelha** (ou seja, a batida onde entraria a 5ª, se existisse) — não é um tempo fixo de espera, é sincronizado ao beat.

## Bloco de promo/CTA (fim do vídeo)
- Aparece perto do fim (alinhado a uma batida), fica até ao fim do vídeo.
- Copy dividido em linhas curtas com hierarquia clara (kicker → oferta principal em destaque dourado → detalhe da oferta), não um parágrafo corrido.
- Objetivo: limpo, sem ruído visual — poucas linhas, tamanhos diferentes para guiar o olho, tudo centrado.

## Fluxo de trabalho
- Tomás pede ajustes em português coloquial; Claude interpreta, ajusta o script de geração e re-renderiza (não é suposto Tomás editar isto manualmente num editor de vídeo — ver preferência em memória).
- Conteúdo/copy das legendas deve puxar de `Angulos de Venda/`, `Caracteristicas Produtos/`, `Influencers/Copys Videos Organicos - Caneleiras.md` e `Valores da marca/` nesta mesma pasta.
