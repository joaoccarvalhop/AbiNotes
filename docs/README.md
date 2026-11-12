# ABI Hub — documentação

Uma página só (`index.html`) para Arena Breakout: Infinite: builds de armas, loadouts, preços do mercado, equipamento, keybinds e mapas com rotas.

Funciona offline. Abre-se diretamente no browser (`file://`) e não precisa de servidor nem de instalar nada.

---

## 1. Ficheiros

| Ficheiro / pasta | O que é |
|---|---|
| `index.html` | A página inteira: CSS, HTML e todo o código. Tem de continuar a ser um ficheiro só, que abre por `file://`. Chama-se `index.html` para o site do GitHub Pages abrir sem nada no fim do endereço. |
| `builds.js` | O conteúdo partilhado, igual para toda a gente. Define `window.ABI_BUILDS` com as builds por arma e os `loadouts` sugeridos. Não leva nada pessoal (keybinds, rotas, os teus loadouts): isso fica no browser de cada um (secção 2). |
| `merchant.js` | Dados do Field Merchant (`window.ABI_MERCHANT`), tirados do ABI Builder por `tools/merchant_extract.py`: itens, os 38 sons, e as caixas de cada mapa/modo com o peso de cada item. |
| `merchant-sounds.js` | Os 76 sons do Merchant (`window.ABI_MERCHANT_SOUNDS`), em data URLs, gerados por `tools/merchant_sounds.py`. São um `.js` e não `.ogg` soltos porque uma página aberta com duplo clique não consegue usar `fetch` em ficheiros locais. Se o ficheiro faltar, os sons vêm do ABI Builder. |
| `prices.js` | Os preços. Define `window.ABI_PRICES`, com `items` e `snapshots` (uma leitura do mercado por data). |
| `maps/<slug>/` | Um mapa: <br>• `data.js` — marcadores, pisos e modos <br>• `nav.js` — paredes para as rotas <br>• `nav-fix.json` — correções de paredes feitas à mão <br>• `tiles/` — imagens do mapa <br>• `floors/` — plantas de cada piso |
| `tools/` | Scripts em Python para gerar e rever as paredes dos mapas (secção 5). Os resultados vão para `tools/out/`. |
| `docs/` | Esta documentação e a auditoria (`AUDITORIA.md`). |

O `make_zip.py` também leva o `merchant.js`.

Os slugs dos mapas são `farm`, `valley`, `northridge`, `armory`, `tv-station` e `airport`.

---

## 2. O que é de cada um

Já não há botão Save nem "Unsaved". Há duas camadas:

- **Partilhado:** o `builds.js` e o `prices.js`, iguais para toda a gente que abre o site. Só mudam por commit (por exemplo, preços novos de um vídeo).
- **Teu:** o que cada pessoa junta ou muda fica no browser dela (`K.mine`) e grava-se sozinho a cada alteração (`setDirty()`, o nome ficou do tempo do Save).
  - `mineOf()` calcula a camada comparando `data`/`market` com os ficheiros. `applyMine()` volta a pô-la por cima ao abrir a página.
  - Guarda:
    - keybinds;
    - rotas e paredes;
    - os teus loadouts;
    - builds juntadas, ou tiradas/mudadas (`buildsGone`, por arma + JSON da build);
    - itens e leituras de preços que os ficheiros não têm.
  - Quando os ficheiros são atualizados, o partilhado novo aparece e o teu continua por cima. Não há conflitos nem avisos.
  - **Loadouts:** os do `builds.js` são partilhados (`sharedLoIds`). Editar um cria uma cópia tua ao lado ("Save as yours", "based on …") e só os teus têm Delete. O separador "Yours" mostra só os teus.
  - **Keybinds:** toda a gente começa no Default do jogo. O "My setup" (`KB_MINE`) só aparece, uma vez, na cópia local (`file://`) de quem fez a página.
  - **Migração:** os rascunhos antigos (`K.draft`, `K.priceDraft`) são lidos uma vez, passam para `K.mine` (sem contar builds como tiradas) e são apagados.
- O resto das preferências também fica só no browser: favoritos, "In game", filtros, tier lists, smelts, códigos do Trading, a última secção aberta.
- **Backup** (Share > Backup): "Download backup" gera um `.json` com todas as chaves `abi-*` do localStorage. "Restore a backup" pede confirmação, substitui essas chaves e recarrega a página. Serve para guardar as coisas ou passá-las para outro PC ou browser.

## 3. Partilhar

**Share** (no topo da página) escolhe o que enviar: loadouts, rotas, keybinds, builds feitas por outras pessoas e preços. O resultado é um **código**, para colar no chat, ou um **ficheiro `.abihub`**, para quando o código fica demasiado longo.

O separador **Import** lê esse código ou ficheiro, compara com o que já tens e deixa-te escolher o que trazer.

Cada loadout e cada rota têm o seu próprio botão Share, que abre a mesma janela já com esse item escolhido. O botão **Routes** do mapa também aceita estes códigos (só tira as rotas deles).

---

## 4. Como a página está organizada (para quem mexe no código)

### Secções do código

O script está dividido por cabeçalhos `/* ---------- nome ---------- */`. Os principais, por ordem:

1. Constantes (`TIERS`, `ORDER`), **todas as chaves do browser em `K`**, `$`, `el` e `ls`.
2. **Helpers partilhados**:

   | Helper | Para que serve |
   |---|---|
   | `plural(n, "word")` | "1 build", "3 builds" |
   | `tierLabel(key)` | o nome de um tier de build |
   | `insertBuild(gun, b)` | põe uma build no sítio certo, por ordem de tier |
   | `button(label, {cls, tip, icon, onClick})` | cria um botão completo |

3. Estado partilhado lido desde o arranque (por exemplo, os filtros do Builds).
4. A camada pessoal (`mineOf`, `applyMine`, `setDirty`) e os nomes das builds.
5. Áreas (Home, Builds, Loadouts, Market, Gear, Maps, Merchant, Smelter, Keybinds, Tier list) e as suas barras. "Home" é também o primeiro separador do topo (o logótipo continua a levar lá).
6. Catálogo de equipamento, a aba Gear e a **overlay de detalhe** (`openGear`, `openExtra`, `openWeapon`). As stats base das armas (sem acessórios) estão em `WEAPON_STATS`, lidas do wiki do ABI Builder; os nomes seguem os do `builds.js` (ex.: "Deagle", "Mosin", "ZC807"). As stats de cada build (com acessórios) estão em `BUILD_STATS`, pelo código sem o "Mod Gun-": só existem para as builds publicadas no ABI Builder. As do So1o não estão online; a folha dele só tem custo, TTK e notas.
7. **Overlays**:
   - `closeDialog(dlg)` — fecha com o fade;
   - `wireDialog(dlg, close, xId)` — liga o X, o Esc e o clique no fundo;
   - `present(dlg, label, reopen)` — navega entre overlays com "← Back".
8. Loadouts, editor de loadout e o picker com pesquisa (`makePicker`).
9. **Widgets de filtros** (secção 4.4).
10. Market, preços e histórico.
11. Keybinds.
12. Builds: lista, cartões e caixa de filtros.
13. Share e Import.
14. Home (`renderHome`):
    - Em cima, uma faixa de boas-vindas (`.home-hero`). Ao fundo tem uma tira do próprio mapa de Farm (os tiles `maps/farm/tiles/base/<coluna>_<linha>.webp`, linhas 4–6 e colunas 4–20), escurecida. Por cima: o nome, os números (builds, loadouts, rotas, itens na tier list) e três ações: Add build, Add loadout e Plan a route.
    - Depois, um cartão por secção, pela ordem do topo; ao passar o rato acende a borda laranja. A seguir vêm os favoritos e as tuas rotas.
    - No fundo, "About & sources".
    - About (`openAbout`, `#about`): todas as fontes da página, por secção (`ABOUT_SOURCES`), cada uma com o link e para que serve. Uma fonte nova entra nessa lista.
15. Maps (secção 4.5).
16. Pesquisa global e arranque.
    - `gsResults(v)` dá todos os resultados por grupo: Weapons, Loadouts, Gear, Market e Maps (as portas das keys).
    - A caixa mostra só alguns por grupo e acaba em "See all N results".
    - Esse link abre a overlay `#searchall` (`openSearchAll`), com um separador por grupo. Abre-se com `present()`, por isso quem abre um resultado tem "← Back to Search".

### Regras de interface (combinadas)

- Tudo o que se vê está em **inglês** e **sem texto técnico**. As explicações vão em tooltips.
- Estilo contido: sem emojis como ícones e sem etiquetas a mais. Os ícones são de linha (`icon(name)`, em `ICON_PATHS`).
- **Overlays**: todas usam a mesma moldura, 720 × 780 ou menos em ecrãs pequenos. A exceção é a confirmação ("Delete this?"), que é compacta.
  - Separadores dentro de uma overlay **nunca a fazem mudar de tamanho**: os painéis ficam todos na mesma célula da grelha (`gmTabs`).
  - Passar de uma overlay para outra usa sempre `present()`, para parecer a mesma janela e ter "← Back".
- **Filtros**: todas as secções usam a mesma caixa (secção 4.4). "Sort by" fica sempre no fim, à direita. A caixa é sempre uma linha só: com muitos filtros faz scroll para o lado e "Sort by" fica preso à direita (os menus abertos flutuam por cima e fecham-se ao fazer scroll). "× Clear" aparece logo a seguir ao último filtro, e só quando há algum ativo.
- **Níveis**: "Lv4" na munição, "T4" no equipamento. Os níveis de build ("Budget", "Balanced", "Max") só levam número na lista de builds.
- Os avisos (rascunho, erros) **flutuam** no canto inferior direito e nunca empurram a página.
- **Botões iguais em todo o lado** (revisão de consistência, 2026-11-12):
  - Qualquer botão com ícone mostra o ícone e a palavra afastados (regra global `button:where(:has(> svg.ico))`). Usa-se `button(label, { icon, tip, onClick })`.
  - "Adicionar" é sempre o ícone + seguido da palavra ("Add build", "Add loadout", "Add price", "Add recipe", "Add tier"), nunca um "+" escrito.
  - Partilhar é sempre `button("Share", { icon: "share" })`, e cada coisa partilhável tem o seu: loadout, rota, preset, Smelter, tier list (só a lista aberta), arma (as builds de outros) e preço (`prices: "latest"`).
  - Apagar é sempre `delButton()` (lixo + "Delete"), com `confirmBox` e depois o aviso "… deleted". Os do Smelter (receitas, smelts) seguem a mesma regra.
  - Limpar é sempre `clearButton()` ("× Clear"), e só aparece quando há algo para limpar: caixas de filtros (Gear e Market incluídos), a bancada do Smelter e o código lido em Maps.
  - O ⓘ é sempre `infoDot()`. As estrelas dos favoritos são o ícone `star` (preenchido quando é favorito).
  - As dropdowns são todas `ddSelect`, que também aceita `{ group }`, `{ sep }` e `{ act, run }` (os presets dos Keybinds usam-nas).
- **Overlays**: todas abrem com `present()`, incluindo os editores de build e de loadout, o seletor de teclas e o price reader. Assim têm "← Back", e Cancel, Esc e guardar voltam à overlay de onde vieste. O rodapé só tem ações (o X fecha; já não há "Close" nem "Done").
- **Palavras**: inglês americano (color, caliber, recognize, favorite). Nas builds e nos loadouts diz-se "level"; "tier" fica para a proteção do equipamento e para a Tier list.
- **Listas vazias** dentro dos painéis usam `emptyNote()`: "No … yet" quando não há nada, "Nothing matches these filters." ou "Nothing matches your search." quando está escondido.
- **Overlays à espera de algo** (Import, Backup, Price reader sem a janela do jogo) usam a mesma caixa `.sh-drop`: ícone num círculo, título, uma linha e o botão. A overlay mantém o tamanho e a caixa fica ao centro (`.mc-wait`).
- **Números**: preços com `fmtKoen` (também no Merchant). Os custos já não levam "≈". Os tooltips são todos `data-tip`.
- **Animações**: usam sempre o conjunto global `motion` (JS) e as classes `.a-*` (CSS), para serem iguais em todas as secções. Uma animação nova entra aí, não fica presa a uma secção.
  - Os keyframes antigos (`enter`, `pop`, `ddin`, `m-in`/`m-out`, `toast-in`, `mpswap`) também passaram a ser só fades. Assim as secções, as overlays, as dropdowns, os avisos e os cartões dos loadouts entram sem saltar. Ficam com movimento só o anel a pulsar no mapa e o deslizar das colunas dos Maps.
  - Só luz, sem movimento: `motion.in`/`stagger` (fade, um a seguir ao outro), `pop` (brilho laranja curto em algo escolhido), `tick` (um número que mudou), `nudge` (a seta acende), `flash` (algo acabado de juntar), `swap` (o conteúdo de uma caixa trocou, ex. um separador).
  - As secções desenham-se de novo a cada clique, por isso `motion.changed(chave, valor)` diz o que mudou mesmo, e `motion.opened(secção)` diz se a secção acabou de ser aberta (`areaVisit`). Só isso se anima.
  - Com "reduce motion" no sistema não há animações. Se uma animação nunca acabar (separador em segundo plano), a classe sai ao fim de 2,5 s.
  - Merchant: os painéis ao abrir; os sons quando os filtros mudam os que aparecem; brilho no som clicado; candidatos quando a lista muda (e os que "Show more" junta); os números das faixas e a contagem quando mudam.
  - Smelter: os painéis ao abrir; brilho na peça que acabou de entrar; a seta acende quando as três estão lá; os números quando mudam; os separadores trocam com fade; o smelt registado acende na lista.

### 4.4 Widgets de filtros

| Função | O que faz |
|---|---|
| `filterBox()` | A caixa. Tem: <br>• `.group(label, node, tip)` <br>• `.sort(dd)` <br>• `.clear(fn)` |
| `ddSelect(label, [[value, label, sub?]], get, set)` | O dropdown. Um único listener na página fecha o que estiver aberto. |
| `rangeFilter(what, fmt, onChange)` | O slider de dinheiro com duas pegas. Usado no custo dos Loadouts e nos preços do Gear. `.set(lo, hi, top, step)` desenha-o. |
| `gearTable(cols, rows, …)` | As tabelas do Gear. Têm: <br>• `.filter(fn, key)` — vários filtros juntam-se, por nome <br>• `.sortTo(i)` <br>• `.onSort` |

### 4.5 Maps

- **Estado**:
  - `mapsUI` — preferências guardadas inteiras com `saveMapsUI()`;
  - `mapView` — o mapa que está à vista;
  - `spawnSel` / `hereSel` — o plano;
  - `routeEdit` / `navEdit` — os editores.
- **Trocar de mapa, de modo ou de dados** passa sempre por `resetMapState()`. Isso fecha os editores e larga o spawn. `openRouteOnMap(r)` abre uma rota vinda de outro sítio (Home, import).
- **Ecrã**: três colunas.
  - Há cinco colunas: barra Filters, coluna Filters, mapa, coluna Routes e barra Routes.
    - Cada barra (`v.lrail` / `v.rail`) tem um cabeçalho fixo a laranja que diz de que lado é (`railHead`), e por baixo as abas.
    - Clicar numa aba abre a coluna nessa aba; clicar outra vez na aba aberta fecha a coluna (`v.foldLeft` / `v.foldRight`).
  - Filters (`v.layers`, `renderLayers`, `lyTab`) mostra uma aba de cada vez:
    - Keys: as portas das keys deste mapa; clicar numa vai lá com `focusMarkerAfter`, sem largar o plano. Clicar na que está escolhida larga-a (`closeCard`). Só há um conjunto de anéis a pulsar de cada vez: `focusMarkerAfter` tira sempre o anterior (`dropFocusRing`), também quando se escolhe a mesma key outra vez.
    - Markers: a pesquisa e os grupos.
    - Display: o aspeto das rotas.
    - Raid: jogadores e minutos.
  - Animações:
    - As colunas abrem e fecham a deslizar (transição da largura; o conteúdo tem largura fixa, por isso não se reorganiza durante a animação).
    - Enquanto a coluna desliza, o `fold` corrige o `tx` a cada frame, por isso o mapa não se mexe nem muda de zoom (o observador de tamanho ignora estas mudanças com `v.keepLeft`).
    - Conteúdo novo numa coluna entra com um fade (`swapIn`).
  - O mapa ao centro.
  - O editor de rotas (ramo `routeEdit` de `renderMapSide`, classes `re2-*`) tem, por ordem:
    1. o nome em grande (editável), com as cores em círculos e um (i) com os atalhos no tooltip;
    2. a faixa Distance · Risk · Contacts e a linha "de onde → para onde";
    3. os pontos em linha do tempo, cada um com o nome do sítio mais próximo (`ctx.place`), a nota editável na linha, o andar num chip e o apagar a aparecer ao passar o rato;
    4. uma barra fixa em baixo com Undo/Clear à esquerda e Delete/Share/Done à direita.
  - Para mudar a ordem dos pontos arrasta-se o número de um ponto na lista (`reDrag`, drag and drop do HTML). Uma linha laranja mostra onde vai cair, e o Undo desfaz.
  - O andar de cada ponto usa o `ddSelect` da página. Dentro das colunas dos mapas (`.mp-col`), o menu flutua em posição fixa, como no Merchant.
  - No topo da coluna Routes há três passos (`routeSteps`): Spawn → Route → Go. Mostram em que passo estás, e cada um leva lá com um clique. A explicação de cada passo fica no tooltip.
  - Escolher um spawn (ou "I'm here") abre a coluna Routes na aba Suggested.
  - As rotas não dependem do modo: o caminho é o mesmo em Normal, Lockdown ou Forbidden, só os spawns mudam. `savedFor` e a lista mostram as rotas de todos os modos, e abrir uma não muda o modo. O `r.mode` ainda se grava, mas já não se usa.
  - Importar um código abre a rota no mapa e no spawn certos (`openRouteOnMap` → `openSaved`, que lê o spawn no primeiro ponto).
  - Routes à direita (`v.side`, `renderMapSide`). As abas estão numa barra sempre visível na borda direita do ecrã (`v.rail`, `drawRail`, `rtTab`). Uma aba abre a coluna nessa aba; clicar na aba que está ativa fecha a coluna (`v.foldRight`). Enquanto se desenha uma rota, a barra fica desativada.
    - Suggested: de onde partes (o spawn, ou "aqui" a meio do raid, com "Change"; sem nada escolhido, o botão "Pick your spawn") e as rotas calculadas a partir daí (`planFin`). Sem spawn escolhido, lista todos os spawns do mapa (`spawnList`: os que estão lado a lado contam como um; nomes repetidos levam a direção, ex. "Cemetery · north"); abrir um calcula as suas rotas nessa altura (`spOpen`, `spFins`) e clicar numa escolhe o spawn e abre-a.
    - Yours: as tuas que começam nesse spawn; sem spawn escolhido, todas, agrupadas pelo spawn com os mesmos nomes do Suggested (abertas por defeito, `spOpen` com chave "m:").
    - Free: as tuas que começam em qualquer sítio.
    - O título de cada coluna diz a aba aberta ("Routes · Yours", "Filters · Markers"; `colTab`), por isso as listas não têm título próprio (`sec()` só guarda o lugar do "New").
    - A aba aberta em cada barra (Routes `rtTab`, Filters `lyTab`) fica guardada em `mapsUI`, por isso um reload volta a ela.
    - "New" fica no título da lista (`newHead`); com a lista vazia aparece antes um cartão com "New route" (`emptyNew`). Em Yours sem spawn escolhido, New pede primeiro o spawn (`askSpawn(true, "new")`, `newWaiting`) e a rota começa nele (`newRouteAt`). Cada rota tua tem o botão Share à direita, visível ao passar o rato (`.rt-share`).
    - Codes: o código de um amigo.
      - "Read" lê o código para `codeRead` sem gravar nada e mostra um cartão por rota.
      - "Preview" desenha a rota no mapa (`codePreview`, `previewCode`) e muda para o mapa dela se for preciso.
      - "Add" (ou "Add all") é que a junta às tuas rotas.
      - Sair do separador Codes tira a pré-visualização.
    - Clicar numa aba com uma rota aberta fecha-a.
  - Linha da rota: "Line strength" (`--la`) e "Line width" (`--lw`, de 2 a 12 px), em Route display. Valem para a rota aberta e para a pré-visualização.
  - Esbatido (`away`): só um troço noutro andar dentro de edifícios. O piso térreo (`m.level`) é ao ar livre e aparece sempre.
  - Passar o rato numa rota da lista desenha-a no mapa (`planHover`). Clicar abre os passos dela (`planOpen`, `planPanel`), com "← All routes" para voltar.
  - O mapa só desenha a rota aberta ou a que estás a desenhar (`routesHere`). Os tempos dos contactos e as mudanças de andar aparecem ao passar o rato.
  - Os andares estão no canto inferior esquerdo do mapa (`drawFloors`). O modo continua na barra de cima.
  - Cada coluna fecha numa tira estreita (`syncCols`; `mapsUI.leftHidden` / `mapsUI.sideHidden`). Fechar ou abrir uma coluna não muda o zoom nem a posição do mapa: o `tx` é corrigido logo e o observador de tamanho não volta a encaixar o mapa (`v.keepLeft`).
  - Já não há botões Routes/Filters no canto nem painel a deslizar. `toggleLayers` e `toggleRoutesPop` só voltam a desenhar.
- **Abrir um marcador vindo de outro sítio** (a porta de uma key): `openMarkerOnMap(slug, mk)`.
  - Muda de mapa e de piso, faz zoom no marcador e abre o cartão dele.
  - Põe anéis a pulsar (`.mp-focus`) em todos os sítios com o mesmo nome nesse piso. Os anéis desaparecem quando o cartão fecha.
  - O marcador escolhido aparece mesmo que a categoria dele esteja desligada nos Filters.
- **Keys**:
  - `keyDoor(nome)` encontra o marcador "Key" com o mesmo nome sem a palavra key. Todas as 17 keys do Market têm porta.
  - `allMaps()` carrega os dados de todos os mapas uma vez, quando se pesquisa ou se abre uma key.
- **Marcadores com vários sítios**: no `markers.json` alguns marcadores têm uma lista de sítios (por exemplo, keys com várias portas, Retrieval Boxes, o boss da Northridge). A primeira cópia dos mapas deixou-os de fora. `tools/maps_add_multi.py` junta-os ao `data.js`, um marcador por sítio (50 ao todo). Pode correr-se outra vez sem repetir nada.
- **Sem botões de zoom**: faz-se zoom com a roda do rato. Também não há cartão "Pick your spawn".
- **Fluxo**:
  1. Abres o mapa.
  2. Clicas num spawn (`selectSpawn`).
  3. O painel flutuante (`planPanel`) entra a deslizar, com as tuas rotas primeiro e depois as sugeridas.
  4. A rota escolhida mostra as paragens, com os opcionais fechados.
  5. Em baixo estão Save, Change, Share e New.
- **Rotas sugeridas**:
  - `suggestRoutes` gera as rotas Rush, Loot run, Quiet e PvP.
  - `finishRoute` calcula tempos, contactos prováveis (jogadores simulados a partir dos spawns), "taken?" e risco. Os minutos da rota (`f.minutes`) continuam a ser calculados (servem os contactos), mas não aparecem no ecrã: a estimativa não era fiável. Nas listas e nos separadores mostra-se o risco no lugar deles.
  - As rotas contornam as paredes com `legPts` / `gridPath`, que fazem A* sobre a grelha de `navGrid`.
- **Paredes**:
  - Vêm do `nav.js`, mais as correções de `nav-fix.json` e as tuas edições (`data.nav`).
  - Editam-se em Filters → Walls → Edit.
- **Tamanho da raid**: jogadores e minutos vêm de `MAP_RAID` (`raidInfo(slug)`). Mudam-se em Filters → Raid e ficam em `mapsUI.raid`, por mapa.
- **Parados de propósito**: `RAID_ON` e `MARKS_ON` estão a `false`. Desligam o relógio da raid, "I'm here", os vistos de chegada e as marcas (Saw someone…). O código e o CSS ficam para mais tarde; basta pôr a flag a `true`.

### 4.6 Merchant

Diz o que uma caixa do Field Merchant pode ter, pelo som que o item faz ao ser apanhado ou largado.

- **Ecrã** (inspirado no do ABI Builder): três colunas lado a lado.
  - Filtros: pesquisa, mapa/modo, tamanho do item com rotação, tipo e preço da caixa.
  - Sons: cada cartão mostra os itens que fazem esse som. Os sons sem nenhum item depois dos filtros não aparecem.
  - Clique esquerdo escolhe ou tira o som, sem tocar nada.
  - Clique direito só ouve, sem escolher: alterna entre apanhar e largar, e o cartão acende enquanto toca.
  - Os botões Pick up e Drop ficam só na janela de detalhe do item.
  - Candidatos.
  - Em janelas largas (mais de 1150px) a página cabe no ecrã (`merFit`) e cada coluna faz scroll lá dentro.
  - `merView()` aplica os filtros e `merCandidates(v, sons)` junta os sons.
- **Sons escolhidos** (`merSel()` = `merUI.sound` + `merUI.also`): clicar num cartão junta esse som aos escolhidos, e clicar num já escolhido tira-o. Serve para quando não se tem a certeza de qual foi: as chances contam com todos. Um som ouvido no jogo (`merHeard`) recomeça a escolha só com ele.
- **Números da caixa** (`merProfit`): por cima dos candidatos aparece uma faixa com Cargo cost, Profit chance e Average back.
  - Com uma só caixa escolhida há uma faixa.
  - Se só se escolheu o preço e vários tipos o partilham, aparece uma faixa igual para cada tipo. O Merchant do jogo mostra o tipo, por isso cada tipo tem os seus números. Clicar numa faixa escolhe esse tipo.
  - O nome do tipo é a primeira coluna da faixa ("Cargo"), seguido de Cost, Profit chance e Average back. Antes estava solto por cima da faixa e parecia uma descrição.
  - Cada candidato mostra quanto ganha ou perde em relação ao custo da caixa.
- **Item em detalhe** (`openMerItem`, overlay `#meritem`): clicar num candidato abre o item.
  - Mostra quanto vende, os botões do som e todas as caixas do mapa/modo onde pode sair, com o custo, a chance e o ganho.
  - A caixa escolhida fica marcada.
- **Lista de candidatos**: mostra 90 de cada vez (`merShow`). "Show more" junta mais 90, e mudar um filtro volta aos 90.
- **O que os filtros tiram deixa de estar escolhido**: o tipo de caixa que não existe a esse preço ou fica sem itens, e os sons sem itens.
- **Dados**: `merchant.js`. Um "perfil" é o stock que vários mapas/modos partilham. Caixas com o mesmo nome e preço juntam-se numa só (`merCargos`), e as probabilidades misturam-se pelo peso de cada uma (`merOdds`). "Worth on average" é a soma de preço de venda × probabilidade.
  - O que há em cada caixa é igual em todos os mapas; o mapa e o modo só mudam a frequência das caixas e, nos modos de infeção, a mistura das caixas com o mesmo nome e preço.
  - As probabilidades só aparecem quando os filtros deixam uma única caixa (tipo + preço).
- **Ouvir o jogo** (`merListen`): a partilha de ecrã do browser (`getDisplayMedia`) traz o som e a imagem da janela. Só funciona no Edge/Chrome; o Firefox não partilha som.
  - O som é cortado em frames de 1024 amostras (passo 512, 48 kHz). Cada frame passa a energia em 24 bandas logarítmicas (`merFeature`, com FFT nossa).
  - Um som 5 dB acima do fundo dispara uma comparação (`merFrame`). Primeiro tira-se o ruído de fundo, depois correlaciona-se o "desenho" tempo × banda com cada referência (`merSimilar`). Ganha a mais parecida, se passar o "Match" (65% por omissão).
  - **Apanhar + largar**: um segundo som até 20 s depois do primeiro lê-se em par com ele. Um item só ganha o par se estiver entre os melhores dos dois sons. Se os sons discordarem, fica a resposta do primeiro, porque os sons de largar parecem-se mais entre itens e sozinhos enganam-se mais.
  - Referências: os 76 sons (38 × apanhar/largar) vêm do `merchant-sounds.js` da pasta (`merSoundUrl`; sem ele, do ABI Builder). São analisados da primeira vez que se ouve e o resultado fica guardado no browser (`K.merRefs`). As gravações do Teach (`K.merMine`) contam ao lado delas.
- **Leitor de preços** (`openMerOcr`, `merFind`, `merReadAll`): no jogo o preço aparece num cartão que segue o rato. Desenha-se uma vez uma caixa da moeda até ao fim do preço numa imagem do jogo, e ensinam-se os dígitos escrevendo o que se vê. Nada de bibliotecas de OCR.
  - A moeda (`merSetAnchor`) fica guardada em meia resolução e em resolução inteira. A cada 400 ms procura-se a moeda no ecrã todo com correlação normalizada a meia resolução e ajusta-se ao pixel. Depois lê-se o que está à direita dela.
  - A moeda também aparece no Total e no Owned. Por isso guardam-se os 5 melhores sítios e conta o primeiro número que seja preço de uma caixa do mapa.
  - Leitura: separa tinta de fundo (Otsu), corta linhas e letras, reduz cada letra a 10 × 14 e compara com as letras ensinadas.
  - A altura das letras é a mediana das letras da linha, por isso o que está à volta do cartão não a muda. Colunas pintadas de cima a baixo são a borda do cartão e ficam de fora.
  - Um espaço largo separa números. Em saldo o cartão mostra "16,000 20,000", e o preço dos dados é o completo (o segundo).
  - Ensina-se na mesma resolução em que se vai ler: a 1280 de largura os dígitos tocam-se e falha.
  - O formato guardado mudou (`merOcr.v = 2`). O que foi ensinado antes apaga-se uma vez e ensina-se de novo.
- **Testes**: correm na consola da página.
  - `tools/merchant_sound_test.js`: os 76 sons com ruído por baixo.
  - `tools/merchant_ocr_test.js`: preços desenhados.
  - `tools/merchant_ocr_card_test.js`: o cartão real em `tools/merchant_ocr_sample.webp`, no sítio onde estava, movido e numa janela mais pequena.
- **Separadores** (`sub-merchant`, `merBar`): "Live" (a página de sempre) e "Practice". A escolha fica em `merUI.tab`. O `merDraw` passa para o `prDraw` quando o separador aberto é o Practice.
- **Practice** (`prDraw`, `prs` em `K.merPractice`, a banca em `pr`): uma banca como a do mercador no jogo.
  - **A banca** (`prFill`): 24 caixas ("Free") ou 20 contra o relógio ("20, timed", a melhor fica em `prs.best`), numa grelha de 9 colunas.
    - Cada caixa é uma carga real do mapa/modo (tipo e preço).
    - O tamanho da caixa é o do item que tem dentro (às vezes rodado). As maiores são arrumadas primeiro.
    - O rótulo é o tipo de carga. Ao passar o rato aparece o tipo e o preço, como o cartão do jogo.
  - **What's inside:**
    - "Cargo odds": o item sai pelas odds da carga da caixa.
    - "All alike": cada som com a mesma probabilidade, e a caixa é uma carga que pode ter esse item.
  - **Abrir uma caixa** (`prOpen`): toca o pick-up e depois o drop (`prSound`) e mostra o tamanho. Os botões "Pick up" e "Drop" tocam cada som sozinho. Espaço toca os dois (`prHear`) e Enter abre a caixa seguinte.
  - **Answer with:**
    - "Sound card": os cartões que o Live mostra com essa carga e esse tamanho escolhidos (`prBoxItems` + `prFits`), na mesma ordem e no sítio do Live (metade esquerda). A banca fica onde estão os Candidates.
    - "Item": 4 itens com sons diferentes, do mesmo tamanho sempre que possível. Teclas 1–4.
  - Depois de responder: verde no que era, vermelho no que escolheste, e a caixa passa a mostrar o item. Clica na caixa para o ouvir; o tooltip diz o que valia contra o preço da carga.
  - **Weak sounds first:** o peso de cada item é multiplicado por 1 + 4 × a taxa de erro do seu som (`prMiss`, que começa em 50% para sons nunca ouvidos).
  - "Your ear": acerto total, os 5 sons mais falhados (clica para ouvir), as melhores bancas e "Start over".

### 4.7 Smelter

O jogo não publica odds. As regras vêm do guia do ABI Builder (abibuilder.com/guides/smelter-guide) e de notas da MoreFun citadas por senseos.gg. As odds a sério vêm do registo de cada um.

- **Dados**:
  - `SMELT_RECIPES`: as receitas especiais ("Trash to Treasure") com datas. As novas metem-se na página ("Add one"), em `smd.recipes`.
  - Cor dos itens (`smRar`): a que marcaste, senão a do `merchant.js` (136 dos 280 itens Miscellaneous). Roxo = 4, dourado = 5, vermelho = 6.
  - `smFind(nome)` liga o nome de uma receita ao item do Market. Os nomes longos do Market vêm cortados com "…".
- **Estado**: `smd` em `K.smelt` (localStorage): `log`, `rar`, `recipes`, `slots`, `out`. Não vai para o builds.js.
  - Cuidado: `sm` já é a janela do Share. Por isso o estado do Smelter chama-se `smd`.
- **Ecrã**:
  - Em cima fica a bancada: 3 quadrados com os itens, uma seta e o quadrado "What came out" com o valor e o botão Log. Cada quadrado é um `makePicker` com aspeto de quadrado, e a borda de cima tem a cor do item.
  - Por baixo, três números: Going in, Can give e Your record.
  - No fundo ficam a receita especial e os resultados lado a lado. As duas caixas ficam do tamanho do conteúdo, até 300px no máximo (`.sm-box`). Ficam com a altura da maior das duas, e o que passa do máximo faz scroll lá dentro, por isso a página não cresce. Cada uma tem dois separadores: Now / History (`smRecTab`) e By kind / History (`smResTab`).
  - A receita mostra o item que dá, quanto vale e o ganho em relação ao custo. Estes itens não estão no Market, por isso o valor vem de `r.worth` (o valor publicado) ou do que o utilizador escreve (`smd.worth`).
  - As regras aparecem uma só vez, no tooltip do (i) (`SMELT_TIP`). No resto da página só se mostra a regra que se aplica, em poucas palavras.
- **Regras** (`smOutcome`):
  - menos de 45k pode dar um roxo barato;
  - 200k ou mais dá hipótese de um vermelho; 300k ou mais, de um entre dois;
  - 3 roxos dão pelo menos um dourado;
  - 3 dourados dão hipótese de um entre três vermelhos (três iguais: um entre cinco);
  - a receita especial em curso.
- **Tipos de fundição** (`smKind`): servem para as estatísticas: 3 dourados iguais, 3 dourados, 3 roxos, 300k+, 200k–300k, 45k–200k e menos de 45k.
- **Registo**: cada entrada guarda os itens, o valor de cada um na altura, o tipo, o resultado, o valor e a cor.
  - `smStats` faz a média que entrou e que saiu, e quantos dourados e vermelhos saíram, por tipo.
  - Vai no Share como "Smelter results" (`smelts`). O que vem de amigos entra com `by: "a friend"`.

### 4.7b Trading

Para comprar logo a seguir a um reset do mercado e vender quando está seco. Vem do guia de ammo resets do ABI Builder (o Discord do DeanPo que o guia cita já não existe, por isso não está na página); os truques e os loadouts são do l1as_tv. Serve para tudo, mas a munição é o clássico: revende-se logo, ao contrário do resto, que fica bloqueado até ir a uma raid.

- **Horas** (`trSchedule`, hora de Sydney): 15:50 (talvez), 18:50–19:30 (o primeiro certo), 20:30, 21:30, 22:30 e 23:30 (certos), 00:30 (talvez). A venda vai das 03:00 às 16:00.
  - `trSydney(dia, minutos)` passa uma hora de Sydney para um momento real (`Intl`, com a mudança de hora incluída). `trEvents` dá os resets de ontem a amanhã. `trStatus` diz o que fazer agora: "Reset on" (comprar), "Reset soon" (parar de vender, a menos de 30 min), "Selling time" ou "Waiting".
  - No ecrã só aparecem horas locais: Sydney é só a conta feita por trás, e nenhum texto a mostra. A lista diz "Done", "On now" ou "in 54 min"; o truque da venda mostra as horas de venda já na tua hora (`{sell}` em `TR_TIPS`).
  - Todas as horas mostradas são as do relógio e do fuso do PC (o do browser). O nome do fuso aparece em "Next reset · Lisbon time" e no tooltip da barra. Foi testado com Lisboa, Nova Iorque e Tóquio, em novembro e em julho, e no dia da mudança de hora em Sydney.
  - O relógio (`trLive`) redesenha-se sozinho a cada 30 s: o próximo reset na tua hora, a barra do teu dia (00:00–24:00, com as horas de venda a laranja, os resets a verde, tracejados quando são "talvez", e uma linha no agora) e a lista dos resets de hoje.
- **Profit**: os preços variam, por isso compra e venda são intervalos, em sliders de dois punhos.
  - Os sliders são a `rangeFilter` partilhada, com `{ exact: true }`: mostra sempre as duas pontas e aceita um mínimo em `set(lo, hi, top, step, bottom)`.
  - A escala vai de metade a uma vez e meia o "Market price" que escreves, por isso serve para qualquer item. Ao mudar esse preço, a escala acompanha-o enquanto escreves (`rescale`, 250 ms depois da última tecla). Os intervalos mudam na mesma proporção, sempre a partir das frações guardadas ao começar a escrever, por isso os números a meio (3, 30, 300…) não os estragam. Ficam sempre nos passos do slider. Não se usa o evento "change", porque o campo reformata o número enquanto escreves e o browser deixa de o disparar.
  - Também tem quantidade, quantos por anúncio (120) e taxa por anúncio (60k).
  - Dá:
    - uma faixa do lucro, do pior caso (comprar caro, vender barato) ao melhor, com o 0 e o "Likely" (o meio dos dois intervalos) marcados;
    - "Profit chance": quantas combinações de preços dão lucro, contando todos os preços dos intervalos como igualmente prováveis;
    - o gasto, as taxas e "Sell for at least" (o preço por unidade para não perder).
  - Começa no exemplo do guia (5 200 balas de M995, compra 5 600–6 000, venda 6 700–7 200) e fica guardado em `K.trade` (`trd`); o ícone de voltar repõe-no.
- A secção fica no topo antes dos Keybinds.
- **Tricks**: uma linha cada, em duas colunas, com a explicação no tooltip (`TR_TIPS`).
- **Hauling loadouts**: os 5 códigos do guia com Copy (`TR_CODES`).
  - "Add code" abre um formulário (nome + código, Save/Cancel, Enter/Esc). Os teus códigos ficam em `trd.codes` (browser) e aparecem primeiro, em "Yours".
  - Cada código teu tem o lixo ao passar o rato, com confirmação e aviso. Os do guia ficam em "From the guide".
- **Layout**: duas colunas independentes (`.tr-col`): à esquerda os resets e os truques, à direita Profit e os loadouts. Assim um painel mais baixo não deixa buraco.
  - O estado diz só o que fazer ("Nothing to do yet", "Buy now…", "Stop selling…", "Sell now…"); o tempo até ao próximo reset aparece uma vez, à direita.
  - As faixas de venda têm "Sell" escrito quando há espaço, e os resets de hoje ficam numa só linha.

### 4.8 Tier list

Como o "Tier List Maker" do ABI Builder: arrumas as coisas em S/A/B/C/D, e as outras secções podem ordenar por isso.

- O separador fica no fim do topo, depois de Keybinds. As linhas vão de S (em cima) a D (em baixo).
- **Tipos** (`TL_KINDS`): Guns (as armas do builds.js, por categoria), Helmets, Armor (coletes e coletes-rig), Chest rigs e Backpacks (do `GEAR`/`EXTRA`). Cada tipo tem a sua lista.
- **Armas por categoria**: em Guns escolhe-se "All guns" (lista `guns`) ou uma categoria (lista `guns:Assault Rifles`, `tl.gunCat`). São listas separadas.
  - Para ordenar, uma arma procura-se nas duas (`tlRankAny`). Nas Builds, que já mostram as armas por categoria, conta primeiro a lista da categoria. Nos Loadouts conta primeiro a geral. Se não estiver numa, usa-se a outra.
- **Estado**: `tl` em `K.tiers` (localStorage): `kind` (o separador aberto) e `lists[tipo].rows = [{ name, items: [nomes] }]`. Guarda-se pelo nome (o equipamento pelo nome completo, `fullName`). Um nome que deixou de existir sai sozinho. Não vai para o builds.js.
- **Ecrã** (`tlDraw`):
  - A barra da secção (`#sub-tiers`) tem os tipos em separadores, como o Gear. À direita ficam o menu "Guns" (todas ou uma categoria), "Add tier", "Start again" e "Share".
  - As linhas ficam à esquerda e dividem a altura entre si; a letra é grande e o nome edita-se ali mesmo. "Unranked" fica à direita, com a pesquisa no título e grupos (equipamento por tier de proteção, do maior para o menor).
  - Em ecrãs largos cabe no ecrã e cada caixa faz scroll por dentro (`fitToScreen`, a mesma função que o Merchant usa).
  - "Unranked" é uma grelha que preenche a largura (`auto-fill`, os quadrados esticam), sem uma faixa vazia à direita.
  - Cada item mostra a imagem com o nome por baixo. O (i) no canto (ao passar o rato) ou um duplo clique abre a overlay dele: `openWeapon` para as armas, `openGear` para o resto.
  - Arrastar um item para uma linha (com a marca laranja de onde entra), ou clicar nele e depois clicar na linha. O clique só marca o item, sem redesenhar, para o duplo clique funcionar. Clique direito devolve-o a Unranked. Esc larga o que estava escolhido.
  - O lixo de cada linha (ao passar o rato) apaga-a e os itens dela voltam a Unranked.
- **Ordenar** ("My tier list"): `tlRank`/`tlOrder` (linha, depois a posição na linha; o que não está na lista vai para o fim) e `tlScore` (1 na linha de cima, 0 na de baixo).
  - Builds: `sortMode = "tiers"`; cada arma diz "S in your tier list".
  - Gear: as tabelas Helmets, Armor, Chest rigs e Backpacks (`table.tierKind`), com `sortTo("tiers")`.
  - Loadouts: `tlLoScore` faz a média das peças que estão nas listas (arma, capacete, colete, rig, mochila). Os loadouts sem nenhuma vão para o fim.
  - Quando a lista muda, `afterTiers()` volta a desenhar o que está ordenado por ela.
- **Nas overlays**: ao lado do "#11 on So1o's list" (e dos chips de valor do equipamento) aparece "S in your tier list", na cor da linha (`tlChip`). Só aparece quando o item está numa lista; clicar abre essa lista. Está nas armas (`openWeapon`), no capacete e colete (`openGear`) e nas rigs e mochilas (`openExtra`).
- **Share**: "Tier lists" (`tiers`), uma entrada por tipo. Ao importar, a lista do amigo fica no lugar da tua para esse tipo ("replaces yours").

### Chaves no browser

Estão todas no objeto `K`, no início do script. **Nunca mudes o valor de uma chave existente**: quem já usa a página perderia o que tem guardado.

Quando uma chave muda de formato, cria-se uma nova com outra versão (`…-v2`) e lê-se a antiga uma vez, como se faz com `gearTierOld`.

---

## 5. Ferramentas (`tools/`)

Correm com `python tools\<script>.py`. Os resultados vão para `tools/out/`.

| Script | Para quê |
|---|---|
| `nav_extract.py [slug…]` | Gera o `maps/<slug>/nav.js` a partir das plantas SVG e das imagens. Gera também as linhas vetoriais das paredes e a água. |
| `nav_fix.py <slug> <floor> cut/wall/area/clear/undo/list/show …` | Correções de paredes à mão. Guarda em `nav-fix.json` e reconstrói o `nav.js`. |
| `nav_check.py [slug]` | Confirma que tudo continua alcançável (a partir dos spawns e das escadas). |
| `nav_buildings.py [slug…]` | Encontra grupos de loot interior sem paredes à volta, ou seja, edifícios que a grelha não conhece. |
| `nav_review.py` | Uma imagem por local, para rever as paredes peça a peça. |
| `nav_grid_plan.py <slug> <floor> x0 y0 x1 y1 [step]` | Imagem com uma grelha de coordenadas e a planta, para pôr paredes a olho. |
| `nav_onwall.py <slug> [floor…]` | Marcadores que ficaram por cima de uma parede. |
| `nav_preview.py`, `nav_grid_view.py`, `nav_mask_test.py` | Imagens de verificação. |
| `merchant_extract.py` | Volta a gerar o `merchant.js` a partir da página do mercador do ABI Builder (quando o jogo mudar). `merchant_probe.py` mostra o que a página tem. |
| `merchant_sounds.py` | Descarrega os sons do Merchant para `merchant-sounds.js`. Corre-se depois do `merchant_extract.py` se o jogo trouxer sons novos. |
| `merchant_sound_test.js`, `merchant_ocr_test.js`, `merchant_ocr_card_test.js` | Testes do Merchant para a consola do browser (ver 4.6). O último usa `merchant_ocr_sample.webp`. |
| `maps_add_multi.py [--dry]` | Junta ao `data.js` de cada mapa os marcadores que no `markers.json` têm vários sítios, um por sítio. Não repete nada. |
| `price_frames.py <frames> <out>` | Preços novos, passo 1. Primeiro, o ffmpeg tira 3 imagens por segundo do vídeo, já cortadas à volta da grelha do mercado (`crop=1460:880:370:110`, mais `mpdecimate`). Depois este script fica só com uma imagem por cada meio ecrã de scroll e uma por cada mudança de categoria ou de separador (New / Like New / Worn). |
| `price_merge.py <read> <data> "<fonte>" [--write]` | Preços novos, passo 2. Junta o que foi lido das imagens (`batch_*.json`: categoria, separador e, para cada item, nome, preço e durabilidade) num snapshot novo do `prices.js`. Os itens são encontrados pela categoria e pelo nome que o jogo mostra. Um nome cortado igual para vários itens ("… (1)", "… (2)") é dado ao item cujo preço anterior era mais parecido. Lista as leituras muito diferentes das da última vez, para confirmar à vista. Sem `--write` só mostra o resultado. |
| `obs_setup.py [prices\|record\|stream]` | Configura o OBS (fecha-o antes; os teus perfis e cenas ficam como estão). A palavra escolhe com qual o OBS abre. <br>• Perfil **ABI Prices**: o mercado, ecrã inteiro a 30 fps, qualidade "Indistinguishable" em NVENC, hybrid MP4 em `videos/`, sem o rato. F9 grava, F10 pára. <br>• Perfil **Record**: gameplay, 1080p60, qualidade "Indistinguishable" em NVENC, em `Videos\OBS`. F9 / F10. <br>• Perfil **Stream**: 1080p60 a 6000 kbps em NVENC, áudio a 160 kbps. F11 começa, F12 pára. O serviço e a chave põe-se à mão. <br>• Cenas **Gameplay**: "Game" (Game Capture de qualquer coisa em ecrã inteiro) e "Screen" (Display Capture), para usar quando a captura de jogo fica preta. <br>• Cenas **ABI Prices**: o ecrã sem o rato. |
| `make_zip.py` | Gera o `ABI-Hub.zip` para os amigos: a página, os dados, `images/`, `maps/` (sem `nav-fix.json`) e o `LEIA-ME.txt` de `tools/zip/`. Só quando pedido. |
| `navlib.py` | Biblioteca partilhada: a mesma grelha que a página constrói, e imagens. |
| `floors_probe.py`, `categories_probe.py`, `routes_probe.py` | Sondas: o que as plantas, as categorias e os dados de rotas contêm. |

**Corrigir uma parede, passo a passo**:

1. `nav_buildings.py <slug>` ou `nav_review.py` para encontrar o sítio.
2. `nav_grid_plan.py` para ler as coordenadas.
3. `nav_fix.py … wall/cut` para corrigir.
4. `nav_check.py <slug>` para confirmar que nada ficou fechado.

**GitHub Pages**: o repositório é público para o Pages funcionar. O site é https://joaoccarvalhop.github.io/AbiNotes/
- O `.nojekyll` faz o GitHub servir os ficheiros tal como estão.
- O `index.html` tem `noindex`, para não aparecer no Google.
- O `.gitignore` deixa de fora o zip, o `tools/out/` (dados de trabalho grandes) e o `__pycache__`.
- O conteúdo partilhado muda-se nesta pasta (`builds.js`, `prices.js`) e depois faz-se commit e push. O que cada pessoa faz no site fica no browser dela (secção 2).

---

## 6. Testar

Para testar alterações, abre `index.html` no Firefox. Depois de mudar o ficheiro, faz **Ctrl+F5**.

Para testes automáticos com servidor local:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Corre-o dentro da pasta do projeto.

Abre http://127.0.0.1:8765/. O browser guarda dados separados para cada endereço, por isso o que fazes aqui não se mistura com o do `file://` nem com o do site.
