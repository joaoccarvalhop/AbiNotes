/* Loadouts: a weapon build plus the gear to wear with it. Their cost and level, favourites, the filters' state. */
import { costNum, data, el, icon, K, ls, motion, saveName, setDirty, TIERS } from "./base.js";
import { CAT_BY_NAME, fullName, gearImg, VALUE } from "./gear-data.js";
import { marketPriceK } from "./market-data.js";

/* ---------- loadouts: a weapon build plus the gear to wear with it ---------- */
export const LO_TIERS = TIERS.filter(t => t.key !== "misc");
export const LO_TAGS = ["Solo", "Squad", "PvP", "Loot run", "Leg meta", "Long range", "Normal", "Lockdown", "Forbidden"];
export const LO_SLOTS = [["helmet", "Helmet"], ["armor", "Armor"], ["rig", "Chest rig"], ["pack", "Backpack"], ["headset", "Headset"]];
export const LO_UTILITY = { Budget: "2 Stun · 2 Frag · 1 Smoke", Balanced: "3 Stun · 2 Frag · 2 Smoke · 1 Tear gas", PvP: "4 Stun · 4 Frag · 2 Smoke · 2 Molotov" };
export const K_LO = K.loTier;
export let loTier = ls.get(K_LO) || "all";
// which level the Loadouts page shows (its tabs): only this file assigns it
export function setLoTier(k) { loTier = k; ls.set(K_LO, k); }
// favourites are personal: kept in this browser, by loadout id
export const K_FAV = K.loFav;
export const favs = new Set(ls.get(K_FAV) || []);
export const isFav = lo => !!lo.id && favs.has(lo.id);
export function favButton(lo, onChange) {
  const b = el("button", "lo-fav"); b.type = "button";
  b.append(icon("star")); // a line icon like the others; filled when it's a favorite (CSS)
  const sync = () => { const on = isFav(lo); b.setAttribute("aria-pressed", String(on)); b.dataset.tip = on ? "Remove from favorites" : "Add to favorites"; b.setAttribute("aria-label", `${b.dataset.tip}: ${lo.name}`); };
  b.addEventListener("click", e => {
    e.stopPropagation();
    if (!lo.id) { lo.id = loNewId(lo.name); setDirty(true); } // the id has to reach builds.js or the star is lost on reload
    isFav(lo) ? favs.delete(lo.id) : favs.add(lo.id);
    ls.set(K_FAV, [...favs]); sync();
    motion.pop(b); // the shared glow
    onChange && onChange();
  });
  sync();
  return b;
}
export const loNewId = name => (name || "loadout").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

// skrux's T5/T6 prices (k), by full item name
export const GEAR_PRICE = {};
Object.values(VALUE).forEach(groups => Object.values(groups).forEach(rows => rows.forEach(r => { GEAR_PRICE[fullName(r[0])] = r[3]; })));

// a build by code; some codes repeat on two weapons (the author reused a preset slot), so the weapon decides first
export function findBuild(code, gunName) {
  let hit = null;
  if (gunName) data.categories.forEach(c => c.weapons.forEach(g => { if (g.name === gunName) g.builds.forEach(b => { if (!hit && b.code === code) hit = { cat: c, gun: g, build: b }; }); }));
  data.categories.forEach(c => c.weapons.forEach(g => g.builds.forEach(b => { if (!hit && b.code === code) hit = { cat: c, gun: g, build: b }; })));
  if (!hit && gunName) data.categories.forEach(c => c.weapons.forEach(g => { if (!hit && g.name === gunName) hit = { cat: c, gun: g, build: null }; }));
  if (hit && hit.build) hit.name = saveName(hit.gun.name, hit.build.tier, hit.gun.builds.filter(x => x.tier === hit.build.tier).indexOf(hit.build), hit.build);
  return hit;
}
export const gearPriceK = n => marketPriceK(n) || GEAR_PRICE[n] || null;
export const isArmoredRig = n => !!(CAT_BY_NAME[n] && CAT_BY_NAME[n].kind === "arig");
export function loCost(lo) {
  const w = findBuild(lo.build, lo.gun);
  let total = w && w.build ? costNum(w.build.cost) || 0 : 0, missing = 0;
  // market prices first (newest), then skrux's T5/T6 list
  LO_SLOTS.forEach(([k]) => { if (!lo[k]) return; const p = gearPriceK(lo[k]); if (p) total += p; else missing++; });
  return { total, missing };
}
// a loadout's level comes from what it costs in total (k), not from the level of its build
export const LO_LEVEL = [["budget", 600], ["balanced", 1500], ["max", Infinity]];
export const LEVEL_TIP = "Set by the total cost: Budget up to 600k, Balanced up to 1.5M, Max above that";
export function levelOf(total) { return LO_LEVEL.find(([, top]) => total < top)[0]; }
export function loLevel(lo) { const c = loCost(lo).total; return c ? levelOf(c) : lo.tier || "budget"; }
export function loLevelChip(lo) { const c = loTierChip(loLevel(lo)); c.title = LEVEL_TIP; return c; }

export function loTierChip(t) { const x = TIERS.find(y => y.key === t) || TIERS[0]; return el("span", "chip " + x.key, x.label); }

export function loSlot(kind, name, lo) {
  const s = el("div", "lo-slot");
  const label = LO_SLOTS.find(x => x[0] === kind)[1];
  if (kind === "rig" && !name && isArmoredRig(lo.armor)) { s.classList.add("merged"); s.append(el("span", "g-img none", "↖"), el("small", null, "In the rig")); s.dataset.tip = "The armored rig is also the chest rig"; return s; }
  if (!name) { s.classList.add("empty"); s.append(el("span", "g-img none", "—"), el("small", null, label)); s.dataset.tip = `No ${label.toLowerCase()}`; return s; }
  const c = CAT_BY_NAME[name];
  s.append(gearImg(name), el("small", null, label));
  if (c && c.tier) s.append(el("span", "g-tier t" + c.tier, "T" + c.tier));
  s.dataset.tip = `${label}: ${name}${c ? " · " + c.sub : ""}`;
  return s;
}

// filters, kept in this browser
export const K_LOF = K.loFilters;
export const LO_MAPS = ["Normal", "Lockdown", "Forbidden"], LO_STYLES = LO_TAGS.filter(t => !LO_MAPS.includes(t));
export const LO_SORTS = [["default", "Default"], ["cheap", "Cheapest"], ["dear", "Most expensive"], ["new", "Newest"], ["az", "A–Z"], ["tiers", "My tier list", "The average of its gun's and gear's tiers"]];
export const loF = { min: 0, max: null, kind: [], map: [], style: [], prot: [], sort: "default", ...(ls.get(K_LOF) || {}) };
export const saveLoF = () => ls.set(K_LOF, loF);
export const loFiltered = () => loF.min > 0 || loF.max != null || ["kind", "map", "style", "prot"].some(k => loF[k].length);
export const loKind = lo => { const w = findBuild(lo.build, lo.gun); return w ? w.cat.name : ""; };
export const loProt = lo => { const c = CAT_BY_NAME[lo.armor]; return c && c.tier ? String(c.tier) : ""; };
