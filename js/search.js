/* Search everything (the box in the top bar): weapons, loadouts, gear, market items and the key doors on the maps,
   each opening where it lives. */
import { goToWeapon } from "../app.js";
import { $, data, el, fmtKoen, market, norm, plural, TIERS } from "./base.js";
import { EXTRA, EXTRA_KIND, GEAR, GEAR_KIND, gearImg } from "./gear-data.js";
import { loLevel } from "./loadouts-data.js";
import { catLabel, itemImg, latest } from "./market-data.js";
import { openLoadout } from "./overlays/loadout.js";
import { openPrice } from "./overlays/price.js";
import { openGear } from "./overlays/weapon.js";
import { allMaps, mapDoors, openMarkerOnMap } from "./page-data.js";
import { closeDialog, navCur, present, thumb, wireDialog } from "./ui.js";

/* ---------- search everything: weapons, loadouts, gear, market items and the key doors on the maps, each opens where it lives ---------- */
export const GS_GROUPS = ["Weapons", "Loadouts", "Gear", "Market", "Maps"];
// every match, grouped in that order, the best first in each (starts with before contains)
export function gsResults(v) {
  const n = norm(v), out = [];
  if (n.length < 2) return out;
  const add = (group, label, sub, open, node) => { if (norm(label).includes(n)) out.push({ group, label, sub, open, node }); };
  data.categories.forEach(c => c.weapons.forEach(g => add("Weapons", g.name, `${c.name} · ${plural(g.builds.length, "build")}`, () => goToWeapon(g.name), () => thumb(g))));
  (data.loadouts || []).forEach((lo, i) => add("Loadouts", lo.name, `${lo.gun} · ${TIERS.find(t => t.key === loLevel(lo))?.label || ""}`, () => openLoadout(i)));
  [...GEAR, ...EXTRA].forEach(x => add("Gear", x.name, (GEAR_KIND[x.kind] || EXTRA_KIND[x.kind]) + (x.tier ? " · T" + x.tier : ""), () => openGear(x.name), () => gearImg(x.name)));
  const gearNames = new Set([...GEAR, ...EXTRA].map(x => x.name));
  market.items.forEach(it => { if (!gearNames.has(it.name)) add("Market", it.name, `${catLabel(it.cat)} · ${fmtKoen(latest(it.id)?.price)}`, () => openPrice(it.id), () => itemImg(it)); });
  mapDoors().forEach(d => add("Maps", d.mk.n, `Key door · ${d.map}${d.mk.l ? " · " + d.mk.l : ""}`, () => openMarkerOnMap(d.slug, d.mk), () => {
    const s = el("span", "g-img"), im = new Image(); im.alt = ""; im.className = "ok";
    im.src = d.mk.ic || ((ABI_MAPS[d.slug].categories || {}).Key || {}).ic || ""; s.append(im); return s;
  }));
  return GS_GROUPS.flatMap(gr => out.filter(r => r.group === gr).sort((a, b) => (norm(b.label).startsWith(n) - norm(a.label).startsWith(n)) || a.label.localeCompare(b.label)));
}
// a result as a row: picture, name, what it is
export function gsRow(h, active, onPick) {
  const o = el("div", "pk-opt gs-opt" + (active ? " active" : "")); o.setAttribute("role", "option");
  const txt = el("span", "g-label"); txt.append(el("b", null, h.label), el("small", null, h.sub));
  o.append(h.node ? h.node() : el("span", "g-img none", h.group[0]), txt);
  o.addEventListener("mousedown", e => { e.preventDefault(); onPick(); });
  return o;
}
// all the results in an overlay, with a tab per group
export let saTab = "All";
export function openSearchAll(v) {
  const dlg = $("searchall");
  if (!dlg.wired) { dlg.wired = true; wireDialog(dlg, () => closeDialog(dlg), "searchall-x"); }
  const top = $("searchall-top"), body = $("searchall-body"); top.textContent = ""; body.textContent = "";
  const inp = el("input"); inp.type = "search"; inp.value = v; inp.placeholder = "Search everything"; inp.autocomplete = "off"; inp.setAttribute("aria-label", "Search everything");
  const tabs = el("div", "g-seg"); tabs.setAttribute("aria-label", "Show");
  top.append(inp, tabs);
  const draw = () => {
    const all = gsResults(inp.value.trim()), count = g => all.filter(r => r.group === g).length;
    if (saTab !== "All" && !count(saTab)) saTab = "All";
    tabs.textContent = "";
    ["All", ...GS_GROUPS].forEach(g => {
      const nn = g === "All" ? all.length : count(g), b = el("button", null, `${g} ${nn}`); b.type = "button";
      b.setAttribute("aria-pressed", String(g === saTab)); b.disabled = !nn && g !== "All";
      b.addEventListener("click", () => { saTab = g; draw(); });
      tabs.append(b);
    });
    $("searchall-sub").textContent = inp.value.trim().length < 2 ? "Type at least two letters." : `${plural(all.length, "result")} for "${inp.value.trim()}"`;
    body.textContent = ""; body.scrollTop = 0;
    const shown = saTab === "All" ? all : all.filter(r => r.group === saTab);
    if (!shown.length) { if (inp.value.trim().length >= 2) body.append(el("div", "wp-none", "Nothing matches your search.")); return; }
    let last = "";
    shown.forEach(h => {
      if (saTab === "All" && h.group !== last) { body.append(el("div", "wp-cat", h.group)); last = h.group; }
      body.append(gsRow(h, false, () => {
        h.open(); // an overlay takes this one's place (with ← Back to it); a page or the map does not, so this one closes
        if (dlg.open && navCur && navCur.dlg === dlg) closeDialog(dlg);
      }));
    });
  };
  inp.addEventListener("input", draw);
  allMaps(() => { if (dlg.open && top.contains(inp)) draw(); }); // the key doors, once the maps are in
  draw();
  present(dlg, "Search", () => openSearchAll(inp.value.trim()));
  inp.focus();
}
(function globalSearch() {
  const box = $("gsearch"), q = box.querySelector("input"), pop = box.querySelector(".gs-pop");
  let active = 0, hits = [], total = 0;
  // a few per group here; the rest behind "See all"
  const results = v => {
    const all = gsResults(v); total = all.length;
    return GS_GROUPS.flatMap(gr => all.filter(r => r.group === gr).slice(0, gr === "Market" ? 6 : 4));
  };
  const more = () => total > hits.length;
  const draw = () => {
    pop.textContent = "";
    if (!hits.length) { pop.append(el("div", "wp-none", "Nothing matches your search.")); return; }
    let last = "";
    hits.forEach((h, i) => {
      if (h.group !== last) { pop.append(el("div", "wp-cat", h.group)); last = h.group; }
      pop.append(gsRow(h, i === active, () => pick(i)));
    });
    if (more()) {
      const b = el("button", "gs-more" + (active === hits.length ? " active" : ""), `See all ${total} results`); b.type = "button";
      b.addEventListener("mousedown", e => { e.preventDefault(); pick(hits.length); });
      pop.append(b);
    }
  };
  const close = () => { pop.hidden = true; box.classList.remove("open"); };
  const pick = i => {
    if (i === hits.length && more()) { const v = q.value.trim(); close(); q.value = ""; q.blur(); openSearchAll(v); return; }
    const h = hits[i]; if (!h) return; close(); q.value = ""; q.blur(); h.open();
  };
  const refresh = () => {
    const v = q.value.trim();
    if (v.length < 2) { close(); return; }
    hits = results(v); active = Math.min(active, hits.length - (more() ? 0 : 1)); draw(); pop.hidden = false; box.classList.add("open");
  };
  q.addEventListener("input", () => { active = 0; refresh(); });
  q.addEventListener("focus", () => allMaps(() => { if (!pop.hidden) refresh(); })); // the key doors, once the maps are in
  q.addEventListener("keydown", e => {
    if (pop.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(hits.length - (more() ? 0 : 1), active + 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { close(); }
  });
  q.addEventListener("blur", () => setTimeout(close, 120));
})();
