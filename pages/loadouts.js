/* The Loadouts page: its filter box and the list of loadouts. Loaded the first time it opens (loadPage in app.js).
   The loadouts themselves (cost, level, favourites, the filters' state) and the overlays are in app.js: Home, Share,
   search and the weapon overlay use them. renderLoadouts() in app.js redraws this page when it is in. */
import { registerPage, renderLoadouts } from "../app.js";
import { $, button, data, el, fmtK, isMine, norm, SHORT } from "../js/base.js";
import { favButton, findBuild, isFav, LEVEL_TIP, levelOf, LO_MAPS, LO_SLOTS, LO_SORTS, LO_STYLES, LO_TIERS, loCost, loF, loFiltered, loKind, loLevelChip, loProt, loSlot, loTier, saveLoF, setLoTier } from "../js/loadouts-data.js";
import { ammoBadges, openLoadout, openLoEditor } from "../js/overlays/loadout.js";
import { tlLoChip, tlLoScore } from "../js/rankings.js";
import { ddSelect, filterBox, rangeFilter, thumb } from "../js/ui.js";

// count and Clear on top; cost range, the filter groups and Sort by below. Built once, then only synced
export function loFilterPanel() {
  const wrap = el("div"); wrap.id = "lo-filters";
  const syncs = [];
  const sort = ddSelect("Sort by", LO_SORTS, () => loF.sort, v => { loF.sort = v; saveLoF(); renderLoadouts(true); });
  const box = filterBox(), group = box.group;

  // cost: the shared money range, in k
  const cost = rangeFilter("total cost", fmtK, (lo, hi) => { loF.min = lo; loF.max = hi; saveLoF(); renderLoadouts(true); });
  syncs.push(() => {
    const top = Math.max(500, Math.ceil(Math.max(0, ...data.loadouts.map(x => loCost(x).total)) / 500) * 500);
    cost.set(loF.min, loF.max, top, 50);
  });
  group("Total cost", cost, "Weapon build plus gear, at market prices");

  // a group of toggles; its options can come from the loadouts themselves (a function), and are read again on every sync,
  // so a loadout with a new weapon kind or armor tier gets its button
  const multi = (label, key, opts, tip) => {
    const seg = el("div", "g-seg");
    let shown = "";
    const build = list => {
      seg.textContent = ""; shown = JSON.stringify(list);
      list.forEach(([v, t]) => {
        const btn = el("button", null, t); btn.type = "button"; btn.dataset.v = v;
        btn.addEventListener("click", () => { const arr = loF[key], i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); saveLoF(); renderLoadouts(true); });
        seg.append(btn);
      });
    };
    syncs.push(() => {
      const list = typeof opts === "function" ? opts() : opts;
      if (JSON.stringify(list) !== shown) build(list);
      seg.querySelectorAll("button").forEach(btn => btn.setAttribute("aria-pressed", String(loF[key].includes(btn.dataset.v))));
    });
    group(label, seg, tip);
  };
  multi("Weapon", "kind", () => data.categories.filter(c => c.weapons.some(g => data.loadouts.some(l => l.gun === g.name))).map(c => [c.name, SHORT[c.name] || c.name]));
  multi("Map", "map", LO_MAPS.map(t => [t, t]));
  multi("Style", "style", LO_STYLES.map(t => [t, t]));
  multi("Armor", "prot", () => [...new Set(data.loadouts.map(loProt).filter(Boolean))].sort().map(t => [t, "T" + t]), "Tier of the body armor or armored rig");
  const clear = box.clear(() => { Object.assign(loF, { min: 0, max: null, kind: [], map: [], style: [], prot: [] }); saveLoF(); renderLoadouts(true); });
  box.sort(sort);

  wrap.append(box);
  wrap.sync = () => {
    clear.hidden = !loFiltered();
    sort.sync(); syncs.forEach(f => f());
  };
  return wrap;
}

// the list (renderLoadouts in app.js calls this when the loadouts change)
function drawLoadouts(quiet) {
  if (!Array.isArray(data.loadouts)) data.loadouts = [];
  const sec = $("loadouts");
  let panel = $("lo-filters"), res = $("lo-results");
  if (!panel) { sec.textContent = ""; panel = loFilterPanel(); res = el("div"); res.id = "lo-results"; sec.append(panel, res); }
  res.textContent = "";
  const q = norm(($("lo-q") && $("lo-q").value || "").trim());
  const any = (want, have) => !want.length || want.some(v => have.includes(v));
  const rows = data.loadouts.map((lo, i) => { const cost = loCost(lo).total; return { lo, i, cost, level: cost ? levelOf(cost) : lo.tier || "budget" }; });
  const order = {
    default: (x, y) => x.i - y.i, cheap: (x, y) => x.cost - y.cost || x.i - y.i, dear: (x, y) => y.cost - x.cost || x.i - y.i,
    new: (x, y) => (y.lo.added || "").localeCompare(x.lo.added || "") || y.i - x.i, az: (x, y) => x.lo.name.localeCompare(y.lo.name),
    tiers: (x, y) => (tlLoScore(y.lo) ?? -1) - (tlLoScore(x.lo) ?? -1) || x.i - y.i, // the best average first; none ranked go last
  }[loF.sort] || ((x, y) => x.i - y.i);
  const list = rows.filter(({ lo, cost, level }) => (loTier === "all" || (loTier === "fav" ? isFav(lo) : loTier === "mine" ? isMine(lo) : level === loTier))
    && (!q || norm([lo.name, lo.gun, lo.author, lo.ammo, ...(lo.tags || [])].join(" ")).includes(q))
    && cost >= loF.min && (loF.max == null || cost <= loF.max)
    && any(loF.kind, [loKind(lo)]) && any(loF.map, lo.tags || []) && any(loF.style, lo.tags || []) && any(loF.prot, [loProt(lo)]))
    .sort((x, y) => (isFav(y.lo) - isFav(x.lo)) || order(x, y)); // favourites first
  panel.sync(list.length);
  if (!list.length) {
    res.append(el("p", "nores", loTier === "fav" && !data.loadouts.some(isFav) ? "No favorites yet. Click the star on a loadout to keep it here."
      : loTier === "mine" && !data.loadouts.some(isMine) ? "None of yours yet. Add a loadout, or edit any of them to keep your own copy."
      : !data.loadouts.length ? "No loadouts yet. Make the first one with Add loadout." : loFiltered() ? "No loadout matches these filters." : "No loadout matches your search."));
    return;
  }
  const grid = el("div", "lo-grid" + (quiet === true ? " quiet" : ""));
  list.forEach(({ lo, level }, i) => {
    const card = el("article", "lo-card " + level); card.tabIndex = 0; card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open loadout ${lo.name}`);
    card.style.animationDelay = Math.min(i * 30, 300) + "ms";
    const top = el("header", "lo-top");
    const t = el("div", "lo-title"); t.append(el("h3", null, lo.name), loLevelChip(lo), favButton(lo, () => { if (loTier === "fav") renderLoadouts(true); }));
    card.classList.toggle("is-fav", isFav(lo));
    const tags = el("div", "lo-tags"); (lo.tags || []).forEach(x => tags.append(el("span", null, x)));
    top.append(t, tags);
    const w = findBuild(lo.build, lo.gun);
    const gun = el("div", "lo-gun");
    if (w) {
      const box = el("div", "lo-gname"); box.append(el("b", null, w.gun.name), el("small", null, w.build ? w.name : "This build was removed"));
      gun.append(thumb(w.gun), box, ammoBadges(lo.ammo, w.gun.name));
    } else gun.append(el("div", "lo-gname", "Weapon not found"));
    const kit = el("div", "lo-kit");
    LO_SLOTS.forEach(([k]) => kit.append(loSlot(k, lo[k], lo)));
    const foot = el("footer", "lo-foot");
    const cost = loCost(lo);
    const tc = el("span", "lo-cost", cost.total ? fmtK(cost.total) + (cost.missing ? "+" : "") : "");
    if (cost.missing) tc.dataset.tip = "Some gear has no known price, so the real total is higher";
    foot.append(el("span", "lo-by", lo.author ? "by " + lo.author : "Unknown author"));
    if (loF.sort === "tiers") { const tlc = tlLoChip(lo); if (tlc) foot.append(tlc); } // sorted by your tier list: why it sits here
    foot.append(tc);
    card.append(top, gun, kit, foot);
    const open = () => openLoadout(data.loadouts.indexOf(lo));
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    grid.append(card);
  });
  res.append(grid);
}

/* sub-bar: tier tabs, search, new */
(function loBar() {
  const bar = $("sub-loadouts");
  const nav = el("nav", "g-jump"); nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "Loadout levels");
  [["all", "All"], ["fav", "Favorites"], ["mine", "Yours"], ...LO_TIERS.map(t => [t.key, t.label])].forEach(([k, label]) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.k = k;
    if (LO_TIERS.some(t => t.key === k)) b.title = LEVEL_TIP;
    b.addEventListener("click", () => { setLoTier(k); mark(); drawLoadouts(); });
    nav.append(b);
  });
  const mark = () => nav.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.k === loTier)));
  const tools = el("div", "tools");
  const q = el("input"); q.id = "lo-q"; q.type = "search"; q.placeholder = "Search loadout…"; q.autocomplete = "off"; q.setAttribute("aria-label", "Search loadouts");
  q.addEventListener("input", () => renderLoadouts(true));
  const add = button("Add loadout", { icon: "plus", onClick: () => openLoEditor(-1) });
  tools.append(q, add);
  bar.append(nav, tools);
  mark();
})();


// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("loadouts", { draw: drawLoadouts });
