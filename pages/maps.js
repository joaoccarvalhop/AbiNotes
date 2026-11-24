/* The Maps page: loaded the first time it opens (loadPage in app.js). What the rest of the hub uses (MAP_LIST,
   the key doors, reading route codes, and openRouteOnMap / openMarkerOnMap / planRouteOnMap / refreshMaps, which
   load this file first) is in js/page-data.js. */
import { area, registerPage, setArea } from "../app.js";
import { $, button, clearButton, clone, data, delButton, el, emptyNote, icon, isPhone, K, ls, norm, reduceMotion, setDirty, swapIn } from "../js/base.js";
import { today } from "../js/market-data.js";
import { B64, b64text, loadMapData, MAP_CODE, MAP_LIST, openRouteOnMap, ROUTE_COLORS } from "../js/page-data.js";
import { shareRoute, unpackText } from "../js/share.js";
import { closeDialog, confirmBox, ddSelect, infoDot, toast } from "../js/ui.js";

/* ---------- maps: the six raid maps (copied from maps.tcno.co for offline use), their markers, and your own routes ----------
   A map is one layer (tiles, floor plan, routes) moved and scaled as a whole; markers and route points sit in it too but
   undo the scale (--k) so they keep their size. Routes are yours (data.routes, kept in this browser) and travel as short share codes. */
export const K_MAPS = K.maps;
export const mapsUI = { slug: "farm", floors: {}, diffs: {}, off: {}, ...(ls.get(K_MAPS) || {}) };
if (mapsUI.offV !== 3) { mapsUI.off = {}; mapsUI.offV = 3; } // the default markers changed: start everyone from them
// gone with the redesign: hidden routes (nothing can show them again now) and the plan's old tabs
delete mapsUI.hidden; delete mapsUI.planTab;
// everything in mapsUI is kept, whatever it holds (a list of fields here kept forgetting the new ones)
export const saveMapsUI = () => ls.set(K_MAPS, mapsUI);
export const mapRoutes = () => { if (!Array.isArray(data.routes)) data.routes = []; return data.routes; };
// after the whole data is swapped (a draft restored or discarded): routes may have changed
export function mapsRefresh() {
  navVersion++; legMemo.clear(); // walls may have changed with the data
  if (!mapView) return;
  resetMapState({ keepPlan: true });
  refreshPlan(); // a route of yours on show may be gone
}
// what belongs to the map on show (its spawn and plan, a route or walls being edited, a picked marker), all let go at once:
// before another map, another mode, or new data. keepPlan keeps the spawn and plan (the same map is still on show)
export function resetMapState({ keepPlan = false } = {}) {
  if (routeEdit) stopRouteEdit({ silent: true });
  if (navEdit) stopNavEdit();
  if (!keepPlan) { spFins.clear(); spOpen.clear(); spawnSel = null; hereSel = null; mapPreview = null; planStep = -1; planHover = null; }
  mapSel = null;
  if (mapView) { mapView.card.hidden = true; dropFocusRing(mapView); if (mapView.askSpawn) askSpawn(false); }
}
// another mode: spawns and extracts change, so what was picked belongs to the old one
export function setMapMode(d) {
  resetMapState();
  mapsUI.diffs[mapsUI.slug] = d; saveMapsUI();
  renderMapsBar(); drawMarkers(); refreshPlan();
}
// open one of your routes from elsewhere (Home, an import): its map, then the route on its spawn once the map is drawn
export let mapOpenAfter = null;
export function mapsOpenRoute(r) {
  if (mapView && mapView.slug === r.map) resetMapState();
  if (mapsUI.slug !== r.map) { resetMapState(); mapsUI.slug = r.map; saveMapsUI(); }
  mapOpenAfter = r.id;
  if (area !== "maps") setArea("maps"); else renderMaps();
  if (mapView && mapView.slug === r.map && mapView.kFit) { mapOpenAfter = null; openSaved(r); }
}
// "Plan a route" from elsewhere (Home): the map, then it asks for your spawn. Asking before the map is drawn did
// nothing (askSpawn needs mapView), so on a first visit, with the map's file still loading, the button only opened Maps
export let mapSpawnAfter = false;
export function mapsPlanRoute() {
  mapSpawnAfter = true;
  if (area !== "maps") setArea("maps"); else renderMaps();
  if (mapView && mapView.slug === mapsUI.slug && mapView.kFit) { mapSpawnAfter = false; setTimeout(() => askSpawn(true)); }
}
// open a marker from elsewhere (a key's door from search or from its market overlay): its map and floor, zoomed in on it, its card open
export let mapMarkAfter = null;
export function mapsOpenMarker(slug, mk) {
  document.querySelectorAll("dialog.modal[open]").forEach(d => closeDialog(d, true));
  resetMapState();
  if (mapsUI.slug !== slug) { mapsUI.slug = slug; saveMapsUI(); }
  mapMarkAfter = { slug, n: mk.n, c: mk.c, x: mk.x, y: mk.y };
  if (area !== "maps") setArea("maps"); else renderMaps();
  if (mapView && mapView.slug === slug && mapView.kFit) focusMarkerAfter();
}
export function focusMarkerAfter() {
  const a = mapMarkAfter, v = mapView; if (!a || !v || v.slug !== a.slug) return;
  const r = v.view.getBoundingClientRect(); if (!r.width || !v.kFit) return; // not laid out yet: the resize watcher comes back here
  mapMarkAfter = null;
  const mk = v.m.markers.find(m => m.n === a.n && m.c === a.c && m.x === a.x && m.y === a.y) || v.m.markers.find(m => m.n === a.n);
  if (!mk) return;
  if (mk.l && v.m.levels.includes(mk.l) && mk.l !== mapFloor(v.m)) setMapFloor(mk.l);
  v.k = Math.min(3, Math.max(v.k, (v.kFit || v.k) * 3));
  v.tx = r.width / 2 - mk.x * v.S * v.k; v.ty = r.height / 2 - mk.y * v.S * v.k; applyMapView();
  showMarkerCard(mk);
  // the spot itself, ringed so it can't be missed (until its card closes); a key with several doors rings each of them.
  // Only one set of rings at a time: the old one goes first (also when the same key is picked again)
  dropFocusRing(v);
  const box = el("div", "mp-focusset");
  v.m.markers.filter(o => o === mk || (o.c === mk.c && o.n === mk.n && o.l === mk.l)).forEach(o => {
    const ring = el("i", "mp-focus"); ring.style.left = o.x * v.S + "px"; ring.style.top = o.y * v.S + "px"; box.append(ring);
  });
  v.marks.after(box); v.focusEl = box; v.focusMk = mk;
}
export function dropFocusRing(v) { if (v && v.focusEl) { v.focusEl.remove(); v.focusEl = v.focusMk = null; } }
export let mapView = null; // { slug, m, k, tx, ty, world, view, … } for the map on show
export let routeEdit = null; // { route, undo: [] } while drawing
export let mapSel = null;    // the marker whose card is open


/* the bar under Maps: which map, which floor, which difficulty */
export function renderMapsBar() {
  const bar = $("sub-maps"); bar.textContent = "";
  const nav = el("nav", "g-jump"); nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "Maps");
  MAP_LIST.forEach(([slug, name]) => {
    const b = el("button", null, name); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(slug === mapsUI.slug));
    b.addEventListener("click", () => { if (slug === mapsUI.slug) return; resetMapState(); mapsUI.slug = slug; saveMapsUI(); renderMaps(); });
    nav.append(b);
  });
  const tools = el("div", "tools");
  const m = mapView && mapView.slug === mapsUI.slug ? mapView.m : null;
  if (m) {
    drawFloors(); // the floors sit on the map, bottom left
    if (m.difficulties.length > 1) {
      const seg = el("div", "g-seg"); seg.setAttribute("aria-label", "Difficulty");
      m.difficulties.forEach(d => {
        const b = el("button", null, d); b.type = "button"; b.setAttribute("aria-pressed", String(d === mapDiff(m)));
        b.title = "Show what you find in " + d;
        b.addEventListener("click", () => setMapMode(d));
        seg.append(b);
      });
      tools.append(seg);
    }
  }
  bar.append(nav, tools);
}
// the floors, stacked top to bottom in the map's bottom-left corner (like the game's own maps)
export function drawFloors() {
  const v = mapView; if (!v) return;
  if (v.floorsEl) v.floorsEl.remove(), (v.floorsEl = null);
  if (v.m.levels.length < 2) return;
  const box = el("div", "mp-floors"); box.setAttribute("aria-label", "Floor");
  v.m.levels.forEach(lv => {
    const b = el("button", null, lv); b.type = "button"; b.dataset.tip = "Floor " + lv; b.setAttribute("aria-pressed", String(lv === mapFloor(v.m)));
    b.addEventListener("click", e => { e.stopPropagation(); setMapFloor(lv); });
    box.append(b);
  });
  v.view.append(box); v.floorsEl = box;
}
export const mapFloor = m => (m.levels.includes(mapsUI.floors[mapsUI.slug]) ? mapsUI.floors[mapsUI.slug] : m.level || m.levels[0]);
export const mapDiff = m => (m.difficulties.includes(mapsUI.diffs[mapsUI.slug]) ? mapsUI.diffs[mapsUI.slug] : m.difficulty);

export function renderMaps() {
  const sec = $("maps");
  renderMapsBar();
  if (mapView && mapView.slug === mapsUI.slug && sec.contains(mapView.view)) return;
  sec.textContent = "";
  const slug = mapsUI.slug;
  loadMapData(slug, m => {
    if (slug !== mapsUI.slug) return;
    if (!m) { sec.append(el("p", "nores", "This map's files are missing from the maps folder.")); return; }
    buildMapView(slug, m);
    renderMapsBar();
  });
}

export function buildMapView(slug, m) {
  const sec = $("maps"); sec.textContent = "";
  const side = el("aside", "mp-side");
  const view = el("div", "mp-view"); view.tabIndex = 0; view.setAttribute("aria-label", m.name + " map");
  const world = el("div", "mp-world");
  const tiles = el("div", "mp-tiles"), floor = el("div", "mp-floor"), circles = el("div", "mp-circles");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.classList.add("mp-routes");
  const marks = el("div", "mp-marks"), handles = el("div", "mp-handles");
  world.append(tiles, floor, circles, svg, marks, handles);
  // three columns: Filters on the left, the map, Routes on the right; each side folds into a thin strip (zoom is the mouse wheel)
  // two side columns, each with a bar of tabs on the screen's edge that is always there: Filters on the left, Routes on the right.
  // A tab opens its column on that tab; the open tab again folds it. The column slides; the map stays put while it does
  const column = (cls, title, ic, key) => {
    const col = el("aside", "mp-col " + cls), head = el("div", "mp-colhead");
    const fold = hide => {
      const v = mapView; let last = v.view.getBoundingClientRect().left;
      mapsUI[key] = hide;
      if (!hide && isPhone()) mapsUI[key === "leftHidden" ? "sideHidden" : "leftHidden"] = true; // a phone has room for one at a time
      saveMapsUI(); syncCols();
      // while the column slides, the map's left edge moves: follow it frame by frame so the map itself doesn't move
      v.keepLeft = true; const t0 = performance.now();
      const step = now => {
        const l = v.view.getBoundingClientRect().left; if (l !== last) { v.tx += last - l; last = l; applyMapView(); }
        if (now - t0 < 420) requestAnimationFrame(step); else { v.keepLeft = null; const r = v.view.getBoundingClientRect(), b = playBox(v); v.kFit = Math.min(r.width / b.w, r.height / b.h); }
      };
      requestAnimationFrame(step);
      setTimeout(() => step(t0 + 1000), 460); // lands even when frames are held back
    };
    // its title, then the tab open in it ("Routes · Yours"); it folds from its bar: the open tab again
    const h = el("h3", null, title); h.append(el("span", "mp-coltab")); head.append(h);
    // an X to fold it (phones only, by CSS: on a computer the open tab folds it)
    const x = el("button", "x mp-colx"); x.type = "button"; x.setAttribute("aria-label", "Close " + title); x.textContent = "×";
    x.addEventListener("click", () => fold(true)); head.append(x);
    col.append(head); return { col, fold };
  };
  const L = column("mp-left", "Filters", "layers", "leftHidden"), R = column("mp-right", "Routes", "route", "sideHidden");
  const layers = el("div", "mp-layers"), routesPop = el("div", "mp-rtpop");
  const lrail = el("nav", "mp-rail mp-rail-l"), rail = el("nav", "mp-rail mp-rail-r");
  lrail.setAttribute("aria-label", "Filters"); rail.setAttribute("aria-label", "Routes");
  L.col.append(layers); R.col.append(side, routesPop);  const card = el("div", "mp-card"); card.hidden = true;
  const hint = el("div", "mp-hint"); hint.hidden = true;
  view.append(world, card, hint);
  sec.append(lrail, L.col, view, R.col, rail);
  if (!reduceMotion) view.classList.add("enter");
  const S = m.scale, W = m.bounds[1][0] * S, H = m.bounds[1][1] * S;
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  mapView = { slug, m, S, W, H, k: 1, tx: 0, ty: 0, view, world, tiles, floor, circles, svg, marks, handles, side, card, hint, layers, routesPop, rail, lrail, foldRight: R.fold, foldLeft: L.fold };
  // on a phone the columns open over the map: it starts with both shut, so the map is what you see
  if (isPhone() && !phoneMapSeen) { phoneMapSeen = true; mapsUI.leftHidden = true; mapsUI.sideHidden = true; }
  syncCols();
  drawMapLayers(); drawMarkers(); drawRoutes(); renderLayers(); renderMapSide();
  setTimeout(() => {
    if (mapView && !mapView.kFit) fitMap(); // (the resize watcher may have fitted it already, and zoomed on to a marker asked for)
    // a route asked for from elsewhere (Home, an import) opens now that its map is drawn
    const r = mapOpenAfter && mapRoutes().find(x => x.id === mapOpenAfter && x.map === slug); mapOpenAfter = null;
    if (r && r.pts.length > 1) openSaved(r);
    focusMarkerAfter(); // a marker asked for from elsewhere (a key's door)
    if (mapSpawnAfter) { mapSpawnAfter = false; askSpawn(true); } // "Plan a route" from Home
    if (codePreview && codePreview.map === slug && rtTab === "code") centreOn({ x: codePreview.pts[0][0], y: codePreview.pts[0][1] }); // a friend's route, on its map
  }, 0);
  bindMapInput();
}

// tiles of the floor on show (TV Station has a set per floor), plus that floor's plan
export function drawMapLayers() {
  const v = mapView; if (!v) return;
  const { m, S } = v, fl = mapFloor(m);
  const name = m.layers[fl] ? fl : m.layers.base ? "base" : Object.keys(m.layers)[0];
  if (v.tilesFor !== name) {
    v.tilesFor = name; v.tiles.textContent = "";
    const L = m.layers[name], size = m.tile * m.offsetScale[0];
    v.tiles.style.left = m.offset[0] * S + "px"; v.tiles.style.top = m.offset[1] * S + "px";
    L.have.forEach(key => {
      const [x, y] = key.split("_").map(Number);
      const img = new Image(); img.alt = ""; img.decoding = "async"; img.draggable = false;
      img.src = `maps/${v.slug}/tiles/${name}/${key}.webp`;
      img.style.cssText = `left:${x * size}px;top:${y * size}px;width:${size + 1}px;height:${size + 1}px`; // 1 px overlap hides the seams
      v.tiles.append(img);
    });
  }
  v.floor.textContent = "";
  m.floors.filter(f => f.floor.includes(fl)).forEach(f => {
    const img = new Image(); img.alt = ""; img.draggable = false; img.src = f.src;
    const [[x0, y0], [x1, y1]] = f.bounds;
    img.style.cssText = `left:${x0 * S}px;top:${y0 * S}px;width:${(x1 - x0) * S}px;height:${(y1 - y0) * S}px`;
    v.floor.append(img);
  });
}

// what a map shows until you change it: what matters in a raid; common containers, cameras and the like start hidden
export const MARKERS_ON = new Set(["Spawn", "Label", "Key", "Key Spawn", "Sniper Scav Spawn", "Safe", "Electronic Safe", "Safe (Behind Key)", "Secret Safe",
  "Extract", "No Backpack Extract", "Covert Ops Extract", "Red Item Spawn", "Gold Item Spawn", "Airdrops", "Premium Weapon Cases", "Military Computers", "Boss Spawn", "Lever",
  "Cash Registers", "Car", "Field Merchant"]);
export const defaultOff = m => {
  const cats = [...new Set(m.markers.map(mk => mk.c))], g = n => (m.categories[n] || {}).g || "Other";
  const quiet = [...new Set(cats.map(g))].filter(x => !cats.some(n => MARKERS_ON.has(n) && g(n) === x)); // groups with nothing on: the group is off too
  return [...cats.filter(n => !MARKERS_ON.has(n)), ...quiet.map(x => "g:" + x)];
};
export const markersOff = (slug, m) => mapsUI.off[slug] || defaultOff(m);
/* markers: on this floor (or on every floor), for this difficulty, in a category that is switched on */
export function markerShown(mk, m) {
  const fl = mapFloor(m), d = mapDiff(m), cat = m.categories[mk.c] || {};
  if (mk === mapSel && (!mk.l || mk.l === fl || !m.levels.includes(mk.l))) return true; // the marker whose card is open shows even if its kind is switched off
  if (mk.l && m.levels.includes(mk.l) && mk.l !== fl && !mk.all && !cat.all && mk.c !== "Spawn") return false; // spawns show on every floor: you plan from them
  if (mk.df && mk.df !== d && m.inherit[d] !== mk.df) return false;
  const off = markersOff(mapView.slug, m);
  return !off.includes(mk.c) && !off.includes("g:" + (cat.g || "Other"));
}
export function drawMarkers() {
  const v = mapView; if (!v) return;
  const { m, S } = v;
  v.marks.textContent = ""; v.circles.textContent = "";
  // spawns your saved routes start from (this mode): they get a ring
  const ctx = routeContext(m), mine = new Set();
  mapRoutes().forEach(r => { if (r.map === v.slug && r.pts.length > 1) { const { sp } = routeEnds(ctx, r.pts); if (sp) spawnGroup(ctx, sp).forEach(q => mine.add(q)); } });
  const q = norm((v.q || "").trim()); // the search under Layers
  m.markers.forEach(mk => {
    if (!markerShown(mk, m)) return;
    // spawns: stand out until you pick yours; then the ones next to you go, the rest are possible enemies
    let spawnCls = "";
    if (mk.c === "Spawn") {
      if (!spawnSel) spawnCls = " pick";
      else if (mk === spawnSel.sp) spawnCls = " mine";
      else if (spawnSel.group.includes(mk)) return;
      else if (mapsUI.hideEnemies) return;
      else spawnCls = " enemy";
    }
    const cat = m.categories[mk.c] || {};
    if (mk.t === "c") { // an area (sniper scav zones and the like)
      const r = (mk.r || 10) * 5 * S, other = mk.l && m.levels.includes(mk.l) && mk.l !== mapFloor(m);
      const c = el("div", "mp-circle" + (mk.c === "Spawn" ? " spawn" + spawnCls + (mine.has(mk) && spawnCls !== " mine" ? " has-routes" : "") + (other ? " away" : "") : ""));
      c.style.cssText = `left:${mk.x * S - r}px;top:${mk.y * S - r}px;width:${2 * r}px;height:${2 * r}px;background:${mk.col || "rgba(255,0,0,.25)"};border-color:${mk.ol || "rgba(255,0,0,.6)"}`;
      if (mk.c === "Spawn") { // centred, never smaller than a finger's worth on screen
        const dm = `max(${2 * r}px, calc(20px / var(--k)))`;
        c.style.left = mk.x * S + "px"; c.style.top = mk.y * S + "px"; c.style.width = dm; c.style.height = dm; c.style.transform = "translate(-50%, -50%)";
      }
      c.dataset.tip = (spawnCls ? { " pick": "Click if you spawned here", " mine": "Your spawn", " enemy": "Someone may spawn here" }[spawnCls] : mk.n || mk.c) + (other ? ` (on ${mk.l})` : "");
      if (mk.c === "Spawn") c.addEventListener("click", e => { e.stopPropagation(); showMarkerCard(mk); });
      v.circles.append(c); return;
    }
    const hit = q && norm([mk.n, mk.c, mk.d].join(" ")).includes(q);
    if (q && !hit && mk.t !== "l") return;
    const d = el("div", (mk.t === "l" ? "mp-label" : "mp-mk") + spawnCls);
    d.style.left = mk.x * S + "px"; d.style.top = mk.y * S + "px";
    if (mk.t === "l") d.textContent = mk.n;
    else {
      const img = new Image(); img.alt = ""; img.draggable = false; img.src = mk.ic || cat.ic || "maps/icons/key.svg";
      d.append(img);
      d.dataset.tip = (mk.n && mk.n !== mk.c ? mk.n + "\n" : "") + mk.c + (mk.l && m.levels.length > 1 ? " · " + mk.l : "");
      if (spawnCls) d.dataset.tip = { " pick": "Click if you spawned here", " mine": "Your spawn", " enemy": "Someone may spawn here" }[spawnCls];
      if (hit) d.classList.add("hit");
      if (mapSel === mk) d.classList.add("sel");
      d.addEventListener("click", e => { e.stopPropagation(); showMarkerCard(mk); });
    }
    v.marks.append(d);
  });
}
/* ---------- suggested routes: from a spawn, four ways to play it, worked out from the map's own markers ----------
   Spawns next to each other are one group (you appear at one of them). Your extracts are on the other side of the map,
   so only extracts across the map's centre from your spawn count. Points are joined by straight lines (the data has no
   walkable paths): a plan to follow, not a GPS. */
export const ROUTE_KINDS = [
  ["rush", "Rush", "#9fc58a", "Straight to an open extract on your side's exit"],
  ["loot", "Loot run", "#e0a23f", "Through the best loot on the way, then out"],
  ["quiet", "Quiet", "#7fb3d5", "Away from busy areas, bosses and snipers"],
  ["pvp", "PvP", "#e06c6c", "Through the most contested area, then out"],
];
export const LOOT_VALUE = { "Red Item Spawn": 10, "Secret Safe": 8, "Gold Item Spawn": 7, "Safe": 6, "Electronic Safe": 6, "Premium Weapon Cases": 5, "Military Computers": 4,
  "Safe (Behind Key)": 3, "Airdrops": 3, "Large Weapon Cases": 2, "Military Supply Cases": 2, "Long Weapon Cases": 1.5, "Medium Weapon Cases": 1.5, "Weapon Cases": 1.5, "Ammo Caches": 1 };
export const DANGER = { "Boss Spawn": 3, "Sniper Scav Spawn": 1.5, "Lookout/Rat Spot": 1 };
// seconds to search a container; of the common ones (no LOOT_VALUE) people open only some
export const LOOT_SECS = { "Red Item Spawn": 15, "Gold Item Spawn": 15, "Secret Safe": 40, "Safe": 25, "Electronic Safe": 30, "Safe (Behind Key)": 25, "Small Safe": 15, "Retro Safe": 20,
  "Premium Weapon Cases": 20, "Large Weapon Cases": 15, "Long Weapon Cases": 15, "Medium Weapon Cases": 12, "Weapon Cases": 12, "Wooden Weapon Cases": 12, "Tactical Accessory Cases": 10,
  "Military Computers": 30, "Computers": 20, "Military Supply Cases": 15, "Airdrops": 30, "Ammo Caches": 8, "Grenade Boxes": 6, "Medkits": 6, "Toolboxes": 8, "Jackets": 5, "Winter Coat": 5,
  "Suitcases": 8, "Premium Suitcases": 10, "Storage Cases": 10, "Gym Bags": 8, "Biscuit Tin": 5, "Office Drawers": 6, "Document Boxes": 8, "Cash Registers": 8, "Trash Bins": 5, "Car": 10,
  "Loose Loot": 5, "Large Material Crates": 12, "Large Crate": 12, "Abandoned Crate": 10, "Hazmat Jacket": 5, "Weapon Spawn": 5 };
export const COMMON_SHARE = .2;
export let mapPreview = null; // the suggested route on show (not saved)
export let mapImportOpen = false; // the "paste a route code" box in the side panel
export let mapRaidEdit = false;   // editing players / raid minutes
export function extractRules(mk) {
  const t = ((mk.n || "") + " " + (mk.d || "")).toLowerCase();
  return { key: /\bkey\b/.test(t), pay: /koen|\bpay\b/.test(t), timed: /min(ute)?s? after|active \d+ ?min|unlocks after/.test(t),
    rare: /rarely|chance|sometimes|random/.test(t), sw: /switch|lever|elevator|call (a|the)/.test(t), nobag: mk.c === "No Backpack Extract",
    opens: +((t.match(/(\d+)\s*min(?:ute)?s?\s*after|active\s*(?:after\s*)?(\d+)\s*min|after\s*(\d+)\s*min/) || []).slice(1).find(Boolean) || 0) || null }; // minutes into the raid it opens
}
export function extractNote(r) {
  return [r.key && "needs a key", r.pay && "costs Koen", r.timed && "opens after a while", r.sw && "flip a switch first", r.rare && "not always open", r.nobag && "no backpack"].filter(Boolean).join(", ");
}
// worked out once per map and mode: every panel redraw asks for it
export let ctxMemo = null;
export function routeContext(m) {
  const d = mapDiff(m);
  if (!ctxMemo || ctxMemo.m !== m || ctxMemo.d !== d) ctxMemo = { m, d, ctx: buildRouteContext(m, d) };
  return ctxMemo.ctx;
}
export function buildRouteContext(m, d) {
  const ok = mk => !mk.df || mk.df === d || m.inherit[d] === mk.df;
  const W = m.bounds[1][0], R = W * 0.08;
  const spawns = m.markers.filter(mk => mk.c === "Spawn" && ok(mk));
  const extracts = m.markers.filter(mk => (mk.c === "Extract" || mk.c === "No Backpack Extract") && ok(mk)).map(mk => ({ ...mk, rules: extractRules(mk) }));
  const loot = m.markers.filter(mk => LOOT_VALUE[mk.c] && ok(mk)).map(mk => ({ ...mk, v: LOOT_VALUE[mk.c] }));
  const danger = m.markers.filter(mk => DANGER[mk.c] && ok(mk));
  const boxes = m.markers.filter(mk => LOOT_SECS[mk.c] && ok(mk)); // everything you can search
  const labels = m.markers.filter(mk => mk.t === "l" && mk.c === "Label" && !/\bkey\b/i.test(mk.n || "")); // place names only (some labels name a key's room)
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const near = (p, list, r) => list.filter(q => dist(p, q) < r);
  // how busy a spot is: spawns around it (players arrive there) plus the loot that pulls them in
  const heatRaw = p => spawns.reduce((s, q) => s + Math.exp(-((dist(p, q) / (R * 1.6)) ** 2)), 0) + loot.reduce((s, q) => s + q.v * Math.exp(-((dist(p, q) / R) ** 2)), 0) / 12;
  const maxHeat = Math.max(1e-6, ...loot.map(heatRaw));
  const heat = p => heatRaw(p) / maxHeat;
  const dangerAt = p => danger.reduce((s, q) => s + DANGER[q.c] * Math.exp(-((dist(p, q) / (R * .7)) ** 2)), 0);
  const centre = (() => { const all = [...extracts, ...spawns]; return { x: all.reduce((s, q) => s + q.x, 0) / all.length, y: all.reduce((s, q) => s + q.y, 0) / all.length }; })();
  const place = p => { const l = labels.filter(q => dist(p, q) < W * .1).sort((a, b) => dist(p, a) - dist(p, b))[0]; return l ? l.n : ""; };
  // how busy a spot is compared with the rest of the map (0 = quietest, 1 = busiest), for the route's risk
  const heatRank = (() => { const all = loot.map(q => heat(q) + dangerAt(q) * .3).sort((a, b) => a - b); return v => all.length ? all.filter(x => x <= v).length / all.length : 0; })();
  // minutes to loot a spot: a little to get in, then what's around it (the valuables, and some of the common boxes)
  const SPOT = W * .04;
  const lootMin = p => { let s = 20; near(p, boxes, SPOT).forEach(q => { s += LOOT_SECS[q.c] * (LOOT_VALUE[q.c] ? 1 : COMMON_SHARE); }); return Math.min(3.5, s / 60); };
  // loot zones: boxes grouped by spot, what players go from one to the next for
  const zones = [], left = new Set(boxes);
  boxes.slice().sort((a, b) => (LOOT_VALUE[b.c] || 0) - (LOOT_VALUE[a.c] || 0)).forEach(b => {
    if (!left.has(b)) return;
    const here = [...left].filter(q => dist(q, b) < SPOT); here.forEach(q => left.delete(q));
    const v = here.reduce((s, q) => s + (LOOT_VALUE[q.c] || .3), 0);
    if (v < 1.5) return;
    const c = centroid(here); zones.push({ x: c.x, y: c.y, v, min: lootMin(c) });
  });
  zones.forEach(z => { z.hot = z.v * (.4 + heat(z)); z.place = place(z); });
  return { d, W, R, spawns, extracts, loot, danger, boxes, zones, lootMin, dist, near, heat, dangerAt, heatRank, centre, place, mpu: m.name === "TV Station" ? .045 : .09, sims: {} };
}
// spawns close together are one group: you appear at one of them
export function spawnGroup(ctx, sp) {
  const group = [sp], r = ctx.W * .07;
  for (let i = 0; i < group.length; i++) ctx.spawns.forEach(q => { if (!group.includes(q) && ctx.dist(group[i], q) < r) group.push(q); });
  return group;
}
// players and raid length per map (fan wiki and ABI Database disagree on some; editable in the side panel)
let phoneMapSeen = false; // Maps on a phone opens with its side columns shut, once per visit
export const MAP_RAID = { farm: [12, 30], valley: [20, 30], armory: [10, 25], "tv-station": [12, 25], northridge: [16, 35], airport: [10, 30] };
export function raidInfo(slug) {
  const o = (mapsUI.raid || {})[slug], d = MAP_RAID[slug] || [12, 30];
  return { players: (o && o.players) || d[0], minutes: (o && o.minutes) || d[1], custom: !!o };
}
// moving speed on average (sprints, stamina breaks, walking and checking corners), how much longer real paths are than straight lines,
// and minutes spent looting a stop / a detour
export const RUN_MPS = 3.2, PATH_FACTOR = 1.35, LOOT_MIN = 1.5, DETOUR_MIN = 1;
// indoor maps: corridors and stairs make the real way much longer than the line
export const PATH_BY_MAP = { armory: 1.8, "tv-station": 1.7 };
export const minutesFor = (units, ctx) => units * ctx.mpu / RUN_MPS * (PATH_BY_MAP[mapView && mapView.slug] || PATH_FACTOR) / 60;
export const fmtDist = m => (m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1) + " km");
export const clock = t => { const s = Math.round(t * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// mid-raid, from wherever you are: straight out, or a couple of stops first
export const HERE_KINDS = [
  ["rush", "Out now", "#9fc58a", "Straight to the nearest extract you can use"],
  ["loot", "Loot on the way", "#e0a23f", "A couple of good stops, then out"],
];
export function centroid(list) { return { x: list.reduce((s, q) => s + q.x, 0) / list.length, y: list.reduce((s, q) => s + q.y, 0) / list.length }; }
// what loot sits at a spot: "2 Red Item Spawn, Safe"
export const lootWhat = (ctx, t) => { const c = {}; ctx.near(t, ctx.loot, ctx.W * .025).forEach(q => { c[q.c] = (c[q.c] || 0) + 1; }); return Object.entries(c).sort((a, b) => LOOT_VALUE[b[0]] - LOOT_VALUE[a[0]]).slice(0, 2).map(([k, n]) => n > 1 ? `${n} ${k}` : k).join(", "); };
// a point: where, its note (for the saved route), and the place and loot apart for the panel
export const routeNode = (m, mk, note, place, loot) => ({ x: Math.round(mk.x), y: Math.round(mk.y), l: mk.l || m.level || m.levels[0], note, place: place || "", what: loot || "" });
// "while I'm here": loot a few steps off the line, priced by the extra distance it adds
export function detoursAlong(ctx, m, core, taken, maxM, autoOk) {
  const { dist, W } = ctx, out = [], used = [...core];
  if (core.length < 2) return out;
  ctx.loot.slice().sort((a, b) => b.v - a.v).forEach(t => {
    if (taken.has(t) || used.some(q => dist(q, t) < W * .025)) return;
    let best = null;
    for (let i = 0; i < core.length - 1; i++) { const c = dist(core[i], t) + dist(t, core[i + 1]) - dist(core[i], core[i + 1]); if (!best || c < best.c) best = { c, i }; }
    const meters = best.c * ctx.mpu;
    if (meters < 15 || meters > maxM) return; // under 15 m it is already on the way
    const v = ctx.near(t, ctx.loot, W * .025).reduce((s, q) => s + q.v, 0), what = lootWhat(ctx, t);
    out.push({ key: Math.round(t.x) + "," + Math.round(t.y), ...routeNode(m, t, [ctx.place(t), what].filter(Boolean).join(": "), ctx.place(t) || "Loot", what), seg: best.i, meters: Math.max(5, Math.round(meters / 5) * 5), v });
    used.push(t);
  });
  out.sort((a, b) => b.v / (b.meters + 25) - a.v / (a.meters + 25));
  out.length = Math.min(out.length, 6);
  out.forEach(d => { d.auto = autoOk && d.v >= 6 && d.meters <= 70; }); // worth it: on from the start
  return out;
}
// the routes from a spawn (four ways to play it), or from where you are mid-raid (free: { t0 } minutes into the raid)
export function suggestRoutes(m, sp, free) {
  const ctx = routeContext(m), { dist, centre, W } = ctx;
  const group = free ? [] : spawnGroup(ctx, sp);
  // your extracts are across the centre of the map from where you spawned (mid-raid: if you told us your spawn)
  const home = free ? (spawnSel ? spawnSel.group : null) : group, from = home ? centroid(home) : null;
  const side = q => (q.x - centre.x) * (from.x - centre.x) + (q.y - centre.y) * (from.y - centre.y);
  const across = from ? ctx.extracts.filter(e => side(e) < 0) : [];
  const pool = across.length ? across : ctx.extracts, t0 = free ? free.t0 : 0;
  // easy extracts first; one that opens late is out for a rush, or (mid-raid) until it has opened
  const exitFrom = (p, early) => {
    const easy = pool.filter(e => !e.rules.key && !e.rules.pay && !e.rules.rare && !e.rules.nobag && !(e.rules.timed && (free ? (e.rules.opens || 15) > t0 + 3 : early)));
    const list = easy.length ? easy : pool;
    // mid-raid, the people you marked count: a way past them costs more
    const cost = e => dist(p, e) * (free ? 1 + 3 * markThreat(ctx, p, e, t0) : 1);
    return list.slice().sort((a, b) => cost(a) - cost(b))[0];
  };
  const what = t => lootWhat(ctx, t), node = (mk, ...a) => routeNode(m, mk, ...a);
  const sims = allSims(ctx, home || []), routes = [];
  (free ? HERE_KINDS : ROUTE_KINDS).forEach(([kind, label, color, why]) => {
    const budget = (kind === "rush" ? 0 : free ? 700 : kind === "pvp" ? 1100 : 1400) / ctx.mpu;
    // and a time budget: a good share of the raid (mid-raid: of what is left), looting included
    const raidMin = raidInfo(mapsUI.slug).minutes, tBudget = free ? Math.max(4, (raidMin - t0) * .6) : raidMin * (kind === "pvp" ? .5 : .55);
    const stops = [], taken = new Set();
    let cur = sp, used = 0, tUsed = 0;
    const cluster = t => ctx.near(t, ctx.loot, W * .025).filter(q => !taken.has(q));
    const clusterValue = t => cluster(t).reduce((s, q) => s + q.v, 0);
    while (kind !== "rush" && stops.length < (free || kind === "pvp" ? 2 : kind === "quiet" ? 3 : 4)) {
      let best = null, bestS = 0;
      ctx.loot.forEach(t => {
        if (taken.has(t)) return;
        const dd = dist(cur, t), ex = exitFrom(t, false);
        if (!ex || used + dd + dist(t, ex) > budget || tUsed + minutesFor(dd, ctx) + ctx.lootMin(t) + minutesFor(dist(t, ex), ctx) > tBudget) return;
        const cv = clusterValue(t), h = ctx.heat(t);
        // who else is likely there when you would be: Quiet keeps away, PvP goes looking
        const busy = kind === "quiet" || kind === "pvp" ? simPresence(ctx, sims, t, t0 + tUsed + minutesFor(dd, ctx)) : 0;
        const s = kind === "loot" ? cv / (dd + W * .03)
          : kind === "quiet" ? Math.sqrt(cv) * Math.exp(-6 * h) * Math.exp(-2 * ctx.dangerAt(t)) * Math.exp(-6 * busy) / (dd + W * .03)
          : (h * h * 40 + cv * .2) * (1 + 4 * busy) / (dd + W * .15); // busiest places first, even if a bit further
        if (s > bestS) { bestS = s; best = t; }
      });
      if (!best) break;
      used += dist(cur, best); tUsed += minutesFor(dist(cur, best), ctx) + ctx.lootMin(best); cluster(best).forEach(q => taken.add(q)); stops.push(best); cur = best;
    }
    const ex = exitFrom(cur, kind === "rush");
    if (!ex) return;
    const note = extractNote(ex.rules);
    const first = free ? { ...node(sp, "Start here", ctx.place(sp) || "Here", `${clock(t0)} into the raid`), k: "start" }
      : node(sp, "Spawn" + (group.length > 1 ? ` (one of ${group.length} here)` : ""), ctx.place(centroid(group)) || "Spawn", group.length > 1 ? `One of ${group.length} spawns here` : "");
    const core = [first, ...stops.map(t => node(t, [ctx.place(t), what(t)].filter(Boolean).join(": "), ctx.place(t) || "Loot", what(t))),
      node(ex, "Extract: " + (ex.n || "Extract") + (note ? ` (${note})` : ""), ex.n || "Extract", note)];
    // detours on from the start only while the route still fits its time
    const detours = detoursAlong(ctx, m, core, taken, kind === "rush" ? 90 : 140, kind !== "rush");
    let tot = tUsed + minutesFor(dist(cur, ex), ctx);
    detours.forEach(d => { if (!d.auto) return; const add = minutesFor(d.meters / ctx.mpu, ctx) + ctx.lootMin(d); if (tot + add > tBudget) d.auto = false; else tot += add; });
    routes.push({ kind, label, color, why, core, detours, stops: stops.length,
      exit: ex.n || "Extract", exitNote: note, exitTimed: ex.rules.timed && !(free && (ex.rules.opens || 15) <= t0), across: !!across.length, t0, free: !!free, mine: home || [] });
  });
  return routes;
}

// a route with the detours you switched on: its points, when you reach each one (minutes into the raid), and where you may meet people
// prog: what you ticked in the raid ({ at: the point you reached, t: the minute you did, empty: points you found looted })
export function finishRoute(m, sp, base, on, prog) {
  const ctx = routeContext(m), { dist } = ctx;
  const bySeg = base.core.map(() => []);
  base.detours.filter(d => on.has(d.key)).forEach(d => bySeg[d.seg].push(d));
  const path = [];
  base.core.forEach((c, i) => {
    path.push({ ...c, kind: c.k || (i === 0 ? "spawn" : i === base.core.length - 1 ? "exit" : "stop") });
    bySeg[i].sort((a, b) => dist(c, a) - dist(c, b)).forEach(d => path.push({ ...d, kind: "detour", note: d.note + " (on the way)" }));
  });
  if (prog) path.forEach(p => { if (prog.empty.has(ptKey(p))) p.empty = true; }); // found looted: no time spent searching it
  const t0 = base.t0 || 0, times = pathTimes(ctx, path).map(x => x + t0);
  // you ticked a point: from there on the times move by how late (or early) you were, and so do the contacts
  const at = prog ? path.findIndex(p => ptKey(p) === prog.at) : -1, late = at >= 0 ? prog.t - times[at] : null;
  if (at >= 0) for (let j = at; j < times.length; j++) times[j] += late;
  const t = times[times.length - 1] - t0;
  const meters = Math.round(path.slice(1).reduce((s, p, i) => s + polyLen(legPts(path[i], p)), 0) * ctx.mpu);
  const stuck = path.slice(1).map((p, i) => (legPts(path[i], p).stuck ? i + 1 : -1)).filter(i => i > 0); // steps with no way found round the walls
  let contacts = contactPoints(ctx, sp, path, times, base), looted = lootedFirst(ctx, path, times, base);
  if (at >= 0) { contacts = contacts.filter(c => c.t >= prog.t); looted = looted.filter(l => l.i > at); } // behind you now
  const risk = routeRisk(ctx, path, contacts);
  // a detour's spur: from the nearest spot on its step of the line
  const spurs = base.detours.filter(d => !on.has(d.key)).map(d => {
    const a = base.core[d.seg], b = base.core[d.seg + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
    const f = Math.max(0, Math.min(1, ((d.x - a.x) * dx + (d.y - a.y) * dy) / L));
    return { ...d, fx: a.x + dx * f, fy: a.y + dy * f };
  });
  return { ...base, path, times, pts: path.map(p => [p.x, p.y, p.note, p.l]), meters, minutes: Math.max(1, Math.round(t)), risk, contacts, looted, spurs, stuck, at, late,
    stopsAll: path.filter(p => p.kind === "stop" || p.kind === "detour").length };
}

/* walls: where you can't walk. From the floor plans (buildings' walls; the gaps are the doors), the wall lines some maps draw
   on their tiles (both in maps/<slug>/nav.js), and what you add or open by hand (data.nav). Routes go round them. */
export let navVersion = 0; // goes up when you edit walls: grids and paths are worked out again
export const navMemo = {}, legMemo = new Map();
export const navEdits = (slug, fl) => ((data.nav || {})[slug] || {})[fl] || null;
export function navGrid(slug, fl) {
  const key = slug + "|" + fl + "|" + navVersion;
  if (key in navMemo) return navMemo[key];
  // an older grid of this map and floor is out of date now: let it go (each one is several arrays the size of the map)
  Object.keys(navMemo).forEach(k => { if (k.startsWith(slug + "|" + fl + "|")) delete navMemo[k]; });
  const base = window.ABI_NAV && ABI_NAV[slug], ed = navEdits(slug, fl), m = window.ABI_MAPS && ABI_MAPS[slug];
  const floor = base && base.floors && base.floors[fl], mask = base && base.masks && base.masks[fl], fix = base && base.fix && base.fix[fl];
  if (!m || (!floor && !mask && !fix && !ed)) return (navMemo[key] = null);
  const cell = base ? base.cell : Math.round(1.5 / (m.name === "TV Station" ? .045 : .09));
  const cols = base ? base.cols : Math.floor(m.bounds[1][0] / cell) + 1, rows = base ? base.rows : Math.floor(m.bounds[1][1] / cell) + 1;
  const g = new Uint8Array(cols * rows);
  if (mask) { let i = 0, v = 0; for (const n of mask.split(",")) { const k = parseInt(n, 36); if (v) g.fill(1, i, i + k); i += k; v ^= 1; } } // runs of free / blocked
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < cols && y < rows) g[y * cols + x] = v; };
  const line = (w, close) => {
    const n = w.length / 2 + (close ? 1 : 0);
    for (let i = 1; i < n; i++) {
      const ax = w[(i - 1) * 2 % w.length] / cell, ay = w[((i - 1) * 2 + 1) % w.length] / cell, bx = w[i * 2 % w.length] / cell, by = w[(i * 2 + 1) % w.length] / cell;
      const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3) + 1;
      for (let k = 0; k <= steps; k++) set(Math.floor(ax + (bx - ax) * k / steps), Math.floor(ay + (by - ay) * k / steps), 1);
    }
  };
  (floor ? floor.walls : []).forEach(w => line(w));
  // the hand-checked fixes that ship with the map, then yours: walls and blocked areas, areas cleared, then openings
  [fix, ed].forEach(ed => {
    if (!ed) return;
    (ed.walls || []).forEach(w => line(w));
    const inside = (a, fn) => { // every cell whose middle is inside the polygon
      const xs = a.filter((_, i) => i % 2 === 0), ys = a.filter((_, i) => i % 2);
      for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.max(...ys) / cell; y++) for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.max(...xs) / cell; x++) {
        const px = (x + .5) * cell, py = (y + .5) * cell; let inn = false;
        for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) if ((a[i + 1] > py) !== (a[j + 1] > py) && px < (a[j] - a[i]) * (py - a[i + 1]) / (a[j + 1] - a[i + 1]) + a[i]) inn = !inn;
        if (inn) fn(x, y);
      }
    };
    (ed.clear || []).forEach(a => inside(a, (x, y) => set(x, y, 0))); // false walls taken out (road markings and the like)
    (ed.areas || []).forEach(a => { // a blocked area: its outline and everything inside
      line(a, true);
      const xs = a.filter((_, i) => i % 2 === 0), ys = a.filter((_, i) => i % 2);
      for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.max(...ys) / cell; y++) for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.max(...xs) / cell; x++) {
        const px = (x + .5) * cell, py = (y + .5) * cell; let inside = false;
        for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) if ((a[i + 1] > py) !== (a[j + 1] > py) && px < (a[j] - a[i]) * (py - a[i + 1]) / (a[j + 1] - a[i + 1]) + a[i]) inside = !inside;
        if (inside) set(x, y, 1);
      }
    });
    (ed.cuts || []).forEach(([x, y]) => { // an opening: a door-wide hole in whatever wall is there
      const cx = x / cell, cy = y / cell, r = 1.6 / (m.name === "TV Station" ? .045 : .09) / cell;
      for (let yy = Math.floor(cy - r); yy <= cy + r; yy++) for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) if ((xx + .5 - cx) ** 2 + (yy + .5 - cy) ** 2 <= r * r) set(xx, yy, 0);
    });
  });
  return (navMemo[key] = { cell, cols, rows, g, seen: new Uint32Array(cols * rows), cost: new Float32Array(cols * rows), from: new Int32Array(cols * rows), run: 0 });
}
// the shortest way between two cells that keeps off walls (8 directions, never squeezing past a corner), or null.
// With "soft", walls can be crossed at a high cost: for places with no opening marked, the way in is guessed
export function gridPath(G, s, e, soft) {
  const { cols, rows, g, seen, cost, from } = G, run = ++G.run, ex = e % cols, ey = (e / cols) | 0;
  const h = i => { const dx = Math.abs(i % cols - ex), dy = Math.abs(((i / cols) | 0) - ey); return Math.max(dx, dy) + .4142 * Math.min(dx, dy); };
  const heapI = [], heapF = [];
  const push = (i, f) => { let k = heapI.length; heapI.push(i); heapF.push(f); while (k) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p; } heapI[k] = i; heapF[k] = f; };
  const pop = () => { const top = heapI[0], li = heapI.pop(), lf = heapF.pop(); if (heapI.length) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= heapI.length) break; if (c + 1 < heapI.length && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= lf) break; heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c; } heapI[k] = li; heapF[k] = lf; } return top; };
  seen[s] = run; cost[s] = 0; from[s] = -1; push(s, h(s));
  const done = new Set();
  for (let n = 0, cap = soft ? 2500000 : 600000; heapI.length && n < cap; n++) {
    const i = pop(); if (i === e) break; if (done.has(i)) continue; done.add(i);
    const x = i % cols, y = (i / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx; if (g[j] && !soft) continue;
      if (!soft && dx && dy && (g[y * cols + nx] || g[ny * cols + x])) continue; // no slipping between two walls that touch at a corner
      const c = cost[i] + (dx && dy ? 1.4142 : 1) + (g[j] ? soft : 0);
      if (seen[j] === run && cost[j] <= c) continue;
      seen[j] = run; cost[j] = c; from[j] = i; push(j, c + h(j));
    }
  }
  if (seen[e] !== run) return null;
  const out = []; for (let i = e; i !== -1; i = from[i]) out.push(i);
  return out.reverse();
}
// which free cells join up (8 directions, as the paths move): worked out once per grid, so a way that can't exist isn't searched for
export function gridParts(G) {
  if (G.part) return G.part;
  const { cols, rows, g } = G, part = new Int32Array(cols * rows), stack = new Int32Array(cols * rows);
  let n = 0;
  for (let i0 = 0; i0 < part.length; i0++) {
    if (g[i0] || part[i0]) continue;
    n++; let top = 0; stack[top++] = i0; part[i0] = n;
    while (top) {
      const i = stack[--top], x = i % cols, y = (i / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx; if (g[j] || part[j]) continue;
        if (dx && dy && (g[y * cols + nx] || g[ny * cols + x])) continue;
        part[j] = n; stack[top++] = j;
      }
    }
  }
  return (G.part = part);
}
// the nearest free cell to (x, y), in cells: points often sit on a wall, a roof line or in the water
export function nearFree(G, x, y) {
  const { cols, rows, g } = G, cx = Math.floor(x), cy = Math.floor(y);
  for (let r = 0; r <= 28; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { // up to ~20 m: a boat out on the water, a crate in a wall
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !g[ny * cols + nx]) return ny * cols + nx;
  }
  return -1;
}
// can you walk straight from a to b (in cells)? "once": crossing one short stretch of wall is allowed (a guessed doorway)
export function clearLine(G, ax, ay, bx, by, once) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 3) + 1; let run = 0, runs = 0;
  for (let k = 1; k < steps; k++) {
    const x = Math.floor(ax + (bx - ax) * k / steps), y = Math.floor(ay + (by - ay) * k / steps);
    if (G.g[y * G.cols + x]) { if (!once) return false; if (!run++) runs++; if (runs > 1 || run > 12) return false; } else run = 0;
  }
  return true;
}
// the way you walk from a to b ({x, y, l} in map units): round the walls, through the openings. Straight when the map has no walls
// for that floor, the two are on different floors, or no way was found (then .stuck is set)
export function legPts(a, b) {
  const v = mapView, fl = a.l || (v && mapFloor(v.m)), straight = [a, b];
  if (!v || (b.l || fl) !== fl) return straight;
  const G = navGrid(v.slug, fl); if (!G) return straight;
  const key = `${v.slug}|${fl}|${navVersion}|${Math.round(a.x)},${Math.round(a.y)}|${Math.round(b.x)},${Math.round(b.y)}`;
  if (legMemo.has(key)) return legMemo.get(key);
  if (legMemo.size > 6000) legMemo.clear();
  const ax = a.x / G.cell, ay = a.y / G.cell, bx = b.x / G.cell, by = b.y / G.cell;
  let out;
  if (clearLine(G, ax, ay, bx, by)) out = [a, b];
  else {
    const s = nearFree(G, ax, ay), e = nearFree(G, bx, by);
    const joined = s >= 0 && e >= 0 && gridParts(G)[s] === gridParts(G)[e]; // shut off from each other: only a guessed way in can do
    let cells = joined ? gridPath(G, s, e) : null, guessed = false;
    if (!cells && s >= 0 && e >= 0) { cells = gridPath(G, s, e, 40); guessed = !!cells; } // no opening found: guess where you get in
    if (!cells) { out = [a, b]; out.stuck = true; }
    else {
      // pull the string tight: keep only the corners you need (a guessed way in keeps its crossing)
      const pts = [{ x: ax, y: ay }, ...cells.map(i => ({ x: i % G.cols + .5, y: ((i / G.cols) | 0) + .5 })), { x: bx, y: by }], keep = [pts[0]];
      const see = (p, q) => clearLine(G, p.x, p.y, q.x, q.y) || (guessed && clearLine(G, p.x, p.y, q.x, q.y, true));
      for (let i = 0; i < pts.length - 1;) {
        let j = pts.length - 1;
        while (j > i + 1 && !see(pts[i], pts[j])) j--;
        keep.push(pts[j]); i = j;
      }
      out = keep.map((p, i) => (i === 0 ? a : i === keep.length - 1 ? b : { x: p.x * G.cell, y: p.y * G.cell, l: fl }));
      if (guessed) out.stuck = "guess";
    }
  }
  out.walked = true;
  legMemo.set(key, out);
  return out;
}
export const polyLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
// the point a share f (0..1) of the way along a line of points
export function alongPts(pts, f) {
  const L = polyLen(pts) * f; let s = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (s + d >= L) { const k = d ? (L - s) / d : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k, i }; } s += d; }
  return { ...pts[pts.length - 1], i: pts.length - 1 };
}
// minutes from a to b on foot: the real way when the map has walls, else the straight line stretched a little
export function legMinutes(a, b, ctx) {
  const pts = legPts(a, b);
  return pts.walked ? polyLen(pts) * ctx.mpu / RUN_MPS * 1.1 / 60 : minutesFor(ctx.dist(a, b), ctx);
}
/* editing walls: open a doorway, add a wall or a blocked area, erase what you added. Kept per map and floor in data.nav */
export let navEdit = null; // { tool: "open" | "wall" | "area" | "erase", cur: [[x, y]...], undo: [] }
export const NAV_TOOLS = [["open", "Opening", "Click a wall where there is a way through (a door, a gap, a window you can climb)"],
  ["wall", "Wall", "Click along a wall or fence; double-click or right-click to finish"],
  ["area", "Blocked", "Click round a place you can't walk (water, rocks, a closed yard); click the first point to close it"],
  ["erase", "Erase", "Click something you added to remove it"]];
export function navHere(make) {
  const v = mapView, fl = mapFloor(v.m);
  if (!make) return navEdits(v.slug, fl);
  data.nav = data.nav || {}; const m = (data.nav[v.slug] = data.nav[v.slug] || {});
  return (m[fl] = m[fl] || { cuts: [], walls: [], areas: [] });
}
export function startNavEdit(tool) {
  if (routeEdit) stopRouteEdit();
  navEdit = { tool: tool || "open", cur: [], undo: [] };
  toggleLayers(false); toggleRoutesPop(false); mapView.view.classList.add("navedit"); drawNavBar(); drawRoutes(); syncSide();
}
export function stopNavEdit() { finishNavShape(); navEdit = null; if (mapView) { mapView.view.classList.remove("navedit"); drawNavBar(); drawRoutes(); syncSide(); } }
export function navChanged() { navVersion++; legMemo.clear(); setDirty(true); refreshPlan(); }
// each undo step remembers its map and floor: undoing after a floor change puts the walls back where they were
export function navSnapshot() { navEdit.undo.push({ slug: mapView.slug, fl: mapFloor(mapView.m), json: JSON.stringify(navHere(true)) }); }
export function finishNavShape() {
  if (!navEdit || !navEdit.cur.length) return;
  const c = navEdit.cur; navEdit.cur = [];
  if (navEdit.tool === "wall" && c.length > 1) { navSnapshot(); navHere(true).walls.push(c.flat()); navChanged(); }
  else if (navEdit.tool === "area" && c.length > 2) { navSnapshot(); navHere(true).areas.push(c.flat()); navChanged(); }
  else drawRoutes();
}
export function navClick([x, y]) {
  const v = mapView, ctx = routeContext(v.m), near = 2.5 / ctx.mpu, p = { x, y };
  const ed = navHere(true), dSeg = (w, i) => { const ax = w[i], ay = w[i + 1], bx = w[i + 2], by = w[i + 3], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)); return Math.hypot(x - ax - dx * f, y - ay - dy * f); };
  const hitLine = (w, close) => { const q = close ? [...w, w[0], w[1]] : w; for (let i = 0; i + 3 < q.length; i += 2) if (dSeg(q, i) < near) return true; return false; };
  const t = navEdit.tool;
  if (t === "open") {
    const i = ed.cuts.findIndex(([cx, cy]) => Math.hypot(cx - x, cy - y) < near);
    navSnapshot(); i >= 0 ? ed.cuts.splice(i, 1) : ed.cuts.push([Math.round(x), Math.round(y)]); navChanged();
  } else if (t === "erase") {
    const ci = ed.cuts.findIndex(([cx, cy]) => Math.hypot(cx - x, cy - y) < near), wi = ed.walls.findIndex(w => hitLine(w)), ai = ed.areas.findIndex(a => hitLine(a, true));
    if (ci < 0 && wi < 0 && ai < 0) return;
    navSnapshot(); if (ci >= 0) ed.cuts.splice(ci, 1); else if (wi >= 0) ed.walls.splice(wi, 1); else ed.areas.splice(ai, 1); navChanged();
  } else {
    const c = navEdit.cur;
    if (t === "area" && c.length > 2 && Math.hypot(c[0][0] - x, c[0][1] - y) < near) { finishNavShape(); return; }
    c.push([Math.round(x), Math.round(y)]); drawRoutes();
  }
}
export function navUndo() {
  const u = navEdit && navEdit.undo.pop(); if (!u) return;
  data.nav = data.nav || {}; (data.nav[u.slug] = data.nav[u.slug] || {})[u.fl] = JSON.parse(u.json); navChanged();
}
// the bar over the map while editing walls: the tools, undo, done
export function drawNavBar() {
  const v = mapView; if (!v) return;
  if (v.navBar) { v.navBar.remove(); v.navBar = null; }
  if (!navEdit) return;
  const bar = el("div", "mp-navbar"), seg = el("div", "g-seg");
  NAV_TOOLS.forEach(([k, label, tip]) => {
    const b = el("button", null, label); b.type = "button"; b.title = tip; b.setAttribute("aria-pressed", String(navEdit.tool === k));
    b.addEventListener("click", () => { finishNavShape(); navEdit.tool = k; drawNavBar(); drawRoutes(); }); seg.append(b);
  });
  const tip = el("span", "mp-navtip", (NAV_TOOLS.find(x => x[0] === navEdit.tool) || [])[2] || "");
  const undo = el("button", "icon-btn"); undo.type = "button"; undo.append(icon("undo")); undo.dataset.tip = "Undo (Ctrl+Z)"; undo.addEventListener("click", navUndo);
  const done = el("button", "primary", "Done"); done.type = "button"; done.addEventListener("click", stopNavEdit);
  bar.append(seg, tip, undo, done); v.view.append(bar); v.navBar = bar;
}
// the walls drawn as lines, for the floor on show: the plans' walls, the map's wall lines (its squares joined up into a stroke),
// the hand-checked fixes and yours. Only a picture: routes still use the grid
export const navLineMemo = {};
export function navMaskPath(slug, fl) {
  const key = slug + "|" + fl;
  if (key in navLineMemo) return navLineMemo[key];
  const base = window.ABI_NAV && ABI_NAV[slug], mask = base && base.masks && base.masks[fl];
  if (!mask) return (navLineMemo[key] = "");
  const { cols, rows, cell } = base, g = new Uint8Array(cols * rows);
  let i = 0, on = 0; for (const n of mask.split(",")) { const k = parseInt(n, 36); if (on) g.fill(1, i, i + k); i += k; on ^= 1; }
  const S = mapView.S, c = q => ((q + .5) * cell * S).toFixed(1), out = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!g[y * cols + x]) continue;
    const r = x + 1 < cols && g[y * cols + x + 1], d = y + 1 < rows && g[(y + 1) * cols + x];
    const p = `M${c(x)} ${c(y)}`;
    if (r) out.push(`${p}L${c(x + 1)} ${c(y)}`);
    if (d) out.push(`${p}L${c(x)} ${c(y + 1)}`);
    if (!r && !d && x + 1 < cols && y + 1 < rows && g[(y + 1) * cols + x + 1]) out.push(`${p}L${c(x + 1)} ${c(y + 1)}`);
    if (!d && x > 0 && y + 1 < rows && g[(y + 1) * cols + x - 1] && !g[y * cols + x - 1]) out.push(`${p}L${c(x - 1)} ${c(y + 1)}`);
    if (!r && !d && !(x > 0 && g[y * cols + x - 1]) && !(y > 0 && g[(y - 1) * cols + x])) out.push(`${p}l.1 0`); // a lone square: a dot
  }
  return (navLineMemo[key] = out.join(""));
}
export function drawNav(S) {
  const v = mapView, fl = mapFloor(v.m), show = navEdit || mapsUI.showWalls;
  if (v.navImg) { v.navImg.remove(); v.navImg = null; }
  if (!show) return;
  const ns = "http://www.w3.org/2000/svg", base = window.ABI_NAV && ABI_NAV[v.slug], floor = base && base.floors && base.floors[fl];
  const grp = document.createElementNS(ns, "g"); grp.setAttribute("class", "navlines");
  const el2 = (tag, attrs) => { const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, x]) => e.setAttribute(k, x)); grp.append(e); return e; };
  const pts = w => w.reduce((s, q, i) => s + (i % 2 ? `,${q * S} ` : `${q * S}`), "");
  // water as shapes (its rows of squares), the map's wall lines as clean strokes (traced when the walls were made)
  const water = base && base.water && base.water[fl];
  if (water) {
    let i = 0, on = 0, d = ""; const k = base.cell * S;
    for (const n of water.split(",")) { const len = parseInt(n, 36); if (on) { let a = i; while (a < i + len) { const y = Math.floor(a / base.cols), x = a % base.cols, run = Math.min(i + len - a, base.cols - x); d += `M${(x * k).toFixed(1)} ${(y * k).toFixed(1)}h${(run * k).toFixed(1)}v${(k + .3).toFixed(1)}h${(-run * k).toFixed(1)}z`; a += run; } } i += len; on ^= 1; }
    el2("path", { d, class: "navwater" });
  }
  if (base && base.lines && base.lines[fl]) base.lines[fl].forEach(w => el2("polyline", { points: pts(w), class: "navplan" }));
  else { const maskD = navMaskPath(v.slug, fl); if (maskD) el2("path", { d: maskD, class: "navmask" }); }
  (floor ? floor.walls : []).forEach(w => el2("polyline", { points: pts(w), class: "navplan" }));
  const fix = base && base.fix && base.fix[fl], ed = navHere(false);
  [[fix, "navfix"], [ed, "navadd"]].forEach(([e, cls]) => {
    if (!e) return;
    (e.walls || []).forEach(w => el2("polyline", { points: pts(w), class: cls }));
    (e.areas || []).forEach(a => el2("polygon", { points: pts(a), class: cls + " area" }));
  });
  v.svg.insertBefore(grp, v.svg.firstChild);
  // openings: yours you can click again to remove; the shipped ones as small marks
  [[fix, false], [ed, true]].forEach(([e, mine]) => (e && e.cuts || []).forEach(c => {
    const o = el("div", "mp-navcut" + (mine ? "" : " fixed")); o.style.left = c[0] * S + "px"; o.style.top = c[1] * S + "px";
    o.dataset.tip = mine ? "An opening you marked" + (navEdit ? "\nClick it again (Opening) to remove" : "") : "An opening (door or gate) checked by hand";
    v.handles.append(o);
  }));
  if (navEdit && navEdit.cur.length) { const l = document.createElementNS(ns, "polyline"); l.setAttribute("points", navEdit.cur.map(q => `${q[0] * S},${q[1] * S}`).join(" ")); l.setAttribute("class", "navadd drawing"); v.svg.append(l); }
}/* other players, guessed: from each enemy spawn, most loot the nearest spot, then the next nearest, and so on; some run to the
   busiest spot first. Each guess is a track (where they are, minute by minute); marks you add mid-raid start tracks of their own. */
export const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); // seeded: the same map gives the same guesses
export function simTrack(ctx, start, prof, r, t0, raidMin) {
  const track = [{ x: start.x, y: start.y, t: t0 }], seen = new Set();
  let cur = start, t = t0;
  const leave = Math.max(t0 + 4, raidMin * (.55 + r() * .3)); // when they head out
  const go = (z, stay) => {
    t += minutesFor(ctx.dist(cur, z), ctx); track.push({ x: z.x, y: z.y, t, z: stay ? z : null });
    if (stay) { t += z.min; track.push({ x: z.x, y: z.y, t, z, out: true }); }
    cur = z;
  };
  if (prof === "chaos") { const top = ctx.zones.slice().sort((a, b) => b.hot - a.hot).slice(0, 3), z = top[Math.floor(r() * top.length)]; if (z) { seen.add(z); go(z, true); } }
  while (t < leave) {
    // mostly the nearest spot; a better one a bit further sometimes wins
    const cand = ctx.zones.filter(z => !seen.has(z)).map(z => ({ z, s: Math.pow(z.v, .35) / (ctx.dist(cur, z) + ctx.W * .02) })).sort((a, b) => b.s - a.s).slice(0, 3);
    if (!cand.length) break;
    const x = r(), pick = cand[x < .6 ? 0 : x < .85 ? 1 : 2] || cand[0];
    seen.add(pick.z); go(pick.z, true);
  }
  const ex = ctx.extracts.slice().sort((a, b) => ctx.dist(cur, a) - ctx.dist(cur, b))[0];
  if (ex) go(ex, false);
  return track;
}
// where a track is at minute t (null before it starts or once they are out)
export function posAt(track, t) {
  if (t < track[0].t || t > track[track.length - 1].t + .5) return null;
  for (let i = 1; i < track.length; i++) if (t <= track[i].t) {
    const a = track[i - 1], b = track[i], f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z && !a.out ? a.z : null };
  }
  return track[track.length - 1];
}
// the guessed players: per enemy spawn group, a few "nearest first" and "busiest first" tracks, weighted by how many people that group holds
export function enemySims(ctx, mine) {
  const raid = raidInfo(mapsUI.slug), key = raid.players + "|" + raid.minutes + "|" + mine.map(q => q.x).join(",");
  if (ctx.sims[key]) return ctx.sims[key];
  const seen = new Set(mine), groups = [];
  ctx.spawns.forEach(s => { if (seen.has(s)) return; const g = spawnGroup(ctx, s); g.forEach(q => seen.add(q)); const c = centroid(g); groups.push({ ...c, n: g.length, place: ctx.place(c) || "a spawn" }); });
  const left = Math.max(1, ctx.spawns.length - mine.length), sims = [];
  groups.forEach((g, gi) => {
    const people = Math.min(1, (raid.players - 1) * g.n / left); // spawns next to each other hold one player (or squad)
    [["near", .65, 4], ["chaos", .35, 2]].forEach(([prof, share, k]) => {
      for (let j = 0; j < k; j++) sims.push({ w: people * share / k, gid: gi, prof, from: g.place, track: simTrack(ctx, g, prof, rng(gi * 97 + j * 13 + (prof === "chaos" ? 7 : 1)), 0, raid.minutes) });
    });
  });
  return (ctx.sims[key] = sims);
}
// the guesses plus the people you marked: each mark starts a few tracks from where and when you saw them
export function allSims(ctx, mine) {
  return [...enemySims(ctx, mine), ...markSims(ctx)];
}
// how many people are likely around p at minute t (one per spawn group at most)
export function simPresence(ctx, sims, p, t) {
  const R = 80 / ctx.mpu, per = {};
  sims.forEach(sim => { const q = posAt(sim.track, t); if (q) per[sim.gid] = (per[sim.gid] || 0) + sim.w * Math.exp(-((ctx.dist(p, q) / R) ** 2)); });
  return Object.values(per).reduce((s, c) => s + Math.min(1, c), 0);
}
// where you may meet people: along your route, every half minute, who is likely within sight
export function contactPoints(ctx, sp, path, times, base) {
  const { dist } = ctx, sims = allSims(ctx, base.mine || spawnGroup(ctx, sp));
  const R = (PATH_BY_MAP[mapView && mapView.slug] ? 35 : 50) / ctx.mpu; // close enough to run into each other: shorter indoors
  const samples = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], ta = times[i - 1] + ((a.kind === "stop" || a.kind === "detour") && !a.empty ? ctx.lootMin(a) : 0); // you stay a while at a stop
    if (ta > times[i - 1]) for (let t = times[i - 1]; t < ta; t += .5) samples.push({ x: a.x, y: a.y, t });
    const n = Math.max(1, Math.ceil((times[i] - ta) / .5)), way = legPts(a, b);
    for (let k = 1; k <= n; k++) { const f = k / n, p = alongPts(way, f); samples.push({ x: p.x, y: p.y, t: ta + (times[i] - ta) * f }); }
  }
  samples.forEach(s => {
    const per = {}; let best = 0;
    sims.forEach(sim => {
      let d = Infinity, at = null;
      for (const dt of [-.5, 0, .5]) { const p = posAt(sim.track, s.t + dt); if (p) { const x = dist(p, s); if (x < d) { d = x; at = p; } } }
      if (!at) return;
      const c = sim.w * Math.exp(-((d / R) ** 2));
      per[sim.gid] = (per[sim.gid] || 0) + c; // the guesses for one person are alternatives: they add up
      if (c > best) { best = c; s.sim = sim; s.at = at; }
    });
    s.score = 1 - Object.values(per).reduce((m, c) => m * (1 - Math.min(.9, c)), 1);
  });
  const picks = [];
  samples.slice().sort((a, b) => b.score - a.score).forEach(s => {
    if (picks.length >= 4 || s.score < .3) return;
    if (picks.some(p => dist(p, s) * ctx.mpu < 120)) return;
    picks.push(s);
  });
  const out = picks.map(s => {
    const back = s.sim ? posAt(s.sim.track, Math.max(s.sim.track[0].t, s.t - 1.5)) || s.sim.track[0] : null;
    return { x: s.x, y: s.y, t: s.t, score: s.score, fx: back ? back.x : null, fy: back ? back.y : null, level: s.score > .7 ? "High" : s.score > .5 ? "Medium" : "Low",
      from: s.sim ? s.sim.from : "", doing: s.at && s.at.z ? "looting " + (s.at.z.place || "there") : "on the move", marked: !!(s.sim && s.sim.mark) };
  });
  // an extract that opens late gathers people waiting for it
  const ex = path[path.length - 1];
  if (base.exitTimed) out.push({ x: ex.x, y: ex.y, t: times[times.length - 1], level: "Medium", from: "", ambush: true });
  return out.sort((a, b) => a.t - b.t);
}
// your stops someone probably loots before you get there
export function lootedFirst(ctx, path, times, base) {
  const sims = allSims(ctx, base.mine || []), r = ctx.W * .045, out = [];
  path.forEach((p, i) => {
    if (p.kind !== "stop" && p.kind !== "detour") return;
    const per = {}; let first = Infinity;
    sims.forEach(sim => {
      const left = sim.track.find(q => q.out && q.t < times[i] && ctx.dist(q, p) < r);
      if (!left) return;
      per[sim.gid] = (per[sim.gid] || 0) + sim.w * .6; first = Math.min(first, left.t); // they rarely take everything
    });
    const miss = Object.values(per).reduce((m, c) => m * (1 - Math.min(.9, c)), 1);
    if (1 - miss > .5) out.push({ i, place: p.place, t: first, chance: 1 - miss });
  });
  return out;
}
/* live, mid-raid: a raid clock and the marks you add (saw someone, heard shots, looted, a body); kept in this browser tab only */
export const ss = { get: k => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
// the raid clock, ticking steps, "I'm here" and the dock are off for now: Maps is pick your spawn, pick or draw a route. The code stays for later
export const RAID_ON = false;
export let raidClock = RAID_ON ? ss.get(K.raidClock) : null; // { start: ms } while running, { at: minutes } when stopped
export let raidMarks = ss.get(K.raidMarks) || []; // { map, mode, x, y, t, type }
export const MARK_TYPES = { seen: ["Saw someone", 1], shots: ["Heard shots", .7], looted: ["Already looted", .5], body: ["Body", .6] };
export const raidNow = () => (raidClock ? (raidClock.start ? (Date.now() - raidClock.start) / 60000 : raidClock.at) : null);
export function setClock(min, run) { raidClock = min == null ? null : run ? { start: Date.now() - min * 60000 } : { at: min }; ss.set(K.raidClock, raidClock); }
// marks (saw someone, shots…) are off for now: ticking the points you reach does the job; the code stays for later
export const MARKS_ON = false;
export const marksHere = () => (MARKS_ON && mapView ? raidMarks.filter(k => k.map === mapView.slug && k.mode === mapDiff(mapView.m)) : []);
export function addMark(type, [x, y]) {
  raidMarks.push({ map: mapView.slug, mode: mapDiff(mapView.m), x: Math.round(x), y: Math.round(y), t: Math.round(hereT0() * 10) / 10, type });
  ss.set(K.raidMarks, raidMarks); afterMarks();
}
export function removeMark(k) { raidMarks = raidMarks.filter(x => x !== k); ss.set(K.raidMarks, raidMarks); afterMarks(); }
// a new raid: no marks, no clock, nothing picked
export function newRaid() {
  askSpawn(false);
  raidMarks = raidMarks.filter(k => k.map !== mapView.slug); ss.set(K.raidMarks, raidMarks);
  setClock(null); hereSel = null; spawnSel = null; planStep = -1; drawMarkers(); refreshPlan();
}
// marks change the guesses: the suggestions from where you are too
export function afterMarks() {
  if (hereSel && mapsUI.start === "here") return setHere([hereSel.pt.x, hereSel.pt.y], { pick: hereSel.pick, rerouted: hereSel.rerouted });
  refreshPlan();
}
// where you should be on a route at the raid's minute now: walking its legs, waiting at the stops while you loot them
export function youNow(r) {
  const now = raidNow(); if (now == null || !r || now <= r.times[0] || now >= r.times[r.times.length - 1]) return null;
  const ctx = routeContext(mapView.m);
  for (let i = 1; i < r.path.length; i++) {
    if (now > r.times[i]) continue;
    const a = r.path[i - 1], dwell = (a.kind === "stop" || a.kind === "detour") && !a.empty ? ctx.lootMin(a) : 0, t = now - r.times[i - 1];
    if (t <= dwell) return { x: a.x, y: a.y, l: a.l };
    const walk = r.times[i] - r.times[i - 1] - dwell, p = alongPts(legPts(a, r.path[i]), walk > 0 ? (t - dwell) / walk : 1);
    return { x: p.x, y: p.y, l: (t - dwell) / walk < .5 ? a.l : r.path[i].l };
  }
  return null;
}
// someone you marked keeps looting from there (nearest spot first); "looted" means they were there a minute before
export function markSims(ctx) {
  const marks = marksHere(), key = JSON.stringify(marks) + raidInfo(mapsUI.slug).minutes;
  if (ctx.markKey === key) return ctx.markList;
  const out = [];
  marks.forEach((k, i) => {
    const [, conf] = MARK_TYPES[k.type] || ["", .5], t0 = k.type === "looted" ? Math.max(0, k.t - 1) : k.t;
    for (let j = 0; j < 4; j++) out.push({ w: conf / 4, gid: "m" + i, prof: "near", mark: k, from: `the one you marked at ${clock(k.t)}`, track: simTrack(ctx, k, "near", rng(i * 31 + j * 7 + 500), t0, raidInfo(mapsUI.slug).minutes) });
  });
  ctx.markKey = key; ctx.markList = out;
  return out;
}
// how much the people you marked are in the way from a to b, leaving at minute t0
export function markThreat(ctx, a, b, t0) {
  const sims = markSims(ctx); if (!sims.length) return 0;
  const R = (PATH_BY_MAP[mapView && mapView.slug] ? 45 : 70) / ctx.mpu, dur = minutesFor(ctx.dist(a, b), ctx);
  let s = 0;
  for (const f of [.2, .4, .6, .8, 1]) {
    const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    sims.forEach(sim => { const q = posAt(sim.track, t0 + dur * f); if (q) s += sim.w * Math.exp(-((ctx.dist(p, q) / R) ** 2)); });
  }
  return s;
}
// the clock ticks on screen every second; the plan follows it every half minute
export let clockTick = 0;
if (RAID_ON) setInterval(() => { // the raid clock ticking (off for now)
  const now = raidNow(); if (now == null || !raidClock.start) return;
  document.querySelectorAll(".pl-clock b").forEach(b => { b.textContent = clock(now); });
  if (++clockTick % 30 || !mapView || area !== "maps" || routeEdit) return;
  if (hereSel && mapsUI.start === "here") setHere([hereSel.pt.x, hereSel.pt.y], { pick: hereSel.pick, rerouted: hereSel.rerouted }); else drawRoutes();
}, 1000);
// when you reach each point, from its start: moving, plus the looting at stops and detours
export function pathTimes(ctx, path) {
  let t = 0; const times = [0];
  for (let i = 1; i < path.length; i++) { const q = path[i - 1]; t += legMinutes(q, path[i], ctx) + ((q.kind === "stop" || q.kind === "detour") && !q.empty ? ctx.lootMin(q) : 0); times.push(t); }
  return times;
}
// risk: how busy the path is (its average and its worst spot), raised by the contact points on it
export function routeRisk(ctx, path, contacts) {
  const samples = [];
  for (let i = 1; i < path.length; i++) for (const f of [.25, .5, .75]) samples.push({ x: path[i - 1].x + (path[i].x - path[i - 1].x) * f, y: path[i - 1].y + (path[i].y - path[i - 1].y) * f });
  if (!samples.length) return "Low";
  const hv = samples.map(p => ctx.heat(p) + ctx.dangerAt(p) * .3);
  const rank = ctx.heatRank(.5 * hv.reduce((s, x) => s + x, 0) / hv.length + .5 * Math.max(...hv));
  let risk = rank > .75 ? "High" : rank > .4 ? "Medium" : "Low";
  // two likely contacts make it High, any one at least Medium
  const hi = contacts.filter(c => c.level === "High" && !c.ambush).length;
  if (hi >= 2) risk = "High";
  else if (risk === "Low" && (hi || contacts.some(c => c.level === "Medium"))) risk = "Medium";
  return risk;
}
// where a drawn route starts and ends: on a spawn and at an extract, or anywhere (a route for mid-raid)
export function routeEnds(ctx, pts) {
  const snap = ctx.W * .03, at = p => ({ x: p[0], y: p[1] });
  const near = (list, p) => list.filter(q => ctx.dist(q, p) < snap).sort((a, b) => ctx.dist(a, p) - ctx.dist(b, p))[0] || null;
  return { sp: pts.length ? near(ctx.spawns, at(pts[0])) : null, ex: pts.length > 1 ? near(ctx.extracts, at(pts[pts.length - 1])) : null };
}
// a saved route read like a suggested one: a point with a note counts as a loot stop, the others are just turns
export function savedBase(m, r) {
  const ctx = routeContext(m), { sp, ex } = routeEnds(ctx, r.pts), last = r.pts.length - 1, free = !sp;
  const core = r.pts.map((p, i) => {
    const at = { x: p[0], y: p[1] };
    const place = i === 0 && sp ? ctx.place(sp) || "Spawn" : i === last && ex ? ex.n || "Extract" : ctx.place(at) || "Point " + (i + 1);
    return { ...at, l: p[3] || r.floor, note: p[2] || "", place, what: i === last && ex ? extractNote(ex.rules) : p[2] || "",
      k: i === 0 ? (sp ? "spawn" : "start") : i === last ? "exit" : p[2] ? "stop" : "turn" };
  });
  return { kind: "r:" + r.id, label: r.name || "Route", color: r.color, why: free ? "Your route, from anywhere" : "Your route", core,
    detours: detoursAlong(ctx, m, core, new Set(), 120, false), exit: ex ? ex.n || "Extract" : "End", exitNote: ex ? extractNote(ex.rules) : "",
    exitTimed: !!(ex && ex.rules.timed), across: true, t0: free ? r.t0 || 0 : 0, free, mine: sp ? spawnGroup(ctx, sp) : spawnSel ? spawnSel.group : [], saved: r, sp };
}
export function savedFin(m, r) {
  if (!r.pts || r.pts.length < 2) return null;
  const b = savedBase(m, r);
  return finishRoute(m, b.sp || b.core[0], b, new Set());
}
// the suggested route on show, as a route the map can draw (and you can save)
export function previewOf(fin, s) {
  const v = mapView, ctx = routeContext(v.m); // the mode is kept with the route, not in its name
  const from = s === hereSel ? ctx.place(s.pt) || "here" : ctx.place(s.sp) || "this spawn";
  return { id: "preview", map: v.slug, name: `${fin.label} from ${from}`, color: fin.color, floor: mapFloor(v.m), mode: mapDiff(v.m),
    t0: s === hereSel ? s.t0 : undefined, pts: fin.pts.map(p => p.slice()) };
}

export function showMarkerCard(mk) {
  if (mk.c === "Spawn") { selectSpawn(mk); return; } // clicking a spawn means "I spawned here"
  const v = mapView; mapSel = mk; drawMarkers();
  if (v.focusMk !== mk) dropFocusRing(v);
  const c = v.card; c.textContent = ""; c.hidden = false;
  const cat = v.m.categories[mk.c] || {};
  const x = el("button", "x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", closeCard);
  const head = el("div", "mp-card-head");
  const img = new Image(); img.alt = ""; img.src = mk.ic || cat.ic || ""; head.append(img);
  const t = el("div"); t.append(el("b", null, mk.n || mk.c), el("small", null, mk.c + (mk.l ? " · " + mk.l : "") + (mk.df ? " · " + mk.df : ""))); head.append(t);
  c.append(x, head);
  const info = mk.d || cat.info; if (info) c.append(el("p", null, info));
  if (mk.loot) c.append(el("p", "mp-loot", "Inside: " + Object.entries(mk.loot).map(([k, n]) => `${n} ${k}`).join(" · ")));
}
// returns false when there was no card to close
export function closeCard() {
  const v = mapView; if (!v || v.card.hidden) return false;
  v.card.hidden = true; dropFocusRing(v); mapSel = spawnSel ? spawnSel.sp : null; drawMarkers();
  if (lyTab === "keys") renderLayers(); // the key list shows none picked again
  return true;
}
/* planning: from your spawn (start of the raid) or from where you are (mid-raid); the suggestions and your own routes that fit side by side */
export let spawnSel = null; // { sp, group, routes, on: {kind: Set of detour keys}, pick, bases, fin }
export let hereSel = null;  // { pt, t0, routes, on, pick, bases, fin }
export let planHover = null; // the route under the mouse in the table: it lights up on the map
export let planStep = -1;    // the step picked in the list: its point shows its name on the map
export const planSrc = () => (mapsUI.start === "here" ? hereSel : spawnSel);
// minutes into the raid now: the clock when it runs, or what you typed
export const hereT0 = () => { const n = raidNow(); return n != null ? Math.round(n * 10) / 10 : mapsUI.hereT0 ?? 10; };
// the route on show for the plan: the suggestion (mapPreview) or one of yours
// (only once you open a route from the list: the list alone draws nothing but the one under the mouse)
export let planOpen = false;
export const planRoute = () => { const s = planSrc(); return !routeEdit && planOpen && s && s.fin ? s.fin.saved || mapPreview : null; };
// your routes that fit: from this spawn (same mode), or free ones starting near where you are
export function savedFor(s) {
  const v = mapView, ctx = routeContext(v.m), d = mapDiff(v.m);
  return mapRoutes().filter(r => r.map === v.slug && r.pts.length > 1).filter(r => { // (any mode: the way is the same, only the spawns change)
    const { sp } = routeEnds(ctx, r.pts);
    return s === spawnSel ? sp && s.group.includes(sp) : !sp && ctx.dist({ x: r.pts[0][0], y: r.pts[0][1] }, s.pt) < ctx.W * .12;
  });
}
export function refreshPlan() {
  const v = mapView; if (!v) return;
  const s = planSrc();
  mapPreview = null;
  if (s) {
    s.bases = [...savedFor(s).map(r => savedBase(v.m, r)), ...s.routes]; // yours first, then the suggestions
    const base = s.bases.find(b => b.kind === s.pick) || s.bases[0];
    s.fin = null;
    if (base) {
      s.pick = base.kind;
      if (!s.on[base.kind]) s.on[base.kind] = new Set(base.detours.filter(d => d.auto).map(d => d.key));
      s.fin = finishRoute(v.m, base.sp || s.sp || s.pt, base, base.saved ? new Set() : s.on[base.kind], s.prog && s.prog.kind === base.kind ? s.prog : null);
      if (!base.saved) mapPreview = previewOf(s.fin, s);
    }
  }
  drawRoutes(); renderMapSide();
}
// your spawn this game: picked on the map; the ones next to it disappear, the others show as possible enemies
export function selectSpawn(sp, opts = {}) {
  const v = mapView; if (!v) return;
  mapsUI.start = "spawn"; saveMapsUI();
  const waiting = hereWaiting, startNew = newWaiting; askSpawn(false);
  if (!sp) { spawnSel = null; mapSel = null; planStep = -1; planOpen = false; drawMarkers(); refreshPlan(); return; }
  if (!spawnSel || spawnSel.sp !== sp) {
    planStep = -1; planOpen = false; // a new spawn: its routes, with the Routes column open
    if (rtTab !== "mine") rtTab = "sug"; // picked from Yours: stay there (your routes from it); else the suggested ones
    if (mapsUI.sideHidden && v.foldRight) v.foldRight(false);
    const keep = spawnSel && !String(spawnSel.pick).startsWith("r:") ? spawnSel.pick : "loot";
    spawnSel = { sp, group: spawnGroup(routeContext(v.m), sp), routes: suggestRoutes(v.m, sp), on: {}, pick: keep };
  }
  if (opts.pick) { spawnSel.pick = opts.pick; planOpen = true; } // a route asked for by name opens straight away
  v.card.hidden = true; mapSel = sp;
  drawMarkers(); refreshPlan();
  if (waiting) setHere(waiting); // "I'm here" asked for your spawn first
  if (startNew) newRouteAt(spawnSel); // "New route" in Yours asked for the spawn first
}
// a new route of yours from a spawn: its first point is the spawn
export let newWaiting = false;
export function newRouteAt(sel) {
  const n = newRoute(), sp = sel.sp; n.name = `My route from ${routeContext(mapView.m).place(sp) || "spawn"}`;
  n.pts.push(sp.l ? [sp.x, sp.y, "", sp.l] : [sp.x, sp.y]); startRouteEdit(n);
}
// "I'm here" (right-click): your extracts are across the map from your spawn, so without one it asks for it first
export let hereWaiting = null;
export function imHere(pt) {
  if (spawnSel) return setHere(pt);
  hereWaiting = pt; askSpawn(true, "here");
}
// where you are now: a free route's start, or (with the raid tools on) "I'm here"
export function setHere(pt, opts = {}) {
  const v = mapView; if (!v) return;
  mapsUI.start = "here"; saveMapsUI(); planStep = -1; planOpen = !!pt; // mid-raid: the way out opens at once
  if (!pt) { hereSel = null; if (spawnSel) { mapsUI.start = "spawn"; saveMapsUI(); } refreshPlan(); return; } // back to your spawn's plan, if you picked one
  if (mapsUI.sideHidden && v.foldRight) v.foldRight(false); // the way out shows in the Routes column: open it
  const at = { x: Math.round(pt[0]), y: Math.round(pt[1]), l: mapFloor(v.m) }, t0 = hereT0();
  const keep = hereSel && !String(hereSel.pick).startsWith("r:") ? hereSel.pick : "rush";
  hereSel = { pt: at, t0, routes: suggestRoutes(v.m, at, { t0 }), on: {}, pick: opts.pick || keep, rerouted: !!opts.rerouted };
  refreshPlan();
}
export function pickPlan(kind) {
  const s = planSrc(); if (!s) return; s.pick = kind; planStep = -1; planOpen = true; planHover = null; refreshPlan(); swapIn(mapView.side);
  phoneShowMap();
}
// on a phone a column covers the map: once a route is picked, fold it so the route shows (its steps stay a tab away)
export function phoneShowMap() { const v = mapView; if (v && isPhone() && !mapsUI.sideHidden && !routeEdit && v.foldRight) v.foldRight(true); }
// open one of your routes where it belongs: on its spawn, or where it starts mid-raid
export function openSaved(r) {
  const v = mapView;
  const { sp } = routeEnds(routeContext(v.m), r.pts);
  if (sp) selectSpawn(sp, { pick: "r:" + r.id });
  else { mapsUI.hereT0 = r.t0 || 0; setHere([r.pts[0][0], r.pts[0][1]], { pick: "r:" + r.id }); }
  centreOn({ x: r.pts[0][0], y: r.pts[0][1] });
  phoneShowMap();
}
// a detour: on a suggestion it switches on and off; on your route it becomes a point of it
export function toggleDetour(key) {
  const s = planSrc(); if (!s || !s.fin) return;
  const r = s.fin.saved;
  if (r) {
    const d = s.fin.detours.find(x => x.key === key); if (!d) return;
    r.pts.splice(d.seg + 1, 0, [d.x, d.y, d.what || d.place, d.l]); setDirty(true);
  } else { const on = s.on[s.fin.kind]; on.has(key) ? on.delete(key) : on.add(key); }
  refreshPlan();
}
// in the raid, tick the points as you reach them: the rest of the route's times (and its contacts) follow when you really got there
export const ptKey = p => Math.round(p.x) + "," + Math.round(p.y);
export function arrive(i) {
  const s = planSrc(); if (!s || !s.fin) return;
  const key = ptKey(s.fin.path[i]), prog = s.prog && s.prog.kind === s.pick ? s.prog : (s.prog = { kind: s.pick, at: null, t: 0, empty: new Set() });
  if (prog.at === key) { prog.at = null; refreshPlan(); return; } // ticked again: undo
  if (raidNow() == null) setClock(s.fin.times[i], true); // no clock yet: it starts as if you were on time
  prog.at = key; prog.t = Math.round(raidNow() * 10) / 10;
  refreshPlan();
}
// you reached it and someone had been there: no searching, the route goes on
export function markEmpty(i) {
  const s = planSrc(); if (!s || !s.fin) return;
  const key = ptKey(s.fin.path[i]);
  if (!s.prog || s.prog.kind !== s.pick || s.prog.at !== key) arrive(i);
  s.prog.empty.has(key) ? s.prog.empty.delete(key) : s.prog.empty.add(key);
  refreshPlan();
}
// pick a step: highlight it on the map and bring it into view
export function pickStep(i, p) {
  planStep = planStep === i ? -1 : i;
  if (planStep >= 0) centreOn(p);
  drawRoutes(); renderMapSide();
}
/* the plan, plainly: where from and to, the routes as tabs, the picked one's stops (one line each), its optional stops folded away,
   and what you can do with it in a bar at the bottom */
export let planOptOpen = false;
export function planPanel(side) {
  const v = mapView, s = planSrc(), r = s.fin, ctx = routeContext(v.m);
  side.classList.add("pl2"); side.style.setProperty("--c", r.color);
  // from → to, and tuck the panel away
  const head = el("div", "p2-head"), where = el("p", "p2-where");
  const from = s === spawnSel ? (ctx.place(centroid(s.group)) || "Your spawn") : "Here";
  where.append(el("span", null, from), el("i", null, "→"), el("b", null, r.exit));
  // back to the list of routes (the map then shows none until you open another)
  const back = button("All routes", { cls: "linkbtn p2-back", tip: "Back to the list", onClick: () => { planOpen = false; planHover = null; planStep = -1; drawRoutes(); renderMapSide(); swapIn(mapView.side); } });
  back.prepend("← ");
  const name = el("b", "p2-name", r.saved ? r.saved.name || "My route" : r.label); name.style.setProperty("--c", r.color);
  head.append(back, name, where);

  // the routes, as tabs: yours first, then the suggestions; each with its minutes, coloured like its line
  // the other tabs' routes are worked out once per plan (refreshPlan makes a new s.bases), not on every redraw of the panel
  const memo = s.bases._fins = s.bases._fins || new Map();
  const fins = s.bases.map(b => {
    if (b.kind === s.pick && s.fin) return s.fin;
    if (!memo.has(b.kind)) memo.set(b.kind, finishRoute(v.m, b.sp || s.sp || s.pt, b, b.saved ? new Set() : s.on[b.kind] || new Set(b.detours.filter(d => d.auto).map(d => d.key))));
    return memo.get(b.kind);
  });
  const tabs = el("div", "p2-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Routes");
  fins.forEach((f, i) => {
    if (i && !f.saved && fins[i - 1].saved) tabs.append(el("span", "p2-gap"));
    const t = el("button", "p2-tab" + (f.saved ? " mine" : "")); t.type = "button"; t.setAttribute("role", "tab"); t.setAttribute("aria-selected", String(f.kind === s.pick));
    t.style.setProperty("--c", f.color);
    // risk as a dot; the extract and the risk's word are in the tip (no minutes: the estimate isn't close enough to show)
    const sm = el("small", null, f.risk); sm.prepend(el("span", "p2-risk lv-" + f.risk.toLowerCase()));
    t.append(el("b", null, f.saved ? f.saved.name || "My route" : f.label), sm);
    t.dataset.tip = (f.saved ? "Your route" : f.why) + `\n${f.exit} · Risk ${f.risk}`;
    t.addEventListener("click", () => pickPlan(f.kind));
    t.addEventListener("mouseenter", () => { planHover = f.kind; drawRoutes(); });
    t.addEventListener("mouseleave", () => { planHover = null; drawRoutes(); });
    tabs.append(t);
  });

  // how long, how far, how risky; then only the warnings that matter, in one quiet line each
  const sum = el("p", "p2-sum");
  sum.append(`${fmtDist(r.meters)} · Risk `, el("span", "pl-risk risk-" + r.risk.toLowerCase(), r.risk));
  sum.dataset.tip = "Risk: how busy the way is, and the likely contacts on it.";
  const notes = [];
  if (r.exitNote) notes.push("Extract: " + r.exitNote);
  if (!r.across) notes.push("This extract may not be open for you.");
  if (r.stuck.length) notes.push(`${r.stuck.length === 1 ? "A way in is" : r.stuck.length + " ways in are"} guessed.`);

  // the stops, one line each; a dot at the end says what to watch for there (point at it for the detail)
  const ol = el("ol", "p2-steps");
  const core = r.path.map((p, i) => [p, i]).filter(([p]) => p.kind !== "detour");
  core.forEach(([p, i], n) => {
    const li = el("li", "p2-step " + p.kind + (planStep === i ? " cur" : ""));
    const num = el("span", "p2-n"); if (p.kind === "exit") num.append(icon("exit")); else num.textContent = n + 1;
    const name = p.kind === "spawn" || p.kind === "start" ? p.place || from : p.place;
    const txt = el("span", "p2-txt"); txt.append(el("b", null, name), el("small", null, p.kind === "spawn" ? "spawn" : p.kind === "start" ? "start" : p.kind === "exit" ? (r.exitNote || "extract") : (p.what || "").replace(new RegExp("^" + (name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\s*"), "")));
    li.append(num, txt);
    const marks = el("span", "p2-marks");
    const next = core[n + 1] ? core[n + 1][1] : r.path.length;
    r.contacts.filter(c => !c.ambush && c.t >= r.times[i] && c.t < (r.times[next] ?? Infinity)).forEach(c => {
      const d = el("span", "p2-dot lv-" + c.level.toLowerCase()); d.dataset.tip = `${c.level} chance of contact around ${clock(c.t)}${c.from ? "\nSomeone from " + c.from : ""}`; marks.append(d);
    });
    if (p.kind === "exit" && r.contacts.some(c => c.ambush)) { const d = el("span", "p2-dot lv-medium"); d.dataset.tip = "It opens late: people may wait at it"; marks.append(d); }
    const taken = r.looted.find(l => l.i === i);
    if (taken) { const d = el("span", "p2-dot taken"); d.dataset.tip = `Likely looted before you get there, around ${clock(taken.t)}`; marks.append(d); }
    if (r.stuck.includes(i)) { const d = el("span", "p2-dot guess"); d.dataset.tip = "The way in is a guess: no opening is marked here"; marks.append(d); }
    li.append(marks);
    li.addEventListener("click", () => pickStep(i, p));
    ol.append(li);
  });

  // optional stops, folded away: the ones on the route can come off, the others can go on
  const on = r.saved ? new Set() : s.on[r.kind] || new Set();
  const opts = [...r.path.filter(p => p.kind === "detour").map(p => ({ ...p, on: true })), ...r.detours.filter(d => !on.has(d.key)).map(d => ({ ...d, on: false }))];
  const opt = el("div", "p2-opt");
  if (opts.length) {
    const tg = el("button", "p2-opttg"); tg.type = "button"; tg.setAttribute("aria-expanded", String(planOptOpen));
    tg.append(el("span", "p2-chev", "›"), `${opts.length} optional stop${opts.length === 1 ? "" : "s"} on the way`);
    tg.addEventListener("click", () => { planOptOpen = !planOptOpen; renderMapSide(); });
    opt.append(tg);
    if (planOptOpen) {
      const ul = el("ul", "p2-optlist");
      opts.forEach(d => {
        const li = el("li", d.on ? "on" : "");
        const b = el("button", "pl-add"); b.type = "button"; b.append(icon(d.on ? "minus" : "plus"));
        b.title = d.on ? "Skip it" : r.saved ? "Add it to your route" : "Add it to the route"; b.setAttribute("aria-label", (d.on ? "Skip " : "Add ") + d.place);
        b.addEventListener("click", () => toggleDetour(d.key));
        const txt = el("span", "p2-txt"); txt.append(el("b", null, d.place), el("small", null, d.what || ""));
        li.append(b, txt, el("span", "p2-m", d.meters ? `+${d.meters} m` : ""));
        ul.append(li);
      });
      opt.append(ul);
    }
  }

  // what you can do with it: a suggestion becomes yours when you save, change or share it
  const foot = el("div", "p2-foot");
  const act = (ic, label, tip, fn) => { const b = el("button", null); b.type = "button"; b.append(icon(ic), label); b.title = tip; b.addEventListener("click", fn); foot.append(b); return b; };
  const keep = () => { const n = newRoute(mapPreview); n.name = mapPreview.name; s.pick = "r:" + n.id; return n; };
  if (r.saved) {
    act("edit", "Change", "Edit this route on the map", () => startRouteEdit(r.saved));
    act("share", "Share", "Send it to friends", () => shareRoute(r.saved));
  } else {
    act("save", "Save", "Keep it with your routes", () => { const n = keep(); toast([el("span", null, "Route saved: "), el("b", null, n.name)]); refreshPlan(); });
    act("edit", "Change", "Save a copy and change it on the map", () => startRouteEdit(keep()));
    act("share", "Share", "Save it and send it to friends", () => { const n = keep(); refreshPlan(); shareRoute(n); });
  }
  side.append(head, sum, ...notes.map(t => el("p", "p2-note", t)), ol, opt, foot); // (the other routes are in the list: All routes)
}
// bring a spot to the middle of the view, zoomed in a bit if the whole map is on show
export function centreOn(mk) {
  const v = mapView; if (!v) return;
  const r = v.view.getBoundingClientRect();
  v.k = Math.max(v.k, (v.kFit || v.k) * 2.2);
  v.tx = r.width / 2 - mk.x * v.S * v.k; v.ty = r.height / 2 - mk.y * v.S * v.k;
  applyMapView();
}
/* moving around: drag to pan, wheel to zoom where the mouse is */
export function applyMapView() { const v = mapView; v.world.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`; v.world.style.setProperty("--k", v.k); }
// the playable part of the map (where its markers are), a little padded: the images have wide empty borders
export function playBox(v) {
  if (v.box) return v.box;
  const xs = v.m.markers.map(mk => mk.x * v.S).sort((a, b) => a - b), ys = v.m.markers.map(mk => mk.y * v.S).sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(f * (a.length - 1)))]; // ignore the odd stray marker
  let x0 = q(xs, .005), x1 = q(xs, .995), y0 = q(ys, .005), y1 = q(ys, .995);
  const px = (x1 - x0) * .06 + 20, py = (y1 - y0) * .06 + 20;
  x0 = Math.max(0, x0 - px); y0 = Math.max(0, y0 - py); x1 = Math.min(v.W, x1 + px); y1 = Math.min(v.H, y1 + py);
  return (v.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}
export function fitMap() {
  const v = mapView; if (!v) return;
  const r = v.view.getBoundingClientRect();
  if (!r.width || !r.height) return; // not laid out yet: the resize watcher fits it once it has a size
  const b = playBox(v);
  v.kFit = Math.min(r.width / b.w, r.height / b.h); v.k = v.kFit;
  if (r.width > 200) v.kMin = Math.min(v.kFit, r.width / v.W, r.height / v.H) * .9; // zooming out can still show the whole image (once the view has its size)
  v.tx = (r.width - b.w * v.k) / 2 - b.x * v.k; v.ty = (r.height - b.h * v.k) / 2 - b.y * v.k; applyMapView();
}
// a spot hidden under the side panel glides into the open part of the map
export function panClear(p) {
  return; // the panels sit beside the map now, not over it: nothing hides under them
  const v = mapView; if (!v) return;
  const x = p.x * v.S * v.k + v.tx, cover = Math.min(350, v.view.clientWidth * .5) + 40;
  if (x >= cover) return;
  const from = v.tx, to = v.tx + (cover + 80 - x), t0 = performance.now();
  const step = now => { const f = Math.min(1, (now - t0) / 320), e = 1 - (1 - f) ** 3; v.tx = from + (to - from) * e; applyMapView(); if (f < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { if (Math.abs(v.tx - to) > .5) { v.tx = to; applyMapView(); } }, 380); // lands even when frames are held back (a tab in the background)
}
export function zoomAt(f, cx, cy) {
  const v = mapView, r = v.view.getBoundingClientRect();
  if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
  const k = Math.min(3, Math.max(v.kMin || v.kFit * .8, v.k * f));
  v.tx = cx - (cx - v.tx) * k / v.k; v.ty = cy - (cy - v.ty) * k / v.k; v.k = k; applyMapView();
}
export const toMapUnits = (v, e) => { const r = v.view.getBoundingClientRect(); return [((e.clientX - r.left - v.tx) / v.k) / v.S, ((e.clientY - r.top - v.ty) / v.k) / v.S]; };
export function bindMapInput() {
  const v = mapView, view = v.view;
  view.addEventListener("wheel", e => {
    if (e.target.closest(".mp-layers, .mp-rtpop, .mp-card")) return; // boxes on the map scroll themselves
    e.preventDefault(); const r = view.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  view.addEventListener("dblclick", e => { if (navEdit) { e.preventDefault(); finishNavShape(); } });
  view.addEventListener("contextmenu", e => {
    if (navEdit) { e.preventDefault(); finishNavShape(); return; }
    // drawing a route: right-click on (or right next to) a point removes it; never the browser's menu
    if (routeEdit) {
      e.preventDefault();
      const pts = routeEdit.route.pts, [x, y] = toMapUnits(v, e), px = (p => Math.hypot(p[0] - x, p[1] - y) * v.S * v.k);
      const i = pts.reduce((best, p, j) => (px(p) < (best < 0 ? Infinity : px(pts[best])) ? j : best), -1);
      if (i >= 0 && px(pts[i]) < 18) { routeEdit.undo.push(JSON.stringify(pts)); pts.splice(i, 1); routeChanged(); }
      return;
    }
    if (!RAID_ON || routeEdit || e.target.closest(".mp-pt, .mp-layers, .mp-card, .mp-markx, .mp-zoom, .ly-btn, .mp-ctx")) return;
    e.preventDefault(); openMarkMenu(e);
  });
  let drag = null;
  // two fingers: pinch to zoom (the wheel's job on a computer), the map follows the point between them
  const fingers = new Map(); let pinch = null;
  const mid = () => { const [a, b] = [...fingers.values()], r = view.getBoundingClientRect(); return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }; };
  view.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch") return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) { pinch = mid(); drag = null; view.classList.remove("panning"); }
  }, true);
  view.addEventListener("pointermove", e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch || fingers.size < 2) return;
    const m = mid();
    v.tx += m.x - pinch.x; v.ty += m.y - pinch.y; // the pair moved: the map goes with them
    if (pinch.d) zoomAt(m.d / pinch.d, m.x, m.y); else applyMapView();
    pinch = m;
  }, true);
  const lift = e => { fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null; };
  view.addEventListener("pointerup", lift, true); view.addEventListener("pointercancel", lift, true);
  view.addEventListener("pointerdown", e => {
    if (pinch) return;
    if (e.button !== 0 || e.target.closest(".mp-floors, .mp-zoom, .mp-card, .mp-layers, .mp-rtpop, .mp-sidetab, .ly-btn, .mp-ctx, .mp-hint, .mp-navbar, .mp-dock, .mp-dockpop, .mp-you, .mp-markx, .mp-pt, .mp-mk, .mp-det, .mp-contact, .mp-circle.spawn, polyline.hit")) return;
    drag = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false, closing: !!v.ctxMenu || !!v.dockPop };
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove", e => {
    if (!drag || pinch) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { v.tx = drag.tx + dx; v.ty = drag.ty + dy; applyMapView(); view.classList.add("panning"); }
  });
  view.addEventListener("pointerup", e => {
    const d = drag; drag = null; view.classList.remove("panning");
    if (d && !d.moved && navEdit) navClick(toMapUnits(v, e)); // editing walls
    else if (d && !d.moved && routeEdit) addRoutePoint(toMapUnits(v, e)); // a click while drawing adds a point
    else if (d && !d.moved && !d.closing && v.askSpawn) { // asked for your spawn: the one nearest the click
      const [x, y] = toMapUnits(v, e), ctx = routeContext(v.m), sp = ctx.spawns.filter(q => markerShown(q, v.m)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (sp && Math.hypot(sp.x - x, sp.y - y) < ctx.W * .05) selectSpawn(sp);
    }
    else if (d && !d.moved) { // a click on the ground only closes things (on a phone, the column open over the map too)
      closeCard();
      if (isPhone()) { if (!mapsUI.leftHidden) v.foldLeft(true); if (!mapsUI.sideHidden && !routeEdit) v.foldRight(true); }
    }
  });
  // fit when it first gets a size, and again after a resize if you hadn't zoomed
  if (window._mapRO) window._mapRO.disconnect(); // one watcher at a time: the previous map's view is gone
  (window._mapRO = new ResizeObserver(() => {
    if (mapView !== v) return;
    if (!v.kFit) { fitMap(); focusMarkerAfter(); return; }
    if (v.keepLeft) return; // a side column is sliding: the fold keeps the map in place and the zoom as it is
    const old = v.kFit, r = view.getBoundingClientRect();
    if (r.width && r.height) { if (v.k === old) fitMap(); else { const b = playBox(v); v.kFit = Math.min(r.width / b.w, r.height / b.h); } }
  })).observe(view);
}

/* routes: a line of points, each with an optional note */
// what the map draws: the route being drawn; else the plan's route; else your routes (as their switches say)
export function routesHere() {
  const v = mapView, pr = planRoute();
  // one route at a time: the one being drawn, the one open, or a friend's code being looked at (Codes)
  return routeEdit ? [routeEdit.route] : pr ? [pr] : codePreview && rtTab === "code" && codePreview.map === v.slug ? [codePreview] : [];
}
// a route point is [x, y, note, floor]; a point without a floor is on the route's floor
export const ptFloor = (r, p, m) => p[3] || r.floor || mapFloor(m);
export function drawRoutes() {
  const v = mapView; if (!v) return;
  const S = v.S, ns = "http://www.w3.org/2000/svg", fl = mapFloor(v.m), levels = v.m.levels;
  v.svg.textContent = ""; v.handles.textContent = "";
  v.world.style.setProperty("--la", mapsUI.lineAlpha ?? .85); // how strong the lines are (Filters)
  v.world.style.setProperty("--lw", mapsUI.lineWidth ?? 6);    // and how thick
  v.world.style.setProperty("--sa", mapsUI.simAlpha ?? .35);  // and the guessed enemy paths
  const poly = (pts, cls, color) => { const l = document.createElementNS(ns, "polyline"); l.setAttribute("points", pts); l.setAttribute("class", cls); if (color) l.style.stroke = color; v.svg.append(l); return l; };
  const xy = p => `${p[0] * S},${p[1] * S}`;
  const src = planSrc(), pr = planRoute(), pfin = pr ? src.fin : null;
  // the route under the mouse in the list, and only that one, while none is open
  if (!pr && src && src.bases && planHover) src.bases.filter(r => r.kind === planHover).forEach(r => {
    const pts = r.core.flatMap((p, i) => (i ? legPts(r.core[i - 1], p).slice(1) : [p])).map(p => `${p.x * S},${p.y * S}`).join(" ");
    poly(pts, "alt hot", r.color);
  });
  // what you plan from, on the map: your spawn or where you are, with a label to clear it (click another spawn or spot to change)
  if (src && !routeEdit && !navEdit) {
    const here = src === hereSel, at = here ? hereSel.pt : centroid(spawnSel.group);
    if (here) { const h = el("div", "mp-here"); h.style.left = at.x * S + "px"; h.style.top = at.y * S + "px"; v.handles.append(h); }
    const est = !here && src.fin && youNow(src.fin);
    if (est) {
      const h = el("div", "mp-here est"); h.style.left = est.x * S + "px"; h.style.top = est.y * S + "px";
      h.dataset.tip = `Where you should be by ${clock(raidNow())}, going by the clock.\nSomewhere else? Right-click where you are: I'm here`; v.handles.append(h);
    }
    const tag = el("div", "mp-you"); tag.style.left = at.x * S + "px"; tag.style.top = at.y * S + "px";
    tag.append(el("span", null, here ? `You · ${clock(hereSel.t0)}` : `Your spawn · ${routeContext(v.m).place(at) || "here"}`));
    const x = el("button", null, "✕"); x.type = "button"; x.title = "Clear it"; x.setAttribute("aria-label", "Clear");
    x.addEventListener("click", e => { e.stopPropagation(); here ? setHere(null) : selectSpawn(null); });
    tag.dataset.tip = here ? "Where this route starts" : "Click another spawn to change it";
    tag.append(x); v.handles.append(tag);
  }
  routesHere().forEach(r => {
    const editing = !!routeEdit && routeEdit.route === r, plan = r === pr;
    const fin = plan ? pfin : null, f = i => ptFloor(r, r.pts[i], v.m), kinds = fin ? fin.path.map(p => p.kind) : [], last = r.pts.length - 1;
    const dim = plan && planHover && planHover !== src.pick ? " dim" : ""; // another route is being looked at
    // one piece of line per step: steps away from this floor fade, steps that change floor are dotted (stairs, ladders)
    const steps = r.pts.map((_, i) => i).slice(1).map(i => [i - 1, i]);
    if (r.loop && r.pts.length > 2) steps.push([last, 0]);
    const at = i => ({ x: r.pts[i][0], y: r.pts[i][1], l: f(i) });
    steps.forEach(([a, b]) => {
      const way = legPts(at(a), at(b)), pts = way.map(q => `${q.x * S},${q.y * S}`).join(" "); // round the walls, through the openings
      // (the ground floor is outdoors too: a step there shows whatever floor you look at; only other floors indoors fade)
      const ground = v.m.level || levels[0], seen = f(a) === fl || f(b) === fl || (f(a) === ground && f(b) === ground);
      const cls = (seen ? "" : " away") + (f(a) !== f(b) ? " stairs" : "") + (way.stuck ? " stuck" : "") + dim;
      [["under", ""], ["line", r.color]].forEach(([kind, color]) => {
        const l = poly(pts, (kind === "under" ? "under" : "line") + cls + (editing && kind === "line" ? " editing" : ""), color);
        l.dataset.a = a; l.dataset.b = b;
      });
      // which way to go: a small chevron half way along the longer steps
      if (!editing && !dim && f(a) === fl && polyLen(way) > v.W / S * .045) {
        const mid = alongPts(way, .5), p0 = way[mid.i - 1] || way[0], p1 = way[mid.i] || way[way.length - 1];
        const ar = el("span", "mp-arrow"); ar.style.left = mid.x * S + "px"; ar.style.top = mid.y * S + "px";
        ar.style.setProperty("--a", Math.atan2(p1.y - p0.y, p1.x - p0.x) + "rad"); ar.style.setProperty("--c", r.color); v.handles.append(ar);
      }
    });
    // numbered points (the suggested route and the one being drawn show them all); the last one is the way out
    r.pts.forEach((p, i) => {
      const change = i > 0 && f(i) !== f(i - 1);
      if (!editing && !plan && !p[2] && !change && i !== 0 && i !== last) return;
      const exit = i === last && last > 0 && !r.loop, k = kinds[i] || "";
      const h = el("div", "mp-pt" + (editing ? " edit" : "") + (i === 0 ? " first" : "") + (exit ? " exit" : "") + (k === "detour" ? " det" : "") +
        (plan && planStep === i ? " cur" : "") + (f(i) !== fl && f(i) !== (v.m.level || levels[0]) ? " away" : "") + dim);
      if (exit) h.append(icon("exit")); else h.textContent = i + 1;
      h.style.left = p[0] * S + "px"; h.style.top = p[1] * S + "px"; h.style.setProperty("--c", r.color);
      const name = fin && fin.path[i] ? (exit ? fin.exit : fin.path[i].place + (fin.path[i].what ? " · " + fin.path[i].what : "")) : p[2];
      const down = change && levels.indexOf(f(i)) > levels.indexOf(f(i - 1)); // floors are listed top to bottom
      h.dataset.tip = (exit ? "Extract" : (r.name ? r.name + " · " : "") + "Point " + (i + 1)) + (levels.length > 1 ? " · " + f(i) : "") +
        (change ? `\n${down ? "Go down" : "Go up"} to ${f(i)}` : "") + (name ? "\n" + name : "") + (exit && fin && fin.exitNote ? "\n" + fin.exitNote : "") +
        (editing ? "\nDrag to move · right-click to remove" : "");
      if (change) h.append(el("span", "mp-stairs", (down ? "↓ " : "↑ ") + f(i)));
      // names stay off the map unless asked for: the extract always says its name
      const label = exit ? (fin ? fin.exit : p[2]) : fin && fin.path[i] ? fin.path[i].place : p[2];
      if (label && !dim && (exit || editing || mapsUI.showNames || (plan && planStep === i))) h.append(el("span", "mp-note", label));
      if (exit && fin && fin.contacts.some(c => c.ambush)) h.classList.add("warn");
      if (editing) bindPoint(h, i);
      else if (plan && fin) h.addEventListener("click", e => { e.stopPropagation(); pickStep(i, { x: p[0], y: p[1] }); });
      v.handles.append(h);
    });
  });
  // detours you skipped: a faint spur and a small ring; a click adds it
  if (pr && !planHover) pfin.spurs.forEach(d => {
    poly(`${d.fx * S},${d.fy * S} ${d.x * S},${d.y * S}`, "spur", pfin.color);
    const b = el("button", "mp-det"); b.type = "button"; b.setAttribute("aria-label", "Add " + d.place);
    b.style.left = d.x * S + "px"; b.style.top = d.y * S + "px"; b.style.setProperty("--c", pfin.color);
    b.dataset.tip = `${d.place}${d.what ? "\n" + d.what : ""}\n+${d.meters} m off the route · click to add it`;
    b.addEventListener("click", e => { e.stopPropagation(); toggleDetour(d.key); });
    v.handles.append(b);
  });
  // likely contacts: of the suggested route, or of the one being drawn; pointing at one shows where they come from
  const cs = mapsUI.showContacts === false || planHover ? [] : routeEdit ? (routeEdit.stats ? routeEdit.stats.contacts : []) : pr ? pfin.contacts : [];
  cs.filter(c => !c.ambush).forEach(c => {
    const lv = c.level.toLowerCase(), w = el("div", "mp-contact lv-" + lv);
    w.style.left = c.x * S + "px"; w.style.top = c.y * S + "px"; w.style.setProperty("--s", 22 + Math.round((c.score || .5) * 12) + "px");
    w.append(el("span", "mp-ct", "~" + clock(c.t)), el("span", "mp-clab", `${c.level} chance · ~${clock(c.t)}${c.from ? "\nfrom " + c.from : ""}`));
    let ln = null;
    // a likely contact: picks the step you'd be on at that minute
    w.addEventListener("click", e => { e.stopPropagation(); const f = planRoute() && planSrc().fin; if (!f) return; let i = f.times.findIndex(t => t >= c.t); if (i < 0) i = f.path.length - 1; pickStep(i, f.path[i]); });
    w.addEventListener("mouseenter", () => { if (c.fx != null) ln = poly(`${c.fx * S},${c.fy * S} ${c.x * S},${c.y * S}`, "threat lv-" + lv); });
    w.addEventListener("mouseleave", () => { if (ln) ln.remove(); ln = null; });
    v.handles.append(w);
  });
  drawNav(S);
  if (routeEdit || navEdit) return;
  const ctx = routeContext(v.m), now = hereT0();
  // the guessed paths of everyone else (Filters)
  if (mapsUI.showSims) enemySims(ctx, spawnSel ? spawnSel.group : []).forEach(s => poly(s.track.map(q => `${q.x * S},${q.y * S}`).join(" "), "sim"));
  // your marks, fading with time, and where that person may be now: their guessed way from the mark to now
  marksHere().forEach(k => {
    const age = Math.max(0, now - k.t), label = (MARK_TYPES[k.type] || [k.type])[0];
    markSims(ctx).filter(s => s.mark === k).forEach(s => {
      const p = posAt(s.track, now); if (!p || age < .2) return;
      poly([...s.track.filter(q => q.t <= now), p].map(q => `${q.x * S},${q.y * S}`).join(" "), "ghost");
      const g = el("div", "mp-ghost"); g.style.left = p.x * S + "px"; g.style.top = p.y * S + "px"; g.style.setProperty("--g", 16 + Math.min(44, age * 7) + "px");
      g.dataset.tip = `Maybe here now (${label.toLowerCase()} ${Math.round(age)} min ago)`; v.handles.append(g);
    });
    const w = el("div", "mp-markx mk-" + k.type); w.style.left = k.x * S + "px"; w.style.top = k.y * S + "px"; w.style.opacity = Math.max(.4, 1 - age / 12);
    w.append(el("span", null, clock(k.t)));
    w.dataset.tip = `${label} at ${clock(k.t)}\nRight-click to remove`;
    w.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); removeMark(k); });
    v.handles.append(w);
  });
}function bindPoint(h, i) {
  const v = mapView;
  h.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.stopPropagation(); h.setPointerCapture(e.pointerId);
    const pts = routeEdit.route.pts, before = JSON.stringify(pts); let moved = false;
    const move = ev => { moved = true; const [x, y] = toMapUnits(v, ev); pts[i][0] = Math.round(x); pts[i][1] = Math.round(y); h.style.left = pts[i][0] * v.S + "px"; h.style.top = pts[i][1] * v.S + "px"; drawRouteLineOnly(i); };
    const up = () => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      if (moved) { routeEdit.undo.push(before); routeChanged(); } else focusPointNote(i);
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); // a cancelled drag ends like a drop
  });
  h.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); const pts = routeEdit.route.pts; routeEdit.undo.push(JSON.stringify(pts)); pts.splice(i, 1); routeChanged(); });
}
export function drawRouteLineOnly(i) { // while dragging point i: just the steps that touch it; the handle moves itself
  const v = mapView, r = routeEdit.route;
  v.svg.querySelectorAll("polyline").forEach(l => {
    const a = +l.dataset.a, b = +l.dataset.b;
    if (a !== i && b !== i) return;
    if (!l.classList.contains("editing") && !l.classList.contains("under")) return;
    l.setAttribute("points", `${r.pts[a][0] * v.S},${r.pts[a][1] * v.S} ${r.pts[b][0] * v.S},${r.pts[b][1] * v.S}`);
  });
}
// show a floor; while drawing it is also the floor new points go on, until you change it again
export function setMapFloor(lv) {
  if (!mapView || !mapView.m.levels.includes(lv)) return;
  if (navEdit) finishNavShape(); // a wall half drawn belongs to the floor it was started on
  mapsUI.floors[mapsUI.slug] = lv; saveMapsUI();
  if (routeEdit) routeEdit.floor = lv;
  renderMapsBar(); drawMapLayers(); drawMarkers(); drawRoutes();
  if (routeEdit) renderMapSide();
}
// a new point stays on the floor you are drawing on (the last one you went to)
// the first point sticks to a spawn next to it, any point to an extract: the route then starts at that spawn or ends there
export function addRoutePoint([x, y]) {
  const pts = routeEdit.route.pts, ctx = routeContext(mapView.m), p = { x, y }, snap = ctx.W * .02;
  const near = list => list.filter(q => ctx.dist(q, p) < snap).sort((a, b) => ctx.dist(a, p) - ctx.dist(b, p))[0];
  const first = !pts.length, onSpawn = first && near(ctx.spawns), hit = onSpawn || near(ctx.extracts);
  if (hit) { x = hit.x; y = hit.y; }
  if (first) { // the first point decides: on a spawn the route starts there; anywhere else it's free, from the raid's minute now
    const r = routeEdit.route;
    if (onSpawn) delete r.t0; else r.t0 = hereT0();
    if (/^Route \d+$/.test(r.name)) r.name = `My route from ${ctx.place(p) || (onSpawn ? "spawn" : "here")}`;
  }
  routeEdit.undo.push(JSON.stringify(pts));
  pts.push([Math.round(x), Math.round(y), "", routeEdit.floor || mapFloor(mapView.m)]);
  routeChanged();
}
export function routeChanged() { setDirty(true); editStats(); drawRoutes(); renderMapSide(); }
// the route being drawn, read like a suggested one: time, risk, likely contacts
export function editStats() { if (routeEdit) routeEdit.stats = savedFin(mapView.m, routeEdit.route); }
export function startRouteEdit(route) {
  if (navEdit) stopNavEdit(); // one editor at a time
  if (routeEdit && routeEdit.route !== route) stopRouteEdit({ silent: true });
  toggleRoutesPop(false); toggleLayers(false);
  routeEdit = { route, undo: [], had: route.pts.length };
  // carry on where the route ends: its last point's floor
  const last = route.pts[route.pts.length - 1];
  routeEdit.floor = last ? ptFloor(route, last, mapView.m) : mapFloor(mapView.m);
  if (routeEdit.floor !== mapFloor(mapView.m)) { mapsUI.floors[mapsUI.slug] = routeEdit.floor; saveMapsUI(); renderMapsBar(); drawMapLayers(); drawMarkers(); }
  mapView.view.classList.add("drawing");
  editStats(); // how to draw is in the side panel (one place, not two)
  drawRoutes(); renderMapSide();
}
// silent: letting go of the editor because something else takes over (another map, new data): no questions
export function stopRouteEdit({ silent = false } = {}) {
  const r = routeEdit && routeEdit.route;
  // a saved route emptied with "Clear all points": ask before it goes, like Delete route does
  if (!silent && r && r.pts.length < 2 && routeEdit.had > 1) {
    confirmBox({ title: "Delete this route?", body: [el("span", "c-name", r.name), el("p", null, "It has no points left.")], ok: "Delete route", cancel: "Keep editing", danger: true })
      .then(yes => { if (yes) { routeEdit.had = 0; stopRouteEdit(); } });
    return;
  }
  routeEdit = null;
  if (mapView) { mapView.view.classList.remove("drawing"); mapView.hint.hidden = true; }
  if (r && r.pts.length < 2) { const i = mapRoutes().indexOf(r); if (i >= 0) { mapRoutes().splice(i, 1); setDirty(true); } } // a lone spawn point is no route
  // show it where it belongs: picked in the plan when it fits there
  const s = planSrc();
  if (s && r && r.pts.length > 1) s.pick = "r:" + r.id;
  refreshPlan();
}
// Esc on the map closes the thing on top, one at a time: a menu or popup, then the marker's card, then "click your spawn";
// only then does it end drawing a route or editing walls (their own handlers)
addEventListener("keydown", e => {
  const v = mapView;
  if (e.key !== "Escape" || area !== "maps" || !v || document.querySelector("dialog[open]") || e.target.closest?.("input, textarea")) return;
  const done = v.ctxMenu ? (closeMarkMenu(), true) : v.dockPop ? (closeDockPop(), true)
    : closeCard() || (v.askSpawn ? (askSpawn(false), true) : false)
    || (!routeEdit && !navEdit && planSrc() ? (mapsUI.start === "here" ? setHere(null) : selectSpawn(null), true) : false); // last: clear the spawn, back to the bare map
  if (done) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
export function focusPointNote(i) { const inp = mapView.side.querySelector(`.re2-steps input[data-i="${i}"]`); if (inp) { inp.focus(); inp.select(); } }
addEventListener("keydown", e => {
  if (!routeEdit || area !== "maps") return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.target.closest("input, textarea")) {
    e.preventDefault(); const u = routeEdit.undo.pop(); if (u) { routeEdit.route.pts = JSON.parse(u); routeChanged(); }
  }
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
    if (e.target.closest("input, textarea, select")) { e.target.blur(); return; } // Esc in the name or a note leaves the field, not the editor
    stopRouteEdit();
  }
});

/* share codes: ABI1-FARM-<points>.<name, colour, floor, notes>; points are two base64url characters per coordinate (4-unit steps) */
export function routeCode(r) {
  const pts = r.pts.map(([x, y]) => [x, y].map(v => { v = Math.max(0, Math.min(4095, Math.round(v / 4))); return B64[v >> 6] + B64[v & 63]; }).join("")).join("");
  const notes = r.pts.map(p => p[2] || ""), extra = { n: r.name || "", c: r.color, f: r.floor || "" };
  if (r.mode) extra.m = r.mode; if (r.t0) extra.s = r.t0; // the mode it was made for, and (free routes) the minute it starts
  if (notes.some(Boolean)) extra.t = notes;
  // each point's floor, only when the route changes floor (keeps simple codes short)
  const floors = r.pts.map(p => p[3] || r.floor || "");
  if (new Set(floors).size > 1) extra.l = floors;
  return `ABI1-${MAP_CODE[r.map]}-${pts}.${b64text(JSON.stringify(extra))}`;
}
export function copyRouteCode(r) {
  const code = routeCode(r);
  (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(
    () => toast([el("span", null, "Code copied: "), el("b", null, r.name || "Route"), el("span", null, ". Send it to your squad.")]),
    () => { window.prompt("Copy this code:", code); });
}
export function newRoute(from) {
  const v = mapView;
  const r = { id: "r-" + Date.now().toString(36), map: v.slug, name: from ? from.name : `Route ${mapRoutes().filter(x => x.map === v.slug).length + 1}`,
    color: from ? from.color : ROUTE_COLORS[mapRoutes().length % ROUTE_COLORS.length], floor: from ? from.floor : mapFloor(v.m),
    pts: from ? from.pts.map(p => p.slice()) : [], added: new Date().toISOString().slice(0, 10), mode: from && from.mode || mapDiff(v.m) };
  if (from && from.t0) r.t0 = from.t0;
  mapRoutes().push(r); setDirty(true);
  return r;
}

/* the side panel: your routes (or the one being drawn), the site's routes, then what to show */
export function renderMapSide() {
  const v = mapView; if (!v) return;
  const side = v.side, keepScroll = side.scrollTop; side.textContent = ""; side.classList.remove("pl2");
  const sec = (title, ...nodes) => { const s = el("section", "mp-sec"); s.append(el("h3", null, title), ...nodes); side.append(s); return s; };
  syncSide(); drawRail();

  if (routeEdit) {
    // the route editor: name and colour on top, its numbers, the stops as a timeline (each named after its place), and a bar at the bottom
    const r = routeEdit.route, levels = v.m.levels, many = levels.length > 1, ctx = routeContext(v.m);
    side.style.setProperty("--c", r.color);
    const head = el("div", "re2-head");
    const name = el("input", "re2-name"); name.value = r.name; name.maxLength = 40; name.placeholder = "Route name"; name.setAttribute("aria-label", "Route name");
    name.addEventListener("input", () => { r.name = name.value; setDirty(true); });
    const sw = el("div", "re2-colors"); sw.setAttribute("aria-label", "Line color");
    ROUTE_COLORS.forEach(c => { const b = el("button"); b.type = "button"; b.style.background = c; b.dataset.tip = "Line color"; b.setAttribute("aria-pressed", String(r.color === c)); b.addEventListener("click", () => { r.color = c; routeChanged(); }); sw.append(b); });
    const how = infoDot("Click the map: add a point\nDrag a point: move it\nRight-click a point: remove it" + (many ? "\nFloor buttons, bottom left: keep drawing upstairs or downstairs" : "") + "\nCtrl+Z: undo");
    const top = el("div", "re2-top"); top.append(name, how);
    head.append(top, sw);
    side.append(head);
    // its numbers, like a suggested route's
    const st = routeEdit.stats;
    if (st && r.pts.length > 1) {
      const sum = el("div", "mc-sum re2-sum");
      const fig = (label, value, cls) => { const d = el("div", "mc-fig"); d.append(el("small", null, label), el("b", cls || null, value)); sum.append(d); };
      const n = st.contacts.filter(c => !c.ambush).length;
      fig("Distance", fmtDist(st.meters)); fig("Risk", st.risk, "risk-" + st.risk.toLowerCase()); fig("Contacts", String(n));
      side.append(sum);
      const { sp, ex } = routeEnds(ctx, r.pts), fromTo = el("p", "re2-ends");
      fromTo.append(el("span", null, sp ? `${ctx.place(sp) || "Your"} spawn` : `Anywhere, from ${clock(r.t0 || 0)}`), el("i", null, "→"), el("b", null, ex ? ex.n || "an extract" : "no extract yet"));
      side.append(fromTo);
    }
    // the stops: a timeline, each named after the place it's at; floor changes written between them
    if (!r.pts.length) side.append(el("p", "re2-empty", "Click the map to place the first point"));
    const list = el("ol", "re2-steps"); list.style.setProperty("--c", r.color);
    r.pts.forEach((p, i) => {
      const f = ptFloor(r, p, v.m), prev = i ? ptFloor(r, r.pts[i - 1], v.m) : f, last = i === r.pts.length - 1;
      if (f !== prev) list.append(el("li", "re2-stairs", `${levels.indexOf(f) > levels.indexOf(prev) ? "↓ Down" : "↑ Up"} to ${f}`));
      const li = el("li", "re2-step" + (i === 0 ? " first" : last ? " last" : ""));
      const num = el("span", "re-n", String(i + 1));
      // change the order: drag a stop by its number up or down the list; a line shows where it lands
      if (r.pts.length > 1) {
        num.classList.add("grab"); num.dataset.tip = "Drag to change the order";
        num.addEventListener("pointerdown", () => { li.draggable = true; });
        li.addEventListener("dragstart", e => { reDrag = i; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); });
        li.addEventListener("dragend", () => { li.draggable = false; reDrag = null; list.querySelectorAll(".re2-step").forEach(x => x.classList.remove("dragging", "drop-above", "drop-below")); });
        li.addEventListener("dragover", e => {
          if (reDrag == null) return; e.preventDefault();
          const below = e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2;
          list.querySelectorAll(".re2-step").forEach(x => x.classList.remove("drop-above", "drop-below"));
          li.classList.add(below ? "drop-below" : "drop-above"); li.dataset.below = below ? "1" : "";
        });
        li.addEventListener("drop", e => {
          e.preventDefault(); if (reDrag == null) return;
          let to = i + (li.dataset.below ? 1 : 0); const from = reDrag;
          if (to > from) to--;
          if (to !== from) { routeEdit.undo.push(JSON.stringify(r.pts)); const [pt] = r.pts.splice(from, 1); r.pts.splice(to, 0, pt); routeChanged(); }
        });
      }
      const txt = el("div", "re2-txt");
      const place = ctx.place({ x: p[0], y: p[1] }) || `Point ${i + 1}`;
      const note = el("input", "re2-note"); note.dataset.i = i; note.value = p[2] || ""; note.maxLength = 60;
      note.placeholder = i === 0 ? "Add a note, e.g. spawn here" : last ? "Add a note, e.g. extract" : "Add a note, e.g. loot the safe";
      note.setAttribute("aria-label", `Note for point ${i + 1}`);
      note.addEventListener("input", () => { p[2] = note.value; setDirty(true); drawRoutes(); });
      txt.append(el("b", null, place), note);
      li.append(num, txt);
      if (many) { // the page's own small menu, like every other dropdown here
        const s = ddSelect("Floor", levels.map(lv => [lv, lv]), () => f, val => { routeEdit.undo.push(JSON.stringify(r.pts)); p[3] = val; if (last) { setDirty(true); setMapFloor(val); } else routeChanged(); });
        s.classList.add("re2-floor"); s.dataset.tip = "Floor of this point";
        li.append(s);
      } else li.append(el("span"));
      const del = el("button", "re-del"); del.type = "button"; del.append(icon("trash")); del.dataset.tip = "Remove this point"; del.setAttribute("aria-label", `Remove point ${i + 1}`);
      del.addEventListener("click", () => { routeEdit.undo.push(JSON.stringify(r.pts)); r.pts.splice(i, 1); routeChanged(); });
      li.append(del); list.append(li);
    });
    if (r.pts.length) side.append(list);
    // the bar at the bottom: quick tools on the left, what to do with it on the right
    const bar = el("div", "re2-bar"), tools = el("div", "re2-tools");
    const tool = (ic, label, fn, off) => { const b = el("button", "icon-btn"); b.type = "button"; b.append(icon(ic)); b.dataset.tip = label; b.setAttribute("aria-label", label); b.disabled = !!off; b.addEventListener("click", fn); tools.append(b); };
    tool("undo", "Undo (Ctrl+Z)", () => { const u = routeEdit.undo.pop(); if (u) { r.pts = JSON.parse(u); routeChanged(); } }, !routeEdit.undo.length);
    tool("trash", "Clear all points", () => { routeEdit.undo.push(JSON.stringify(r.pts)); r.pts = []; routeChanged(); }, !r.pts.length);
    const acts = el("div", "re2-acts");
    const del = delButton("Delete this route");
    del.addEventListener("click", async () => {
      if (r.pts.length && !(await confirmBox({ title: "Delete this route?", body: [el("span", "c-name", r.name)], ok: "Delete route", danger: true }))) return;
      const name = r.name; r.pts = []; stopRouteEdit();
      toast([el("span", null, "Route deleted: "), el("b", null, name || "Route")]); // like every other delete
    });
    const share = button("Share", { icon: "share", tip: "Send it to friends", onClick: () => shareRoute(r) }); share.disabled = r.pts.length < 2;
    const done = el("button", "primary", "Done"); done.type = "button"; done.addEventListener("click", stopRouteEdit);
    acts.append(del, share, done);
    bar.append(tools, acts);
    side.append(bar);
    side.scrollTop = keepScroll;
    return;
  }
  drawDock();
  const s = planSrc();
  // the steps belong to planning from a spawn: Suggested and Yours, or a route open; Free and Codes don't start at one
  if ((s && s.fin && planOpen) || rtTab === "sug" || rtTab === "mine") side.append(routeSteps());
  if (s && s.fin && planOpen) { planPanel(side); side.scrollTop = keepScroll; return; }
  routesList(side); side.scrollTop = keepScroll;
}
// the two side columns, open or folded into their strip (remembered)
export function syncCols() {
  const sec = $("maps"); sec.classList.toggle("hide-left", !!mapsUI.leftHidden); sec.classList.toggle("hide-right", !!mapsUI.sideHidden && !routeEdit);
  drawRail(); // its tabs show whether the column is open
}
// where you are in planning, as three steps on top of the Routes column: the spawn, a route, then going (each a click away)
export function routeSteps() {
  const s = planSrc(), open = !!(s && s.fin && planOpen), cur = !s ? 0 : !open ? 1 : 2;
  const steps = [
    ["Spawn", s === hereSel ? "Planning from where you are" : "Click the spawn where you start, on the map", () => { if (s === hereSel) setHere(null); else askSpawn(true); }],
    ["Route", "Pick one: the suggested, yours, or a free one", () => { if (!s) return askSpawn(true); planOpen = false; rtTab = "sug"; drawRoutes(); renderMapSide(); swapIn(mapView.side); }],
    ["Go", "Follow the numbered stops. In a raid, click a stop when you reach it: times and contacts follow", () => { if (!open && s && s.fin) pickPlan(s.pick); }],
  ];
  const box = el("ol", "rt-steps");
  steps.forEach(([label, tip, fn], i) => {
    const li = el("li", i < cur ? "done" : i === cur ? "cur" : "");
    const b = el("button"); b.type = "button"; b.dataset.tip = tip; b.addEventListener("click", fn);
    b.append(el("span", "rt-stepn", i < cur ? "✓" : String(i + 1)), el("span", null, label));
    li.append(b); box.append(li);
  });
  return box;
}
// the Routes column always shows the side panel: the list of routes, an open route, or the one being drawn
export function syncSide() {
  const v = mapView; if (!v) return;
  v.side.hidden = false; v.routesPop.hidden = true;
  syncCols();
}
// a route of the plan worked out (once per plan: refreshPlan makes new bases)
export function planFin(s, b) {
  const memo = s.bases._fins = s.bases._fins || new Map();
  if (b.kind === s.pick && s.fin) return s.fin;
  if (!memo.has(b.kind)) memo.set(b.kind, finishRoute(mapView.m, b.sp || s.sp || s.pt, b, b.saved ? new Set() : s.on[b.kind] || new Set(b.detours.filter(d => d.auto).map(d => d.key))));
  return memo.get(b.kind);
}
/* the Routes column, as a list: where you start, then the suggested routes from there, then yours from a spawn, then your free
   ones; at the bottom a new route or a friend's code. Pointing at a route draws it; a click opens it (its steps, Save, Share…) */
// the tab open in each bar is remembered, so a reload comes back to it
export let rtImportOpen = false, rtTab = ["mine", "free", "sug", "code"].includes(mapsUI.rtTab) ? mapsUI.rtTab : "sug";
export let reDrag = null; // the stop being dragged in the route editor's list
// a friend's code, read but not kept yet: its routes, and the one on show on the map (drawn like an open route, saved nowhere)
export let codeRead = { text: "", routes: [] }, codePreview = null;
export const finMemo = new WeakMap(); // your routes' minutes and risk, by route
// Suggested with no spawn picked: which spawns are open in the list, and their routes once worked out (a map or mode change starts again)
export const spOpen = new Set(), spFins = new Map();
export function previewCode(r) {
  codePreview = r;
  if (mapView && r.map !== mapView.slug) { resetMapState(); mapsUI.slug = r.map; saveMapsUI(); rtTab = "code"; renderMaps(); return; } // its map; drawn once that's in
  drawRoutes(); renderMapSide(); centreOn({ x: r.pts[0][0], y: r.pts[0][1] });
}
// the tabs on the Routes column's edge: a click shows that list (and closes a route that was open)
export const RT_TABS = [["mine", "Yours", "save"], ["free", "Free", "plus"], ["sug", "Suggested", "route"], ["code", "Codes", "upload"]];
// a bar's fixed header: which side it is (not a button), so Filters and Routes never get mixed up
// a column's title says which of its tabs is open
export const colTab = (cls, name) => { const s = document.querySelector(`#maps ${cls} .mp-coltab`); if (s) s.textContent = name ? " · " + name : ""; };
export const railHead = (ic, title) => { const h = el("div", "mp-railhead"); h.append(icon(ic), el("span", null, title)); return h; };
export function drawRail() {
  const v = mapView; if (!v || !v.rail) return;
  v.rail.textContent = ""; v.rail.append(railHead("route", "Routes"));
  if (mapsUI.rtTab !== rtTab || mapsUI.lyTab !== lyTab) { mapsUI.rtTab = rtTab; mapsUI.lyTab = lyTab; saveMapsUI(); }
  colTab(".mp-right", routeEdit ? "" : (RT_TABS.find(t => t[0] === rtTab) || [])[1]);
  const open = !mapsUI.sideHidden || !!routeEdit, on = open && !routeEdit ? rtTab : null;
  RT_TABS.forEach(([k, label, ic]) => {
    const b = el("button", "mp-railtab"); b.type = "button"; b.setAttribute("aria-pressed", String(on === k));
    b.append(icon(ic), el("span", null, label)); b.dataset.tip = on === k ? "Hide routes" : label;
    b.disabled = !!routeEdit; // drawing a route: the column shows the editor
    b.addEventListener("click", () => {
      // the open tab again: fold the column (on a computer, with a route open, it goes back to the list instead; a phone always folds)
      if (on === k && (isPhone() || !(planOpen && planSrc() && planSrc().fin))) { v.foldRight(true); return; }
      if (!open && k === rtTab && planOpen) { v.foldRight(false); return; } // folded with a route open: back to its steps, not the list
      rtTab = k; planOpen = false; planHover = null; planStep = -1;
      if (k !== "code") codePreview = null; // a friend's route shows only while you look at it in Codes
      if (!open) v.foldRight(false);
      drawRoutes(); renderMapSide(); swapIn(v.side);
    });
    v.rail.append(b);
  });
  drawLRail();
}
// the Filters bar, the same way: Keys, Markers (with the search), how routes look, the raid's size
export const LY_TABS = [["marks", "Markers", "layers"], ["keys", "Keys", "key"], ["disp", "Display", "gear"], ["raid", "Raid", "map"]];
export let lyTab = ["marks", "keys", "disp", "raid"].includes(mapsUI.lyTab) ? mapsUI.lyTab : "marks";
export function drawLRail() {
  const v = mapView; if (!v || !v.lrail) return;
  v.lrail.textContent = ""; v.lrail.append(railHead("layers", "Filters"));
  colTab(".mp-left", (LY_TABS.find(t => t[0] === lyTab) || [])[1]);
  const on = mapsUI.leftHidden ? null : lyTab;
  LY_TABS.forEach(([k, label, ic]) => {
    const b = el("button", "mp-railtab"); b.type = "button"; b.setAttribute("aria-pressed", String(on === k));
    b.append(icon(ic), el("span", null, label)); b.dataset.tip = on === k ? "Hide filters" : label;
    b.addEventListener("click", () => {
      if (on === k) { v.foldLeft(true); return; }
      lyTab = k; mapsUI.lyTab = k; saveMapsUI(); if (!on) v.foldLeft(false);
      renderLayers(); drawLRail(); swapIn(v.layers);
    });
    v.lrail.append(b);
  });
}
// new content in a column comes in with a short fade
export function routesList(box) {
  const v = mapView, ctx = routeContext(v.m), d = mapDiff(v.m), s = planSrc();
  const mine = mapRoutes().filter(r => r.map === v.slug && r.pts.length > 1), ends = r => routeEnds(ctx, r.pts);
  // your route read like a suggested one (minutes, risk, extract), worked out once until its points change
  const finOf = r => { const key = JSON.stringify(r.pts); let c = finMemo.get(r); if (!c || c.key !== key) { c = { key, f: savedFin(v.m, r) }; finMemo.set(r, c); } return c.f; };
  const mineRow = (r, sub, kind) => {
    const f = finOf(r), row2 = row(r.name || "Route", sub, r.color, f ? f.risk : "", () => openRouteOnMap(r), kind);
    if (f) { row2.dataset.tip = `${f.exit} · Risk ${f.risk}`; row2.querySelector(".rt-right").prepend(el("span", "p2-risk lv-" + f.risk.toLowerCase())); }
    // share straight from the list (shows on hover; a span, since the row itself is a button)
    const sh = el("span", "rt-share"); sh.setAttribute("role", "button"); sh.tabIndex = 0; sh.setAttribute("aria-label", "Share"); sh.dataset.tip = "Send it to friends"; sh.append(icon("share"));
    const doShare = e => { e.stopPropagation(); e.preventDefault(); shareRoute(r); };
    sh.addEventListener("click", doShare); sh.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") doShare(e); });
    row2.append(sh);
    return row2;
  };
  const hover = (b, kind) => { if (!kind) return; b.addEventListener("mouseenter", () => { planHover = kind; drawRoutes(); }); b.addEventListener("mouseleave", () => { planHover = null; drawRoutes(); }); };
  const row = (title, sub, color, right, onClick, kind) => {
    const b = el("button", "rt-row"); b.type = "button"; b.style.setProperty("--c", color);
    const t = el("span", "pl-txt"); t.append(el("b", null, title), el("small", null, sub));
    b.append(el("span", "pl-bar"), t, el("span", "rt-right", right || "")); b.addEventListener("click", onClick); hover(b, kind); return b;
  };
  // a list's block: no title of its own (the column's title already names the tab), only a slot for "New"
  const sec = () => { const x = el("section", "rt-sec"); x.append(el("h3", "rt-sechead")); box.append(x); return x; };
  // where you start: the suggested routes and "yours" depend on it (Free and Codes don't)
  const fromRow = () => {
    const top = el("div", "rt-from");
    if (s) {
      const here = s === hereSel, t = el("div", "rt-fromtxt");
      t.append(el("small", null, here ? "From where you are" : "Your spawn"), el("b", null, here ? `Here · ${clock(hereSel.t0)}` : ctx.place(centroid(s.group)) || "Your spawn"));
      top.append(t, button("Change", { cls: "linkbtn", tip: here ? "Plan from your spawn again" : "Pick another spawn", onClick: () => { if (here) setHere(null); else { selectSpawn(null); askSpawn(true); } } }));
    } else top.append(button("Pick your spawn", { cls: "primary", icon: "route", tip: "Click where you spawn: the routes from it show here", onClick: () => askSpawn(true) }));
    box.append(top);
  };
  // every spawn of the map, ones side by side counted as one, named the same way in Suggested and Yours;
  // spawns named after the same place get told apart by where they lie among them (north, south-west…)
  let spList = null;
  const spawnList = () => {
    if (spList) return spList;
    const seen = new Set(), named = [];
    ctx.spawns.forEach(q => { if (seen.has(q)) return; const g = spawnGroup(ctx, q); g.forEach(x => seen.add(x)); const c = centroid(g); named.push({ g, c, name: ctx.place(c) || "Spawn", key: Math.round(g[0].x) + "," + Math.round(g[0].y) }); });
    const dirs = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
    named.forEach(a => {
      const same = named.filter(b => b.name === a.name); if (same.length < 2) return;
      const mx = same.reduce((t, b) => t + b.c.x, 0) / same.length, my = same.reduce((t, b) => t + b.c.y, 0) / same.length;
      a.label = `${a.name} · ${dirs[(Math.round(Math.atan2(a.c.y - my, a.c.x - mx) / (Math.PI / 4)) + 8) % 8]}`;
    });
    return spList = named.map(a => ({ g: a.g, key: a.key, name: a.label || a.name })).sort((a, b) => a.name.localeCompare(b.name));
  };
  const spawnOf = sp => spawnList().find(x => x.g.includes(sp));
  const spawnHead = (name, on, onClick, n) => {
    const h = el("button", "mp-gname rt-spawn"); h.type = "button"; h.setAttribute("aria-expanded", String(on));
    h.append(el("span", "chev", "›"), el("span", null, name)); if (n) h.append(el("small", null, String(n)));
    h.addEventListener("click", onClick); return h;
  };
  // "New" sits on the list's title; with nothing there yet the empty list itself asks for the first one
  const newHead = (secEl, tip, onClick) => secEl.querySelector("h3").append(button("New", { cls: "linkbtn rt-new", icon: "plus", tip, onClick }));
  const emptyNew = (secEl, text, tip, onClick) => {
    const e = el("div", "rt-empty"); e.append(el("p", null, text), button("New route", { cls: "primary", icon: "plus", tip, onClick })); secEl.append(e);
  };
  drawRail();
  if (rtTab === "sug") {
    fromRow();
    const sg = sec();
    if (s && s.bases && s.bases.some(b => !b.saved)) s.bases.filter(b => !b.saved).forEach(b => {
      const f = planFin(s, b), r = row(f.label, `to ${f.exit}`, f.color, f.risk, () => pickPlan(b.kind), b.kind);
      r.dataset.tip = `${f.why}\nRisk ${f.risk}`; r.querySelector(".rt-right").prepend(el("span", "p2-risk lv-" + f.risk.toLowerCase()));
      sg.append(r);
    });
    else if (s) sg.append(emptyNote("No extract found from there"));
    else {
      // no spawn yet: every spawn of the map (ones side by side count as one); open one to see its routes, pick one to go
      spawnList().forEach(({ g, name, key }) => {
        const sp = g[0], on = spOpen.has(key);
        sg.append(spawnHead(name, on, () => { on ? spOpen.delete(key) : spOpen.add(key); renderMapSide(); }));
        if (!on) return;
        // its suggested routes, worked out now (once per spawn)
        if (!spFins.has(key)) spFins.set(key, suggestRoutes(v.m, sp).map(b => ({ b, f: finishRoute(v.m, sp, b, new Set(b.detours.filter(d2 => d2.auto).map(d2 => d2.key))) })));
        const box2 = el("div", "rt-spawnlist");
        spFins.get(key).forEach(({ b, f }) => {
          const r2 = row(f.label, `to ${f.exit}`, f.color, f.risk, () => selectSpawn(sp, { pick: b.kind }));
          r2.dataset.tip = `${f.why}\nRisk ${f.risk}`; r2.querySelector(".rt-right").prepend(el("span", "p2-risk lv-" + f.risk.toLowerCase()));
          box2.append(r2);
        });
        if (!spFins.get(key).length) box2.append(emptyNote("No extract found from there"));
        sg.append(box2);
      });
    }
  } else if (rtTab === "mine") {
    // yours that start at a spawn: this one's when one is picked, else all of them
    fromRow();
    const fromSpawn = mine.filter(r => ends(r).sp), atThis = s && s === spawnSel ? fromSpawn.filter(r => s.group.includes(ends(r).sp)) : fromSpawn;
    const ys = sec();
    const picked = s && s === spawnSel, mineRow2 = r => { const { ex } = ends(r), f = finOf(r); return mineRow(r, "to " + ((f && f.exit) || (ex && ex.n) || "an extract"), picked ? "r:" + r.id : null); };
    // with a spawn picked: its routes; without one: all of them, under the spawn each starts at (named as in Suggested)
    if (picked) atThis.forEach(r => ys.append(mineRow2(r)));
    else {
      const by = new Map();
      atThis.forEach(r => { const sp = spawnOf(ends(r).sp) || { key: "?", name: "Spawn" }; if (!by.has(sp.key)) by.set(sp.key, { sp, rs: [] }); by.get(sp.key).rs.push(r); });
      [...by.values()].sort((a, b) => a.sp.name.localeCompare(b.sp.name)).forEach(({ sp, rs }) => {
        const k = "m:" + sp.key, on = !spOpen.has(k);   // open unless you closed it
        ys.append(spawnHead(sp.name, on, () => { on ? spOpen.add(k) : spOpen.delete(k); renderMapSide(); }, rs.length));
        if (!on) return;
        const box2 = el("div", "rt-spawnlist"); rs.forEach(r => box2.append(mineRow2(r))); ys.append(box2);
      });
    }
    // a new one from the spawn picked starts on it: its first point is the spawn
    // without a spawn it asks for one first (routes here start at a spawn; Free is for the others)
    const tip = picked ? "Starts at your spawn: click the map to add the next points" : "Pick the spawn it starts at";
    const go = () => { if (picked) newRouteAt(s); else askSpawn(true, "new"); };
    if (atThis.length) newHead(ys, tip, go);
    else emptyNew(ys, picked ? "No route of yours from here" : "No routes of yours yet", tip, go);
  } else if (rtTab === "free") {
    // yours that start anywhere: for mid-raid, from where you are
    const free = mine.filter(r => !ends(r).sp), fs = sec();
    free.forEach(r => { const { ex } = ends(r), f = finOf(r); fs.append(mineRow(r, [`from ${clock(r.t0 || 0)}`, "to " + ((f && f.exit) || (ex && ex.n) || "an extract")].join(" · "))); });
    const ftip = "Start it anywhere but a spawn: it's a free route";
    if (free.length) newHead(fs, ftip, () => drawOwnRoute());
    else emptyNew(fs, "No free routes yet", ftip, () => drawOwnRoute());
  } else {
    // a code a friend sent you (the same codes Share makes; only their routes are taken here)
    // read first, look at it on the map, then keep it: nothing is saved until Add
    const cs = sec();
    const f = el("form", "mp-import"), inp = el("input"), go = el("button", null, "Read"), msg = el("span", "msg");
    inp.placeholder = "Paste a code"; inp.autocomplete = "off"; inp.value = codeRead.text; go.type = "submit"; f.append(inp, go, msg);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      let pack = null; try { pack = await unpackText(inp.value); } catch { pack = null; }
      const got = pack && Array.isArray(pack.routes) ? pack.routes.filter(r => r && r.map && Array.isArray(r.pts) && r.pts.length > 1) : [];
      codeRead = { text: inp.value, routes: got }; codePreview = null;
      if (!got.length) { msg.textContent = "No route in that code."; msg.className = "msg err"; return; }
      if (got.length === 1) previewCode(got[0]); else renderMapSide();
    });
    cs.append(f);
    const add = list => {
      const added = list.map((r, i) => { const n = { ...clone(r), id: "r-" + Date.now().toString(36) + i, added: today() }; mapRoutes().push(n); return n; });
      codeRead = { text: "", routes: [] }; codePreview = null;
      setDirty(true); toast([el("span", null, added.length === 1 ? "Route added: " : `${added.length} routes added: `), el("b", null, added.map(n => n.name).join(", "))]);
      openRouteOnMap(added.find(n => n.map === v.slug) || added[0]);
    };
    if (codeRead.routes.length) {
      const list = el("div", "rt-code");
      codeRead.routes.forEach(r => {
        const here = r.map === v.slug, c2 = here ? ctx : null, e2 = c2 ? routeEnds(c2, r.pts) : {};
        const mapName = (MAP_LIST.find(m => m[0] === r.map) || [, r.map])[1];
        const sub = [mapName, e2.sp ? `from ${c2.place(e2.sp) || "a"} spawn` : here ? "free route" : "", e2.ex && "to " + (e2.ex.n || "an extract"), `${r.pts.length} points`].filter(Boolean).join(" · ");
        const card = el("div", "rt-codecard" + (codePreview === r ? " on" : "")); card.style.setProperty("--c", r.color || "var(--accent)");
        const t = el("span", "pl-txt"); t.append(el("b", null, r.name || "Route"), el("small", null, sub));
        const btns = el("span", "rt-codebtns");
        btns.append(button(codePreview === r ? "Showing" : "Preview", { cls: codePreview === r ? "" : "linkbtn", tip: here ? "Show it on the map" : "Show it on " + mapName, onClick: () => previewCode(r) }),
          button("Add", { cls: "primary", tip: "Keep it with your routes", onClick: () => add([r]) }));
        card.append(el("span", "pl-bar"), t, btns); list.append(card);
      });
      cs.append(list);
      // keep them all, or none: Clear lets the code go (nothing was saved) and takes its route off the map
      const ca = el("div", "rt-codeacts");
      if (codeRead.routes.length > 1) ca.append(button(`Add all ${codeRead.routes.length}`, { tip: "Keep them all", onClick: () => add(codeRead.routes) }));
      ca.append(clearButton(() => { codeRead = { text: "", routes: [] }; codePreview = null; drawRoutes(); renderMapSide(); }, "Don't add them: forget this code"));
      cs.append(ca);
    }
  }
}// (the routes list lives in the Routes column now: these only redraw it)
export function toggleRoutesPop(open) { if (open && mapView) renderRoutesPop(); }
export function renderRoutesPop() {
  const v = mapView, box = v.routesPop; box.textContent = "";
  const ctx = routeContext(v.m);
  const d = mapDiff(v.m), mine = mapRoutes().filter(r => r.map === v.slug && r.pts.length > 1)
    .sort((a, b) => (!!a.mode && a.mode !== d) - (!!b.mode && b.mode !== d) || (a.name || "").localeCompare(b.name || ""));
  const rl = el("div", "pl-exits");
  mine.forEach(r => {
    const b = el("button", "pl-exit pl-mine"); b.type = "button"; b.style.setProperty("--c", r.color);
    const { sp, ex } = routeEnds(ctx, r.pts), other = r.mode && r.mode !== d;
    const txt = el("span", "pl-txt"); txt.append(el("b", null, r.name || "Route"),
      el("small", null, [sp ? `From ${ctx.place(sp) || "a"} spawn` : "Free route", ex && (ex.n || "an extract"), other && r.mode].filter(Boolean).join(" · ")));
    b.append(el("span", "pl-bar"), txt);
    b.dataset.tip = other ? `Made for ${r.mode}: opens it in that mode` : "Open it";
    b.addEventListener("click", () => { toggleRoutesPop(false); openRouteOnMap(r); });
    rl.append(b);
  });
  if (!mine.length) rl.append(emptyNote("No routes yet"));
  // first what to do: pick the spawn (the plan and suggested routes follow), or draw a route of your own
  const acts = el("div", "rt-acts");
  acts.append(button("Pick your spawn", { cls: "primary", icon: "route", tip: "Click where you spawn: your extracts and the suggested routes show here", onClick: () => askSpawn(true) }),
    button("Draw a route", { icon: "plus", tip: "Your first click decides: on a spawn it starts there, anywhere else it's a free route", onClick: () => drawOwnRoute() }));
  const sec = (title, ...nodes) => { const s = el("section", "rt-sec"), h = el("h3", null, title); s.append(h, ...nodes); box.append(s); return h; };
  box.append(acts);
  const mh = sec("Your routes", rl); if (mine.length) mh.append(el("small", null, String(mine.length)));
  // a friend's code: the same codes Share makes (only their routes are taken here) or an older route code
  const f = el("form", "mp-import"), inp = el("input"), go = el("button", null, "Import"), msg = el("span", "msg");
  inp.placeholder = "Paste a code"; inp.autocomplete = "off"; go.type = "submit"; f.append(inp, go, msg);
  f.addEventListener("submit", async e => {
    e.preventDefault();
    let pack = null; try { pack = await unpackText(inp.value); } catch { pack = null; }
    const got = pack && Array.isArray(pack.routes) ? pack.routes.filter(r => r && r.map && Array.isArray(r.pts) && r.pts.length > 1) : [];
    if (!got.length) { msg.textContent = "No route in that code."; msg.className = "msg err"; return; }
    toggleRoutesPop(false);
    const added = got.map((r, i) => { const n = { ...clone(r), id: "r-" + Date.now().toString(36) + i, added: today() }; mapRoutes().push(n); return n; });
    setDirty(true); toast([el("span", null, added.length === 1 ? "Route added: " : `${added.length} routes added: `), el("b", null, added.map(n => n.name).join(", "))]);
    openRouteOnMap(added.find(n => n.map === v.slug) || added[0]);
  });
  sec("From a friend", f);
}
/* the dock, bottom right of the map: the raid clock and the raid's size (marks are on right-click, routes in the side panel) */
export function drawDock() {
  const v = mapView; if (!v) return;
  if (v.dock) v.dock.remove(), (v.dock = null);
  if (!RAID_ON) return;
  const dock = el("div", "mp-dock"); v.dock = dock; v.view.append(dock);
  if (routeEdit || navEdit) { dock.hidden = true; return; }
  const btn = (label, tip, fn, cls) => { const b = el("button", cls || null); b.type = "button"; if (typeof label === "string") b.textContent = label; else b.append(...label); b.title = tip; b.addEventListener("click", e => { e.stopPropagation(); fn(b); }); return b; };
  const pop = (anchor, build) => { // a small box over the dock; a click elsewhere closes it
    closeDockPop(); const p = el("div", "mp-dockpop"); build(p); v.view.append(p);
    const r = anchor.getBoundingClientRect(), vr = v.view.getBoundingClientRect();
    p.style.right = Math.max(10, vr.right - r.right) + "px"; p.style.bottom = (vr.bottom - r.top + 6) + "px"; v.dockPop = p;
  };
  // the raid clock: start it when the raid starts; nudge it if you started late
  const g2 = el("div", "mp-dockg pl-clock"), now = raidNow(), running = !!(raidClock && raidClock.start);
  // Start raid gets you ready: the clock waits at 0:00 while you pick your spawn and route; Go starts it
  if (now == null) g2.append(btn([icon("route"), "Start raid"], "Get ready: pick your spawn and route, then Go when the raid begins", () => {
    setClock(0, false);
    if (!spawnSel) askSpawn(true); // a raid starts at a spawn: ask which one
    afterMarks();
  }));
  else if (!running && now === 0) g2.append(el("b", null, "0:00"),
    btn([el("span", "pl-go", "Go")], "The raid has begun: start the clock", () => { askSpawn(false); setClock(0, true); afterMarks(); }, "go"),
    btn("✕", "Cancel", () => newRaid()));
  else g2.append(el("b", null, clock(now)),
    btn("−1", "One minute back", () => { setClock(Math.max(0, raidNow() - 1), running); afterMarks(); }),
    btn("+1", "One minute on", () => { setClock(raidNow() + 1, running); afterMarks(); }),
    btn(running ? "❚❚" : "▶", running ? "Pause the clock" : "Start the clock again", () => { setClock(raidNow(), !running); drawDock(); }),
    btn("✕", "New raid: clear the clock and your marks on this map", () => newRaid()));
  // the raid's size: players and minutes (the wiki's numbers, editable)
  const raid = raidInfo(v.slug);
  const size = btn(`${raid.players} · ${raid.minutes}m`, "Players and raid length: click to change", b => pop(b, p => {
    const num = (val, label) => { const i = el("input"); i.type = "number"; i.min = 1; i.max = 99; i.value = val; i.setAttribute("aria-label", label); return i; };
    const pl = num(raid.players, "Players"), mi = num(raid.minutes, "Raid minutes"), row = el("div", "sr-raid");
    const ok = el("button", "primary", "Save"); ok.type = "button";
    ok.addEventListener("click", () => { mapsUI.raid = mapsUI.raid || {}; mapsUI.raid[v.slug] = { players: Math.max(1, +pl.value || raid.players), minutes: Math.max(1, +mi.value || raid.minutes) }; saveMapsUI(); closeDockPop(); afterMarks(); });
    const reset = el("button", "linkbtn", "Reset"); reset.type = "button";
    reset.addEventListener("click", () => { if (mapsUI.raid) delete mapsUI.raid[v.slug]; saveMapsUI(); closeDockPop(); afterMarks(); });
    row.append(pl, el("span", null, "players"), mi, el("span", null, "min"), ok, reset); p.append(row);
  }), "mp-size");
  size.title = "Players and raid length: click to change"; g2.append(size);
  dock.append(g2);
}
// "click the spawn where you are": the map asks after Start raid, spawns stand out, and a click near one picks it
export function askSpawn(on, why) {
  const v = mapView; if (!v) return;
  v.askSpawn = on; v.view.classList.toggle("pickspawn", on);
  if (!on) { hereWaiting = null; newWaiting = false; }
  if (on && isPhone() && !mapsUI.sideHidden && v.foldRight) v.foldRight(true); // on a phone the column covers the map: get it out of the way
  if (on) {
    v.hint.textContent = "";
    if (why === "new") { newWaiting = true; v.hint.append("Click the spawn your route starts at"); }
    else if (why === "here") {
      v.hint.append("Where did you spawn? Click it: your extracts are across the map from it. ");
      const no = el("button", "linkbtn", "Don't know"); no.type = "button";
      no.addEventListener("click", () => { const pt = hereWaiting; askSpawn(false); if (pt) setHere(pt); });
      v.hint.append(no);
    } else v.hint.append(raidClock ? "Click the spawn where you are, pick a route, then Go" : "Click the spawn where you start");
    const x = el("button", "linkbtn", "Cancel"); x.type = "button"; x.addEventListener("click", () => askSpawn(false)); v.hint.append(" · ", x);
    v.hint.hidden = false;
  }
  else if (!routeEdit) v.hint.hidden = true;
}
export function closeDockPop() { if (mapView && mapView.dockPop) { mapView.dockPop.remove(); mapView.dockPop = null; } }
document.addEventListener("pointerdown", e => { if (mapView && mapView.dockPop && !e.target.closest(".mp-dockpop, .mp-dock")) closeDockPop(); });// a route of your own: just start drawing; your first click decides if it starts at a spawn or is free
export function drawOwnRoute() { planHover = null; startRouteEdit(newRoute()); } // (startRouteEdit lets go of any edit already open)
/* Filters, on the map: how strong the lines are, names, contacts, enemy spawns, and which markers show */
export function renderLayers() {
  const v = mapView; if (!v || v.layers.hidden) return;
  const box = v.layers, keep = box.scrollTop; box.textContent = "";
  const sw = (label, on, fn, tip) => {
    const row = el("div", "ly-row"); if (tip) row.dataset.tip = tip;
    const s = el("button", "mp-switch"); s.type = "button"; s.setAttribute("role", "switch"); s.setAttribute("aria-checked", String(on)); s.setAttribute("aria-label", label);
    s.addEventListener("click", fn); row.append(el("span", null, label), s); return row;
  };
  // a strength slider: changes the lines as you drag, kept when you let go
  const slider = (label, key, def, cssVar) => {
    const row = el("label", "ly-row" + (key === "simAlpha" ? " ly-sub" : "")), rg = el("input"); rg.type = "range"; rg.min = 10; rg.max = 100; rg.step = 5; rg.value = Math.round((mapsUI[key] ?? def) * 100);
    rg.addEventListener("input", () => { mapsUI[key] = rg.value / 100; v.world.style.setProperty(cssVar, mapsUI[key]); });
    rg.addEventListener("change", saveMapsUI);
    row.append(el("span", null, label), rg); return row;
  };
  const routes = el("section", "ly-sec");
  const op = slider("Line strength", "lineAlpha", .85, "--la");
  // how thick the route's line is, 2 to 12 px (changes as you drag, kept when you let go)
  const lw = el("label", "ly-row"), lwr = el("input"); lwr.type = "range"; lwr.min = 2; lwr.max = 12; lwr.step = 1; lwr.value = mapsUI.lineWidth ?? 6;
  lwr.addEventListener("input", () => { mapsUI.lineWidth = +lwr.value; v.world.style.setProperty("--lw", mapsUI.lineWidth); });
  lwr.addEventListener("change", saveMapsUI);
  lw.append(el("span", null, "Line width"), lwr);
  const editW = el("button", "linkbtn ly-edit", "Edit"); editW.type = "button"; editW.title = "Mark a door the map misses, a wall or a place you can't walk";
  editW.addEventListener("click", () => { toggleLayers(false); startNavEdit(); });
  const walls = sw("Walls", !!mapsUI.showWalls, () => { mapsUI.showWalls = !mapsUI.showWalls; saveMapsUI(); drawRoutes(); renderLayers(); }, "What routes go round: buildings' walls (gaps are doors) and fences");
  walls.firstChild.after(editW);
  routes.append(op, lw,
    sw("Names along the route", !!mapsUI.showNames, () => { mapsUI.showNames = !mapsUI.showNames; saveMapsUI(); drawRoutes(); renderLayers(); }, "Off: only the extract says its name. Point at a stop, or pick it in the list, to read it"),
    sw("Likely contacts", mapsUI.showContacts !== false, () => { mapsUI.showContacts = mapsUI.showContacts === false; saveMapsUI(); drawRoutes(); renderLayers(); }),
    walls,
    sw("Likely enemy paths", !!mapsUI.showSims, () => { mapsUI.showSims = !mapsUI.showSims; saveMapsUI(); drawRoutes(); renderLayers(); }, "Where other players probably go: most loot the nearest spot, then the next; some run to the busiest spot first"),
    ...(mapsUI.showSims ? [slider("Their strength", "simAlpha", .35, "--sa")] : []),
    sw("Possible enemy spawns", !mapsUI.hideEnemies, () => { mapsUI.hideEnemies = !mapsUI.hideEnemies; saveMapsUI(); drawMarkers(); renderLayers(); }, "Once you pick your spawn, the others show faded"));
  // the raid's size: players and minutes (the wiki's numbers, yours once changed); the suggested routes and contacts use them
  const raid = raidInfo(v.slug), raidSec = el("section", "ly-sec"), raidH = el("h3", "with-reset", "Raid");
  if (raid.custom) {
    const reset = el("button", "linkbtn", "Reset"); reset.type = "button"; reset.title = "Back to the usual numbers for this map";
    reset.addEventListener("click", () => { delete mapsUI.raid[v.slug]; saveMapsUI(); afterMarks(); renderLayers(); });
    raidH.append(reset);
  }
  const num = (label, key, tip) => {
    const row = el("label", "ly-row"), i = el("input"); row.dataset.tip = tip;
    i.type = "number"; i.min = 1; i.max = 99; i.value = raid[key];
    i.addEventListener("change", () => {
      const n = Math.round(+i.value); if (!(n >= 1)) { i.value = raid[key]; return; }
      mapsUI.raid = mapsUI.raid || {}; mapsUI.raid[v.slug] = { players: raid.players, minutes: raid.minutes, [key]: Math.min(99, n) };
      saveMapsUI(); afterMarks(); renderLayers();
    });
    row.append(el("span", null, label), i); return row;
  };
  raidSec.append(
    num("Players", "players", "How many people join this map. More players: more likely contacts"),
    num("Raid minutes", "minutes", "How long the raid lasts. Suggested routes fit in it"),
    ...raidH.querySelectorAll("button")); // (Reset, when the numbers are yours)
  // markers: search, then a quiet list of groups (switch + count), each opening to its categories
  const q = el("input"); q.id = "mp-q"; q.type = "search"; q.placeholder = "Find a key, extract…"; q.autocomplete = "off"; q.setAttribute("aria-label", "Find on the map");
  q.value = v.q || ""; q.addEventListener("input", () => { v.q = q.value; drawMarkers(); });
  const groups = {}, count = {};
  v.m.markers.forEach(mk => { count[mk.c] = (count[mk.c] || 0) + 1; });
  Object.entries(v.m.categories).forEach(([name, c]) => { if (count[name]) (groups[c.g] = groups[c.g] || []).push(name); });
  const off = markersOff(v.slug, v.m);
  const open = mapsUI.open = mapsUI.open || [];
  const ORDER = ["Extracts", "Locations", "Safes", "Interactions", "Loot", "Other", "Distortion"];
  const setOff = list => { mapsUI.off[v.slug] = list; saveMapsUI(); drawMarkers(); renderLayers(); };
  const toggle = (on, label) => { const s = el("button", "mp-switch"); s.type = "button"; s.setAttribute("role", "switch"); s.setAttribute("aria-checked", String(on)); s.setAttribute("aria-label", (on ? "Hide " : "Show ") + label); return s; };
  const filters = el("div", "mp-filters");
  Object.entries(groups).sort((a, b) => (ORDER.indexOf(a[0]) + 99) % 99 - (ORDER.indexOf(b[0]) + 99) % 99 || a[0].localeCompare(b[0])).forEach(([g, names]) => {
    const gOn = !off.includes("g:" + g), isOpen = open.includes(g);
    const total = names.reduce((s, n) => s + count[n], 0);
    const gbox = el("div", "mp-group" + (gOn ? "" : " off"));
    const head = el("div", "mp-ghead");
    const exp = el("button", "mp-gname"); exp.type = "button"; exp.setAttribute("aria-expanded", String(isOpen));
    exp.append(el("span", "chev", "›"), el("span", null, g), el("small", null, String(total)));
    exp.addEventListener("click", () => { mapsUI.open = isOpen ? open.filter(x => x !== g) : [...open, g]; saveMapsUI(); renderLayers(); });
    // switching a group on whose categories are all off shows all of them
    const s = toggle(gOn, g); s.addEventListener("click", () => setOff(gOn ? [...off, "g:" + g] : off.filter(x => x !== "g:" + g && !(names.every(n => off.includes(n)) && names.includes(x)))));
    head.append(exp, s); gbox.append(head);
    if (isOpen) {
      const list = el("div", "mp-cats");
      names.sort().forEach(n => {
        const c = v.m.categories[n], on = !off.includes(n);
        const b = el("button", "mp-cat"); b.type = "button"; b.setAttribute("aria-pressed", String(on)); b.disabled = !gOn;
        const im = new Image(); im.alt = ""; if (c.ic) im.src = c.ic; b.append(im, el("span", null, n === "Label" ? "Place names" : n), el("small", null, String(count[n])));
        if (c.info) b.title = c.info;
        b.addEventListener("click", () => setOff(on ? [...off, n] : off.filter(x => x !== n)));
        list.append(b);
      });
      gbox.append(list);
    }
    filters.append(gbox);
  });
  const head = el("h3", "with-reset", "Markers");
  if (mapsUI.off[v.slug]) { const rs = el("button", "linkbtn", "Reset"); rs.type = "button"; rs.title = "Back to the markers that matter most in a raid"; rs.addEventListener("click", () => { delete mapsUI.off[v.slug]; saveMapsUI(); drawMarkers(); renderLayers(); }); head.append(rs); }
  const marks = el("section", "ly-sec"); marks.append(head, filters);
  // the settings you set once: folded away at the bottom until you open them
  const fold = (title, key, body) => {
    const on = !!mapsUI[key], h = el("button", "mp-gname ly-keyshead"); h.type = "button"; h.setAttribute("aria-expanded", String(on));
    h.append(el("span", "chev", "›"), el("span", null, title));
    h.addEventListener("click", () => { mapsUI[key] = !on; saveMapsUI(); renderLayers(); });
    const s = el("section", "ly-sec ly-fold"); s.append(h); if (on) s.append(body); return s;
  };
  const search = el("section", "ly-sec"); search.append(q);
  // keys: every key's door on this map (one line per key), a click takes the map there
  const keys = el("section", "ly-sec"), seen = new Set();
  const doors = v.m.markers.filter(mk => mk.c === "Key" && mk.n && !seen.has(mk.n) && seen.add(mk.n)).sort((a, b) => a.n.localeCompare(b.n));
  const kOpen = true, kh = el("h3", "with-reset", "Keys"); kh.append(el("small", null, String(doors.length)));
  keys.append(kh);
  if (!doors.length) keys.append(emptyNote("No keys on this map"));
  if (kOpen && doors.length) {
    const kl = el("div", "ly-keys");
    doors.forEach(mk => {
      const on = mapSel === mk || !!(mapSel && mapSel.n === mk.n && mapSel.c === "Key");
      const b = el("button", "ly-key"); b.type = "button"; b.setAttribute("aria-pressed", String(on));
      const im = new Image(); im.alt = ""; im.src = mk.ic || (v.m.categories.Key || {}).ic || ""; b.append(im, el("span", null, mk.n), el("small", null, mk.l || ""));
      // a click goes to it; a click on the one picked lets it go (card and rings away)
      b.addEventListener("click", () => { if (on) closeCard(); else { mapMarkAfter = { slug: v.slug, n: mk.n, c: mk.c, x: mk.x, y: mk.y }; focusMarkerAfter(); } renderLayers(); });
      kl.append(b);
    });
    keys.append(kl);
  }
  // what you look for in a raid first (search, keys, markers), then what you set once
  // one tab at a time, picked on the Filters bar
  const dispH = el("h3", null, "Route display"), raidT = el("h3", null, "Raid");
  if (lyTab === "keys") box.append(keys);
  else if (lyTab === "marks") box.append(search, marks);
  else if (lyTab === "disp") { routes.prepend(dispH); box.append(routes); }
  else { raidSec.prepend(raidT); box.append(raidSec); }
  box.scrollTop = keep;
}
// (Filters live in the left column now: this only redraws them)
export function toggleLayers(open) { if (open && mapView) renderLayers(); }
// right-click on the map, mid-raid: "I'm here", off your route
export function openMarkMenu(e) {
  const v = mapView, at = toMapUnits(v, e), r = v.view.getBoundingClientRect();
  closeMarkMenu();
  const m = el("div", "mp-ctx"); m.style.left = Math.min(e.clientX - r.left, r.width - 170) + "px"; m.style.top = Math.min(e.clientY - r.top, r.height - 195) + "px";
  const here = el("button", "mk-here"); here.type = "button"; here.append(el("span", "pl-you"), "I'm here");
  here.title = "Plan the rest of the raid from this spot"; here.addEventListener("click", () => { closeMarkMenu(); imHere(at); });
  m.append(here);
  v.view.append(m); v.ctxMenu = m;
}
export function closeMarkMenu() { if (mapView && mapView.ctxMenu) { mapView.ctxMenu.remove(); mapView.ctxMenu = null; } }
document.addEventListener("pointerdown", e => { if (mapView && mapView.ctxMenu && !e.target.closest(".mp-ctx")) closeMarkMenu(); });
addEventListener("keydown", e => {
  if (e.key === "Escape") closeMarkMenu();
  if (!navEdit || area !== "maps" || e.target.closest("input, textarea")) return;
  if (e.key === "Escape") { navEdit.cur.length ? ((navEdit.cur = []), drawRoutes()) : stopNavEdit(); }
  else if (e.key === "Enter") finishNavShape();
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); navUndo(); }
});

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("maps", { draw: renderMaps, refresh: mapsRefresh, openRoute: mapsOpenRoute, openMarker: mapsOpenMarker, planRoute: mapsPlanRoute });
