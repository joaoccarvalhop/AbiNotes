/* The Trading page: loaded the first time the page opens (loadPage in app.js), after nothing: the reset clock (trEvents, trStatus) is in app.js, for Home. */
import { area, registerPage } from "../app.js";
import { $, button, copyLine, el, fmtKoen, icon, K, ls, motion, plural } from "../js/base.js";
import { trClock, trEvents, trIn, trStatus } from "../js/page-data.js";
import { confirmBox, infoDot, rangeFilter, toast } from "../js/ui.js";

/* ---------- Trading: the calculator, the codes and the live list (the clock above it is in app.js) ---------- */
// prices move, so buying and selling are ranges (the guide's example: bought ~5,800, sold ~7,000, 5,200 rounds of M995)
export const TR_DEFAULT = { ref: 6400, qty: 5200, buyLo: 5600, buyHi: 6000, sellLo: 6700, sellHi: 7200, stack: 120, fee: 60000 };
export const trd = Object.assign({ ...TR_DEFAULT }, ls.get(K.trade) || {});
if (trd.buyLo == null) Object.assign(trd, { buyLo: TR_DEFAULT.buyLo, buyHi: TR_DEFAULT.buyHi, sellLo: TR_DEFAULT.sellLo, sellHi: TR_DEFAULT.sellHi }); // saved before the ranges
delete trd.buy; delete trd.sell;
export const saveTr = () => ls.set(K.trade, trd);
// the hauling loadouts from the guide (l1as_tv): the biggest rig and backpack, laid out for each ammo
export const TR_CODES = [["M995 · 2×3 boxes", "Equipment-3fcapxBFXpJCOf4w4"], ["M995 · 3×3 boxes", "Equipment-3fcapxBFXpJCOf4l4"], ["DVC12 · 2×3 boxes", "Equipment-3fcapxBFXpJCOf4c4"],
  ["DVC12 · 3×3 boxes", "Equipment-3fcapxBFXpJCOf4e4"], ["BS · 2×3 boxes", "Equipment-3fyaiaeOnaH9wf4z4"]];
// the tricks: one line each, the how on hover
export const TR_TIPS = [
  ["Ammo resells at once", "Most things you buy stay locked until they've been in a raid. Ammo doesn't, which is why it's the usual thing to flip."],
  ["Buy at the reset, sell when it's dry", "Right after a reset the price drops for a while: that's when to buy. Sell between {sell}, your time, when no resets come."],
  ["Undercut by 50", "If the lowest listing is 6,700, list at 6,650. Being first sells it before the next reset; 50 a round is cheap for that."],
  ["Stop selling before a reset", "When one is near, the price is about to crash: what's still listed sells cheap, and the listing fee is lost."],
  ["The red row alarm", "Keep about 33–34M in cash. While the price is high a second row shows in red (you can't afford it); the moment it turns into a normal Buy, a reset has happened. Glance at it instead of reading numbers."],
  ["Park the rest of your cash", "Over the threshold, buy Golden Pens or Jade Bracelets when they cost about what a vendor pays, or leave yesterday's money unclaimed in the mail."],
  ["The mail trick", "Fill the stash leaving 2–3 free slots, buy 8–10 stacks, press Buy then Cancel at once: it all goes to your mail, where it can stay for days without taking stash space."],
];
export function trDraw() {
  const sec = $("trading"); if (!sec || area !== "trading") return;
  const first = motion.opened("trading");
  sec.textContent = "";
  const page = el("div", "tr-page");
  const head = (title, ...extra) => { const h = el("h3", "mc-h", title); h.append(...extra.filter(Boolean)); return h; };

  /* the reset clock: now, the next one, and the day laid out in your time */
  const clock = el("section", "mc-panel tr-clock");
  clock.append(head("Market resets", infoDot("All times are your computer's. From ABI Builder's ammo resets guide (click to open). The \"maybe\" ones don't come every day", "https://abibuilder.com/guides/ammo-resets-guide")));
  const live = el("div", "tr-live"); clock.append(live);
  page.append(clock);

  /* the math of one trade */
  const calc = el("section", "mc-panel tr-calc");
  calc.append(head("Profit", button(null, { cls: "linkbtn sm-act", icon: "undo", tip: "Back to the guide's example (5,200 rounds of M995)", onClick: () => { Object.assign(trd, TR_DEFAULT); saveTr(); trDraw(); } })));
  const form = el("div", "tr-form"), outs = el("div", "tr-out");
  const num = (key, label) => {
    const i = el("input", "m-price-in"); i.inputMode = "numeric"; i.value = (trd[key] || 0).toLocaleString("en-US"); i.setAttribute("aria-label", label);
    i.addEventListener("input", () => { const d = i.value.replace(/\D/g, ""); trd[key] = +d || 0; i.value = d ? (+d).toLocaleString("en-US") : ""; saveTr(); sum(); });
    return i;
  };
  const field = (label, tip, ...inputs) => {
    const l = el("div", "tr-field"); l.dataset.tip = tip; const row = el("div", "tr-pair");
    inputs.forEach((x, k) => { if (k) row.append(el("span", "tr-to", "–")); row.append(x); });
    l.append(el("small", null, label), row); form.append(l);
  };
  // the prices as ranges, on sliders (the shared two-handle one). Their scale runs from half to one and a half times the
  // market price you type, so it fits any item; changing that price redraws them
  // the scale for a market price: half to one and a half times it, in steps that suit its size
  const scaleOf = ref => { const step = ref >= 100000 ? 500 : ref >= 10000 ? 50 : 10; return { step, bottom: Math.floor(ref * .5 / step) * step, top: Math.ceil(ref * 1.5 / step) * step }; };
  const sliders = [];
  const rescale = () => {
    const sc = scaleOf(trd.ref || 6400);
    // the ends move into the scale, on the slider's own steps
    sliders.forEach(([r, lk, hk]) => { [lk, hk].forEach(k => { trd[k] = Math.round(Math.max(sc.bottom, Math.min(trd[k] || trd.ref, sc.top)) / sc.step) * sc.step; }); r.set(trd[lk], trd[hk], sc.top, sc.step, sc.bottom); });
  };
  const slide = (lk, hk, what) => {
    const r = rangeFilter(what, v => v.toLocaleString("en-US"), (lo, hi) => { trd[lk] = lo; trd[hk] = hi; saveTr(); sum(); }, { exact: true });
    sliders.push([r, lk, hk]); return r;
  };
  // a new market price moves the ranges with it (same proportions) and the sliders' scale at once, as you type
  if (!trd.ref) trd.ref = 6400;
  const refIn = num("ref", "Market price");
  // the ranges as fractions of the price when you start typing, so half-typed numbers (3, 30, 300…) never wear them down
  const PK = ["buyLo", "buyHi", "sellLo", "sellHi"];
  let base = null;
  const takeBase = () => { base = { ref: trd.ref, v: PK.map(x => trd[x] / trd.ref) }; };
  refIn.addEventListener("focus", takeBase);
  refIn.addEventListener("input", () => {
    if (!base) takeBase();
    clearTimeout(refIn.t);
    refIn.t = setTimeout(() => {
      const nw = trd.ref; if (!nw) return;
      PK.forEach((x, i) => { trd[x] = Math.round(base.v[i] * nw); });
      rescale(); saveTr(); sum();
    }, 250);
  });
  refIn.addEventListener("blur", () => { base = null; });
  field("Market price, each", "About what it goes for: the sliders below run from half to one and a half times this", refIn);
  field("Buy for, each", "What it costs right after a reset: drag from the cheapest to the dearest you expect", slide("buyLo", "buyHi", "buy price"));
  field("Sell for, each", "What it sells for when the market is dry: drag from the lowest to the highest you expect", slide("sellLo", "sellHi", "sell price"));
  field("How many", "Rounds (or items) you buy and sell", num("qty", "How many"));
  field("Per listing", "How many go in one listing (a stack of ammo is 120)", num("stack", "Per listing"));
  field("Fee per listing", "Tax and handling for each listing: about 60,000 for a stack of 995", num("fee", "Fee per listing"));
  rescale();
  const sum = () => {
    outs.textContent = "";
    const q = trd.qty, stacks = trd.stack ? Math.ceil(q / trd.stack) : 0, fees = stacks * trd.fee;
    const bLo = Math.min(trd.buyLo, trd.buyHi), bHi = Math.max(trd.buyLo, trd.buyHi), sLo = Math.min(trd.sellLo, trd.sellHi), sHi = Math.max(trd.sellLo, trd.sellHi);
    const net = (b, s) => q * (s - b) - fees;
    const worst = net(bHi, sLo), best = net(bLo, sHi), mid = net((bLo + bHi) / 2, (sLo + sHi) / 2);
    // how likely it pays: every buy and sell price in the ranges counted as equally likely
    let won = 0, all = 0; for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { all++; if (net(bLo + (bHi - bLo) * i / 40, sLo + (sHi - sLo) * j / 40) > 0) won++; }
    const pc = all ? won / all : 0, even = q ? (q * (bLo + bHi) / 2 + fees) / q : 0;
    const signed = v => (v >= 0 ? "+" : "−") + fmtKoen(Math.abs(Math.round(v)));
    // the profit as a band from the worst to the best case, with 0 marked
    const lo = Math.min(worst, 0), hi = Math.max(best, 0), span = hi - lo || 1, at = v => (v - lo) / span * 100;
    const band = el("div", "tr-band"), fill = el("i", "tr-fill" + (worst >= 0 ? " up" : best <= 0 ? " down" : ""));
    fill.style.left = at(worst) + "%"; fill.style.width = Math.max(.5, at(best) - at(worst)) + "%";
    const zero = el("i", "tr-zero"); zero.style.left = at(0) + "%"; zero.dataset.tip = "Break even";
    const likely = el("i", "tr-likely"); likely.style.left = at(mid) + "%"; likely.dataset.tip = `Likely: ${signed(mid)} (the middle of both ranges)`;
    band.append(fill, zero, likely);
    const ends = el("div", "tr-ends"); ends.append(el("span", worst >= 0 ? "up" : "down", "Worst " + signed(worst)), el("span", null, "Likely " + signed(mid)), el("span", best >= 0 ? "up" : "down", "Best " + signed(best)));
    const figs = el("div", "mc-sum tr-sum");
    const fig = (label, value, cls, tip) => { const d = el("div", "mc-fig"); d.append(el("small", null, label), el("b", cls || null, value)); if (tip) d.dataset.tip = tip; figs.append(d); };
    fig("Profit chance", Math.round(pc * 100) + "%", pc >= .5 ? "up" : "down", "How often it pays, if any price in your ranges is as likely as any other");
    fig("Spent", bLo === bHi ? fmtKoen(q * bLo) : `${fmtKoen(q * bLo)}–${fmtKoen(q * bHi)}`);
    fig("Fees", fmtKoen(fees), null, `${plural(stacks, "listing")} × ${fmtKoen(trd.fee)}`);
    fig("Sell for at least", q ? Math.ceil(even).toLocaleString("en-US") : "—", null, "Each, to break even (buying at the middle of your range, fees included)");
    outs.append(band, ends, figs);
  };
  sum();
  calc.append(form, outs);
  page.append(calc);

  /* the tricks, one line each */
  const tips = el("section", "mc-panel tr-tips");
  tips.append(head("Tricks"));
  const tl2 = el("div", "tr-tiplist");
  // the selling hours, in your time (the next window, or the one on now)
  const sw = trEvents().sells.find(s => s.to > new Date()), sellTxt = sw ? `${trClock(sw.from)} and ${trClock(sw.to)}` : "the quiet hours";
  TR_TIPS.forEach(([t, how]) => { const r = el("div", "tr-tip"); r.dataset.tip = how.replace("{sell}", sellTxt); r.append(icon("info"), el("span", null, t)); tl2.append(r); });
  tips.append(tl2);
  page.append(tips);

  /* the hauling loadouts: the guide's, then yours (added here, kept in the browser) */
  const codes = el("section", "mc-panel tr-codes");
  const mine = trd.codes || (trd.codes = []);
  codes.append(head("Hauling loadouts", infoDot("The 926 Premium Field Chest Rig (24 slots) and the RAL Heavy Military Backpack (50 slots; crafted at the workbench since season 5, or use a LUC Expanded Tactical Backpack, 45 slots). Paste a code in your storage's preset builds"),
    button("Add code", { cls: "linkbtn sm-act", icon: "plus", tip: "Keep a loadout code of your own here", onClick: () => { trAdding = !trAdding; trDraw(); } })));
  const row = (label, code, del) => {
    const r = el("div", "tr-code"), top2 = el("div", "tr-codehead"); top2.append(el("small", null, label));
    if (del) top2.append(button(null, { cls: "linkbtn sm-del", icon: "trash", tip: "Delete this code", onClick: del }));
    r.append(top2, copyLine(code, "code", label + " loadout code")); return r;
  };
  if (trAdding) {
    // a name and the code, then Save (nothing is kept until then)
    const f = el("div", "tr-addcode"), nm = el("input"), cd = el("input");
    nm.placeholder = "Name, e.g. M995 · my rig"; cd.placeholder = "Equipment-…"; nm.setAttribute("aria-label", "Name"); cd.setAttribute("aria-label", "Loadout code");
    const save = button("Save", { cls: "primary", onClick: () => {
      const code = cd.value.trim(); if (!code) { cd.focus(); return; }
      mine.push({ id: "c-" + Date.now().toString(36), name: nm.value.trim() || "My loadout", code }); trAdding = false; saveTr(); trDraw();
      toast([el("span", null, "Code added: "), el("b", null, mine[mine.length - 1].name)]);
    } });
    [nm, cd].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") save.click(); if (e.key === "Escape") { trAdding = false; trDraw(); } }));
    f.append(nm, cd, save, button("Cancel", { cls: "linkbtn", onClick: () => { trAdding = false; trDraw(); } }));
    codes.append(f); setTimeout(() => nm.focus());
  }
  if (mine.length) {
    codes.append(el("h4", "tr-sub", "Yours"));
    mine.forEach(c => codes.append(row(c.name, c.code, async () => {
      if (!await confirmBox({ title: "Delete this code?", body: [el("span", "c-name", c.name)], ok: "Delete code", danger: true })) return;
      trd.codes = mine.filter(x => x !== c); saveTr(); trDraw(); toast([el("span", null, "Code deleted: "), el("b", null, c.name)]);
    })));
    codes.append(el("h4", "tr-sub", "From the guide"));
  }
  TR_CODES.forEach(([label, code]) => codes.append(row(label, code)));

  // two columns that stack on their own (no row lines them up, so a short panel leaves no hole)
  const colL = el("div", "tr-col"), colR = el("div", "tr-col");
  colL.append(clock, tips); colR.append(calc, codes);
  page.textContent = ""; page.append(colL, colR);
  sec.append(page);
  trLive();
  if (first) motion.stagger([clock, calc, tips, codes]);
}
export let trAdding = false; // the "Add code" form is open
// the clock part alone, redrawn every half minute while you look at it
export function trLive() {
  const live = document.querySelector("#trading .tr-live"); if (!live) return;
  const now = new Date(), S = trStatus(now), E = trEvents(now);
  live.textContent = "";
  // what to do now, and the next reset
  const top = el("div", "tr-now tr-" + S.kind);
  const word = el("b", "tr-word", S.word);
  const nx = el("div", "tr-next");
  // every time here is your computer's clock and time zone (named, so it's never in doubt)
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").split("/").pop().replace(/_/g, " ");
  if (S.next) nx.append(el("small", null, `Next reset · ${zone || "your"} time`), el("b", null, trClock(S.next.from)), el("span", null, `in ${trIn(S.next.from - now)}${S.next.sure ? "" : " · maybe"}`));
  // the left says what to do; the time to the next reset is said once, on the right
  const DO = { buy: "Buy now: prices are down", hold: "Stop selling: prices are about to drop", sell: "Sell now: the market is dry", wait: "Nothing to do yet" };
  top.append(word, el("span", "tr-line", DO[S.kind]), nx);
  live.append(top);
  // your day, 00:00 to 24:00 your time: the selling hours as a band, the resets as marks, now as a line
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const pos = t => (t - d0) / (d1 - d0) * 100;
  const bar = el("div", "tr-bar");
  E.sells.forEach(s => { const a = Math.max(0, pos(s.from)), b = Math.min(100, pos(s.to)); if (b > a) { const x = el("i", "tr-sellband"); x.style.left = a + "%"; x.style.width = b - a + "%"; x.dataset.tip = `Selling time: ${trClock(s.from)}–${trClock(s.to)}`; if (b - a > 8) x.append(el("span", null, "Sell")); bar.append(x); } }); // named when there's room
  const today = E.resets.filter(r => r.from >= d0 && r.from < d1);
  today.forEach(r => {
    const x = el("i", "tr-mark" + (r.sure ? "" : " maybe") + (r.to - r.from > 15 * 60000 ? " span" : "") + (r.to < now ? " past" : ""));
    x.style.left = pos(r.from) + "%"; if (r.to - r.from > 15 * 60000) x.style.width = pos(r.to) - pos(r.from) + "%";
    x.dataset.tip = `${trClock(r.from)}${r.to - r.from > 15 * 60000 ? "–" + trClock(r.to) : ""}${r.sure ? "" : " · maybe"}${r.tip ? "\n" + r.tip : ""}`;
    bar.append(x);
  });
  const nowL = el("i", "tr-nowline"); nowL.style.left = pos(now) + "%"; nowL.dataset.tip = "Now · " + trClock(now); bar.append(nowL);
  bar.dataset.tip = `Today, ${zone || "your"} time (your computer's clock)`;
  const hours = el("div", "tr-hours"); for (let h = 0; h <= 24; h += 3) { const s = el("span", null, String(h % 24).padStart(2, "0") + ":00"); s.style.left = h / 24 * 100 + "%"; hours.append(s); }
  live.append(bar, hours);
  // today's resets as a list, in your time (the past ones dimmed)
  const list = el("div", "tr-list");
  today.forEach(r => {
    const row = el("div", "tr-row" + (r.to < now ? " past" : "") + (r === S.next || r === S.on ? " next" : ""));
    row.append(el("b", null, trClock(r.from) + (r.to - r.from > 15 * 60000 ? "–" + trClock(r.to) : "")), el("span", null, r.to < now ? "Done" : r.from <= now ? "On now" : "in " + trIn(r.from - now)), el("small", r.sure ? "sure" : "maybe", r.sure ? "Sure" : "Maybe"));
    if (r.tip) row.dataset.tip = r.tip;
    list.append(row);
  });
  live.append(list);
}
setInterval(() => { if (area === "trading") trLive(); }, 30000);

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("trading", { draw: trDraw });
