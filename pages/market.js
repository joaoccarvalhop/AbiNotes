/* The Market page: its bar (categories and search) and the table of prices with sparklines. Loaded the first time it
   opens (loadPage in app.js). The prices themselves (latest, priceHistory, fmtKoen…) and the price overlay are in
   app.js: loadouts, gear, search and Share use them. renderMarket() in app.js redraws this page when it is in. */
import { registerPage } from "../app.js";
import { $, button, el, fmtKoen, ls, market, norm } from "../js/base.js";
import { catLabel, change, condHistory, CONDITION_CATS, condLine, CONDS, fmtDate, itemImg, K_MCAT, priceHistory } from "../js/market-data.js";
import { priceTip } from "../js/overlays/loadout.js";
import { openPrice } from "../js/overlays/price.js";
import { ddSelect, filterBox, infoDot } from "../js/ui.js";

export function sparkline(h, w = 90, ht = 24) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${ht}`); svg.setAttribute("width", w); svg.setAttribute("height", ht); svg.classList.add("spark");
  if (h.length < 2) { svg.classList.add("flat"); return svg; }
  const vs = h.map(x => x.price), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const pts = vs.map((v, i) => `${(i / (vs.length - 1) * (w - 4) + 2).toFixed(1)},${(ht - 3 - (v - lo) / span * (ht - 6)).toFixed(1)}`).join(" ");
  const pl = document.createElementNS(svg.namespaceURI, "polyline"); pl.setAttribute("points", pts);
  svg.classList.add(vs[vs.length - 1] >= vs[0] ? "up" : "down");
  svg.append(pl);
  return svg;
}

export const STALE_DAYS = 30;
export const ageDays = d => Math.round((Date.now() - new Date(d + "T12:00:00")) / 864e5);

export let mCat = ls.get(K_MCAT) || "all", mSub = "all", mSort = { key: "name", dir: 1 }, mCond = "all";
// the market's own menu order
export const M_GROUPS = ["Equipment", "Weapon Accessories", "Weapon Bolts", "Ammo", "Medical Supplies", "Tactical Items", "Keys", "Miscellaneous", "Provisions"];
export const groupOf = i => i.group || i.cat || "Other";

// the bar and the table (drawMarket in app.js calls this when the prices change)
function drawMarket() {
  const sec = $("market"); sec.textContent = "";
  const cats = [...new Set(market.items.map(groupOf))].sort((a, b) => ((M_GROUPS.indexOf(a) + 1) || 99) - ((M_GROUPS.indexOf(b) + 1) || 99) || a.localeCompare(b));
  if (!cats.includes(mCat)) mCat = cats[0] || "all"; // always one group open, no "All"
  const subs = mCat === "all" ? [] : [...new Set(market.items.filter(i => groupOf(i) === mCat).map(i => i.cat))];
  if (!subs.includes(mSub)) mSub = "all";
  marketBar(cats);
  const q = norm(($("m-q") && $("m-q").value || "").trim());
  const last = market.snapshots.length ? [...market.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  // the tab names the group, so no heading; the update date sits in the sub-bar's ⓘ
  if (last) $("sub-market").querySelector(".tools").append(infoDot(`Prices from ${fmtDate(last.date)} (${last.source && last.source !== "manual" ? last.source : "entered by hand"})\n${market.snapshots.length} update${market.snapshots.length === 1 ? "" : "s"} so far · ${market.items.length} items`));
  if (!market.items.length) {
    const e = el("div", "m-empty");
    e.append(el("b", null, "No prices yet."), el("p", null, "Each market update adds today's prices here, so you can follow what gets cheaper or more expensive."),
      el("p", null, "You can also correct a price yourself by clicking a row."));
    const add = button("Add an item", { cls: "linkbtn", icon: "plus", onClick: () => openPrice(null) });
    e.append(add);
    sec.append(e);
    return;
  }
  // the filter box every section uses: the open group's kinds (Helmet, Mask… inside Equipment) and Sort by (the column headers sort too)
  const fbox = filterBox();
  if (subs.length > 1) {
    const chips = el("div", "g-seg");
    ["all", ...subs].forEach(s => {
      const b = el("button", null, s === "all" ? "All" : catLabel(s)); b.type = "button";
      b.setAttribute("aria-pressed", String(s === mSub));
      b.addEventListener("click", () => { mSub = s; drawMarket(); });
      chips.append(b);
    });
    fbox.group("Kind", chips);
  }
  // condition: only where the list has gear sold New / Like New / Worn (helmets, masks, armor, armored rigs)
  const inView = i => (mCat === "all" || groupOf(i) === mCat) && (mSub === "all" || i.cat === mSub);
  const hasConds = market.items.some(i => inView(i) && CONDITION_CATS.includes(i.cat));
  if (!hasConds) mCond = "all";
  else {
    const seg = el("div", "g-seg");
    [["all", "All"], ...CONDS].forEach(([k, label]) => {
      const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(k === mCond));
      b.addEventListener("click", () => { mCond = k; drawMarket(); });
      seg.append(b);
    });
    fbox.group("Condition", seg, "The price in that condition, as the market's New / Like New / Worn tabs. Items not sold in it are left out");
  }
  if (mSub !== "all" || mCond !== "all") fbox.clear(() => { mSub = "all"; mCond = "all"; drawMarket(); }); // × Clear, like every filter box, while something is picked
  const M_SORTS = [["name:1", "Name"], ["price:-1", "Most expensive"], ["price:1", "Cheapest"], ["chg:-1", "Biggest rise"], ["chg:1", "Biggest drop"], ["date:-1", "Latest update"], ["cat:1", "Category"]];
  // built once (each dropdown listens on the page), then moved into the new box and synced
  drawMarket.sort = drawMarket.sort || ddSelect("Sort by", M_SORTS, () => `${mSort.key}:${mSort.dir}`, v => { const [key, dir] = v.split(":"); mSort = { key, dir: +dir }; drawMarket(); });
  drawMarket.sort.sync(); fbox.sort(drawMarket.sort);
  sec.append(fbox);
  const rows = market.items.filter(i => inView(i) && (!q || norm(i.name + " " + i.cat).includes(q)))
    .map(i => { const h0 = priceHistory(i.id), h = mCond === "all" ? h0 : condHistory(h0, mCond), l = h[h.length - 1]; return { it: i, h, price: l ? l.price : null, chg: change(h), date: l ? l.date : "" }; })
    .filter(r => mCond === "all" || mCond === "new" || r.price != null); // Like New / Worn: only what is sold that way
  const key = { name: r => r.it.name.toLowerCase(), cat: r => r.it.cat, price: r => r.price ?? -1, chg: r => r.chg ?? -1e9, date: r => r.date };
  rows.sort((a, b) => { const x = key[mSort.key](a), y = key[mSort.key](b); return (x < y ? -1 : x > y ? 1 : 0) * mSort.dir; });
  const t = el("table", "g-table m-table");
  const hr = el("tr");
  [["name", "Item"], ["cat", "Category"], ["price", "Price", "num"], ["chg", "Change", "num"], [null, "Trend"], ["date", "Updated", "num"]].forEach(([k, label, num]) => {
    const th = el("th", num || null);
    if (k) {
      const b = el("button", null, label); b.type = "button";
      th.setAttribute("aria-sort", mSort.key === k ? (mSort.dir > 0 ? "ascending" : "descending") : "none");
      b.addEventListener("click", () => { mSort = { key: k, dir: mSort.key === k ? -mSort.dir : (num ? -1 : 1) }; drawMarket(); });
      th.append(b);
    } else th.append(el("span", "m-th", label));
    hr.append(th);
  });
  const thead = el("thead"); thead.append(hr);
  const body = el("tbody");
  rows.forEach(r => {
    const tr = el("tr", "g-row"); tr.tabIndex = 0; tr.setAttribute("role", "button"); tr.setAttribute("aria-label", `Price history: ${r.it.name}`);
    const nm = el("td", "g-name"); const box = el("div", "g-namebox"); const lab = el("span", "g-label"); lab.append(el("b", null, r.it.name));
    // ammo level in the game's rarity colour
    if (groupOf(r.it) === "Ammo" && r.it.tier) lab.firstChild.append(el("span", "am-lv t" + r.it.tier, "Lv" + r.it.tier));
    box.append(itemImg(r.it), lab); nm.append(box);
    const chg = el("td", "num m-chg");
    if (r.chg != null) { chg.textContent = (r.chg > 0 ? "▲ " : r.chg < 0 ? "▼ " : "") + Math.abs(r.chg).toFixed(r.chg && Math.abs(r.chg) < 10 ? 1 : 0) + "%"; chg.classList.add(r.chg > 0 ? "up" : r.chg < 0 ? "down" : "same"); }
    else chg.textContent = "—";
    const tr2 = el("td"); tr2.append(sparkline(r.h));
    const dt = el("td", "num m-date", r.date ? fmtDate(r.date) : "—");
    if (r.date && ageDays(r.date) > STALE_DAYS) { dt.classList.add("stale"); dt.title = `Over ${STALE_DAYS} days old`; }
    const pc = el("td", "num m-price", fmtKoen(r.price)); pc.dataset.tip = priceTip(null, r.it);
    const lastR = r.h[r.h.length - 1];
    if (mCond === "all") {
      if (condLine(lastR)) {
        // one piece per condition: on one line with dots on a wide screen, one under the other on a phone
        const cs = el("small", "m-conds");
        CONDS.filter(([k]) => k !== "new" && lastR.all[k] != null).forEach(([k, label]) => cs.append(el("span", null, `${label} ${fmtKoen(lastR.all[k])}`)));
        pc.prepend(el("small", "m-new", "New ")); pc.append(cs);
      }
    } else if (lastR && typeof lastR.all === "object" && lastR.all[mCond + "Dur"]) pc.append(el("small", "m-conds", `Durability ${lastR.all[mCond + "Dur"]}`)); // one condition: its durability under the price
    tr.append(nm, el("td", "m-cat", catLabel(r.it.cat)), pc, chg, tr2, dt);
    tr.addEventListener("click", () => openPrice(r.it.id));
    tr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPrice(r.it.id); } });
    body.append(tr);
  });
  if (!rows.length) { const tr = el("tr", "g-empty"); const td = el("td", null, "No item matches your search."); td.colSpan = 6; tr.append(td); body.append(tr); }
  t.append(thead, body);
  const wrap = el("div", "g-scroll"); wrap.append(t);
  // items don't change during a season, so adding one stays out of the way
  const add = button("Add an item", { cls: "linkbtn m-add", icon: "plus", onClick: () => openPrice(null) });
  sec.append(wrap, add);
}

export function marketBar(cats) {
  const bar = $("sub-market"); bar.textContent = "";
  const nav = el("nav", "g-jump"); nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "Market categories");
  cats.forEach(c => {
    const b = el("button", null, c); b.type = "button"; b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(c === mCat));
    b.addEventListener("click", () => { mCat = c; mSub = "all"; ls.set(K_MCAT, c); drawMarket(); });
    nav.append(b);
  });
  const tools = el("div", "tools");
  const q = el("input"); q.id = "m-q"; q.type = "search"; q.placeholder = "Search item…"; q.autocomplete = "off"; q.setAttribute("aria-label", "Search the market");
  q.value = marketBar.q || "";
  q.addEventListener("input", () => { marketBar.q = q.value; drawMarket(); const n = $("m-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
  tools.append(q);
  bar.append(nav, tools);
}


// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("market", { draw: drawMarket, sub: () => mSub });
