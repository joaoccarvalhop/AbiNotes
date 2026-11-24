/* Prices (prices.js): reading Koen, an item's history and latest price, conditions, pictures, the chart. */
import { el, fmtKoen, K, market, noticeLine, pricesFile } from "./base.js";
import { AMMO_IMG, CAT_BY_NAME, MARKET_ALIAS } from "./gear-data.js";

/* ---------- market: in-game prices over time (prices.js) ---------- */
export const K_MCAT = K.marketCat;
if (!pricesFile) noticeLine("prices.js wasn't found. Keep it in the same folder as index.html.", []);

export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// every price an item has had, oldest first: [{ date, price, source }]
// a price is a number (one condition) or { new, likeNew, worn } for gear sold in several conditions
export const CONDS = [["new", "New"], ["likeNew", "Like New"], ["worn", "Worn"]];
export const CONDITION_CATS = ["Helmet", "Mask", "Body Armor", "Armored Rig"]; // sold New / Like New / Worn in the game
// the market always sells Like New at 85% and Worn at 70% of the full durability, rounded half to even
// (it held for all 95 helmets, masks and armor read on 27 Oct 2026), so it is never typed in
export const COND_SHARE = { likeNew: 85, worn: 70 };
export function condDur(max, k) {
  const x = max * COND_SHARE[k] / 100, f = Math.floor(x + 1e-9);
  return Math.abs(x - f - .5) < 1e-9 ? (f % 2 ? f + 1 : f) : Math.round(x);
}
export function mainPrice(v) { return v == null ? null : typeof v === "number" ? v : v.new ?? v.likeNew ?? v.worn ?? null; }
export function priceHistory(id) {
  return market.snapshots.filter(s => mainPrice(s.prices[id]) != null).sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ date: s.date, price: mainPrice(s.prices[id]), all: s.prices[id], source: s.source }));
}
// "Like New 210k · Worn 150k" for the latest snapshot that has conditions
export function condLine(l) {
  if (!l || typeof l.all !== "object") return "";
  return CONDS.filter(([k]) => k !== "new" && l.all[k] != null).map(([k, label]) => `${label} ${fmtKoen(l.all[k])}`).join(" · ");
}
export function latest(id) { const h = priceHistory(id); return h.length ? h[h.length - 1] : null; }
// one condition's price out of a reading (a plain number is the New price: items sold in one condition only)
export const condPrice = (all, k) => all == null ? null : typeof all === "object" ? all[k] ?? null : k === "new" ? all : null;
// an item's history in one condition (the Market's Condition filter): same shape as priceHistory
export const condHistory = (h, k) => h.map(x => ({ ...x, price: condPrice(x.all, k) })).filter(x => x.price != null);
export function itemByName(n) { return market.items.find(i => i.name.toLowerCase() === String(n).toLowerCase()); }
// latest market price in k, used by loadouts and gear (null when the item was never priced)
export function marketPriceK(name) { const it = itemByName(name) || marketItemFor(name); const l = it && latest(it.id); return l ? l.price / 1000 : null; }

// "5.56x45mm M855A1" -> the round's picture
export const CAL_TEXT = { "12x70mm": "12x70", "5.56x45mm": "5.56", "5.45x39mm": "5.45", "7.62x39mm": "7.62x39", "7.62x51mm": "7.62x51", "5.7x28mm": "5.7", "5.8x42mm": "5.8", "9x19mm": "9x19", "9x39mm": "9x39", "7.62x54mm": "7.62x54", ".45 Caliber": ".45", ".338 Caliber": ".338" };
export function ammoImgFor(name) {
  const cal = Object.keys(CAL_TEXT).find(c => name.startsWith(c + " "));
  return cal ? AMMO_IMG[CAL_TEXT[cal] + "|" + name.slice(cal.length + 1)] : null;
}
// a market name (often cut, "DK5 Universal Bullet…") -> the catalogue entry with its picture
export function catalogFor(name) {
  if (CAT_BY_NAME[name]) return CAT_BY_NAME[name];
  const alias = Object.keys(MARKET_ALIAS).find(k => MARKET_ALIAS[k] === name); if (alias && CAT_BY_NAME[alias]) return CAT_BY_NAME[alias];
  const base = name.replace(/…$/, "").toLowerCase();
  const hits = Object.keys(CAT_BY_NAME).filter(k => k.toLowerCase().startsWith(base));
  return hits.length === 1 ? CAT_BY_NAME[hits[0]] : null;
}
export function itemImg(it) {
  const box = el("span", "g-img");
  const c = catalogFor(it.name);
  const src = it.img || (c && c.img) || ammoImgFor(it.name);
  if (!src) { box.classList.add("none"); box.append(el("b", null, it.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase())); return box; }
  const img = new Image(); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = src;
  img.addEventListener("load", () => img.classList.add("ok"));
  img.addEventListener("error", () => { img.remove(); box.append(el("b", null, it.name.slice(0, 3).toUpperCase())); });
  box.append(img);
  return box;
}
// the price overlay's chart: a line per condition (New, Like New, Worn) and a dot per reading; hover a dot for its price
export function priceChart(h) {
  const W = 620, H = 180, L = 54, R = 14, T = 12, B = 26;
  const series = CONDS.map(([k, label]) => [k, label, h.map(x => ({ date: x.date, v: typeof x.all === "object" ? x.all[k] : k === "new" ? x.price : null })).filter(p => p.v != null)])
    .filter(s => s[2].length);
  const vs = series.flatMap(s => s[2].map(p => p.v));
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo) * .12 || hi * .1 || 1; lo = Math.max(0, lo - pad); hi += pad;
  const dates = [...new Set(h.map(x => x.date))].sort();
  const x = d => dates.length < 2 ? (L + W - R) / 2 : L + dates.indexOf(d) / (dates.length - 1) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const ns = "http://www.w3.org/2000/svg", mk = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n; };
  const svg = mk("svg", { viewBox: `0 0 ${W} ${H}`, class: "p-chart", role: "img", "aria-label": "Price over time" });
  [hi, (hi + lo) / 2, lo].forEach(v => {
    svg.append(mk("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" }), mk("text", { x: L - 8, y: y(v) + 3.5, "text-anchor": "end" }, fmtKoen(Math.round(v))));
  });
  const dl = (d, anchor) => svg.append(mk("text", { x: x(d), y: H - 8, "text-anchor": anchor }, fmtDate(d)));
  if (dates.length < 2) dl(dates[0], "middle"); else { dl(dates[0], "start"); dl(dates[dates.length - 1], "end"); }
  series.forEach(([k, label, pts]) => {
    if (pts.length > 1) svg.append(mk("polyline", { points: pts.map(p => `${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" "), class: "c-" + k }));
    pts.forEach(p => { const c = mk("circle", { cx: x(p.date), cy: y(p.v), r: 4, class: "c-" + k }); c.dataset.tip = `${label} · ${fmtDate(p.date)}\n${fmtKoen(p.v)}`; svg.append(c); });
  });
  const box = el("div", "m-chart");
  box.append(svg);
  if (series.length > 1) {
    const lg = el("div", "p-legend");
    series.forEach(([k, label]) => { const s = el("span"); s.append(el("i", "c-" + k), label); lg.append(s); });
    box.append(lg);
  }
  if (dates.length < 2) box.append(el("p", "gm-note", "One day of prices so far. The lines grow each day you save new ones."));
  return box;
}
export function change(h) {
  if (h.length < 2) return null;
  const a = h[h.length - 2].price, b = h[h.length - 1].price;
  return a ? (b - a) / a * 100 : null;
}
// the market's own category names, written like the rest of the page
export const CAT_LABEL = { "Helmet": "Helmets", "Mask": "Face masks", "Body Armor": "Body armor", "Unarmored Chest Rigs": "Chest rigs", "Armored Rig": "Armored rigs", "Backpack": "Backpacks", "Headset": "Headsets", "Gas Mask": "Gas masks", "Muzzle": "Muzzles", "Magazine": "Magazines", "Stock": "Stocks", "Barrel": "Barrels", "Handguard": "Handguards", "Rail": "Rails", "Gas Block": "Gas blocks", "Gun Bolt": "Gun bolts", "Flashlight": "Flashlights", "Laser Sight": "Laser sights", "Front Grips": "Front grips", "Rear Grips": "Rear grips", "Receiver/Dust Cvr": "Receivers & dust covers" };
export const catLabel = c => CAT_LABEL[c] || c;

// the market item for a full name, also when the market only showed a cut name ("DK5 Universal Bullet…")
export function marketItemFor(name, cat) {
  const exact = itemByName(MARKET_ALIAS[name] || name); if (exact) return exact;
  const low = name.toLowerCase();
  const hits = market.items.filter(i => (!cat || i.cat === cat) && low.startsWith(i.name.replace(/…$/, "").toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}
export function extraOffers(x) {
  const it = marketItemFor(x.name, x.cat); const l = it && latest(it.id);
  if (!l) return [];
  const all = typeof l.all === "object" ? l.all : { new: l.all };
  return CONDS.filter(([k]) => all[k] != null).map(([k, label]) => {
    const d = all[k + "Dur"], cur = d ? +String(d).split("/")[0] : x.dur;
    return { cond: k, label, price: all[k], cur, max: x.dur, date: l.date, ppd: x.dur && cur > 0 ? Math.round(all[k] / (cur * (x.factor || 1))) : null };
  });
}
