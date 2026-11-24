/* The base everything else builds on: small helpers, the keys this hub keeps in the browser (K, ls), shared motion,
   the data (builds.js, prices.js) with yours on top, tooltips, copy. */
import { area, PAGES } from "../app.js";

// if anything breaks while starting, show the bars anyway (body.booting hides them until the end of this script)
addEventListener("error", () => document.body.classList.remove("booting"));
// the part under the bar that scrolls (the window itself doesn't)
export const pageEl = document.querySelector(".page");
// the width of its scrollbar (0 where scrollbars float over the page): the bars above add it on the right, to line up (.bar)
export const measureSbw = () => document.documentElement.style.setProperty("--sbw", (pageEl.offsetWidth - pageEl.clientWidth) + "px");
measureSbw(); addEventListener("resize", measureSbw);
export const TIERS = [
  { key: "budget", n: 1, label: "Budget" },
  { key: "balanced", n: 2, label: "Balanced" },
  { key: "max", n: 3, label: "Max" },
  { key: "misc", n: 4, label: "Misc" },
];
export const ORDER = { budget: 0, balanced: 1, max: 2, misc: 3 };
// every key this page keeps in the browser, in one place (the values never change: renaming one would lose what people have saved)
export const K = {
  draft: "abi-builds-draft-v3", saved: "abi-builds-saved-v2", open: "abi-builds-open-v1", tab: "abi-builds-tab-v1", scroll: "abi-builds-scroll-v1",
  sort: "abi-builds-sort-v1", area: "abi-builds-area-v1", builds: "abi-builds-b-filters-v1",
  gearSub: "abi-builds-gear-sub-v1", gearTiers: "abi-builds-gear-tiers-v3", gearTierOld: "abi-builds-gear-tier-v2",
  loTier: "abi-builds-lo-tier-v1", loFav: "abi-builds-lo-fav-v1", loFilters: "abi-builds-lo-filters-v1",
  priceDraft: "abi-prices-draft-v1", marketCat: "abi-builds-market-cat-v1",
  kbPreset: "abi-builds-kb-preset-v1", kbPress: "abi-builds-kp-press-v1",
  maps: "abi-builds-maps-v1",
  merchant: "abi-merchant-ui-v1", merPractice: "abi-merchant-practice-v1", merRefs: "abi-merchant-refs-v1", merMine: "abi-merchant-mine-v1", merOcr: "abi-merchant-ocr-v1",
  smelt: "abi-smelter-v1", tiers: "abi-tiers-v1", trade: "abi-trading-v1",
  mine: "abi-mine-v1", // what you added or changed on top of builds.js and prices.js (the drafts above are only read once, to move them here)
  raidClock: "abi-raid-clock", raidMarks: "abi-raid-marks", // sessionStorage: this tab only
};
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// a phone-sized screen (the same width as the CSS block for phones at the end of the styles)
export const isPhone = () => matchMedia("(max-width: 760px)").matches;
// rows of tabs that slide sideways on a phone: a fade on the side where more is hidden (CSS .more-l / .more-r), and the tab
// picked brought into view whenever it changes (a section opened from Home or a link may sit off the row's edge)
export const SLIDE_ROWS = "nav.areas, nav.cats, .g-jump";
export function slideEdges(n) {
  const l = n.scrollLeft > 2, r = n.scrollLeft + n.clientWidth < n.scrollWidth - 2;
  n.classList.toggle("more-l", l); n.classList.toggle("more-r", r);
}
export function slideRows() {
  if (!isPhone()) { document.querySelectorAll(".more-l, .more-r").forEach(n => n.classList.remove("more-l", "more-r")); return; }
  document.querySelectorAll(SLIDE_ROWS).forEach(n => {
    if (!n.offsetParent) return;
    // the tab picked changed (or the row is new): if it's out of sight, slide it to the middle
    const on = n.querySelector('[aria-selected="true"], [aria-current="page"]'); // tabs, or the page links in the top bar
    if (on && on !== n.slideOn) {
      n.slideOn = on;
      const nr = n.getBoundingClientRect(), r = on.getBoundingClientRect();
      if (r.left < nr.left + 8 || r.right > nr.right - 8) n.scrollLeft += r.left - nr.left - (nr.width - r.width) / 2;
    }
    slideEdges(n);
  });
}
document.addEventListener("scroll", e => { const n = e.target; if (n.matches && n.matches(SLIDE_ROWS)) slideEdges(n); }, { passive: true, capture: true });
// rows are drawn as sections open and tabs change: look again after any click, and when the window changes size
document.addEventListener("click", () => requestAnimationFrame(slideRows), true);
addEventListener("resize", () => requestAnimationFrame(slideRows));

/* ---------- shared motion: every section uses these, so things come in, change and get picked the same way everywhere.
   Sections are drawn again whole on each click, so motion.changed() tells what really changed and only that moves ---------- */
export let areaVisit = 0; // goes up each time you open a section: its first drawing comes in, later redraws don't
export function nextAreaVisit() { areaVisit++; } // (a module can read areaVisit, only this one can change it)
export const motionSeen = new Map();
export const motion = {
  // true the first time a key shows a value, or when the value is new
  changed(key, val) { const s = JSON.stringify(val); if (motionSeen.get(key) === s) return false; motionSeen.set(key, s); return true; },
  // the section was just opened (once per visit, per key)
  opened(key) { return motion.changed("visit:" + key, areaVisit); },
  // plays a class's animation once (again if it was playing), and takes the class off after so hover effects work
  play(e, cls) {
    if (reduceMotion || !e) return e;
    e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls);
    const done = () => { e.classList.remove(cls); e.removeEventListener("animationend", end); clearTimeout(t); };
    const end = ev => { if (ev.target === e) done(); };
    const t = setTimeout(done, 2500); // in a tab in the background the animation may never end: never leave it half shown
    e.addEventListener("animationend", end); return e;
  },
  in(e, i = 0) { if (e) e.style.setProperty("--i", Math.min(i, 14)); return motion.play(e, "a-in"); }, // comes in (rises and fades)
  stagger(list, from = 0) { [...list].slice(from).forEach((e, i) => motion.in(e, i)); },        // one after another
  pop(e) { return motion.play(e, "a-pop"); },     // just picked
  tick(e) { return motion.play(e, "a-tick"); },   // a number that changed
  nudge(e) { return motion.play(e, "a-nudge"); }, // points the way (an arrow)
  flash(e) { return motion.play(e, "a-flash"); }, // just added
  swap: box => swapIn(box),                       // new contents in the same box (a tab changed)
};
export function swapIn(box) { if (reduceMotion || !box) return; box.classList.remove("a-swap"); void box.offsetWidth; box.classList.add("a-swap"); }

export const $ = id => document.getElementById(id);
export const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const norm = s => s.toLowerCase().replace(/[\s-]/g, "");
export const clone = o => JSON.parse(JSON.stringify(o));
export const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

/* ---------- small shared helpers ---------- */
// "1 loadout", "3 loadouts"
export const plural = (n, one, many = one + "s") => `${typeof n === "number" ? n.toLocaleString("en-US") : n} ${n === 1 ? one : many}`;
// a build tier's word ("Balanced"); an unknown tier shows as it is rather than breaking the page
export const tierLabel = key => (TIERS.find(t => t.key === key) || { label: key || "Other" }).label;
// a build goes in its weapon's list after the others of its tier and before the next tier (the names count on that order)
export function insertBuild(gun, b) {
  let at = 0;
  gun.builds.forEach((x, i) => { if ((ORDER[x.tier] ?? 9) <= (ORDER[b.tier] ?? 9)) at = i + 1; });
  gun.builds.splice(at, 0, b);
}
// a button: type, label (text or nodes), tooltip, click; for new code, so buttons stop being written out by hand
// the one empty state inside a panel: "No X yet" when there's nothing, "Nothing matches these filters." / "…your search." when it's hidden
export const emptyNote = text => el("p", "empty-note", text);
// the one "× Clear" (filter boxes, the Smelter's station, a code box…): shown only while there is something to clear
export const clearButton = (fn, tip = "Clear all the filters", cls = "") => { const b = el("button", "f-clear" + (cls ? " " + cls : "")); b.type = "button"; b.append("×", el("span", null, "Clear")); b.dataset.tip = tip; b.addEventListener("click", fn); return b; };
// the one Delete every overlay uses: trash icon and the word, quiet, on the footer's left (the caller asks to confirm)
export const delButton = tip => button("Delete", { cls: "linkbtn del-link", icon: "trash", tip });
export function button(label, { cls = null, tip = "", icon: ic = null, onClick = null } = {}) {
  const b = el("button", cls); b.type = "button";
  if (ic) b.append(icon(ic));
  if (label != null) b.append(...(Array.isArray(label) ? label : [label]));
  if (tip) b.dataset.tip = tip;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

// things that act as buttons without being one (ammo chips that open their price): Enter and Space work like a click
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('.am-link[role="button"]')) { e.preventDefault(); e.target.click(); }
});

/* ---------- shared state read from the start ---------- */
export const bF = { tiers: [], ...(ls.get(K.builds) || {}) }; // Builds' filter box

/* ---------- data ---------- */
export let fileData = window.ABI_BUILDS ? clone(window.ABI_BUILDS) : null;
export let data = fileData ? clone(fileData) : { version: 2, categories: [] };
export let pricesFile = window.ABI_PRICES ? clone(window.ABI_PRICES) : null;
export let market = pricesFile ? clone(pricesFile) : { version: 1, items: [], snapshots: [] };
export const notice = $("notice");

if (!fileData) {
  notice.hidden = false;
  notice.textContent = "builds.js wasn't found. Keep index.html and builds.js together in the same folder.";
}
// notice lines with buttons, one per message
export function noticeLine(text, actions) {
  notice.hidden = false;
  const line = el("div", "notice-line"); line.append(el("span", null, text));
  const done = () => { line.remove(); if (!notice.children.length) notice.hidden = true; };
  actions.forEach(([label, fn]) => { const b = el("button", "linkbtn", label); b.type = "button"; b.addEventListener("click", () => { fn(); done(); }); line.append(b); });
  // × just hides it (nothing is undone)
  const x = el("button", "x", "×"); x.type = "button"; x.title = "Hide this"; x.setAttribute("aria-label", "Hide this"); x.addEventListener("click", done); line.append(x);
  notice.append(line);
}
/* ---------- yours, on top of the shared files ----------
   builds.js and prices.js are what everyone gets from the site. What each person adds or changes (loadouts, builds, routes,
   keybinds, walls, prices) is a small layer kept in their own browser and saved on every change: an update of the files never
   wipes it, and nobody gets someone else's setup. Share > Backup puts it (and every other setting) in one file. */
export const buildKey = (weapon, b) => weapon + "|" + JSON.stringify(b);
export const sharedLoIds = new Set(((fileData && fileData.loadouts) || []).map(l => l.id));
export const isMine = lo => !sharedLoIds.has(lo.id); // a loadout you made (editing a shared one makes your own copy)
export let seedMyKeys = false;
export function seedDone() { seedMyKeys = false; } // the keybinds seeded "My setup" once
export function mineOf() {
  const m = { v: 1 };
  if (data.keybinds && data.keybinds.presets.length) m.keybinds = data.keybinds;
  if (data.routes && data.routes.length) m.routes = data.routes;
  if (data.nav && Object.keys(data.nav).length) m.nav = data.nav;
  const los = (data.loadouts || []).filter(isMine);
  if (los.length) m.loadouts = los;
  // builds: the ones you added, and the shared ones you removed or changed, by weapon
  const had = new Set(), has = new Set(), add = [];
  (fileData ? fileData.categories : []).forEach(c => c.weapons.forEach(w => w.builds.forEach(b => had.add(buildKey(w.name, b)))));
  data.categories.forEach(c => c.weapons.forEach(w => w.builds.forEach(b => { const k = buildKey(w.name, b); has.add(k); if (!had.has(k)) add.push({ weapon: w.name, build: b }); })));
  const gone = [...had].filter(k => !has.has(k));
  if (add.length) m.builds = add;
  if (gone.length) m.buildsGone = gone;
  // prices: the items and readings the file doesn't have
  const fp = pricesFile || { items: [], snapshots: [] }, ids = new Set(fp.items.map(i => i.id));
  const items = market.items.filter(i => !ids.has(i.id)), snaps = [];
  market.snapshots.forEach(s => {
    const f = fp.snapshots.find(x => x.date === s.date && x.source === s.source), prices = {};
    Object.entries(s.prices).forEach(([id, v]) => { if (!f || JSON.stringify(f.prices[id]) !== JSON.stringify(v)) prices[id] = v; });
    if (Object.keys(prices).length) snaps.push({ date: s.date, source: s.source, prices });
  });
  if (items.length) m.items = items;
  if (snaps.length) m.snapshots = snaps;
  return m;
}
export function applyMine(m) {
  data = fileData ? clone(fileData) : { version: 2, categories: [] };
  market = pricesFile ? clone(pricesFile) : { version: 1, items: [], snapshots: [] };
  if (!Array.isArray(data.loadouts)) data.loadouts = [];
  if (!m) return;
  if (m.keybinds) data.keybinds = m.keybinds;
  if (m.routes) data.routes = m.routes;
  if (m.nav) data.nav = m.nav;
  (m.loadouts || []).forEach(l => { if (!data.loadouts.some(x => x.id === l.id)) data.loadouts.push(l); });
  const gone = new Set(m.buildsGone || []), guns = data.categories.flatMap(c => c.weapons);
  guns.forEach(w => { w.builds = w.builds.filter(b => !gone.has(buildKey(w.name, b))); });
  (m.builds || []).forEach(x => { const w = guns.find(g => g.name === x.weapon); if (w && !w.builds.some(b => b.code === x.build.code && b.tier === x.build.tier)) insertBuild(w, x.build); });
  (m.items || []).forEach(it => { if (!market.items.some(i => i.id === it.id)) market.items.push(it); });
  (m.snapshots || []).forEach(s => {
    const f = market.snapshots.find(x => x.date === s.date && x.source === s.source);
    if (f) Object.assign(f.prices, s.prices); else market.snapshots.push(s);
  });
}
{
  let m = ls.get(K.mine);
  if (!m) {
    // first visit after the change: the old drafts held the whole files, so keep only what was yours in them
    const raw = ls.get(K.draft), d = raw && raw.data ? raw.data : raw;
    const rawP = ls.get(K.priceDraft), p = rawP && rawP.data ? rawP.data : rawP;
    if (d && d.categories) { data = d; if (!Array.isArray(data.loadouts)) data.loadouts = []; }
    if (p && p.items) market = p;
    // the local copy started with the maker's own keybinds: keep them there, once, as a preset of his (see kbUserPresets)
    // "the local copy": file:// as it used to be, or a server on this computer (the page is modules now, and
    // Chrome won't load modules from file://, so the maker's copy is served on localhost)
    const localCopy = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    seedMyKeys = localCopy && !(data.keybinds && data.keybinds.presets && data.keybinds.presets.length);
    m = mineOf(); delete m.buildsGone; // an old draft may predate builds added since: never read those as removed
    if (Object.keys(m).length > 1) ls.set(K.mine, m);
    ls.del(K.draft); ls.del(K.priceDraft);
  }
  applyMine(m);
}

export const saved = ls.get(K.saved) || {};
export const openSet = new Set(ls.get(K.open) || []);

// every change is kept at once, in this browser (the names stay from when there was a Save button)
export function setDirty() {
  if (fileData && pricesFile) ls.set(K.mine, mineOf()); // without the files there is nothing to compare with: keep what was there
  else noticeLine("A data file didn't load, so this change can't be kept. Reload the page.", []);
  if (area === "home" && PAGES.home) setTimeout(PAGES.home.draw, 0); // Home sums everything up: after any change it is drawn again (after the change's own redraw)
}
export const setPricesDirty = setDirty;

// "H416 1 Budget", "H416 1B Budget", "MP-133 4 Troll", "MP-133 4B Thermal"
// a build can carry its own name; otherwise the name is built from weapon, tier and position
export function saveName(weapon, tier, i, build) {
  if (build && build.name) return build.name;
  return autoName(weapon, tier, i, build);
}
export function autoName(weapon, tier, i, build) {
  const t = TIERS.find(x => x.key === tier) || { n: "", label: tier || "Build" }; // an unknown tier never breaks the page
  const letter = i === 0 ? "" : String.fromCharCode(65 + i);
  const word = tier === "misc" ? (build && build.label ? build.label : "Misc") : t.label;
  return `${weapon} ${t.n}${letter} ${word}`;
}
// a build's cost in thousands: "245k", "1.2M", "245" (k assumed) or in full Koen "245000" / "1,200,000"
export function costNum(c) {
  if (!c) return null;
  const m = String(c).trim().match(/^([\d.,\s]+)\s*([kKmM]?)/);
  if (!m) return null;
  const raw = m[1].trim(), unit = m[2].toLowerCase();
  // thousands separators (1,200,000 or 1 200 000) vs a decimal comma (1,5k)
  const grouped = /^\d{1,3}([,\s]\d{3})+$/.test(raw);
  const v = parseFloat(grouped ? raw.replace(/[,\s]/g, "") : raw.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return null;
  if (unit === "m") return v * 1000;
  if (unit === "k") return v;
  return v >= 10000 ? v / 1000 : v; // no unit: a big number is in Koen, a small one in thousands
}
// prices in thousands, written like everywhere else on the page (245k, 1.06M)
export const fmtK = v => fmtKoen(Math.round(v * 1000));
// a build's cost as typed ("150K", "150 000") shown the same way as every other price
export const fmtCost = c => (costNum(c) != null ? fmtK(costNum(c)) : c);

/* ---------- tooltips: one look for every hover hint on the page ----------
   Give any element a title="…" or data-tip="…" and it gets this tooltip; nothing else to write.
   data-tip-anchor on a child places the tip under that child instead (e.g. the action name in a keybind row). */
// a popover, so it sits in the browser's top layer: over an open overlay too, not under it
export const tipBox = el("div", "tip"); tipBox.setAttribute("role", "tooltip"); tipBox.setAttribute("popover", "manual"); tipBox.hidden = true; document.body.append(tipBox);
export const tipLayer = on => { if (!tipBox.showPopover) return; try { if (tipBox.matches(":popover-open")) tipBox.hidePopover(); if (on) tipBox.showPopover(); } catch (e) { /* not supported */ } };
export let tipFor = null;
export function showTip(node) {
  if (node.hasAttribute("title")) { node.dataset.tip = node.getAttribute("title"); node.removeAttribute("title"); } // no native tooltip on top
  const text = node.dataset.tip; if (!text) return;
  tipFor = node; tipBox.textContent = text; tipBox.hidden = false; tipLayer(true); // shown again each time, so it lands above the newest overlay
  const r = (node.querySelector("[data-tip-anchor]") || node).getBoundingClientRect();
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  let top = r.bottom + 6; if (top + h > innerHeight - 8) top = r.top - h - 6;
  tipBox.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px"; tipBox.style.top = top + "px";
}
export const hideTip = () => { tipLayer(false); tipBox.hidden = true; tipFor = null; };
export const tipTarget = t => t && t.closest && t.closest("[data-tip],[title]");
// touch screens have no hover: a tap on something that only informs (the ⓘ, a label, a number) shows its tip for a few
// seconds; a tap on something that acts (a button, a card) just acts. The mouse events a tap fakes right after are ignored
export let touchAt = 0, tipTimer = 0;
export const acts = n => n.matches(".g-info") ? false : !!n.closest("button, a, input, select, textarea, label, [role=button], [role=tab], .mc-scard, .pr-box");
document.addEventListener("pointerdown", e => {
  if (e.pointerType !== "touch") return;
  touchAt = Date.now(); clearTimeout(tipTimer); hideTip();
  const n = tipTarget(e.target);
  if (n && !acts(n)) { showTip(n); tipTimer = setTimeout(hideTip, 3500); }
}, true);
export const fromTouch = () => Date.now() - touchAt < 900;
document.addEventListener("mouseover", e => { if (fromTouch()) return; const n = tipTarget(e.target); if (n && n !== tipFor) showTip(n); else if (!n && tipFor) hideTip(); });
document.addEventListener("mouseout", e => { if (fromTouch()) return; if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });
document.addEventListener("focusin", e => { if (fromTouch()) return; const n = tipTarget(e.target); if (n) showTip(n); });
document.addEventListener("focusout", hideTip);
document.addEventListener("mousedown", () => { if (!fromTouch()) hideTip(); });
document.addEventListener("scroll", hideTip, { passive: true, capture: true }); // any scroll, the page or a list

export function safely(part, fn) {
  try { fn(); } catch (e) { console.error(part, e); notice.hidden = false; notice.append(el("div", "notice-line", `Part of the page (${part}) couldn't load because of a bad entry in the data. The rest still works.`)); }
}

/* ---------- copy ---------- */
export async function copy(btn, text, box) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents(box);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    try { document.execCommand("copy"); } catch (_) {}
  }
  btn.textContent = "Copied"; btn.classList.add("done");
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1100);
}
export function copyLine(value, cls, what) {
  const line = el("div", "line");
  const box = el("span", "key " + cls, value);
  const b = el("button", "copy", "Copy"); b.type = "button";
  b.setAttribute("aria-label", `Copy ${what}: ${value}`);
  b.addEventListener("click", () => copy(b, value, box));
  line.append(box, b);
  return line;
}

/* ---------- render ---------- */
export const nav = $("cats");
export const list = $("list");

/* ---------- tabs (one category at a time, remembered across reloads) ---------- */
export let tab = ls.get(K.tab);
export const SHORT = { "Assault Rifles": "Assault", "Submachine Guns": "SMG", "Marksman Rifles": "Marksman", "Bolt-Action Rifles": "Bolt-Action", "Light Machine Guns": "LMG", "Pistol": "Pistols" };
export let sortMode = ["so1o", "tiers"].includes(ls.get(K.sort)) ? ls.get(K.sort) : "gunsmith";
export const scrolls = ls.get(K.scroll) || {};
// the Builds page changes these: a module can read them, only this file can assign them
export function setTabId(id) { tab = id; ls.set(K.tab, tab); }
export function setSortMode(v) { sortMode = v; ls.set(K.sort, v); }

// small line icons in the text colour, for buttons and badges
export const ICON_PATHS = {
  edit: "M2.5 13.5l.8-3.3 7.6-7.6 2.5 2.5-7.6 7.6-3.3.8zM9.6 3.9l2.5 2.5",
  chart: "M2 13.5h12M3 10.5l3-3.5 3 2 4.5-5.5",
  gear: "M3 5.5h10l-1 8H4zM6 5.5V4a2 2 0 0 1 4 0v1.5",
  medal: "M8 14.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM5.2 7.6L3.5 1.5h3l1.5 4M10.8 7.6l1.7-6.1h-3L8 5.5",
  share: "M11.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.5 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11.5 14.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6.3 7l3.4-2M6.3 9l3.4 2",
  copy: "M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3",
  gun: "M1.5 6.5h11l1.5-1.5h1v3h-6l-1 2.5h-2l.5-2.5h-5zM8 8.5l-.5 3.5h-2.5l1-3.5",
  bag: "M3.5 5.5h9l-1 9h-7zM6 5.5V4a2 2 0 0 1 4 0v1.5M5.5 9h5",
  shield: "M8 1.5l5.5 2v4.5c0 3.2-2.4 5.6-5.5 6.5-3.1-.9-5.5-3.3-5.5-6.5V3.5z",
  map: "M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5zM5.5 2v10M10.5 4v10",
  key: "M1.5 4.5h13v7h-13zM4 7h1M7 7h1M10 7h1M4.5 9.5h7",
  route: "M3.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3.5 10.5V8c0-1.5 1-2.5 2.5-2.5h2c1.5 0 2.5-1 2.5-2.5",
  undo: "M5.5 3.5L2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8h-2",
  swap: "M4.5 2.5v11M2 11l2.5 2.5L7 11M11.5 13.5v-11M9 5l2.5-2.5L14 5",
  trash: "M2.5 4.5h11M6 4.5V2.5h4v2M4 4.5l.8 9.5h6.4l.8-9.5",
  exit: "M7.5 2.5h-5v11h5M10 5l3 3-3 3M13 8H5.5",
  save: "M3.5 2.5h7l2 2v9h-9zM5.5 2.5v3h4v-3M5.5 13.5v-4h5v4",
  layers: "M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3",
  plus: "M8 3.5v9M3.5 8h9",
  minus: "M3.5 8h9",
  download: "M8 2.5v8M4.5 7l3.5 3.5L11.5 7M3 13.5h10",
  screen: "M1.5 2.5h13v8.5h-13zM5.5 14h5M8 11v3",
  upload: "M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10",
  check: "M3 8.5l3.2 3L13 4.5",
  info: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 7.2v4.3M8 4.6v.4",
  pickup: "M8 12V2.5M4.5 6L8 2.5 11.5 6M3 14.5h10",
  rotate: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3",
  drop: "M8 2v9.5M4.5 8L8 11.5 11.5 8M3 14.5h10",
  collapse: "M9.5 3.5L5 8l4.5 4.5M13 3v10",
  clock: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 4.5V8l2.5 1.5",
  tiers: "M2.5 3.5h3M2.5 8h3M2.5 12.5h3M7.5 3.5h6M7.5 8h4M7.5 12.5h2",
  star: "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
};
export function icon(n) {
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
  svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("ico");
  p.setAttribute("d", ICON_PATHS[n]); svg.append(p);
  return svg;
}

// "350k", "1.2M", "245 000" -> 350000 ...
export function parseKoen(s) {
  const m = String(s).trim().replace(/[\s,]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2].toLowerCase() === "m" ? 1e6 : m[2].toLowerCase() === "k" ? 1e3 : 1);
  return Math.round(v);
}
export function fmtKoen(v) {
  if (v == null) return "—";
  const k = Math.round(v / 100) / 10; // rounded first, so 999 950 reads 1M and not 1000k
  return k >= 1000 ? (Math.round(v / 1e4) / 100) + "M" : v >= 1e3 ? k + "k" : String(v);
}
