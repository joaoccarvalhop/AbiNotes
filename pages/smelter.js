/* The Smelter page: loaded the first time the page opens (loadPage in app.js), after merchant.js and pages/merchant-items.js (item colours and pictures). Its log (smd) lives in app.js, for Share and Home. */
import { area, registerPage } from "../app.js";
import { $, button, clearButton, el, emptyNote, fmtKoen, market, motion, pageEl, plural } from "../js/base.js";
import { fmtDate, itemImg, latest, today } from "../js/market-data.js";
import { saveSm, smd, SMELT_KINDS, smItem } from "../js/page-data.js";
import { openShare, smeltLabel } from "../js/share.js";
import { confirmBox, infoDot, makePicker, toast } from "../js/ui.js";
import { MER, merPic } from "./merchant-items.js";

/* ---------- Smelter: 3 miscellaneous items from the raid in, 1 out. No odds are published: the rules below are what players
   found (ABI Builder's guide, MoreFun's notes), and your own log of smelts gives the real numbers over time ---------- */
// limited recipes ("Trash to Treasure"): three set items for a chance at a collectible. Dates as published; add new ones on the page
export const SMELT_RECIPES = [
  { out: "Prototype Calculation Module", ins: ["Personal Digital Assistant", "Data Cable", "Laptop"], from: "2026-10-29", to: "2026-11-15" },
  { out: "Target Locator Module", ins: ["Cannon Shell", "Artillery Periscope Binoculars", "Laser Pointer Module"], from: "2026-10-15", to: "2026-10-28" },
  { out: "Phaethon's Clock", ins: ["Desk Clock", "Pocket Watch", "Gungnir Blueprint Fragments"], from: "2026-09-16", to: "2026-09-27" },
  { out: "Pure Gold Soap", ins: ["Soap", "Gold Watch", "Gold Bracelet"], from: "2026-08-27", to: "2026-09-13", worth: 300000 },
  { out: "Gold-Plated Video Camera", ins: ["Video Camera", "Gold Phone", "Gold Bracelet"], from: "2026-08-13", to: "2026-08-26" },
];
export const SMELT_COLORS = [[0, "Unknown"], [1, "White"], [2, "Green"], [3, "Blue"], [4, "Purple"], [5, "Gold"], [6, "Red"]];
export const smItems = () => market.items.filter(i => i.group === "Miscellaneous");
export const smPrice = id => (latest(id) || {}).price || 0;
// the item's colour: marked by you, else from the merchant's list
export let smMerByName = null;
export function smMer(name) {
  if (!smMerByName) { smMerByName = new Map(); if (MER) Object.values(MER.items).forEach(x => smMerByName.set(x[0].toLowerCase(), x)); }
  return smMerByName.get(String(name).toLowerCase()) || null;
}
export const smRar = id => { const it = smItem(id); return smd.rar[id] || (it && (smMer(it.name) || [])[1]) || 0; };
export function smPic(id) {
  const it = smItem(id), m = it && smMer(it.name), r = smRar(id);
  if (m && m[8]) return merPic([it.name, r, , , , , , , m[8]]);
  const p = el("span", "mc-pic r" + r), im = itemImg(it || { name: "?" }); p.append(im); return p;
}
// a recipe's item, by name, on the market list (names differ a little: "Laptop" is "Laptop Computer")
export function smFind(name) {
  const n = name.toLowerCase(), all = smItems();
  const cut = i => /…$/.test(i.name) && n.startsWith(i.name.slice(0, -1).toLowerCase()); // the market cuts long names: "Personal Digital Ass…"
  return all.find(i => i.name.toLowerCase() === n) || all.find(cut) || all.find(i => i.name.toLowerCase().startsWith(n + " ") || n.startsWith(i.name.toLowerCase() + " ")) || null;
}
export const smAllRecipes = () => [...smd.recipes, ...SMELT_RECIPES].sort((a, b) => b.to.localeCompare(a.to));
export const smRecipeNow = () => smAllRecipes().find(r => r.from <= today() && today() <= r.to) || null;
// what kind of smelt three items make: the groups the rules (and your stats) go by
export function smKind(ids) {
  const r = ids.map(smRar), v = ids.reduce((s, id) => s + smPrice(id), 0), same = ids.every(id => id === ids[0]);
  if (r.every(x => x === 5)) return same ? "gold3same" : "gold3";
  if (r.every(x => x === 4)) return "purple3";
  return v >= 300000 ? "v300" : v >= 200000 ? "v200" : v >= 45000 ? "v45" : "low";
}
// what the known rules say about three items
// what three items can give, in a few words: the rule that applies, nothing else
export function smOutcome(ids) {
  const r = ids.map(smRar), v = ids.reduce((s, id) => s + smPrice(id), 0), same = ids.every(id => id === ids[0]), out = [];
  const rec = smRecipeNow();
  if (rec && rec.ins.every(n => { const f = smFind(n); return f && ids.includes(f.id); })) out.push(["good", "Special recipe: " + rec.out]);
  if (r.every(x => x === 5)) out.push(["good", same ? "1 of 5 reds possible" : "1 of 3 reds possible"]);
  else if (r.every(x => x === 4)) out.push(["good", "Gold for sure"]);
  if (!r.every(x => x === 5)) {
    if (v >= 300000) out.push(["good", "1 of 2 reds possible"]);
    else if (v >= 200000) out.push(["good", "Red possible"]);
    else if (v < 45000) out.push(["bad", "May give a cheap purple"]);
    else if (!r.every(x => x === 4)) out.push(["", "No red possible"]);
  }
  return { out, value: v, kind: smKind(ids) };
}
// your log, by kind: how many, what went in and came out, how often red
export function smStats(list) {
  const by = {};
  list.forEach(e => {
    const s = by[e.kind] = by[e.kind] || { n: 0, inV: 0, outV: 0, red: 0, gold: 0 };
    s.n++; s.inV += e.inV.reduce((a, b) => a + b, 0); s.outV += e.outV || 0; if (e.outR === 6) s.red++; if (e.outR === 5) s.gold++;
  });
  return by;
}
export const smSigned = n => (n >= 0 ? "+" : "−") + fmtKoen(Math.abs(Math.round(n)));
export const SMELT_TIP = "Lockdown and Forbidden raids, with items found in that raid.\nUnder 45k: can give a cheap purple\n200k+: a red is possible (300k+: 1 of 2)\n3 purple: gold for sure\n3 gold: 1 of 3 reds (the same gold three times: 1 of 5)\nFrom players' tests: the game gives no odds.";

export function renderSmelter() { smDraw(); }
export function smDraw() {
  const sec = $("smelter"); if (!sec || area !== "smelter") return;
  const keepTop = pageEl.scrollTop; sec.textContent = "";
  const redraw = () => { saveSm(); smDraw(); };
  const first = motion.opened("smelter"); // just opened: the panels come in; after that only what changed moves
  const groups = () => {
    const by = {}; smItems().forEach(it => (by[it.cat] = by[it.cat] || []).push(it));
    return Object.keys(by).sort().map(c => ({ label: c, items: by[c].sort((a, b) => a.name.localeCompare(b.name)).map(it => ({ value: it.id, title: it.name, sub: fmtKoen(smPrice(it.id)), img: () => smPic(it.id) })) }));
  };
  const head = (title, ...extra) => { const h = el("h3", "mc-h", title); h.append(...extra.filter(Boolean)); return h; };
  const page = el("div", "sm-page");

  /* the station: three items in, what came out */
  const st = el("section", "mc-panel sm-main");
  const clr = smd.slots.some(Boolean) || smd.out ? clearButton(() => { Object.assign(smd, { slots: ["", "", ""], out: "", outV: "" }); redraw(); }, "Take everything out", "sm-clear") : null;
  st.append(head("Smelter", infoDot(SMELT_TIP), clr));
  const station = el("div", "sm-station");
  const tile = (id, ph, onChange, extra) => {
    const t = el("div", "sm-tile r" + (id ? smRar(id) : 0) + (id ? "" : " empty")), host = el("div", "pk sm-pk");
    makePicker(host, { placeholder: ph, groups, onChange }).set(id);
    t.append(host);
    if (id && !smRar(id)) { // the next step when its colour isn't known: ask for it right there
      const ask = el("div", "sm-ask");
      ask.append(el("b", null, (smItem(id) || {}).name || ""), el("small", null, "Which color?"));
      const sw = el("div", "sm-swatches");
      SMELT_COLORS.slice(1).forEach(([v, name]) => { const b = el("button", "r" + v); b.type = "button"; b.dataset.tip = name; b.setAttribute("aria-label", name); b.addEventListener("click", () => { smd.rar[id] = v; redraw(); }); sw.append(b); });
      const x = button("×", { cls: "linkbtn sm-askx", tip: "Pick another item", onClick: () => onChange("") });
      ask.append(sw, x);
      t.append(ask);
    }
    if (extra) t.append(extra);
    return t;
  };
  // a tile that just got its item (or its colour) pops
  const popIfNew = (t, key, id) => { if (motion.changed(key, [id, id && smRar(id)]) && !first && id) motion.pop(t); };
  smd.slots.forEach((id, i) => { const t = tile(id, "Item " + (i + 1), v => { smd.slots[i] = v; redraw(); }); popIfNew(t, "sm:slot" + i, id); station.append(t); });
  const arrow = el("span", "sm-to"); arrow.append(el("i")); station.append(arrow);
  const full = smd.slots.every(Boolean);
  if (motion.changed("sm:full", full) && full && !first) motion.nudge(arrow); // all three in: the arrow points at the result
  let logRow = null;
  if (full) {
    logRow = el("div", "sm-logrow");
    const ov = el("input", "m-price-in"); ov.inputMode = "numeric"; ov.placeholder = "Worth"; ov.value = smd.outV ? Number(smd.outV).toLocaleString("en-US") : ""; ov.setAttribute("aria-label", "What it's worth");
    ov.dataset.tip = "Change it if the market price is off";
    ov.addEventListener("input", () => { const d = ov.value.replace(/\D/g, ""); smd.outV = d; ov.value = d ? Number(d).toLocaleString("en-US") : ""; saveSm(); });
    const go = button("Log", { cls: "primary", tip: "Add to your results", onClick: () => {
      smd.log.unshift({ id: "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: today(), ins: [...smd.slots], inV: smd.slots.map(smPrice), kind: smKind(smd.slots),
        out: smd.out, outV: +smd.outV || smPrice(smd.out), outR: smRar(smd.out) });
      smd.out = ""; smd.outV = ""; redraw(); toast([el("b", null, "Logged")]);
    } });
    go.disabled = !smd.out;
    logRow.append(ov, go);
  }
  const out = tile(smd.out, "What came out", v => { smd.out = v; smd.outV = v ? String(smPrice(v)) : ""; redraw(); }, logRow);
  out.classList.add("sm-outtile"); popIfNew(out, "sm:out", smd.out); station.append(out);
  st.append(station);

  // three numbers: what goes in, what it can give, how yours went
  const stats = el("div", "sm-stats");
  const stat = (label, value, sub, cls) => { const d = el("div", "sm-stat" + (cls ? " " + cls : "")); d.append(el("small", null, label), value, el("span", "sm-sub", sub || "")); stats.append(d); return d; };
  if (full) {
    const R = smOutcome(smd.slots), S = smStats(smd.log.filter(e => e.kind === R.kind))[R.kind];
    stat("Going in", el("b", null, fmtKoen(R.value)), SMELT_KINDS[R.kind]);
    const can = el("b", "sm-can"); R.out.forEach(([tone, t], i) => { if (i) can.append(el("span", "sm-sep", " · ")); can.append(el("span", tone, t)); });
    stat("Can give", can, R.out.some(([t]) => t === "good") ? "" : "Add value or color for a red");
    stat("Your record", el("b", S ? (S.outV >= S.inV ? "up" : "down") : null, S ? smSigned(S.outV / S.n - S.inV / S.n) : "—"),
      S ? `${plural(S.n, "smelt")} like this · red ${Math.round(S.red / S.n * 100)}%` : "None like this yet");
  } else { stat("Going in", el("b", null, "—"), "Pick three items"); stat("Can give", el("b", null, "—")); stat("Your record", el("b", null, "—")); }
  // the numbers tick in when they change
  [...stats.children].forEach((d, i) => { const b = d.querySelector("b"); if (motion.changed("sm:stat" + i, b.textContent) && !first) motion.tick(b); });
  st.append(stats);
  page.append(st);

  /* below: the special recipe and your results, side by side */
  const lower = el("div", "sm-lower");
  const now = smRecipeNow(), rp = el("section", "mc-panel");
  const left = now ? Math.round((new Date(now.to + "T23:59:59") - new Date()) / 864e5) : 0;
  const past = smAllRecipes().filter(r => r !== now && r.to < today());
  // two views in one fixed box: what's on now, and the old ones (they scroll inside, the page never grows)
  // the same tabs as the bars and overlays (g-jump: a word, underlined when open)
  const tabs = (cur, list, set) => { const nav = el("nav", "g-jump sm-tabs"); nav.setAttribute("role", "tablist"); list.forEach(([k, t]) => { const b = el("button", null, t); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(cur === k)); b.addEventListener("click", () => { set(k); smDraw(); }); nav.append(b); }); return nav; };
  rp.classList.add("sm-box");
  rp.append(head("Special recipe", tabs(smRecTab, [["now", "Now"], ["past", "History"]], k => { smRecTab = k; }),
    button("Add recipe", { cls: "linkbtn sm-clear", icon: "plus", tip: "A new special recipe, when the game brings one", onClick: () => { smAdding = !smAdding; smRecTab = "now"; smDraw(); } })));
  const rbody = el("div", "sm-scroll");
  // a recipe reads like the station: three items, an arrow, the item it gives, all the same size; then one line of numbers
  const recipe = (r, extra) => {
    const c = el("div", "sm-rec"), row = el("div", "sm-recrow"); let total = 0;
    // squares only: the name (and price) show on hover
    const cell = (pic, tip) => { const d = el("div", "sm-recin"); d.dataset.tip = tip; d.append(pic); return d; };
    r.ins.forEach((n, i) => {
      const f = smFind(n), p = f ? smPrice(f.id) : 0; total += p;
      if (i) row.append(el("span", "sm-plus", "+"));
      row.append(cell(f ? smPic(f.id) : (() => { const x = el("span", "mc-pic r0"); x.append(itemImg({ name: n })); return x; })(), n + (p ? "\n" + fmtKoen(p) : "")));
    });
    const arrow = el("span", "sm-to sm-recto"); arrow.append(el("i")); row.append(arrow);
    // collectibles aren't on the market: the value is the one published, or the one you type
    const prize = smFind(r.out), market = prize && smPrice(prize.id), worth = market || (smd.worth || {})[r.out] || r.worth || 0;
    const noPic = () => { const p = el("span", "mc-pic r6"); p.append(itemImg({ name: r.out })); return p; };
    const outCell = cell(prize ? smPic(prize.id) : noPic(), r.out); outCell.classList.add("sm-recprize"); row.append(outCell);
    const nums = el("div", "sm-recnums");
    const num = (label, v) => { const d = el("span"); d.append(el("small", null, label), v); nums.append(d); };
    num("Total cost", el("b", null, total ? fmtKoen(total) : "—"));
    if (market) num("Reward", el("b", null, fmtKoen(worth)));
    else {
      const w = el("input", "sm-worth"); w.inputMode = "numeric"; w.placeholder = "Type it"; w.value = worth ? worth.toLocaleString("en-US") : ""; w.setAttribute("aria-label", "What " + r.out + " is worth");
      w.dataset.tip = "Not on the market: type what it sells for";
      w.addEventListener("input", () => { const d = w.value.replace(/\D/g, ""); w.value = d ? Number(d).toLocaleString("en-US") : ""; });
      w.addEventListener("change", () => { const d = +w.value.replace(/\D/g, ""); smd.worth = smd.worth || {}; if (d) smd.worth[r.out] = d; else delete smd.worth[r.out]; redraw(); });
      num("Reward", w);
    }
    num("Gain", el("b", worth && total ? (worth >= total ? "up" : "down") : null, worth && total ? smSigned(worth - total) : "—"));
    const when = el("span", "sm-when", extra || `${fmtDate(r.from)} – ${fmtDate(r.to)}`); nums.append(when);
    if (r.mine) nums.append(button(null, { cls: "linkbtn sm-del", icon: "trash", tip: "Delete this recipe", onClick: async () => {
      if (!await confirmBox({ title: "Delete this recipe?", body: [el("span", "c-name", r.out)], ok: "Delete recipe", danger: true })) return;
      smd.recipes = smd.recipes.filter(x => x !== r); redraw(); toast([el("span", null, "Recipe deleted: "), el("b", null, r.out)]);
    } }));
    c.append(row, nums);
    return c;
  };
  if (smAdding) {
    const f = el("div", "sm-add"), ins = [0, 1, 2].map(i => { const x = el("input"); x.placeholder = "Item " + (i + 1); x.setAttribute("list", "sm-names"); return x; });
    const dl = el("datalist"); dl.id = "sm-names"; smItems().forEach(it => { const o = document.createElement("option"); o.value = it.name; dl.append(o); });
    const gives = el("input"); gives.placeholder = "Gives";
    const to = el("input"); to.type = "date"; to.value = today(); to.setAttribute("aria-label", "Last day"); to.dataset.tip = "Last day";
    const ok = button("Save", { cls: "primary", onClick: () => {
      if (ins.some(x => !x.value.trim()) || !gives.value.trim()) { toast([el("b", null, "Fill in all four")]); return; }
      smd.recipes.push({ out: gives.value.trim(), ins: ins.map(x => x.value.trim()), from: today(), to: to.value || today(), mine: true }); smAdding = false; redraw();
    } });
    f.append(...ins, gives, to, ok, dl);
    rbody.append(f);
  }
  if (smRecTab === "past") { const pg = el("div", "sm-recs"); past.forEach(r => pg.append(recipe(r))); rbody.append(past.length ? pg : emptyNote("No past recipes yet")); }
  else if (now) rbody.append(recipe(now, left > 0 ? plural(left, "day") + " left" : "Last day"));
  else rbody.append(emptyNote("No recipe on now"));
  rp.append(rbody);
  if (motion.changed("sm:rectab", [smRecTab, smAdding]) && !first) motion.swap(rbody); // Now / History: the box's contents swap
  lower.append(rp);

  const res = el("section", "mc-panel sm-box");
  res.append(head("Results", smd.log.length ? tabs(smResTab, [["kind", "By kind"], ["hist", "History"]], k => { smResTab = k; }) : null,
    button("Share", { cls: "linkbtn sm-act", icon: "share", tip: "Send your results to friends, or bring in theirs", onClick: () => openShare({ smelts: smd.log.map(e => e.id) }) })));
  const rsb = el("div", "sm-scroll"); res.append(rsb);
  if (!smd.log.length) rsb.append(el("span", "sm-dim", "Log your smelts to see what each kind really gives."));
  else {
    const S = smStats(smd.log), t = el("table", "sm-table");
    const hr = el("tr"); [["Kind"], ["Smelts"], ["Avg", "What comes back against what went in, on average"], ["Red", "How often a red came out"]].forEach(([h, tip]) => { const th = el("th", null, h); if (tip) th.dataset.tip = tip; hr.append(th); }); t.append(hr);
    Object.keys(SMELT_KINDS).filter(k => S[k]).forEach(k => {
      const s = S[k], g = s.outV / s.n - s.inV / s.n, tr = el("tr");
      tr.dataset.kind = k;
      tr.append(el("td", null, SMELT_KINDS[k]), el("td", null, String(s.n)), el("td", g >= 0 ? "up" : "down", smSigned(g)), el("td", s.red ? "red" : null, Math.round(s.red / s.n * 100) + "%"));
      if (s.n < 20) tr.dataset.tip = "Few smelts yet: this will still move a lot";
      t.append(tr);
    });
    const ul = el("div", "sm-entries");
    if (smResTab === "hist") smd.log.forEach(e => {
      const r = el("div", "sm-entry");
      const ins = el("span", "sm-eins"); e.ins.forEach(id => { const p = smPic(id); p.dataset.tip = (smItem(id) || {}).name || id; ins.append(p); });
      const o = smPic(e.out); o.dataset.tip = ((smItem(e.out) || {}).name || e.out) + (e.by ? "\nfrom " + e.by : "");
      const g = e.outV - e.inV.reduce((a, b) => a + b, 0);
      r.dataset.tip = fmtDate(e.at);
      r.append(ins, el("span", "sm-arrow", "→"), o, el("b", g >= 0 ? "up" : "down", smSigned(g)));
      r.append(button(null, { cls: "linkbtn sm-del", icon: "trash", tip: "Delete this smelt", onClick: async () => {
        if (!await confirmBox({ title: "Delete this smelt?", body: [el("span", "c-name", smeltLabel(e))], ok: "Delete smelt", danger: true })) return;
        smd.log = smd.log.filter(x => x !== e); redraw(); toast([el("span", null, "Smelt deleted: "), el("b", null, smeltLabel(e))]);
      } }));
      ul.append(r);
    });
    rsb.append(smResTab === "hist" ? ul : t);
  }
  if (motion.changed("sm:restab", smResTab) && !first) motion.swap(rsb);
  // a smelt just logged: its line (History) or its kind's row lights up
  const newest = smd.log[0];
  if (motion.changed("sm:last", newest && newest.id) && !first && newest) motion.flash(smResTab === "hist" ? rsb.querySelector(".sm-entry") : rsb.querySelector(`tr[data-kind="${newest.kind}"]`));
  lower.append(res);
  page.append(lower);
  sec.append(page);
  pageEl.scrollTop = keepTop;
  if (first) motion.stagger([st, rp, res]); // opening the Smelter: the panels come in
}
export let smAdding = false, smRecTab = "now", smResTab = "kind";

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("smelter", { draw: renderSmelter, redraw: smDraw });
