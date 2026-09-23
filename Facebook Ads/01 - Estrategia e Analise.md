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
**Dados reais desde que os ads arrancaram (9–22 Set, 14 dias de TESTES):** €674 em ads (€48/dia), 41 encomendas pagas, €1.786 de faturação → **custo por encomenda €16,4, ROAS 2,65**, ~€605 de lucro depois de ads. Antes dos ads: ~1 encomenda a cada 2–3 dias, ou seja quase tudo vem dos ads. Foi fase de teste (muitos criativos cortados) e mesmo assim deu lucro. Em 23 Set: €236 em 5 encomendas com €30 gastos. *(A estimativa anterior de "~€10/encomenda" estava errada: usava os últimos 45 dias, incluindo semanas sem ads.)*
**Plano interativo:** https://claude.ai/artifact/Dq1WuXHPqd5PhgR69oCuu6, recalibrado. Modelo: custo/encomenda = €16 × (budget/€48)^0,35 × fator da fase × criativos (por defeito −20% face aos de teste). Cenário **otimista-realista** (Out €80/dia → pré-BF €120 → Black Week €300 → Natal €200 → pós-Natal €60 → Saldos €120), com criativos −20%: **~€31k Out–Dez, ~€40k até 31 Jan, €16k de ads, ~€10k de lucro depois de ads**. Com os criativos iguais aos de teste só dá ~€5k de lucro. O full gas só compensa com criativos **~30% melhores** (aí ~€74k de faturação e ~€15k de lucro); com −20% dá menos lucro que o otimista-realista.
**Regra de decisão para a Black Week (recalibrada a 23 Set):** o dono acredita que o ROAS vai subir com melhores anúncios, influencers e posts diários no feed. Provar em outubro. A meio de outubro, com **€80–100/dia**, olhar para o custo por encomenda (gasto ÷ todas as encomendas pagas): **≤ €14 → full gas** (~€700/dia na Black Week); **€14–18 → otimista-realista** (~€300/dia); **> €18 → conservador** (~€150/dia) e trocar criativos. O quadro "Real vs Plano Q4" no `/dashboard` mostra isto em tempo real.
**Oferta da Black Week (discutido a 23 Set): sem descontos no preço.** O dono admite no máximo um "buy 1 get 1 free". Contas por encomenda de 1 par de caneleiras (€29,95; custo €2,84; envio: o cliente paga €4,95 abaixo de €40 e é grátis a partir de €40, e custa-nos sempre €5,40; embalagem €0,76 + meia de oferta €0,88 + taxas ~2,5%):
- Normal (€29,95 + €4,95 de envio = €34,90): ~€24 de margem por encomenda.
- **BOGO (2 pelo preço de 1, continua < €40 → o cliente paga o envio):** ~€21 de margem e o valor da encomenda não sobe. Com €15 de ads por encomenda sobram **~€6**.
- **Compra 2, Leva 3 (€59,90 → envio grátis):** ~€43 de margem. Com €15 de ads sobram ~€28. Mesmo que converta metade do BOGO (ads a ~€30 por encomenda), sobram ~€13.
- **Recomendação:** headline "Compra 2, Leva 3" em toda a loja na Black Week. Se quiser o BOGO, só nos 2 dias de pico (BF 27 + CM 30) e só em caneleiras. Qualquer oferta destas **multiplica as unidades por encomenda** (2–3× na Black Week), por isso o stock tem de subir quando a oferta estiver fechada.
**Nota do dono (23 Set):** as ofertas em produto **quase não aumentam o custo de cada encomenda**, porque o produto é barato (caneleira €2,84, meia €0,88). O plano usa margem de 70% na Black Week e 72% nos Saldos (sem descontos em preço), e não 60%.
**Inventário por variante:** aba "Inventário por variante" no plano interativo, com stock a 23 Set, consumo por variante (só site, desde 9 Set, 46 encomendas), data em que esgota, quantidade a encomendar e lista de compras por fornecedor. **Bubble mailers:** ~200 em stock a 23 Set, 1 por encomenda e 2 nas encomendas grandes (~10% das encomendas têm 6+ artigos), por isso ~1,1 por encomenda. Ao ritmo do full gas **esgotam por volta de 18 Out**: é preciso encomendar já. Próximo passo: juntar as vendas a clubes ao consumo.
**Prazos e transporte (betopmax, 23 Set):** 7 dias para a foto da amostra + 3 semanas de produção + 2 semanas por avião = 6 semanas desde o pagamento. Por comboio DDP são ~5 semanas de viagem, ~3× mais barato. Vale o mesmo para os outros fornecedores. As sleeves não precisam de produção (vão logo). Caneleiras, meias e bubble mailers precisam de produção personalizada. Dá para juntar tudo num agente (como o szfly56 da 1.ª encomenda) num só envio DDP.
**Custos reais por unidade (produção / transporte, avião assumido):** Built-In €2,24 / €0,60; meias e sleeves €0,59 / €0,29; bubble mailers €0,28 / €0,41; Mini €1,00 / €0,33; Airflow €0,95 / €0,58.
**Opções de envio (aba no plano, pagamento a 28 Set):** personalizados chegam a 9 Nov por avião e a 30 Nov por comboio; sleeves a 19 Out por avião. **Recomendado: ponte aérea + comboio**, ou seja por avião só o que é preciso até o comboio chegar, e o resto por comboio. Faltam as mesmas unidades que com tudo por avião, mas poupa ~€1,1k de transporte (€1,3k contra €2,5k). Mesmo assim faltam produtos antes de chegar: bubble mailers (~240 un., comprar mailers simples cá como solução de recurso), Grip Preto Kids (~100) e Azul Kids (~45). Pedir para **saltar a amostra** (é uma recompra igual) poupa 1 semana.
**Meia de oferta (23 Set):** hoje sai sempre Grip Sock **Branco Adulto** (1 por encomenda). Está a ser pensado deixar o cliente **escolher o tamanho (Adulto ou Kids)**. Com ~35% em Kids (a parte de caneleiras de criança no site), o cenário otimista-realista passa o Branco Adulto de "esgota a 14 Dez" para "esgota a ~25 Jan". Usa as 371 Branco Kids que estavam paradas e reduz a encomenda de branco (~470 → ~330 un.). Atenção: os clubes compram sempre Kids, por isso as Branco Kids passam a ter dois consumos. **Decisão (23 Set):** na Shopify não dá para escolher por variante, mas dá por produto. Produtos de criança ("Caneleiras Embutidas - Criança" e os outros "- Criança", incluindo o Pack Pro Crianças) → oferta **Branco / EU 36-40**; os outros → **Branco / EU 40-48**. O dashboard já desconta o stock certo sozinho (EU 36-40 → GRIP-K-BRANCO), sem mudar código. Falta testar um carrinho misto (adulto + criança) para ver se entram 2 ofertas. *(A ideia anterior, abaixo, fica como histórico.)* **Recomendação sobre como fazer a escolha:** evitar um popup obrigatório ao adicionar ao carrinho, porque é mais um passo no momento de compra e, se for fechado, a oferta pode não entrar. Melhor: **juntar a oferta sozinha, já no tamanho certo**: Kids se o carrinho tem um produto "Criança", Adulto se não tem, com um seletor Adulto/Kids no carrinho para trocar. Não se perde nenhuma venda, e dá para anunciar a oferta no carrinho ("Oferta: meias antiderrapantes · €12,95 · GRÁTIS"). Se se mudar, fazer em outubro e comparar a taxa de carrinho → compra antes e depois, nunca pela primeira vez na Black Week.
**Sock Sleeves (decisão a 23 Set):** encomendar já (24 Set), à parte, por avião, porque não têm produção personalizada. Regra do dono: **no mínimo 25 de cada variante**, mesmo nas que ainda não venderam (Verde, Vermelho e Amarelo Kids, Amarelo Adulto). As que vendem bem são dimensionadas para o full gas **com margem extra** (~1.030 un., ~€0,88 cada com avião). A aba Inventário tem o campo "Mínimo de sleeves por variante".
**Stock (decisão a 23 Set: "não quero que me falte produto"):** a encomenda aos fornecedores é dimensionada para o **full gas com criativos −30%** (~1.700 encomendas Out–Jan + 10% de margem + clubes), porque a decisão do full gas só se toma a meio de outubro, tarde demais para encomendar da China a tempo da BF. O que sobrar vende-se na 2.ª volta da época. **A meia de oferta (Grip Sock Branco Adulto, 1 por encomenda) é o maior consumo de meias**: a escalar, o branco adulto também tem de ser encomendado, apesar dos 718 em stock.

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
