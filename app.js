/* ABI Hub: the entry module (index.html and every page load it). It holds the router (pages, history, View
   Transitions), the loader of the pages in their own file (pages/*.js), and the start.

   The rest of the core is in js/, in layers. A module may use, at load time, only what the layers below it define:
     js/base.js                    helpers, keys in the browser, motion, the data with yours on top, tooltips, icons
     js/gear-data.js, market-data.js, rankings.js, loadouts-data.js, keybinds-data.js, page-data.js   the data by theme
     js/ui.js                      overlays' wiring, confirm box, picker, dropdowns, filter boxes, toast
     js/overlays/*.js, share.js, search.js                                  what you open from anywhere
   Calls to a layer above happen only when something runs later (a click), never while a module loads: imports
   can go in a circle, and the module reached first runs before the one that asked for it. The imports below load
   them in that order on purpose. The pages (pages/*.js) import from here and js/; nothing here imports a page. */
import "./js/base.js";
import "./js/gear-data.js";
import "./js/market-data.js";
import "./js/rankings.js";
import "./js/loadouts-data.js";
import "./js/keybinds-data.js";
import "./js/page-data.js";
import "./js/ui.js";
import "./js/overlays/gear.js";
import "./js/overlays/weapon.js";
import "./js/overlays/loadout.js";
import "./js/overlays/price.js";
import "./js/overlays/add-build.js";
import "./js/share.js";
import "./js/search.js";
/* ---------- pages: Home / Builds / Maps … (top bar) ----------
   Each section is its own page (index.html, builds.html, maps.html …, made by
   tools/make_pages.py), so it has its own address, F5 stays on it and Back/Forward work.
   Every page is the same document: the sections are drawn by this script, not written in
   the HTML. So going from one page to another needs no fetch and no reload: setArea()
   shows the other section and changes the address (history.pushState), and go() wraps it
   in a View Transition so the bar stays put and only what is under it fades across.
   A real page load is only the first one, or Ctrl/middle click (a new tab). */
import { $, areaVisit, K, ls, nextAreaVisit, pageEl, reduceMotion, safely, scrolls, setTabId, slideRows, tab } from "./js/base.js";
import { fillGuns } from "./js/overlays/add-build.js";
import { refreshWeapon } from "./js/overlays/weapon.js";
export const AREAS_LIST = ["home", "builds", "loadouts", "market", "gear", "maps", "merchant", "smelter", "trading", "keybinds", "tiers"];
export const areaFile = a => (a === "home" ? "index.html" : a + ".html");
// github.io serves maps.html at /maps too, so the bar shows the clean address there;
// locally (file://, python -m http.server) nothing does, and the .html stays
export const CLEAN_URLS = /\.github\.io$/.test(location.hostname);
export function areaUrl(a) {
  const u = new URL(areaFile(a), location.href);
  if (CLEAN_URLS) u.pathname = u.pathname.replace(/index\.html$/, "").replace(/\.html$/, "");
  return u.pathname + u.search;
}
export function areaFromPath(p) {
  const m = /([\w-]+)(?:\.html)?\/?$/.exec(p.replace(/\/index(\.html)?$/, "/"));
  return m && AREAS_LIST.includes(m[1]) ? m[1] : "home";
}
export let area = document.body.dataset.area || areaFromPath(location.pathname);
if (tab === "gear" || tab === "keybinds") setTabId(null); // older saves kept these as weapon tabs
if (!AREAS_LIST.includes(area)) area = "home";
export const AREA_TITLE = {};
document.querySelectorAll("#areas a").forEach(a => { AREA_TITLE[a.dataset.area] = a.textContent.trim(); });
export const pageTitle = a => (a === "home" ? "ABI Hub" : AREA_TITLE[a] + " · ABI Hub");
// the first entry knows its page too, so coming back to it with Back finds it
try { history.replaceState({ area }, ""); } catch (e) { }
export const viewKey = () => (area === "builds" ? tab : area);
export function markAreas() {
  document.querySelectorAll("#areas a").forEach(b => {
    if (b.dataset.area === area) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  AREAS_LIST.forEach(a => { const s = $("sub-" + a); if (s) s.hidden = a !== area; }); // Home has no bar of its own
  if (area === "home") $("logo").setAttribute("aria-current", "page"); else $("logo").removeAttribute("aria-current");
  document.title = pageTitle(area);
}
export function setArea(a, { scroll = true, pop = false, animate = true } = {}) {
  if (a === area) return;
  const k = viewKey(); if (k) scrolls[k] = pageEl.scrollTop;
  area = a; nextAreaVisit(); ls.set(K.area, area); ls.set(K.scroll, scrolls);
  // a browser that refuses pushState (some do between files on file://) still changes page, only the address stays
  if (!pop) try { history.pushState({ area }, "", areaUrl(area)); } catch (e) { }
  markAreas(); showSections(animate);
  drawPage(area); // the pages in their own file (pages/*.js). Home is drawn each time: its numbers change as you edit
  if (scroll) pageEl.scrollTo({ top: scrolls[viewKey()] || 0, behavior: "instant" });
}
// a click that a person makes: the same page change, inside a View Transition. Without
// them (older browsers) or with reduced motion, the section's own .enter plays instead.
// A page in its own file is loaded FIRST, outside the transition, so the transition goes
// to the page already drawn (the way a router fetches before it swaps). A newer click
// while it loads wins.
export let goToken = 0;
export async function go(a, opts = {}) {
  if (a === area) return;
  const mine = ++goToken;
  if (PAGE_MODULES.has(a) && !pagesReady.has(a)) { await loadPage(a); if (mine !== goToken) return; }
  if (!document.startViewTransition || reduceMotion) { setArea(a, opts); return; }
  const t = document.startViewTransition(() => setArea(a, { ...opts, animate: false }));
  // a newer click while this one animates skips it, and its promises reject with AbortError: expected, not an error
  t.ready.catch(() => { }); t.updateCallbackDone.catch(() => { }); t.finished.catch(() => { });
}

/* ---------- pages in their own file (pages/<page>.js): loaded the first time they open, then kept ----------
   A page's module registers itself when it loads (registerPage) with what it offers the rest of the hub: draw,
   and whatever else others ask of it (Maps: open a route, a marker…). This file never imports a page, so the
   pages depend on the core and never the other way round. Some pages need a data file of their own first
   (classic scripts that set window.ABI_*): those load before the module, once even if two pages share one.
   A file that fails to load (merchant-sounds.js may be missing) doesn't stop the rest: the page says what it lacks. */
export const PAGE_MODULES = new Set(["home", "builds", "loadouts", "market", "gear", "tiers", "maps", "keybinds", "merchant", "smelter", "trading"]);
export const PAGE_DATA = {
  merchant: ["merchant.js", "merchant-ocr.js", "merchant-sounds.js"],
  smelter: ["merchant.js"], // the items' colours and pictures
};
export const PAGES = {};
export function registerPage(a, api) { PAGES[a] = api; }
// shared data that changes by commit: fetched anew each time, like builds.js and prices.js in index.html
export const FRESH = new Set(["merchant.js"]);
export function loadScript(src, done) {
  const s = document.createElement("script");
  s.src = src; s.onload = () => done(true); s.onerror = () => done(false);
  document.head.append(s);
}
export const scriptsIn = new Map(); // file -> a promise of whether it loaded
export const loadOnce = f => {
  if (!scriptsIn.has(f)) scriptsIn.set(f, new Promise(res => loadScript(FRESH.has(f) ? f + "?t=" + Date.now() : f, res)));
  return scriptsIn.get(f);
};
export const pagesReady = new Set();
// the builds changed: everything that shows them redraws. The Builds page (if it's in), the add-build overlay's weapon
// list, the loadouts (they show build names) and a weapon's overlay if one is open
export function render() {
  if (PAGES.builds) PAGES.builds.draw();
  fillGuns();
  renderLoadouts();
  refreshWeapon();
}
// the loadouts changed (or something they show: builds, prices, tiers): the Loadouts page redraws if it is in
export function renderLoadouts(quiet) { if (PAGES.loadouts) PAGES.loadouts.draw(quiet); }
// your tiers changed (Share brought some): the Tier list page redraws if it is in
export function tlDraw() { if (PAGES.tiers) PAGES.tiers.draw(); }
// the prices or tiers changed: the Gear page redraws if it is in
export function renderGear() { if (PAGES.gear) PAGES.gear.draw(); }
// the prices changed: the Market page redraws if it is in
export function renderMarket() { if (PAGES.market) PAGES.market.draw(); }
// a weapon in Builds, from a loadout's overlay: its tab, its row in view, its overlay open
export function goToWeapon(gunName) { withPage("builds", () => PAGES.builds?.goToWeapon(gunName)); }
export const pageLoads = new Map();
export function loadPage(a) {
  if (!pageLoads.has(a)) pageLoads.set(a, (async () => {
    for (const f of PAGE_DATA[a] || []) await loadOnce(f);
    try { await import(`./pages/${a}.js`); } catch (e) { console.error(`[pages] ${a}:`, e); }
    pagesReady.add(a);
  })());
  return pageLoads.get(a);
}
// draws a page that lives in its own file: now if it's in, else once it is (if you're still on it)
export function drawPage(a) {
  if (!PAGE_MODULES.has(a)) return;
  const draw = () => safely(AREA_TITLE[a], () => { if (!PAGES[a]) throw new Error("its file didn't load"); PAGES[a].draw(); });
  if (pagesReady.has(a)) { draw(); return; }
  loadPage(a).then(() => { if (area === a) { draw(); requestAnimationFrame(slideRows); } });
}
// runs something of a page's (open a route on the map…) once its file is in
export function withPage(a, fn) { if (pagesReady.has(a) || !PAGE_MODULES.has(a)) fn(); else loadPage(a).then(fn); }
// the bar's links (and the logo) are real links: a plain click stays in this page and
// changes section; Ctrl, Shift or middle click open the page in a new tab as usual
document.querySelector(".toolbar").addEventListener("click", e => {
  const l = e.target.closest("a[data-area]");
  if (!l || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go(l.dataset.area);
});
document.querySelectorAll("#areas a").forEach(b => {
  b.addEventListener("keydown", e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const all = [...document.querySelectorAll("#areas a")], i = all.indexOf(b);
    const next = all[(i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
    next.focus(); go(next.dataset.area);
  });
});
addEventListener("popstate", e => {
  const a = (e.state && e.state.area) || areaFromPath(location.pathname);
  if (AREAS_LIST.includes(a)) go(a, { pop: true });
});

export const searching = () => !!$("q").value.trim();
export function showSections(animate) {
  const s = searching();
  document.querySelectorAll("section.cat").forEach(sec => {
    const extra = AREAS_LIST.includes(sec.id);
    const vis = extra ? area === sec.id
      : area === "builds" && (s ? !!sec.querySelector("details.gun:not([hidden])") : sec.id === tab);
    const was = !sec.hidden;
    sec.hidden = !vis;
    if (vis && animate && !was && !reduceMotion) { sec.classList.remove("enter"); void sec.offsetWidth; sec.classList.add("enter"); }
  });
  if (PAGES.builds) PAGES.builds.sync(); // the filter box's count follows the tab
}
export let scrollT = 0;
pageEl.addEventListener("scroll", () => {
  clearTimeout(scrollT);
  scrollT = setTimeout(() => { const k = viewKey(); if (k && !searching()) { scrolls[k] = pageEl.scrollTop; ls.set(K.scroll, scrolls); } }, 150);
}, { passive: true });

// each part draws on its own: one bad record shows a note instead of stopping the whole page
safely("Sections", markAreas); safely("Builds", render);
showSections(false);
drawPage(area); // Merchant, Smelter, Trading: their file first
requestAnimationFrame(() => pageEl.scrollTo({ top: scrolls[viewKey()] || 0, behavior: "instant" }));
document.body.classList.remove("booting"); // drawn: the bars show now, already the right ones
requestAnimationFrame(slideRows); // phones: the tab rows' fades, and the section you left open in view
