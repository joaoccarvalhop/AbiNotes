/* The gear overlay: a helmet, armor, rig… with its stats, price and where to get it. */
import { $, data, el, icon, TIERS } from "../base.js";
import { COMBOS, extraByName, fullName, GEAR, GEAR_CAT, gearByName, gearOffers } from "../gear-data.js";
import { findBuild, LO_SLOTS, loLevel } from "../loadouts-data.js";
import { marketItemFor } from "../market-data.js";
import { thumb, wireDialog } from "../ui.js";
import { openLoadout } from "./loadout.js";
import { openPrice, openPriceEdit } from "./price.js";
import { closeGear } from "./weapon.js";

/* ---------- gear detail overlay ---------- */
export const gm = $("gearmodal");
// wired here, where gm is made (closeGear is a function declaration in weapon.js: it exists before that module runs)
wireDialog(gm, closeGear, "gm-close");
export function gearInfo(name) {
  const g = gearByName(name);
  const offers = g ? gearOffers(g) : [];
  // rank by the best price per point: among the same kind and tier, and among the same kind at any tier
  let rank = null;
  // (an offer without a usable durability has no price per point and doesn't count: it would rank as free)
  const best = x => Math.min(...gearOffers(x).map(o => o.ppd).filter(v => v != null));
  if (g && isFinite(best(g))) {
    const all = GEAR.filter(x => x.kind === g.kind && isFinite(best(x))).sort((a, b) => best(a) - best(b));
    const peers = all.filter(x => x.tier === g.tier);
    rank = { pos: peers.indexOf(g) + 1, of: peers.length, allPos: all.indexOf(g) + 1, allOf: all.length };
  }
  const combos = [];
  COMBOS.forEach(([group, , list]) => list.forEach(([helmet, armor, pro, con]) => {
    const hs = helmet.split(" / ").map(fullName);
    if (g && hs.includes(g.name)) combos.push({ group, other: fullName(armor), pro, con });
    else if (g && fullName(armor) === g.name) combos.push({ group, other: hs[0], otherLabel: helmet.split(" / ").map(fullName).join(" / "), pro, con });
  }));
  return { g, offers, rank, combos };
}
// "Update price" (the form, in the same overlay with ← Back) and "Price history" (the market overlay) for any piece of gear; sits in the overlay's header
export function marketTools(name, cat) {
  const box = el("div", "gm-tools");
  const it = marketItemFor(name, cat);
  const upd = el("button", null, it ? "Update price" : "Add price"); upd.type = "button"; upd.prepend(icon("edit"));
  upd.addEventListener("click", () => openPriceEdit(it, it ? null : { name, cat, group: "Equipment" }));
  box.append(upd);
  if (it) { const hist = el("button", null, "Price history"); hist.type = "button"; hist.prepend(icon("chart")); hist.addEventListener("click", () => openPrice(it.id)); box.append(hist); }
  return box;
}
// the same, from a gear name alone (the "Add price" in tables and loadouts)
export function editPriceFor(name) {
  const g = gearByName(name), x = !g && extraByName(name);
  const cat = g ? GEAR_CAT[g.kind] : x ? x.cat : null, full = g ? g.name : x ? x.name : name;
  const it = marketItemFor(full, cat);
  openPriceEdit(it, it ? null : { name: full, cat: cat || "Other", group: "Equipment" });
}
// "Used in" — the loadouts that wear this piece, in a tab of its own so the info stays short; each one opens with ← Back.
// Call it last, once the body holds everything else
export function usedIn(name, body) {
  const los = (data.loadouts || []).filter(l => LO_SLOTS.some(([k]) => l[k] === name));
  if (!los.length) return;
  const info = el("div", "gm-panel"), used = el("div", "gm-panel");
  const tools = body.firstChild && body.firstChild.classList && body.firstChild.classList.contains("gm-tools") ? body.firstChild : null; // price buttons stay above the tabs
  if (tools) tools.remove();
  info.append(...body.childNodes);
  if (tools) body.append(tools);
  used.append(loadoutList(los));
  gmTabs(body, [["Info", info], [`Used in ${los.length} loadout${los.length === 1 ? "" : "s"}`, used]]);
}
// tabs over panels that share one cell, so the overlay is as tall as the biggest one and keeps its size from tab to tab
export function gmTabs(body, tabs) {
  const nav = el("nav", "g-jump gm-tabs"); nav.setAttribute("role", "tablist");
  const panels = el("div", "gm-panels");
  const all = tabs.map(([label, panel], i) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "tab");
    const show = on => { b.setAttribute("aria-selected", String(on)); panel.classList.toggle("off", !on); panel.inert = !on; };
    b.addEventListener("click", () => { all.forEach(s => s(false)); show(true); body.scrollTop = 0; });
    show(i === 0);
    nav.append(b); panels.append(panel);
    return show;
  });
  body.append(nav, panels);
}
export function loadoutList(los) {
  const list = el("div", "gm-combos");
  los.forEach(lo => {
    const b = el("button", "gm-combo"); b.type = "button";
    const w = findBuild(lo.build, lo.gun);
    b.append(w ? thumb(w.gun) : el("span"), el("span", "gm-cname"));
    b.lastChild.append(el("b", null, lo.name), el("small", null, `${lo.gun} · ${TIERS.find(t => t.key === loLevel(lo))?.label || ""}`));
    b.addEventListener("click", () => openLoadout(data.loadouts.indexOf(lo)));
    list.append(b);
  });
  return list;
}
