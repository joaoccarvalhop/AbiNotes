/* The Tier list page: the S/A/B/C/D rows, the pool, drag and drop, the kinds. Loaded the first time it opens
   (loadPage in app.js). Where things are ranked (tl, tlRank, tlOrder, the chips) is in app.js: Builds, Gear,
   Loadouts, Home and Share use it. tlDraw() in app.js redraws this page when it is in. */
import { area, registerPage } from "../app.js";
import { $, button, data, el, emptyNote, motion, norm, plural } from "../js/base.js";
import { openGear } from "../js/overlays/weapon.js";
import { fitToScreen } from "../js/page-data.js";
import { afterTiers, saveTl, tl, TL_COLORS, TL_KINDS, tlCount, tlList } from "../js/rankings.js";
import { openShare } from "../js/share.js";
import { confirmBox, ddSelect } from "../js/ui.js";

// moves an item into a row at a place (or out of every row: row null)
export function tlMove(L, name, row, at) {
  L.rows.forEach(r => { const i = r.items.indexOf(name); if (i >= 0) { r.items.splice(i, 1); if (r === row && i < at) at--; } });
  if (row) row.items.splice(Math.max(0, Math.min(at, row.items.length)), 0, name);
}
export let tlQ = "", tlPick = null, tlDrag = null; // the pool's search; the item picked by a click (a click on a row puts it there); the one being dragged
// the whole page (tlDraw in app.js calls this)
function drawTiers() {
  const sec = $("tiers"); if (!sec || area !== "tiers") return;
  const first = motion.opened("tiers");
  sec.textContent = "";
  const K0 = TL_KINDS.find(k => k.k === tl.kind) || TL_KINDS[0];
  // guns: all of them in one list, or one list per category
  const cats = data.categories.map(c => c.name), gunCat = K0.k === "guns" && cats.includes(tl.gunCat) ? tl.gunCat : "";
  const key = gunCat ? "guns:" + gunCat : K0.k, L = tlList(key);
  const all = K0.items().filter(it => !gunCat || it.group === gunCat), byName = new Map(all.map(x => [x.name, x]));
  L.rows.forEach(r => { r.items = r.items.filter(n => byName.has(n)); }); // an item no longer in the game drops out quietly
  const ranked = new Set(L.rows.flatMap(r => r.items));
  if (tlPick && !byName.has(tlPick)) tlPick = null;
  const redraw = () => { saveTl(); drawTiers(); afterTiers(); };
  const page = el("div", "tl-page");

  // an item: its picture, the name on hover. Drag it, or click it and then click where it goes
  const tile = it => {
    const t = el("div", "tl-item" + (tlPick === it.name ? " picked" : "")); t.draggable = true; t.tabIndex = 0; t.setAttribute("role", "button");
    t.dataset.name = it.name; t.setAttribute("aria-label", it.name);
    t.dataset.tip = it.name + (ranked.has(it.name) ? "\nRight click: back to unranked" : "");
    t.append(it.pic(), el("span", "tl-iname", it.name));
    // its overlay (stats, builds, prices…): the (i) in the corner on hover, or a double click
    const open = () => (it.open || (() => openGear(it.name)))();
    const info = button(null, { cls: "tl-info", icon: "info", tip: "Details" }); info.draggable = false;
    info.addEventListener("click", e => { e.stopPropagation(); open(); });
    t.append(info);
    t.addEventListener("dblclick", e => { e.stopPropagation(); open(); });
    t.addEventListener("dragstart", e => { tlDrag = it.name; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.name); requestAnimationFrame(() => t.classList.add("dragging")); });
    t.addEventListener("dragend", () => { tlDrag = null; t.classList.remove("dragging"); sec.querySelectorAll(".tl-before, .tl-over").forEach(x => x.classList.remove("tl-before", "tl-over")); });
    // picked without drawing again (so a double click still reaches the same item)
    const pick = e => {
      e.stopPropagation(); tlPick = tlPick === it.name ? null : it.name;
      sec.querySelectorAll(".tl-item.picked").forEach(x => x.classList.remove("picked")); t.classList.toggle("picked", !!tlPick);
      sec.querySelectorAll(".tl-row .tl-zone").forEach(z => z.classList.toggle("can", !!tlPick));
      const pz = sec.querySelector(".tl-poolzone"); if (pz) pz.classList.toggle("can", !!tlPick && ranked.has(tlPick));
    };
    t.addEventListener("click", pick);
    t.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });
    t.addEventListener("contextmenu", e => { if (!ranked.has(it.name)) return; e.preventDefault(); tlMove(L, it.name, null); tlPick = null; redraw(); });
    return t;
  };
  // where in a box the pointer is: before which item (null: at the end)
  const spot = (zone, e) => [...zone.querySelectorAll(".tl-item:not(.dragging)")].find(c => { const r = c.getBoundingClientRect(); return e.clientY < r.bottom && (e.clientY < r.top || e.clientX < r.left + r.width / 2); }) || null;
  const dropZone = (zone, row) => {
    zone.addEventListener("dragover", e => {
      if (!tlDrag) return; e.preventDefault(); e.dataTransfer.dropEffect = "move";
      sec.querySelectorAll(".tl-before, .tl-over").forEach(x => x.classList.remove("tl-before", "tl-over"));
      const b = row && spot(zone, e); if (b) b.classList.add("tl-before"); else zone.classList.add("tl-over");
    });
    zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("tl-over"); });
    zone.addEventListener("drop", e => {
      if (!tlDrag) return; e.preventDefault();
      const b = row && spot(zone, e), at = b ? row.items.indexOf(b.dataset.name) : row ? row.items.length : 0;
      tlMove(L, tlDrag, row, at < 0 ? row.items.length : at); tlDrag = null; tlPick = null; redraw();
    });
    // a click on the box puts the picked item there (at the end)
    zone.addEventListener("click", () => { if (!tlPick) return; tlMove(L, tlPick, row, row ? row.items.length : 0); tlPick = null; redraw(); });
  };

  /* the tiers */
  // the section's own bar, like Gear's: the kinds as tabs; on the right which guns (all, or one category) and the actions
  const bar = $("sub-tiers"); bar.textContent = "";
  const jump = el("nav", "g-jump"); jump.setAttribute("role", "tablist"); jump.setAttribute("aria-label", "Tier lists");
  TL_KINDS.forEach(k => {
    const b = el("button", null, k.label); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(k === K0));
    b.addEventListener("click", () => { tl.kind = k.k; tlPick = null; tlQ = ""; saveTl(); drawTiers(); });
    jump.append(b);
  });
  const tools = el("div", "tools tl-tools");
  if (K0.k === "guns") {
    const n = v => tlCount(v ? "guns:" + v : "guns");
    tools.append(ddSelect("Guns", [["", "All guns", n("") ? plural(n(""), "gun") + " ranked" : "One list for every gun"], ...cats.map(c => [c, c, n(c) ? plural(n(c), "gun") + " ranked" : "A list of its own"])],
      () => gunCat, v => { tl.gunCat = v; tlPick = null; saveTl(); drawTiers(); }));
  }
  tools.append(
    button("Add tier", { icon: "plus", tip: "A new tier at the bottom", onClick: () => { L.rows.push({ name: String.fromCharCode(65 + L.rows.length - 1), items: [] }); redraw(); } }),
    button("Start again", { icon: "undo", tip: "Everything in this list back to unranked", onClick: async () => {
      if (ranked.size && !await confirmBox({ title: "Start this list again?", body: [el("p", null, `${plural(ranked.size, "item")} go back to unranked.`)], ok: "Start again", danger: true })) return;
      delete tl.lists[key]; tlPick = null; redraw();
    } }),
    button("Share", { icon: "share", tip: "Send this tier list to friends, or bring in theirs", onClick: () => openShare({ tiers: tlCount(key) ? [key] : [] }) }));
  bar.append(jump, tools);

  const main = el("section", "mc-panel tl-main");
  const rows = el("div", "tl-rows");
  L.rows.forEach((r, i) => {
    const row = el("div", "tl-row"); row.style.setProperty("--c", TL_COLORS[Math.min(i, TL_COLORS.length - 1)]);
    const name = el("input", "tl-name"); name.value = r.name; name.maxLength = 10; name.setAttribute("aria-label", "Tier name"); name.dataset.tip = "Click to rename";
    name.addEventListener("change", () => { r.name = name.value.trim() || r.name; redraw(); });
    name.addEventListener("keydown", e => { if (e.key === "Enter") name.blur(); });
    const zone = el("div", "tl-zone" + (tlPick ? " can" : ""));
    r.items.forEach(n => zone.append(tile(byName.get(n))));
    dropZone(zone, r);
    const x = button(null, { cls: "linkbtn tl-del", icon: "trash", tip: r.items.length ? "Remove this tier (its items go back to unranked)" : "Remove this tier", onClick: () => { L.rows.splice(i, 1); redraw(); } });
    x.hidden = L.rows.length < 2;
    row.append(name, zone, x);
    rows.append(row);
  });
  main.append(rows);

  /* what's not ranked yet */
  const pool = el("section", "mc-panel tl-pool");
  const left = all.filter(it => !ranked.has(it.name)), q = norm(tlQ), shown = left.filter(it => !q || norm(it.name).includes(q));
  const ph = el("h3", "mc-h tl-poolh", "Unranked"); ph.append(el("small", null, String(left.length)));
  const qi = el("input"); qi.type = "search"; qi.placeholder = "Find…"; ph.append(qi); qi.value = tlQ; qi.setAttribute("aria-label", "Find an item");
  qi.addEventListener("input", () => { tlQ = qi.value; clearTimeout(qi.t); qi.t = setTimeout(() => { drawTiers(); const n = $("tiers").querySelector(".tl-pool input[type=search]"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 150); });
  const pz = el("div", "tl-zone tl-poolzone" + (tlPick && ranked.has(tlPick) ? " can" : ""));
  let grp = null;
  shown.forEach(it => { if (it.group && it.group !== grp && !gunCat) { grp = it.group; pz.append(el("h4", "tl-group", grp)); } pz.append(tile(it)); });
  if (!shown.length) pz.append(emptyNote(left.length ? "Nothing matches your search." : "Everything is ranked."));
  dropZone(pz, null);
  pool.append(ph, pz);

  page.append(main, pool);
  sec.append(page);
  fitToScreen(page);
  if (first) motion.stagger([main, pool]);
}

document.addEventListener("keydown", e => { if (e.key === "Escape" && tlPick && area === "tiers") { tlPick = null; drawTiers(); } });

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("tiers", { draw: drawTiers });
