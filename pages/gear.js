/* The Gear page: one table per kind of gear (helmets, armor, rigs…) with its tiers and price range. Loaded the first
   time it opens (loadPage in app.js). The gear data and the gear overlay are in app.js; drawGear() there redraws
   this page when it is in (prices or tiers changed). */
import { registerPage } from "../app.js";
import { $, button, el, fmtKoen, K, ls, market, motion, pageEl, reduceMotion } from "../js/base.js";
import { AREA_NAME, CAT_BY_NAME, EXTRA, extraByName, fullName, GEAR, GEAR_ITEMS, GEAR_KIND, GEAR_PLURAL, GEAR_SRC, gearByName, gearOffers, HELMET_NOTES, MAT_FACTOR, MATERIALS, nameCell } from "../js/gear-data.js";
import { extraOffers, fmtDate } from "../js/market-data.js";
import { editPriceFor } from "../js/overlays/gear.js";
import { priceTip } from "../js/overlays/loadout.js";
import { openGear, tierCell } from "../js/overlays/weapon.js";
import { tlLetter, tlOrder } from "../js/rankings.js";
import { ddSelect, filterBox, infoDot, rangeFilter } from "../js/ui.js";

// short explanations shown when you hover a column title
export const HEAD_TIPS = {
  "Real": "Durability adjusted for how well the material resists wear",
  "Per point": "Price for each point of protection. Lower is better",
  "Per slot": "Price for each slot of space. Lower is better",
  "Slots per kg": "Space for its weight. Higher is better",
  "Best buy": "The condition (New, Like New, Worn) that gives the most protection for the money",
  "Dur.": "Durability left / maximum",
  "Fits": "Helmets this mask goes on",
  "Sound pickup": "How well you hear footsteps",
  "Noise reduction": "How much loud noise, like gunfire, is muffled",
  "Durability factor": "How much longer this material lasts",
  "Armor damage reduced": "How much less wear the armor takes from hits",
  "Lost on repair": "Maximum durability lost each time you repair",
  "Ergo": "Ergonomics. Lower values make aiming and handling slower",
  "Speed": "Change to your movement speed",
  "kg": "Weight",
  "Slots": "Storage space",
};
// table with clickable headers; cols: [label, kind] where kind is "num", "pct" or text
export function gearTable(cols, rows, sortBy = 0, dir = 1, cls = "") {
  const wrap = el("div", "g-scroll");
  const t = el("table", "g-table " + cls);
  const head = el("tr"), body = el("tbody");
  const cell = (v, kind, i, row) => {
    const td = el("td", kind ? "num" : null);
    if (cols[i][2]) { cols[i][2](td, v, row); return td; }
    td.textContent = v === "" ? "—" : kind === "pct" ? (v ? v + "%" : "0") : String(v);
    if (kind && v < 0) td.classList.add("neg");
    return td;
  };
  let keep = null;
  const draw = () => {
    body.textContent = "";
    const list = [...rows].filter(r => !keep || keep(r)).sort((a, b) => {
      if (sortBy === "tiers") return tlOrder(wrap.tierKind, a[0]) - tlOrder(wrap.tierKind, b[0]) || String(a[0]).localeCompare(String(b[0])); // your tier list
      const x = a[sortBy], y = b[sortBy];
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
    list.forEach(r => {
      const tr = el("tr"); r.forEach((v, i) => i < cols.length && tr.append(cell(v, cols[i][1], i, r)));
      // sorted by your tier list: its letter before the name, so the order explains itself
      if (sortBy === "tiers") { const L = tlLetter(wrap.tierKind, r[0]); if (L) tr.firstChild.prepend(L); }
      // gear rows open their detail overlay
      if (GEAR_ITEMS[r[0]] || CAT_BY_NAME[r[0]] || gearByName(r[0]) || extraByName(r[0])) {
        tr.className = "g-row"; tr.tabIndex = 0; tr.setAttribute("role", "button");
        tr.setAttribute("aria-label", `Details: ${fullName(r[0])}`);
        tr.addEventListener("click", () => openGear(r[0]));
        tr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGear(r[0]); } });
      }
      body.append(tr);
    });
    if (!list.length) { const tr = el("tr", "g-empty"); const td = el("td", null, "Nothing matches these filters."); td.colSpan = cols.length; tr.append(td); body.append(tr); }
    [...head.children].forEach((th, i) => th.setAttribute("aria-sort", i === sortBy ? (dir > 0 ? "ascending" : "descending") : "none"));
  };
  cols.forEach(([label, kind], i) => {
    const th = el("th", kind ? "num" : null);
    const b = el("button", null, label); b.type = "button";
    if (HEAD_TIPS[label]) { b.title = HEAD_TIPS[label]; b.classList.add("has-tip"); }
    b.addEventListener("click", () => { dir = sortBy === i ? -dir : (kind ? -1 : 1); sortBy = i; draw(); if (wrap.onSort) wrap.onSort(); });
    th.append(b); head.append(th);
  });
  const thead = el("thead"); thead.append(head);
  t.append(thead, body); wrap.append(t); draw();
  // filters by name (the tier, the price…): a row shows when every one of them lets it through
  const keeps = {};
  wrap.filter = (fn, key = "tier") => {
    keeps[key] = fn; const fns = Object.values(keeps).filter(Boolean);
    keep = fns.length ? r => fns.every(f => f(r)) : null; draw();
    motion.swap(body); // the rows that are left fade in
    if (wrap.onFilter) wrap.onFilter();
  };
  wrap.rows = rows;
  // Sort by in the filter box drives the same sort as the headers: numbers biggest first, words A–Z
  wrap.sorted = () => sortBy;
  wrap.sortTo = i => { sortBy = i; dir = i === "tiers" ? 1 : cols[i][1] ? -1 : 1; draw(); };
  wrap.cols = cols;
  return wrap;
}

// the gear tab is built from the database and the latest market prices, so it is redrawn when prices change
export let gearSub = ls.get(K.gearSub), gearVTiers = ls.get(K.gearTiers) || [ls.get(K.gearTierOld) || 5];
export const gearKeep = {}; // the tiers and price range picked per table, kept while the page is open (the tab is redrawn when prices change)
// every table (renderGear in app.js calls this)
function drawGear() {
  const sec = $("gear"); sec.textContent = "";
  const bar = $("sub-gear"); bar.textContent = "";
  const last = market.snapshots.length ? [...market.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  // sources and price date stay out of the way, in a tooltip at the end of the sub-bar
  const info = infoDot(`Stats: ABI Builder S7 database\nPrices: market${last ? ", " + fmtDate(last.date) : ""}\nValue math: skrux data sheet (click to open)`, GEAR_SRC);

  // sub-tabs, remembered across reloads (the tab already names the part, so no heading below it)
  const jump = el("nav", "g-jump"); jump.setAttribute("role", "tablist"); jump.setAttribute("aria-label", "Gear sections");
  const tools = el("div", "tools"); tools.append(info);
  bar.append(jump, tools);
  const blocks = [];
  const showSub = (id, animate) => {
    if (!blocks.some(s => s.id === id)) id = blocks[0].id;
    blocks.forEach(s => {
      const on = s.id === id, was = !s.hidden;
      s.hidden = !on;
      if (on && animate && !was && !reduceMotion) { s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter"); }
    });
    jump.querySelectorAll("button").forEach(b => { const on = b.dataset.for === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    gearSub = id; ls.set(K.gearSub, id);
  };
  const block = (id, title, sub, ...nodes) => {
    const s = el("section", "g-block"); s.id = "g-" + id; s.setAttribute("role", "tabpanel"); s.setAttribute("aria-labelledby", "gt-" + id);
    // every part starts with the same tools row (filters, a short lead, or nothing) so tables line up from tab to tab
    let tools = nodes[0] && nodes[0].classList && nodes[0].classList.contains("g-tools") ? nodes.shift() : el("div", "g-tools");
    if (sub) tools.prepend(el("p", "g-lead", sub));
    s.append(tools, ...nodes);
    const b = el("button", null, title); b.type = "button"; b.dataset.for = s.id; b.id = "gt-" + id; b.setAttribute("role", "tab");
    b.addEventListener("click", () => { showSub(s.id, true); if (pageEl.scrollTop > sec.offsetTop) pageEl.scrollTo({ top: sec.offsetTop - 12, behavior: "instant" }); });
    b.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const all = [...jump.children], i = all.indexOf(b);
      const next = all[(i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
      next.focus(); next.click();
    });
    jump.append(b);
    blocks.push(s);
    return s;
  };

  // one button per tier in the table; pick as many as you like (T5 + T6), All clears them
  // (what you picked lives in gearKeep, by table, so a price change redrawing the tab doesn't throw your filters away)
  const tierFilter = (table, items) => {
    const key = table.cols[0][0], on = gearKeep[key + ":tier"] = gearKeep[key + ":tier"] || new Set();
    const seg = el("div", "g-seg");
    const tiers = [...new Set(items.map(g => g.tier))].sort();
    const apply = () => table.filter(on.size ? r => on.has(r[1]) : null);
    const sync = () => seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === "all" ? !on.size : on.has(+b.dataset.t))));
    [["all", "All"], ...tiers.map(t => [String(t), "T" + t])].forEach(([v, label]) => {
      const b = el("button", null, label); b.type = "button"; b.dataset.t = v;
      b.addEventListener("click", () => {
        if (v === "all") on.clear(); else on.has(+v) ? on.delete(+v) : on.add(+v);
        sync(); apply();
      });
      seg.append(b);
    });
    sync(); if (on.size) apply();
    return seg;
  };
  const areas = (td, v) => { v.split(" ").forEach(a => { const s = el("span", "g-area", a); s.dataset.tip = AREA_NAME[a]; td.append(s); }); };
  // price cells: hover for the full picture, or add a missing price right away
  const money = (td, v, r) => {
    if (v) { td.textContent = fmtKoen(v); if (r) td.dataset.tip = priceTip(r[0]); return; }
    if (!r) { td.textContent = "—"; return; }
    td.append(button("Add price", { cls: "linkbtn", icon: "plus", onClick: e => { e.stopPropagation(); editPriceFor(r[0]); } }));
  };
  const per = (td, v) => { td.textContent = v ? fmtKoen(v) : "—"; };
  const real = (td, v) => { td.textContent = v; };
  const newOffer = g => gearOffers(g).find(o => o.cond === "new");
  const dash = v => v || "—";

  // helmets: database stats + skrux's notes + New price
  const helmets = gearTable(
    [["Helmet", null, nameCell], ["Tier", "num", tierCell], ["Durability", "num"], ["Real", "num", real], ["Material"], ["Ergo", "num"], ["Speed", "pct"], ["kg", "num"],
     ["Ricochet"], ["Sound blocking"], ["Face mask"], ["Headset"], ["Price", "num", money], ["Per point", "num", per]],
    GEAR.filter(g => g.kind === "helmet").map(g => {
      const n = HELMET_NOTES[g.name] || [], o = newOffer(g);
      return [g.name, g.tier, g.dur, Math.round(g.dur * g.factor), g.mat, g.ergo, g.spd, g.w, g.extra, dash(n[0]), dash(n[1]), dash(n[2]), o ? o.price : 0, o ? o.ppd : 0];
    }), 1, -1);
  // body armor and armored rigs together
  const armor = gearTable(
    [["Armor", null, nameCell], ["Tier", "num", tierCell], ["Type"], ["Durability", "num"], ["Real", "num", real], ["Material"], ["Protects", null, areas],
     ["Ergo", "num"], ["Speed", "pct"], ["kg", "num"], ["Slots", "num", (td, v) => { td.textContent = v || "—"; }], ["Price", "num", money], ["Per point", "num", per]],
    GEAR.filter(g => g.kind !== "helmet").map(g => {
      const o = newOffer(g);
      return [g.name, g.tier, g.kind === "arig" ? "Armored rig" : "Body armor", g.dur, Math.round(g.dur * g.factor), g.mat, g.areas, g.ergo, g.spd, g.w, g.extra, o ? o.price : 0, o ? o.ppd : 0];
    }), 1, -1);

  // value for money: for each class, the cheapest durability you can buy, in any condition
  const vseg = el("div", "g-seg");
  const grid = el("div", "g-value");
  const tiers = [...new Set(GEAR.filter(g => gearOffers(g).length).map(g => g.tier))].sort();
  gearVTiers = gearVTiers.filter(t => tiers.includes(t));
  if (!gearVTiers.length) gearVTiers = tiers.slice(-1);
  const drawValue = () => {
    grid.textContent = "";
    vseg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(gearVTiers.includes(+b.dataset.t))));
    const many = gearVTiers.length > 1;
    Object.entries(GEAR_KIND).forEach(([kind, label]) => {
      const rows = GEAR.filter(g => g.kind === kind && gearVTiers.includes(g.tier)).map(g => {
        const offers = gearOffers(g).filter(o => o.ppd); if (!offers.length) return null;
        const o = offers.reduce((a, b) => (b.ppd < a.ppd ? b : a));
        return [g.name, g.tier, o.label, `${o.cur}/${o.max}`, o.price, o.ppd];
      }).filter(Boolean);
      if (!rows.length) return;
      // the best value of the list, and with several tiers on show, the best of each tier too
      const best = Math.min(...rows.map(r => r[5])), tierBest = {};
      rows.forEach(r => { tierBest[r[1]] = Math.min(tierBest[r[1]] ?? Infinity, r[5]); });
      const bestTier = new Set(rows.filter(r => many && r[5] === tierBest[r[1]]).map(r => r[5] + "|" + r[1]));
      const cols = [[label, null, (td, n) => { nameCell(td, n); td.classList.add("small"); }], ["Tier", "num", tierCell], ["Best buy", null, (td, v) => { td.textContent = v; td.classList.add("g-cond"); }],
        ["Dur.", "num"], ["Price", "num", money],
        ["Per point", "num", (td, v, row) => {
          td.textContent = v.toLocaleString("en-US");
          const t = row[1]; // the tier, when several are shown (else the column is left out and only the list's best counts)
          if (v === best) { td.classList.add("best"); td.dataset.tip = many ? "Best value of all the tiers shown" : "Best value in this list"; }
          else if (bestTier.has(v + "|" + t)) { td.classList.add("best", "tier"); td.dataset.tip = `Best value in T${t}`; }
        }]];
      // the tier column only says something when more than one tier is shown
      const keep = (_, i) => many || i !== 1;
      const s = el("div", "g-vcol");
      s.append(el("h4", null, GEAR_PLURAL[kind]), gearTable(cols.filter(keep), rows.map(r => r.filter(keep)), many ? 5 : 4, 1, "compact"));
      grid.append(s);
    });
    if (!grid.children.length) grid.append(el("p", "nores", "No prices for these tiers yet."));
  };
  // pick one tier or several; at least one stays on
  tiers.forEach(t => {
    const b = el("button", null, "T" + t); b.type = "button"; b.dataset.t = t;
    b.addEventListener("click", () => {
      if (gearVTiers.includes(t)) { if (gearVTiers.length > 1) gearVTiers = gearVTiers.filter(x => x !== t); }
      else gearVTiers = [...gearVTiers, t].sort();
      ls.set(K.gearTiers, gearVTiers); drawValue();
    });
    vseg.append(b);
  });
  drawValue();

  // other equipment: New price from the market, plus what matters for each kind
  const xNew = x => { const o = extraOffers(x).find(y => y.cond === "new") || extraOffers(x)[0]; return o || null; };
  const fits = (td, v) => { td.textContent = v.length > 2 ? `${v.length} helmets` : v.map(fullName).join(", "); td.dataset.tip = v.join("\n"); td.classList.add("g-fits"); };
  const masks = gearTable(
    [["Mask", null, nameCell], ["Tier", "num", tierCell], ["Durability", "num"], ["Material"], ["kg", "num"], ["Ricochet"], ["Fits", null, fits], ["Price", "num", money], ["Per point", "num", per]],
    EXTRA.filter(x => x.kind === "mask").map(x => { const o = xNew(x); return [x.name, x.tier, x.dur, x.mat, x.w, x.ric, x.fits, o ? o.price : 0, o ? o.ppd : 0]; }), 1, -1);
  const perSlot = (td, v) => { td.textContent = v ? fmtKoen(v) : "—"; td.dataset.tip = "Price ÷ slots"; };
  const bags = (kind, label) => gearTable(
    [[label, null, nameCell], ["Slots", "num", (td, v) => { td.textContent = v; }], ["Grid"], ["kg", "num"], ["Slots per kg", "num", (td, v) => { td.textContent = v.toFixed(1); }], ["Price", "num", money], ["Per slot", "num", perSlot]],
    EXTRA.filter(x => x.kind === kind).map(x => { const o = xNew(x); return [x.name, x.slots, x.grid + (x.bonus ? ` +${x.bonus}` : ""), x.w, x.slots / x.w, o ? o.price : 0, o ? Math.round(o.price / x.slots) : 0]; }), 1, -1);
  const rigs = bags("rig", "Chest rig"), packs = bags("pack", "Backpack");
  const headsets = gearTable(
    [["Headset", null, nameCell], ["Sound pickup"], ["Noise reduction"], ["kg", "num"], ["Price", "num", money]],
    EXTRA.filter(x => x.kind === "headset").map(x => { const o = xNew(x); return [x.name, x.pickup, x.noise, x.w, o ? o.price : 0]; }), 4, -1);
  const gas = gearTable(
    [["Gas mask", null, nameCell], ["Durability", "num"], ["Anti-flash"], ["Anti-poison"], ["kg", "num"], ["Price", "num", money]],
    EXTRA.filter(x => x.kind === "gas").map(x => { const o = xNew(x); return [x.name, x.dur, x.flash, x.poison, x.w, o ? o.price : 0]; }), 5, -1);

  // the filter box every section uses, in the tools row's place (tables still line up from tab to tab): the tier where there is one, and Sort by
  const sortBy = table => {
    const opts = table.cols.map(([label], i) => [String(i), i ? label : "Name"]).filter(([i]) => +i !== 1 || table.cols[1][0] !== "Tier");
    if (table.tierKind) opts.push(["tiers", "My tier list", "Your order from Tier list"]);
    const dd = ddSelect("Sort by", opts, () => String(table.sorted()), v => table.sortTo(v === "tiers" ? v : +v));
    table.onSort = () => dd.sync(); // a header click shows up here too
    return dd;
  };
  // what you want to spend: the same money range as Loadouts, over the table's Price column (items with no price yet drop out once you narrow it)
  const priceRange = table => {
    const pi = table.cols.findIndex(c => c[0] === "Price"); if (pi < 0) return null;
    const max = Math.max(0, ...table.rows.map(r => r[pi] || 0)); if (!max) return null;
    const step = max > 2e6 ? 50000 : max > 400000 ? 10000 : 5000, top = Math.ceil(max / step) * step;
    const key = table.cols[0][0] + ":price", keep = gearKeep[key] = gearKeep[key] || { lo: 0, hi: null };
    const apply = () => table.filter(!keep.lo && keep.hi == null ? null : r => r[pi] > 0 && r[pi] >= keep.lo && (keep.hi == null || r[pi] <= keep.hi), "price");
    const rg = rangeFilter("price", fmtKoen, (lo, hi) => { keep.lo = lo; keep.hi = hi; apply(); });
    rg.set(keep.lo, keep.hi, top, step);
    if (keep.lo || keep.hi != null) apply();
    return rg;
  };
  // the tables with a tier list of their own can be sorted by it
  helmets.tierKind = "helmets"; armor.tierKind = "armor"; rigs.tierKind = "rigs"; packs.tierKind = "packs";
  const withTools = (node, seg, label = "Tier", tip) => {
    const box = filterBox(); box.classList.add("g-tools");
    if (seg) box.group(label, seg, tip);
    const rg = node.rows && priceRange(node);
    if (rg) box.group("Price", rg, "New, at the latest market price. Then Sort by Per point for the best value in your budget");
    // × Clear, like every filter box: only while this table's tier or price is narrowed
    if (node.cols && (seg || rg)) {
      const key = node.cols[0][0], active = () => !!((gearKeep[key + ":tier"] || {}).size || (gearKeep[key + ":price"] && (gearKeep[key + ":price"].lo || gearKeep[key + ":price"].hi != null)));
      const cl = box.clear(() => { if (gearKeep[key + ":tier"]) gearKeep[key + ":tier"].clear(); gearKeep[key + ":price"] = { lo: 0, hi: null }; drawGear(); });
      const sync = () => { cl.hidden = !active(); }; node.onFilter = sync; sync();
    }
    if (node.sortTo) box.sort(sortBy(node));
    return [box, node];
  };
  sec.append(
    block("helmets", "Helmets", null, ...withTools(helmets, tierFilter(helmets, GEAR.filter(g => g.kind === "helmet")))),
    block("masks", "Face masks", null, ...withTools(masks, tierFilter(masks, EXTRA.filter(x => x.kind === "mask")))),
    block("armor", "Armor", null, ...withTools(armor, tierFilter(armor, GEAR.filter(g => g.kind !== "helmet")))),
    block("rigs", "Chest rigs", null, ...withTools(rigs)),
    block("packs", "Backpacks", null, ...withTools(packs)),
    block("headsets", "Headsets", null, ...withTools(headsets)),
    block("gas", "Gas masks", null, ...withTools(gas)),
    block("value", "Value for money", null, ...withTools(grid, vseg, "Tiers", "Pick one or several: ★ is the best value of all shown, ☆ the best of each tier")),
    block("materials", "Materials", null,
      gearTable([["Material"], ["Durability factor", "num", (td, v) => { td.textContent = "×" + v; }], ["Armor damage reduced", "num", (td, v) => { td.textContent = v + "%"; }], ["Lost on repair", "num", (td, v) => { td.textContent = v + "%"; }]],
        MATERIALS.map(m => [m[0], MAT_FACTOR[m[0].replace("Hardened Steel", "Hardened Steel")] || 1, m[1], m[2]]), 1, -1, "narrow")),
  );
  showSub(gearSub, false);
}


// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("gear", { draw: drawGear });
