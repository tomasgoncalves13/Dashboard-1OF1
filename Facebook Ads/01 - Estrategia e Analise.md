# Facebook Ads — Estratégia e Análise

Registo vivo das campanhas, decisões e aprendizagens do Meta Ads da 1OF1 Fútbol. Atualizar sempre que houver dados novos ou uma decisão de teste. Copys prontas vivem em `Copys por Formato/`.

## Estrutura atual (Set 2026)

**Conta:** 1OF1 Fútbol (1244372553658801)
**Budget:** €30/dia, campanha com "Using campaign budget" (CBO) — o Meta aloca automaticamente entre os ads.

**Campanha ativa — GRWM (vídeos de produto, sem fala):**
Vídeos silenciosos só a mostrar as caneleiras a serem calçadas, um por cor:
- GRWM Verde 38s
- GRWM Branco 33s
- GRWM Amarelo 25s
- GRWM Azul 27s
- GRWM Vermelho 29s
- "As tuas caneleiras estão a jogar contra ti?" (angle: Jogas em Desvantagem)
- "Festa no FDS"

**Vencedor até agora:** GRWM Azul 27s — €14.13 gasto, melhor CTR (3.00%/2.06%), 77 cliques, 14 ATC a €1.01/ATC. Os restantes têm gasto residual ou €0 porque o CBO ainda está a concentrar budget no que já mostra sinal.

## Decisões já tomadas

- **Nomes de jogadores profissionais (Lamine Yamal, Wirtz, Ronaldo Jr.) removidos do copy** — risco de política do Meta (unauthorized use of public figures) e claim não verdadeiro de endosso. Não voltar a usar nomes reais sem parceria confirmada.
- **"285K jogadores" / qualquer número específico não pode aparecer no copy** a menos que seja um dado real (vendas, reviews, clientes). O badge "Used by 285K industry peers" é gerado automaticamente pelo Meta (Advantage+) e não é uma alegação nossa — não reaproveitar como texto do anúncio.
- **Advantage+ creative text generation: manter ligado**, mas escrever as 5 variações manualmente em vez de deixar gerar sozinho, para controlar a mensagem.
- **Vídeos GRWM = copy de jogador apenas.** Vídeo é só produto (sem contexto de pai/filho), por isso copy de pais fica reservado para a futura campanha de imagens onde a imagem mostra literalmente essa cena (pai a assistir, filho a jogar). Copy e imagem desalinhados tendem a baixar CTR/relevância.
- Cada cor de vídeo GRWM vai receber um ângulo de jogador diferente (ver `Copys por Formato/GRWM - Video Produto.md`) para começar a isolar qual ângulo puxa mais, sem mexer no vídeo.

## Economia por cliente (LTV vs CPA)

Visível no dashboard (`/ads` → "Aquisição de clientes" e `/dashboard` → "Clientes"). Cliente novo = 1ª encomenda paga desse cliente em todo o histórico; CPA = gasto ÷ clientes novos (quem já tinha comprado não conta).

**Leitura a 22 Set 2026:** LTV ≈ **€33 receita / €24 lucro** por cliente (lucro depois de COGS, envio, embalagem e taxas, antes de ads). Só **~4% dos clientes voltam a comprar**, e nos últimos 30 dias 0 das 47 encomendas pagas foram de clientes que já tinham comprado → na prática o LTV ≈ o lucro da 1ª encomenda.
**Implicação:** o CPA máximo para não perder dinheiro é **~€24**. Não contar com recompra para "pagar" um CPA alto: cada cliente tem de ser rentável logo na 1ª encomenda. Subir o AOV (packs/kits) ou a recompra (email pós-compra) é o que sobe este teto.

## Objetivo Q4 2026 / Black Friday (definido a 23 Set 2026)

**Ponto de partida (dados reais):** melhor mês de sempre = Dez 2025 (€2.2k online). Set 2026 ≈ €1.9k online (42 encomendas) + €0.5k clubes, com €30/dia de ads. AOV ≈ €44, lucro antes de ads ≈ €32/encomenda, CPA ≈ €14.
**O dono propôs €150k até ao fim do ano.** Reality check: seriam ~3.400 encomendas (~50k€/mês, ~20× o melhor mês de sempre), ~€50k+ de ads mesmo com o CPA de hoje, e o CPA sobe sempre que se escala muito e com o leilão caro do BF → lucro perto de zero. Também seria preciso ~10k meias e ~7k caneleiras em stock.
**Meta recomendada: ~€25-30k no Q4** (Out ~€5k, Nov ~€12-15k com BF, Dez ~€10k), ou seja ~10× o ritmo atual. Escalar o budget +20-30% a cada 3-4 dias **enquanto o CPA estiver < €20** (o teto de break-even é ~€24), até ~€100-150/dia no BF.
**Plano interativo:** https://claude.ai/artifact/Dq1WuXHPqd5PhgR69oCuu6. Modelo: custo/encomenda = €10 × (budget/€35)^0,35 × fator da fase. Cenário **otimista-realista** (Out €80/dia → pré-BF €120 → Black Week €300 → Natal €200 → pós-Natal €60 → Saldos €120): **~€36k Out–Dez, ~€45k até 31 Jan, €16k de ads, ~€14k de lucro depois de ads**. O full gas (o dobro do budget) fatura ~€74k mas só dá ~€15k de lucro, porque o lucro quase não sobe com o dobro dos ads. Em 23 Set, com €40/dia, já iam €236 de vendas a meio da tarde.
**Stock:** a este ritmo, as caneleiras Built-In (970 un., ~67/mês hoje) são o gargalo e acabam por volta de dezembro. Encomendar caneleiras e meias pretas **até ~início de outubro** para chegarem antes do BF (27 Nov).

## Próxima campanha (planeada)

Campanha separada com **imagens estáticas**, cada imagem já ligada a um ângulo específico (ex: imagem de caneleira a escorregar → ângulo "Jogas em Desvantagem" / "Não Saem do Sítio"; imagem de pai/filho → ângulo "Pai Protetor" ou "Olheiros"). Aqui sim entra copy de pais, porque a imagem justifica o angle. Ver `Copys por Formato/Imagens - Angulos Especificos.md` (a preencher quando as imagens estiverem escolhidas).

## O que testar a seguir (backlog)

- [ ] Distribuir os 5 ângulos de jogador pelas 5 cores GRWM e deixar correr 3-4 dias sem mexer
- [ ] Depois de estabilizar (30-50+ ATC), comparar CTR / custo-por-ATC por ângulo, não por cor
- [ ] Montar campanha de imagens com ângulos de pais assim que houver imagens selecionadas
- [ ] Considerar ad set próprio (budget dedicado) para os ads que ficam a €0 há vários dias, ou pausar e substituir por criativo novo
- [ ] Definir cadência: quantos ads novos testar por semana (sugestão: 3-4, para não perder o sinal dos vencedores atuais)

## Log de resultados

_Atualizar aqui sempre que houver uma leitura de dados relevante (ex: "após 4 dias, GRWM Azul continua vencedor, GRWM Amarelo pausado por falta de sinal")._

### 9 Set 2026
- 7 ads ativos, GRWM Azul 27s claramente à frente (ver métricas acima). GRWM Amarelo e Festa no FDS sem gasto — normal em CBO nos primeiros dias, não é bug nem sazonalidade de fim de semana.

### 10-11 Set 2026 — Campanha de imagens (8 ads: Criança 1/2/3, Produto 1/2/3, Kit, Produto genérico)
- **Criança 1**: 2 dias seguidos com cliques mas 0 ATC (28 cliques/0 ATC dia 1, 14 cliques/0 ATC dia 2 — 42 acumulados sem carrinho nenhum). É o ad a receber mais reach do CBO. Padrão a monitorizar: se continuar no dia 3, trocar criativo/copy — atrai clique mas não intenção de compra.
- **Kit**: inverteu a tendência — dia 1 tinha o pior custo/ATC (€2.22), dia 2 já com 4 ATC em 11 cliques (36% conversão). Amostra ainda pequena, mas a acompanhar como possível vencedor.
- **Criança 3**: única com 1 compra até agora (ROAS 60.17, dia 1), CTR mais alto do grupo (2.88%) e custo/ATC mais baixo (€0.29). Sinal mais forte do teste, mas n=1 compra.
- **Produto 2** e **Produto (genérico)**: sem sinal nenhum (0 cliques, gasto residual) — CBO já a despriorizar corretamente, não é bug.
- Decisão: deixar correr sem tocar (CBO ainda em fase de aprendizagem, <2 dias de dados). Reavaliar ao dia 3-4.

### 11 Set 2026 (noite, ~22h37) — reavaliação dia 3
- **Criança 1**: mais 20 cliques hoje, 0 ATC → **62 cliques acumulados sem um único ATC**, continua a receber o maior share de budget do ad set (41%, €7.25/€17.55). Cruzou o limiar definido no backlog ("se continuar no dia 3, trocar criativo"). **Decisão: trocar criativo/copy deste ad.**
- **Kit**: confirma-se como o sinal mais forte do teste — hoje 4 ATC em 13 cliques (31% conversão). Candidato a vencedor, deixar CBO continuar a alocar aqui.
- **Criança 3**: inverteu hoje (9 cliques, 0 ATC), depois de ter sido o melhor sinal do dia 1 (1 compra, CTR 2.88%, custo/ATC €0.29). Ainda sem alarme dado o volume baixo — a acompanhar amanhã antes de decidir.
- Produto, Produto 1/2/3, Criança 2: gasto residual, sem sinal, CBO a despriorizar corretamente.
