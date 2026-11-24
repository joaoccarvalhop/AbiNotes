/* Your tier list's rankings (S/A/B/C/D per kind): where things sit, the chips that show it, sorting by it. Builds,
   Gear, Loadouts, Home and Share use them; the Tier list page (pages/tiers.js) draws and edits them. */
import { render, renderGear, renderLoadouts, setArea, tlDraw } from "../app.js";
import { data, el, icon, K, ls, market, sortMode } from "./base.js";
import { EXTRA, fullName, GEAR, GEAR_KIND, gearImg, MARKET_ALIAS } from "./gear-data.js";
import { loF } from "./loadouts-data.js";
import { CONDS, itemByName, latest } from "./market-data.js";
import { gm } from "./overlays/gear.js";
import { openWeapon } from "./overlays/weapon.js";
import { closeDialog, thumb } from "./ui.js";

/* ---------- tier list: your own S/A/B/C/D ranking per kind (like ABI Builder's tier list maker). Builds, Loadouts and Gear can
   sort by it ("My tier list"); Share sends it. Stored by item name (gear by its full name) ---------- */
export const TL_KINDS = [
  { k: "guns", label: "Guns", items: () => data.categories.flatMap(c => c.weapons.map(w => ({ name: w.name, group: c.name, pic: () => thumb(w), open: () => openWeapon(w) }))) },
  // gear grouped by protection tier, the highest first (then by name)
  { k: "helmets", label: "Helmets", items: () => GEAR.filter(g => g.kind === "helmet").sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)).map(g => ({ name: g.name, group: "Tier " + g.tier, pic: () => gearImg(g.name) })) },
  { k: "armor", label: "Armor", items: () => GEAR.filter(g => g.kind !== "helmet").sort((a, b) => a.kind.localeCompare(b.kind) || b.tier - a.tier || a.name.localeCompare(b.name)).map(g => ({ name: g.name, group: GEAR_KIND[g.kind] + " · Tier " + g.tier, pic: () => gearImg(g.name) })) },
  { k: "rigs", label: "Chest rigs", items: () => EXTRA.filter(x => x.kind === "rig").map(x => ({ name: x.name, group: "", pic: () => gearImg(x.name) })) },
  { k: "packs", label: "Backpacks", items: () => EXTRA.filter(x => x.kind === "pack").map(x => ({ name: x.name, group: "", pic: () => gearImg(x.name) })) },
];
export const TL_ROWS = ["S", "A", "B", "C", "D"];
export const TL_COLORS = ["#d9574c", "#e0662f", "#d6a443", "#8fb35a", "#5b98cf", "#8d7fd6", "#80838a"]; // by row, top first
export const tl = Object.assign({ kind: "guns", lists: {} }, ls.get(K.tiers) || {});
export const saveTl = () => ls.set(K.tiers, tl);
export const tlList = k => tl.lists[k] || (tl.lists[k] = { rows: TL_ROWS.map(name => ({ name, items: [] })) });
export const tlCount = k => tl.lists[k] ? tl.lists[k].rows.reduce((s, r) => s + r.items.length, 0) : 0;
// where an item sits: its row (0 = top), its place in the row, the row's name
export function tlRank(k, name) {
  const L = tl.lists[k]; if (!L || !name) return null; const n = fullName(name);
  for (let i = 0; i < L.rows.length; i++) { const p = L.rows[i].items.indexOf(n); if (p >= 0) return { row: i, pos: p, tier: L.rows[i].name, rows: L.rows.length }; }
  return null;
}
// guns can be ranked all together ("guns") or per weapon category ("guns:Assault Rifles"): a gun is looked up in one, then the other
export const tlGunCat = name => (data.categories.find(c => c.weapons.some(w => w.name === name)) || {}).name;
export const tlGunKeys = (name, catFirst) => { const c = tlGunCat(name), keys = c ? ["guns:" + c, "guns"] : ["guns"]; return catFirst ? keys : keys.reverse(); };
export const tlRankAny = (k, name, catFirst) => { if (k !== "guns") return tlRank(k, name); for (const key of tlGunKeys(name, catFirst)) { const r = tlRank(key, name); if (r) return r; } return null; };
// for sorting: unranked last (guns: Builds shows them per category, so the category's list counts first there)
export const tlOrder = (k, name) => { const r = tlRankAny(k, name, true); return r ? r.row * 1000 + r.pos : 1e9; };
export const tlScore = (k, name) => { const r = tlRankAny(k, name, false); return r ? (r.rows > 1 ? 1 - r.row / (r.rows - 1) : 1) : null; }; // 1 top row … 0 bottom row
// a chip for an overlay's header, beside "#11 on So1o's list": where you ranked it ("S in your tier list"), coloured like its row.
// A click opens that list. Nothing when you haven't ranked it
export function tlChip(k, name) {
  const keys = k === "guns" ? tlGunKeys(name, true) : [k];
  const key = keys.find(x => tlRank(x, name)); if (!key) return null;
  const r = tlRank(key, name), cat = key.split(":")[1];
  const c = el("button", "gm-rank tl-chip", `${r.tier} in your tier list`); c.type = "button"; c.prepend(icon("tiers"));
  c.style.setProperty("--c", TL_COLORS[Math.min(r.row, TL_COLORS.length - 1)]);
  c.dataset.tip = `Your ${cat ? cat + " " : ""}tier list: click to open it`;
  c.addEventListener("click", () => { tl.kind = k; if (k === "guns") tl.gunCat = cat || ""; saveTl(); if (gm.open) closeDialog(gm); setArea("tiers"); tlDraw(); });
  return c;
}
// a loadout's place: the average of its pieces (tlLoScore) read as a row letter, S…D. Nothing when none of them is ranked
export function tlLoChip(lo) {
  const s = tlLoScore(lo); if (s == null) return null;
  const i = Math.round((1 - s) * (TL_ROWS.length - 1)), c = el("span", "gm-rank tl-chip", `${TL_ROWS[i]} in your tier lists`);
  c.prepend(icon("tiers")); c.style.setProperty("--c", TL_COLORS[i]);
  c.dataset.tip = "The average of its gun and gear in your tier lists"; return c;
}
// a row letter on its own (Gear's tables, sorted by your tier list)
export const tlLetter = (k, name) => { const r = tlRankAny(k, name, true); if (!r) return null; const b = el("span", "tl-letter", r.tier); b.style.setProperty("--c", TL_COLORS[Math.min(r.row, TL_COLORS.length - 1)]); b.dataset.tip = `${r.tier} in your tier list`; return b; };
// every list's name, for Share: "Guns", "Guns · Assault Rifles", "Helmets"…
export const tlLabel = key => { const [k, cat] = key.split(":"), K0 = TL_KINDS.find(x => x.k === k); return K0 ? K0.label + (cat ? " · " + cat : "") : null; };
// a loadout: the average of the pieces you ranked (gun, helmet, armour, rig, backpack); none ranked: null
export function tlLoScore(lo) {
  const s = [["guns", lo.gun], ["helmets", lo.helmet], ["armor", lo.armor], ["rigs", lo.rig], ["packs", lo.pack]].map(([k, n]) => tlScore(k, n)).filter(v => v != null);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
}
// what sorts by your tier list follows it
export function afterTiers() {
  if (sortMode === "tiers") render();
  if (loF.sort === "tiers") renderLoadouts(true);
  renderGear();
}