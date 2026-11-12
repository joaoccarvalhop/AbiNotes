# Auditoria do ABI Hub — 28 Out 2026

Revisão de `abi-hub.html` feita em três partes. O estado de cada ponto está no fim da linha:

- ✅ corrigido
- ⏳ fica para depois, com o motivo
- 💬 precisa de uma decisão tua

As três partes da revisão:

1. Builds, Loadouts, Gear, Market e Share.
2. Maps.
3. CSS, globais e estrutura.

Os números de linha referem-se ao ficheiro antes das correções.

---

## 1. Bugs

### Dados e gravação
| # | Onde | Problema | Estado |
|---|---|---|---|
| B1 | rascunho (`sameData`) | Um rascunho que só alterava **rotas** ou **paredes** era considerado igual ao ficheiro: não era restaurado e acabava por ser apagado. | ✅ |
| B2 | `costNum` | Custos escritos em Koen completos liam-se mal: "245000" virava 245M e "1,200,000" virava 1.2k. | ✅ |
| B3 | `fmtKoen` | 999 950 aparecia como "1000k" em vez de "1M". | ✅ |
| B4 | novo item no Market | O id vinha só do nome, por isso dois itens podiam ficar com o mesmo id e os preços misturavam-se. | ✅ |
| B5 | import de builds | As builds importadas iam para o fim da lista e desarrumavam a ordem por tier. | ✅ |
| B6 | apagar loadout | Com o índice a −1 (dados trocados com a overlay aberta), `splice(-1)` apagava o **último** loadout. O favorito também ficava guardado. | ✅ |
| B7 | rascunho de preços | Um rascunho antigo era sempre tratado como "prices.js foi atualizado". | ✅ |
| B8 | Maps `saveMapsUI` | "Esconder painel" não era guardado, e o campo morto `planTab` era. | ✅ |

### Crashes
| # | Onde | Problema | Estado |
|---|---|---|---|
| B9 | overlay do Gear, Market | Um preço sem durabilidade válida (`ppd` nulo) rebentava em `toLocaleString`. | ✅ |
| B10 | ranking de valor | Um `ppd` nulo contava como 0 e ficava em #1. | ✅ |
| B11 | editar build | Uma build com tier desconhecido rebentava em `tierLabel`. | ✅ |
| B12 | import | Num browser sem `DecompressionStream` o erro aparecia como "That isn't an ABI Hub code". | ✅ |

### Ecrãs que ficavam desatualizados
| # | Onde | Problema | Estado |
|---|---|---|---|
| B13 | Home | Não se atualizava depois de editar ou importar, e uma linha apagada abria `openLoadout(-1)`. | ✅ |
| B14 | filtros dos Loadouts | As opções Weapon/Armor eram geradas uma vez: um loadout com uma arma ou tier novo não aparecia no filtro. | ✅ |
| B15 | Gear | Guardar um preço apagava os filtros de tier e de preço. | ✅ |
| B16 | overlay da arma | Marcar "In game" num cartão não atualizava a contagem "In game N of M". | ✅ |
| B17 | Keybinds | "N keys differ" não batia certo com as marcas ●. | ✅ |

### Fugas de memória e listeners
| # | Onde | Problema | Estado |
|---|---|---|---|
| B18 | `ddSelect` | Cada dropdown criado acrescentava um listener ao `document` que nunca era removido. O Gear criava 7 a cada atualização de preço. | ✅ (um listener global) |
| B19 | Maps `ResizeObserver` | Era criado um novo a cada mapa aberto e nunca era desligado. | ✅ |
| B20 | Maps `navMemo` | Cada edição de paredes guardava uma grelha nova e as antigas nunca saíam da memória. | ✅ |

### Maps — trocar de mapa ou de modo a meio de uma ação
| # | Onde | Problema | Estado |
|---|---|---|---|
| B21 | linha "Your routes" na Home, import de outro mapa, separador de mapa | O spawn, a rota ou o editor de paredes do mapa anterior continuavam ativos no mapa novo. | ✅ (`resetMapState`) |
| B22 | `startRouteEdit` | Não desligava o editor de paredes e ficavam dois editores ativos. | ✅ |
| B23 | "Draw a route" a meio de outra rota | Ficava uma rota vazia nos dados. | ✅ |
| B24 | editor de paredes | O cartão "Pick your spawn" e o separador "Plan ›" ficavam por cima. | ✅ |
| B25 | editor de paredes | Desvios, contactos e linhas alternativas continuavam clicáveis. | ✅ |
| B26 | undo das paredes | Desfazer depois de mudar de piso escrevia as paredes do piso errado. | ✅ |
| B27 | `refreshMaps` | Depois de descartar um rascunho, as paredes antigas continuavam em cache. | ✅ |
| B28 | "Clear all points" e depois Done | Apagava uma rota guardada sem perguntar. | ✅ (passa a perguntar) |
| B29 | Esc dentro do nome ou da nota da rota | Terminava a edição inteira. | ✅ |
| B30 | trocar de modo durante a edição | A rota ficava com o modo antigo. | ✅ |
| B31 | clicar num contacto no mapa | Abria um separador que já não existe e não fazia nada. | ✅ (seleciona o passo) |
| B32 | `mapsUI.hidden` | Rotas escondidas antes do redesenho ficavam invisíveis para sempre. | ✅ |
| B33 | cartão de marcador | Ficava 40 px por baixo do painel, que agora tem 380 px. | ✅ |
| B34 | ecrãs estreitos | A regra para menos de 820 px ainda partia o mapa em linhas. | ✅ |
| B35 | painel do plano | Recalculava todas as rotas a cada clique num passo. | ✅ (calcula uma vez) |
| B36 | arrastar um ponto | Sem `pointercancel`, os listeners ficavam presos. | ✅ |

---

## 2. Incoerências

| # | Problema | Estado |
|---|---|---|
| C1 | Overlays com tamanhos diferentes: 720, 760, 1060 e 1080 px. | ✅ todas no tamanho largo (ver §4) |
| C2 | "favourites" e "Favorites" misturados. | ✅ Favorites |
| C3 | "Unknown author", "someone" e "Me" para quem fez. | ✅ "Unknown author" |
| C4 | Textos dos estados vazios espalhados por 6 classes diferentes. | ⏳ textos alinhados; as classes ficam para a passagem de helpers |
| C5 | Botões de apagar: "Delete item" em vez de "Delete", e o preço apagado não mostrava toast. | ✅ |
| C6 | "Nothing in this tier." também aparecia quando quem esvaziava a tabela era o filtro de preço. | ✅ "Nothing matches these filters." |
| C7 | Linhas de equipamento do loadout só reagiam a Enter; os links de munição não reagiam ao teclado. | ✅ |
| C8 | Share mostrava o custo da build em texto cru; a pesquisa global mostrava a categoria crua. | ✅ |
| C9 | "Open a file" e "Download file" usavam o ícone de copiar. | ✅ ícones próprios |
| C10 | Tooltips antigos nos Maps: "Right-click… I'm here", "Layers", "click the ground". | ✅ |
| C11 | O Routes popover só aceitava códigos antigos (ABI1) e mostrava uma mensagem confusa. | ✅ aceita os mesmos códigos que o Share |
| C12 | "Draw a route without a spawn", mas o primeiro clique num spawn transformava-a numa rota de spawn. | ✅ "Draw a route" (o primeiro clique decide) |
| C13 | Instruções de desenho repetidas: na faixa do topo e no painel. | ✅ só no painel |
| C14 | "Lv4" nos chips e "T4" nos dados das munições; "1 Budget" e "Budget". | ✅ D2: "Lv" na munição, "T" no equipamento, nível sem número fora da lista de builds |
| C15 | Estilos diferentes nos botões "+ Add" (com ícone ou com "+"). | ⏳ passagem de helpers |

---

## 3. Código repetido e globais (manutenção)

| # | Problema | Estado |
|---|---|---|
| M1 | Cinco dropdowns diferentes: `ddSelect`, o #sort estático, o kbBar e dois `<select>`. | ✅ o #sort estático passou para `ddSelect`; ⏳ kbBar |
| M2 | Fechar overlays (`.closing` e 150 ms) copiado 8 vezes; ligação de X, Esc e fundo copiada 7 vezes. | ✅ `closeDialog` e `wireDialog` |
| M3 | `plural()` só existia dentro da Home e havia cerca de 15 cópias à mão. | ✅ global |
| M4 | `TIERS.find(...)?.label` repetido 5 vezes. | ✅ `tierLabel(key)` |
| M5 | "Último snapshot de preços" repetido 5 vezes. | ✅ `lastSnapshot()` |
| M6 | Reset do estado do mapa repetido 5 vezes, cada um com um subconjunto diferente. | ✅ `resetMapState()` |
| M7 | Chaves do localStorage espalhadas: 6 em `K`, 8 constantes soltas e 6 strings soltas. | ✅ todas em `K` (os valores não mudam, por isso nada se perde) |
| M8 | `var K_BF/bF/bPanel` com um comentário de TDZ que já não é verdade. | ✅ |
| M9 | `setInterval` de 1 s a correr sempre, mesmo com o relógio desligado. | ✅ só com `RAID_ON` |
| M10 | Cerca de 115 sítios a fazer `el("button")` + `type` + `addEventListener`. | ⏳ helper `button()` criado para código novo; a migração total é grande |
| M11 | `title` e `data-tip` misturados nos tooltips. | ⏳ mesma passagem |
| M12 | Variáveis globais genéricas (`nav`, `list`, `q`, `seg`) tapadas por variáveis locais com o mesmo nome. | ⏳ renomear com cuidado numa passagem própria |

### CSS
| # | Problema | Estado |
|---|---|---|
| S1 | Cerca de 200 linhas de CSS morto, do painel antigo do plano e de classes removidas. | ✅ removido (o CSS do relógio e das marcas fica, marcado como estacionado) |
| S2 | Regras em conflito: `.lo-filters` (3 margens), `.sh-from`, `.pl-start`, `polyline.under`, `#maps` em grelha. | ✅ |
| S3 | `[hidden]` repetido 8 vezes, apesar de já existir a regra global. | ✅ |
| S4 | Rodapés de overlay repetidos por id. | ✅ a regra base do `.m-foot` passa a ser a padrão |
| S5 | Cores repetidas sem variável: `rgba(224,102,47,…)` ×25, `#111` ×29, fundos flutuantes ×12. Proposta: `--float-bg`, `--line-hover`, `--danger`, `--neg`. | ⏳ fica para uma passagem só de cores (muda muitas linhas, o resultado visual tem de ficar igual) |
| S6 | Cerca de 12 paddings de botão e 9 breakpoints diferentes. | ⏳ |

---

## 4. Overlays — normalização

Todas as overlays passam a ter **720 × 780** (ou menos, se o ecrã for mais pequeno), com o mesmo cabeçalho, corpo e rodapé:

| Overlay | Antes | Depois |
|---|---|---|
| Gear, arma, loadout, Share, preço | 720×780 | igual |
| Add build | 760×730 | 720×780 |
| Editor de loadout | 1060×760, duas colunas | 720×780, uma coluna |
| Keybinds (escolher tecla) | 1080 de largura, altura automática | 720×780; o teclado escala pela largura da janela |
| Confirmação ("Delete this?") | 480 de largura, altura automática | **continua compacta** (D1) |

---

## Decisões (aceites a 28 Out 2026)

- **D1.** A confirmação fica compacta. É um aviso pequeno por cima de outra overlay; a 720×780 seria uma caixa quase vazia a tapar a janela que está a confirmar.
- **D2.** Níveis: "Lv" para munição, "T" para equipamento, e "Budget/Balanced/Max" sem número fora da lista de builds. O seletor de nível no Add build e a confirmação de edição deixaram de mostrar o número.
- **D3.** Jogadores e duração da raid estão agora em Maps → Filters → Raid. Mudar um número recalcula logo as rotas sugeridas e os contactos; "Reset" volta aos números do mapa.
