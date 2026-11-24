/* The price overlay: an item's history and chart, update a price or add an item. */
import { PAGES, renderGear, renderLoadouts, renderMarket } from "../../app.js";
import { $, button, delButton, el, fmtKoen, icon, market, setPricesDirty } from "../base.js";
import { EXTRA, extraByName, GEAR, gearByName, gearImg } from "../gear-data.js";
import { catLabel, change, COND_SHARE, condDur, CONDITION_CATS, CONDS, fmtDate, itemByName, itemImg, marketItemFor, priceChart, priceHistory, today } from "../market-data.js";
import { keyDoor, openMarkerOnMap } from "../page-data.js";
import { openShare } from "../share.js";
import { closeDialog, confirmBox, navBack, navReplace, navReset, present, setNavReplace, toast, wireDialog } from "../ui.js";
import { usedIn } from "./gear.js";
import { closeLo } from "./loadout.js";
import { closeGear, gmSection, openGear } from "./weapon.js";

/* ---------- price overlay: history, chart, update or add ---------- */
export const pm = $("pricemodal");
export let pmId = null;
export function openPrice(id) {
  pmId = id;
  const it = id ? market.items.find(i => i.id === id) : null;
  const h = it ? priceHistory(it.id) : [];
  const top = $("pm-top"); top.textContent = "";
  const titles = el("div", "gm-titles");
  const t = el("h2", null, it ? it.name : "Add an item"); t.id = "pm-title";
  titles.append(t, el("p", null, it ? `${catLabel(it.cat)} · ${h.length} price${h.length === 1 ? "" : "s"} recorded` : "Name, category and today's market price"));
  top.append(it ? itemImg(it) : el("span", "g-img none", "+"), titles);
  top.firstChild.classList.add("huge");

  const body = $("pm-body"); body.textContent = "";
  if (it && h.length) {
    const l = h[h.length - 1], c = change(h);
    const g = el("div", "gm-stats");
    const st = (label, v, cls) => { const d = el("div", "gm-stat" + (cls ? " " + cls : "")); d.append(el("small", null, label), el("b", null, v)); return d; };
    const vs = h.map(x => x.price);
    g.append(st(typeof l.all === "object" ? "Now · New" : "Now", fmtKoen(l.price)), st("Change", c == null ? "—" : `${c > 0 ? "▲ " : c < 0 ? "▼ " : ""}${Math.abs(c).toFixed(1)}%`, c > 0 ? "neg" : c < 0 ? "best" : ""),
      st("Lowest", fmtKoen(Math.min(...vs))), st("Highest", fmtKoen(Math.max(...vs))));
    body.append(gmSection("Price", g));
    // gear sold New / Like New / Worn: durability changes the price
    if (typeof l.all === "object") {
      const cg = el("div", "gm-stats");
      CONDS.forEach(([k, label]) => { if (l.all[k] != null) cg.append(st(label + (l.all[k + "Dur"] ? ` · ${l.all[k + "Dur"]}` : ""), fmtKoen(l.all[k]))); });
      body.append(gmSection("By condition", cg, el("p", "gm-note", "Worn and Like New sell for less because the durability is lower. New is the price used everywhere else on the page.")));
    }
    const list = el("div", "m-hist");
    [...h].reverse().forEach(x => { const r = el("div", "m-hrow"); r.append(el("span", null, fmtDate(x.date)), el("span", "m-src", x.source && x.source !== "manual" ? x.source : "Entered by hand"), el("b", null, fmtKoen(x.price))); list.append(r); });
    body.append(gmSection("History", priceChart(h), list));
  }
  // links out: the piece in Gear, and the loadouts that wear it
  const gname = it && ((gearByName(it.name) || extraByName(it.name) || {}).name
    || [...GEAR, ...EXTRA].find(x => marketItemFor(x.name, it.cat) === it)?.name);
  if (it) {
    // updating opens the form on its own, with ← Back to here
    const upd = el("button", null, "Update price"); upd.type = "button"; upd.prepend(icon("edit")); upd.addEventListener("click", () => openPriceEdit(it, null));
    const t = el("div", "gm-tools"); t.append(upd);
    if (gname) t.append(button("Open in Gear", { icon: "gear", onClick: () => openGear(gname) }));
    // a key: the door it opens, on its map (once the maps are in)
    keyDoor(it.name, d => {
      if (!d || pmId !== it.id) return; // (a stale overlay's row is detached: adding to it shows nothing)
      t.append(button("Show on map", { icon: "map", tip: `The door on ${d.map}${d.mk.l ? ", floor " + d.mk.l : ""}`, onClick: () => openMarkerOnMap(d.slug, d.mk) }));
    });
    titles.append(t); // in the header, like the gear overlay
  } else body.append(gmSection("New item", priceForm(null, null, id => openPrice(id))));
  if (gname) usedIn(gname, body);
  const foot = $("pm-foot"); foot.textContent = "";
  if (it) {
    const del = delButton("Delete this item and its prices");
    del.addEventListener("click", async () => {
      const yes = await confirmBox({ title: "Delete this item?", body: [el("span", "c-name", it.name), el("p", null, "Its whole price history goes with it.")], ok: "Delete item", danger: true });
      if (!yes) return;
      market.items.splice(market.items.indexOf(it), 1);
      market.snapshots.forEach(s => { delete s.prices[it.id]; });
      market.snapshots = market.snapshots.filter(s => Object.keys(s.prices).length);
      setPricesDirty(true); closePrice(); renderMarket(); renderGear(); renderLoadouts();
      toast([el("span", null, "Item deleted: "), el("b", null, it.name)]); // like every other delete
    });
    // the latest prices, ready to send (the overlay's own Share, like a loadout's)
    const a2 = el("div", "m-actions"); a2.append(button("Share", { icon: "share", tip: "Send your latest market prices to friends", onClick: () => openShare({ prices: "latest" }) }));
    foot.append(del, a2);
  }
  present(pm, it ? it.name : "Add an item", () => openPrice(id));
  const first = body.querySelector(".m-form input"); if (first) first.focus();
}
// only the price form, in the price overlay; ← Back (or Cancel, or saving) returns to where you came from
// It takes over the overlay you are in (gear, loadout or price) instead of opening another one
export const PE_HOSTS = { gearmodal: ["gm", () => closeGear()], lomodal: ["lm", () => closeLo()], pricemodal: ["pm", () => closePrice()] };
export function openPriceEdit(it, preset, hostId) {
  hostId = hostId || Object.keys(PE_HOSTS).find(id => $(id).open) || "pricemodal";
  const [p, close] = PE_HOSTS[hostId], dlg = $(hostId), name = it ? it.name : preset.name;
  if (hostId === "pricemodal") pmId = it ? it.id : null;
  const top = $(p + "-top"); top.textContent = "";
  const titles = el("div", "gm-titles"), t = el("h2", null, it ? "Update price" : "Add a price"); t.id = p + "-title";
  titles.append(t, el("p", null, it ? catLabel(it.cat) + " · " + name : name));
  top.append(it ? itemImg(it) : gearImg(name), titles);
  top.firstChild.classList.add("huge");
  const leave = () => { if (!navBack()) close(); };
  const body = $(p + "-body"); body.textContent = "";
  const form = priceForm(it, preset, leave); form.id = "pe-form";
  body.append(form);
  // Save (and its message) go down next to Cancel
  const acts = form.querySelector(".m-actions"), save = acts.querySelector("button.primary");
  save.setAttribute("form", form.id);
  const cancel = el("button", null, "Cancel"); cancel.type = "button"; cancel.addEventListener("click", leave);
  save.before(cancel);
  const foot = $(p + "-foot"); foot.textContent = ""; foot.append(acts);
  present(dlg, (it ? "Update price · " : "Add a price · ") + name, () => openPriceEdit(it, preset, hostId));
  const first = body.querySelector(".m-form input"); if (first) first.focus();
}
// the price form, usable in any overlay: it = market item (or null), preset = { name, cat, group } to create one for a known piece of gear
export function priceForm(it, preset, onSaved) {
  const h = it ? priceHistory(it.id) : [];
  const f = el("form", "m-form"); f.noValidate = true;
  const fld = (label, input) => { const l = el("label", "fld"); l.append(el("span", null, label), input); return l; };
  const name = el("input"); name.value = it ? it.name : ""; name.placeholder = "e.g. 5.56x45mm M855A1"; name.autocomplete = "off";
  const mSub = PAGES.market ? PAGES.market.sub() : "all"; // the Market's open subcategory, if you came from there
  const cat = el("input"); cat.value = it ? it.cat : (mSub !== "all" ? mSub : ""); cat.placeholder = "e.g. Ammo"; cat.setAttribute("list", "pm-cats"); cat.autocomplete = "off";
  const dl = el("datalist"); dl.id = "pm-cats"; [...new Set(market.items.map(i => i.cat))].forEach(c => { const o = document.createElement("option"); o.value = c; dl.append(o); });
  // digits only, grouped in threes as you type, with the short reading beside it
  const priceInput = (ph) => {
    const input = el("input", "m-price-in"); input.placeholder = ph || "e.g. 245,000"; input.autocomplete = "off"; input.inputMode = "numeric";
    const hint = el("small", "m-price-hint");
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
      const caret = input.value.length - input.selectionStart;
      input.value = digits ? Number(digits).toLocaleString("en-US") : "";
      const pos = Math.max(0, input.value.length - caret); input.setSelectionRange(pos, pos);
      hint.textContent = digits ? "≈ " + fmtKoen(Number(digits)) : "";
    });
    const box = el("div", "m-price-box"); box.append(input, hint);
    return { box, input, get: () => (input.value.replace(/\D/g, "") ? Number(input.value.replace(/\D/g, "")) : null) };
  };
  const msgEl = el("span", "msg");
  const conds = it ? (CONDITION_CATS.includes(it.cat) || (h.length && typeof h[h.length - 1].all === "object")) : !!(preset && CONDITION_CATS.includes(preset.cat));
  const lastAll = h.length && typeof h[h.length - 1].all === "object" ? h[h.length - 1].all : {};
  const maxDur = (() => { const d = lastAll.likeNewDur || lastAll.wornDur; if (d && String(d).includes("/")) return +String(d).split("/")[1]; const who = it || preset, g = who && (gearByName(who.name) || extraByName(who.name)); return g && g.dur ? g.dur : null; })();
  const fields = {};
  if (conds) {
    const grid = el("div", "m-conds-form");
    CONDS.forEach(([k, label]) => {
      const p = priceInput(lastAll[k] ? Number(lastAll[k]).toLocaleString("en-US") : "");
      const r = el("div", "m-cond-row");
      r.append(el("b", null, label), p.box);
      fields[k] = { p };
      if (k === "new") r.append(el("span", "m-dur m-dur-full", maxDur ? `${maxDur} / ${maxDur}` : "full"));
      else if (maxDur) {
        // fixed by the game, so shown, not asked
        const s = el("span", "m-dur m-dur-full", `${condDur(maxDur, k)} / ${maxDur}`);
        s.dataset.tip = `${label} always comes with ${COND_SHARE[k]}% durability`; r.append(s);
      } else {
        const d = el("input", "m-dur-in"); d.inputMode = "numeric"; d.autocomplete = "off"; d.placeholder = lastAll[k + "Dur"] ? String(lastAll[k + "Dur"]).split("/")[0] : "";
        d.addEventListener("input", () => { d.value = d.value.replace(/\D/g, "").slice(0, 3); });
        const dur = el("label", "m-dur"); dur.append(d, el("span", null, "durability"));
        dur.dataset.tip = "Durability of that offer"; r.append(dur);
        fields[k].d = d;
      }
      grid.append(r);
    });
    f.append(fld("Today's prices · fill the ones you saw", grid));
  } else {
    const p = priceInput(); fields.one = { p };
    const row = el("div", "row3");
    if (!it && !preset) row.append(fld("Name", name), fld("Category", cat), fld("Price today", p.box));
    else { row.classList.add("two"); row.append(fld("New price for today", p.box)); }
    f.append(row);
  }
  const save = el("button", "primary", it || preset ? "Save today's prices" : "Add item"); save.type = "submit";
  const acts = el("div", "m-actions"); acts.append(msgEl, save);
  f.append(dl, acts);
  const err = (t, focus) => { msgEl.textContent = t; msgEl.className = "msg err"; if (focus) focus.focus(); };
  f.addEventListener("submit", e => {
    e.preventDefault();
    if (!it && !preset && !name.value.trim()) return err("Give it a name.", name);
    if (!it && !preset && itemByName(name.value.trim())) return err("That item is already on the list.");
    let value;
    if (conds) {
      value = {};
      for (const [k, label] of CONDS) {
        const v = fields[k].p.get(); if (!v) continue;
        value[k] = v;
        if (k !== "new" && maxDur) value[k + "Dur"] = `${condDur(maxDur, k)}/${maxDur}`;
        else if (fields[k].d) {
          const cur = +fields[k].d.value || +fields[k].d.placeholder;
          if (!cur) return err(`Type the durability of the ${label} offer.`, fields[k].d);
          if (maxDur && cur > maxDur) return err(`${label} durability can't be above ${maxDur}.`, fields[k].d);
          value[k + "Dur"] = maxDur ? `${cur}/${maxDur}` : String(cur);
        }
      }
      if (!Object.keys(value).length) return err("Type at least one price.", fields.new.p.input);
    } else {
      value = fields.one.p.get();
      if (!value) return err("Type the price in Koen, e.g. 245,000.", fields.one.p.input);
    }
    let target = it;
    if (!target) {
      const nm = preset ? preset.name : name.value.trim();
      // an id from the name, never one already taken (two items on one id would mix their prices)
      const base = ((preset ? preset.cat + "-" : "") + nm).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
      let id = base; for (let n = 2; market.items.some(i => i.id === id); n++) id = base + "-" + n;
      target = { id, name: nm, cat: preset ? preset.cat : (cat.value.trim() || "Other") };
      if (preset && preset.group) target.group = preset.group;
      market.items.push(target);
    }
    let snap = market.snapshots.find(s => s.date === today() && s.source === "manual");
    if (!snap) { snap = { date: today(), source: "manual", prices: {} }; market.snapshots.push(snap); }
    // conditions you didn't type keep their last known price
    snap.prices[target.id] = conds ? { ...lastAll, ...(typeof snap.prices[target.id] === "object" ? snap.prices[target.id] : {}), ...value } : value;
    setPricesDirty(true); renderMarket(); renderLoadouts(); renderGear();
    toast([el("span", null, "Prices saved: "), el("b", null, target.name)]);
    setNavReplace(true); // the same overlay, refreshed: not a new step back
    onSaved(target.id);
  });
  return f;
}
export function closePrice() {
  navReset();
  if (!pm.open) return;
  closeDialog(pm);
}
wireDialog(pm, () => closePrice(), "pm-close");
