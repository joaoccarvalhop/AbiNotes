/* The Builds page: the weapon categories (tabs), the filter box, the weapon search and the list itself. Loaded the
   first time it opens (loadPage in app.js). What other parts share stays in app.js: the build card and thumbnails
   (overlays use them), which tab and sort are on (tab, sortMode), and render(), which redraws everything that shows
   builds and calls this page's draw when it is in. */
import { area, registerPage, render, searching, setArea, showSections } from "../app.js";
import { $, bF, costNum, data, el, fmtK, K, list, ls, nav, norm, pageEl, reduceMotion, scrolls, setSortMode, setTabId, SHORT, slug, sortMode, tab, TIERS } from "../js/base.js";
import { openWeapon } from "../js/overlays/weapon.js";
import { tlOrder, tlRankAny } from "../js/rankings.js";
import { ddSelect, filterBox, thumb } from "../js/ui.js";
export let bPanel = null; // the filter box, made on the first draw

export function buildNav() {
  nav.textContent = "";
  if (!data.categories.some(c => slug(c.name) === tab)) setTabId(data.categories[0] ? slug(data.categories[0].name) : null);
  data.categories.forEach(c => {
    const b = el("button", null, SHORT[c.name] || c.name); b.type = "button"; b.setAttribute("role", "tab");
    b.title = c.name;
    b.dataset.id = slug(c.name); b.id = "tab-" + b.dataset.id;
    b.setAttribute("aria-controls", b.dataset.id);
    b.append(el("span", "n", String(c.weapons.length)));
    b.addEventListener("click", () => setTab(b.dataset.id));
    b.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const all = [...nav.querySelectorAll("button")]; const i = all.indexOf(b);
      const next = all[(i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
      next.focus(); setTab(next.dataset.id);
    });
    nav.append(b);
  });
  markTabs();
}


// go to a weapon in Builds: its category tab, row opened and scrolled into view
function goToWeapon(gunName) {
  const cat = data.categories.find(c => c.weapons.some(g => g.name === gunName)); if (!cat) return;
  if ($("q").value) { $("q").value = ""; applySearch(); }
  setArea("builds", { scroll: false });
  setTab(slug(cat.name));
  const d = [...document.querySelectorAll("details.gun")].find(x => x.dataset.name === gunName);
  if (!d) return;
  openWeapon(cat.weapons.find(g => g.name === gunName));
  setTimeout(() => { d.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); d.classList.remove("flash-row"); void d.offsetWidth; d.classList.add("flash-row"); }, 60);
}

export function markTabs() {
  nav.querySelectorAll("button").forEach(b => {
    const on = b.dataset.id === tab && !searching();
    b.setAttribute("aria-selected", String(on)); b.tabIndex = on || (!tab && b === nav.firstChild) ? 0 : -1;
  });
}

export function setTab(id) {
  if (searching()) { $("q").value = ""; applySearch(); }
  if (tab) scrolls[tab] = pageEl.scrollTop;
  setTabId(id); ls.set(K.scroll, scrolls);
  markTabs(); showSections(true);
  const y = scrolls[tab] || 0;
  pageEl.scrollTo({ top: y, behavior: "instant" });
}

/* Builds' filter box (the same as Loadouts'): which tiers a weapon has builds in, and Sort by. Built once, kept across
   renders. Its state (bF) is in app.js; the box itself (bPanel) is this page's, and showSections asks it to sync through PAGES */
export function bTierOk(d) { if (!bF.tiers.length) return true; const g = d._gun; return !!g && bF.tiers.some(t => g.builds.some(b => b.tier === t)); }
export function buildsFilterPanel() {
  const wrap = el("div"); wrap.id = "b-filters";
  const box = filterBox(), seg = el("div", "g-seg");
  TIERS.forEach(t => {
    const b = el("button", null, t.label); b.type = "button"; b.dataset.v = t.key;
    b.addEventListener("click", () => { const i = bF.tiers.indexOf(t.key); i < 0 ? bF.tiers.push(t.key) : bF.tiers.splice(i, 1); ls.set(K.builds, bF); applySearch(); });
    seg.append(b);
  });
  box.group("Has builds", seg, "Only weapons with at least one build in the levels you pick");
  const clear = box.clear(() => { bF.tiers = []; ls.set(K.builds, bF); applySearch(); });
  box.sort(ddSelect("Sort by", [["gunsmith", "Gunsmith", "Same order as in the game"], ["so1o", "So1o's ranking", "Best weapons first"], ["tiers", "My tier list", "Your order from Tier list"]],
    () => sortMode, v => { setSortMode(v); render(); showSections(true); }));
  wrap.append(box);
  wrap.sync = () => {
    wrap.hidden = area !== "builds"; // it sits in the page's main list: only Builds shows it
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(bF.tiers.includes(b.dataset.v))));
    clear.hidden = !bF.tiers.length;
  };
  return wrap;
}
// the categories' tabs and the list (render() in app.js calls this, with the rest that shows builds)
export function drawBuilds() {
  buildNav();
  list.textContent = "";
  if (!bPanel) bPanel = buildsFilterPanel();
  list.append(bPanel);
  data.categories.forEach(cat => {
    const sec = el("section", "cat"); sec.id = slug(cat.name);
    sec.setAttribute("role", "tabpanel"); sec.setAttribute("aria-labelledby", "tab-" + sec.id);
    const head = el("div", "cat-head");
    // the category name repeats the tab, so it only shows while searching across categories
    head.append(el("h2", "cat-name", cat.name), el("span", "spacer"));
    sec.append(head);

    const weapons = sortMode === "so1o" ? [...cat.weapons].sort((a, b) => (a.so1o || 999) - (b.so1o || 999))
      : sortMode === "tiers" ? [...cat.weapons].sort((a, b) => tlOrder("guns", a.name) - tlOrder("guns", b.name)) // stable: the unranked stay in game order
      : cat.weapons;
    weapons.forEach(g => {
      const d = el("details", "gun"); d.dataset.name = g.name; d._gun = g;
      if (!g.builds.length) d.classList.add("empty");
      const sum = el("summary");
      const nameBox = el("div", "gname");
      const tr = sortMode === "tiers" && tlRankAny("guns", g.name, true);
      const pos = sortMode === "so1o"
        ? (g.so1o ? `#${g.so1o} on So1o's list` : "Not on So1o's list")
        : sortMode === "tiers" ? (tr ? `${tr.tier} in your tier list` : "Not in your tier list")
        : `#${cat.weapons.indexOf(g) + 1} in Gunsmith`;
      nameBox.append(el("strong", null, g.name), el("span", null, pos));
      const chips = el("div", "chips");
      TIERS.forEach(t => {
        const c = g.builds.filter(b => b.tier === t.key).length;
        const chip = el("span", "chip " + t.key + (c ? "" : " zero"), t.label);
        chip.append(el("b", null, c ? String(c) : "0"));
        chip.title = `${t.label}: ${c} build${c === 1 ? "" : "s"}`;
        chips.append(chip);
      });
      chips.setAttribute("aria-label", TIERS.map(t => `${t.label} ${g.builds.filter(b => b.tier === t.key).length}`).join(", "));
      const costs = g.builds.filter(b => b.tier !== "misc").map(b => costNum(b.cost)).filter(v => v != null);
      const range = el("span", "range", costs.length ? (Math.min(...costs) === Math.max(...costs) ? fmtK(Math.min(...costs)) : `${fmtK(Math.min(...costs))} – ${fmtK(Math.max(...costs))}`) : (g.builds.length ? "" : "No builds yet"));
      sum.append(thumb(g), nameBox, chips, range);
      d.append(sum);
      // the builds open in the overlay, like gear and loadouts do
      sum.addEventListener("click", e => { e.preventDefault(); openWeapon(g); });
      sec.append(d);
    });
    list.append(sec);
  });
  applySearch();
}


/* ---------- search (the weapon search in Builds' own bar) ---------- */
export const q = $("q");
export function applySearch() {
  const v = norm(q.value.trim());
  list.classList.toggle("searching", !!v);
  let shown = [];
  document.querySelectorAll("details.gun").forEach(d => { const hit = (!v || norm(d.dataset.name).includes(v)) && bTierOk(d); d.hidden = !hit; if (hit && v) shown.push(d); });
  showSections(false);
  markTabs();
  $("nores").hidden = !(v && !shown.length && area === "builds");
  if (bPanel) bPanel.sync();
}
q.addEventListener("input", applySearch);
q.addEventListener("keydown", e => { if (e.key === "Escape") { q.value = ""; applySearch(); } });

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("builds", { draw: drawBuilds, sync: () => { if (bPanel) bPanel.sync(); }, goToWeapon });
