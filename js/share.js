/* Backup (everything this browser keeps for the hub, as one file) and Share: send loadouts, routes, keybinds, builds,
   tiers and prices as a code or a .abihub file; Import compares and lets you pick what to keep. */
import { PAGES, render, renderGear, renderLoadouts, renderMarket, tlDraw } from "../app.js";
import { $, button, clone, data, el, emptyNote, fmtCost, fmtK, fmtKoen, icon, insertBuild, market, norm, plural, setDirty, setPricesDirty, tierLabel, TIERS } from "./base.js";
import { kbUserPresets } from "./keybinds-data.js";
import { findBuild, isFav, LO_TIERS, loCost, loLevel, loTierChip } from "./loadouts-data.js";
import { fmtDate, latest, today } from "./market-data.js";
import { MAP_LIST, readRouteCode, refreshMaps, saveSm, smd, SMELT_KINDS, smItem } from "./page-data.js";
import { saveTl, tl, tlCount, tlLabel, tlList } from "./rankings.js";
import { closeDialog, confirmBox, navReset, present, thumb, toast, wireDialog } from "./ui.js";

/* ---------- backup: everything this browser keeps for the hub, in one file, and back ----------
   Your loadouts, builds, routes, keybinds and prices (the layer on top of the shared files), and every other setting: tier lists,
   smelts, trading codes, favourites, filters. Restoring replaces what's here, then reloads. */
export const BACKUP_APP = "ABI Hub backup";
export function backupKeys() { const out = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^abi-/.test(k)) out[k] = localStorage.getItem(k); } } catch (e) {} return out; }
export function downloadBackup() {
  const text = JSON.stringify({ app: BACKUP_APP, v: 1, at: today(), keys: backupKeys() });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `abi-hub-backup-${today()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast([el("span", null, "Backup ready: "), el("b", null, a.download)]);
}
export async function restoreBackup(text) {
  let b = null; try { b = JSON.parse(text); } catch (e) {}
  if (!b || b.app !== BACKUP_APP || !b.keys) return "That isn't an ABI Hub backup file.";
  const yes = await confirmBox({ title: "Restore this backup?", body: [el("span", "c-name", `Made on ${fmtDate(b.at)}`), el("p", null, "It replaces everything this browser keeps for the hub now.")], ok: "Restore", danger: true });
  if (!yes) return "";
  try {
    Object.keys(backupKeys()).forEach(k => localStorage.removeItem(k));
    Object.entries(b.keys).forEach(([k, v]) => { if (/^abi-/.test(k)) localStorage.setItem(k, v); });
  } catch (e) { return "This browser wouldn't keep the backup (storage is full or blocked)."; }
  location.reload();
  return "";
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
/* ---------- share: pick what to send (loadouts, routes, keybinds, builds, prices) as a code or a file; import picks what to keep ----------
   No server: the code or file carries the data. A code is the JSON, deflated, in base64url after "ABIHUB1.". Prices merge by date,
   so whoever read the market last wins, item by item. Route codes (ABI1-…) are accepted too. */
export const sm = $("sharemodal");
export const SHARE_PREFIX = "ABIHUB1.", CODE_SOFT_LIMIT = 1800; // past this, chat apps (Discord: 2000) cut it: offer the file
export let shareSel = null;   // what's ticked on the Share tab
export let shareTab = "share", importPack = null, importPick = null;

export async function packText(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let body = bytes, flag = "p";
  if (window.CompressionStream) {
    body = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    flag = "z";
  }
  let s = ""; for (let i = 0; i < body.length; i += 0x8000) s += String.fromCharCode(...body.subarray(i, i + 0x8000));
  return SHARE_PREFIX + flag + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function unpackText(text) {
  const t = String(text).trim().replace(/\s+/g, "");
  if (/^ABI1-/.test(t)) { const r = readRouteCode(t); return r ? { v: 1, routes: [{ ...r, id: "r-" + Date.now().toString(36) }] } : null; }
  if (!t.startsWith(SHARE_PREFIX)) return null;
  const flag = t[SHARE_PREFIX.length];
  const bin = Uint8Array.from(atob(t.slice(SHARE_PREFIX.length + 1).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  if (flag === "z" && !window.DecompressionStream) throw new Error("old-browser"); // said plainly in the import box
  const raw = flag === "z" ? new Uint8Array(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : bin;
  const obj = JSON.parse(new TextDecoder().decode(raw));
  return obj && obj.v === 1 ? obj : null;
}

// what can be shared, read fresh each time
export function shareSources() {
  const builds = [];
  data.categories.forEach(c => c.weapons.forEach(w => w.builds.forEach(b => { if (b.author && b.author !== "So1o") builds.push({ key: w.name + "|" + b.code, cat: c.name, weapon: w.name, build: b }); })));
  return {
    loadouts: (data.loadouts || []).map(lo => ({ key: lo.id || lo.name, label: lo.name, sub: `${lo.gun} · ${TIERS.find(t => t.key === loLevel(lo))?.label || ""}`, item: lo })),
    routes: (data.routes || []).filter(r => r.pts.length > 1).map(r => ({ key: r.id, label: r.name || "Route", sub: `${(MAP_LIST.find(m => m[0] === r.map) || [, r.map])[1]} · ${r.pts.length} points`, item: r })),
    keybinds: kbUserPresets().map(p => ({ key: p.id, label: p.name, sub: "Keybind preset", item: p })),
    builds: builds.map(b => ({ key: b.key, label: `${b.weapon} ${TIERS.find(t => t.key === b.build.tier)?.label || ""}`, sub: `by ${b.build.author} · ${b.build.code}`, item: b })),
    smelts: smd.log.map(e => ({ key: e.id, label: smeltLabel(e), sub: `${fmtDate(e.at)} · ${fmtKoen(e.outV)}${e.by ? " · from " + e.by : ""}`, item: e })),
    tiers: Object.keys(tl.lists).filter(k => tlCount(k) && tlLabel(k)).map(k => ({ key: k, label: tlLabel(k), sub: `${plural(tlCount(k), "item")} ranked`, item: { kind: k, rows: tlList(k).rows } })),
  };
}
export const smeltLabel = e => `${SMELT_KINDS[e.kind] || "Smelt"} → ${(smItem(e.out) || {}).name || e.out}`;
export const SHARE_KINDS = [["loadouts", "Loadouts"], ["routes", "Routes"], ["keybinds", "Keybinds"], ["builds", "Builds others added"], ["smelts", "Smelter results"], ["tiers", "Tier lists"]];
export const SHARE_KEYS = SHARE_KINDS.map(k => k[0]);

export function sharePayload() {
  const src = shareSources(), out = { v: 1, at: today(), app: "ABI Hub" };
  SHARE_KINDS.forEach(([k]) => {
    const picked = src[k].filter(x => shareSel[k].has(x.key));
    if (!picked.length) return;
    if (k === "loadouts") out.loadouts = picked.map(x => { // with its build, in case the friend doesn't have it
      const lo = clone(x.item), w = findBuild(lo.build, lo.gun);
      if (w && w.build) lo._build = { cat: w.cat.name, weapon: w.gun.name, build: w.build };
      return lo;
    });
    else if (k === "builds") out.builds = picked.map(x => ({ cat: x.item.cat, weapon: x.item.weapon, build: x.item.build }));
    else out[k] = picked.map(x => clone(x.item));
  });
  if (shareSel.prices !== "none") {
    // latest price of every item (one snapshot per date), or the whole history
    const snaps = shareSel.prices === "all" ? clone(market.snapshots) : (() => {
      const by = {};
      market.items.forEach(it => { const l = latest(it.id); if (!l) return; const k = l.date + "|" + (l.source || ""); (by[k] = by[k] || { date: l.date, source: l.source, prices: {} }).prices[it.id] = l.all; });
      return Object.values(by);
    })();
    const ids = new Set(snaps.flatMap(s => Object.keys(s.prices)));
    out.prices = { items: market.items.filter(i => ids.has(i.id)), snapshots: snaps };
  }
  return out;
}

// a route's share button: the global Share, with that route ticked
export function shareRoute(r) { openShare({ routes: [r.id] }); }
export function openShare(preset) {
  shareSel = { prices: "none", ...(preset || {}) };
  SHARE_KEYS.forEach(k => { if (!(shareSel[k] instanceof Set)) shareSel[k] = new Set(shareSel[k] || []); });
  shareTab = preset && preset.tab || "share";
  importPack = null; importPick = null;
  // opened from a loadout or a preset: show that kind first
  shareKind = SHARE_KEYS.find(k => shareSel[k].size) || null; shareQ = ""; shareF = "all"; shareScroll = 0;
  drawShare();
  present(sm, "Share", () => drawShare());
}
export function drawShare() {
  const top = $("sm-top"); top.textContent = "";
  const titles = el("div", "gm-titles"), h = el("h2", null, "Share & import"); h.id = "sm-title";
  titles.append(h, el("p", null, "Send your stuff to friends, bring theirs in, or keep a backup"));
  const ic = el("span", "g-img huge sm-ic"); ic.append(icon("share"));
  top.append(ic, titles);
  const body = $("sm-body"); body.textContent = "";
  const share = el("div", "gm-panel"), imp = el("div", "gm-panel"), bak = el("div", "gm-panel");
  // the tabs share one frame: the hidden ones still take their room (overlays keep their size)
  const nav = el("nav", "g-jump gm-tabs"); nav.setAttribute("role", "tablist");
  [["share", "Share", share], ["import", "Import", imp], ["backup", "Backup", bak]].forEach(([k, label, panel]) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(shareTab === k));
    panel.classList.toggle("off", shareTab !== k); panel.inert = shareTab !== k;
    b.addEventListener("click", () => { if (shareTab !== k) { shareTab = k; drawShare(); } });
    nav.append(b);
  });
  const panels = el("div", "gm-panels"); panels.append(share, imp, bak);
  body.append(nav, panels);
  drawSharePanel(share); drawImportPanel(imp); drawBackupPanel(bak);
  drawShareFoot();
}

export function pickList(items, set, onChange) {
  const box = el("div", "sh-list");
  items.forEach(x => {
    const row = el("label", "sh-row");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = set.has(x.key);
    cb.addEventListener("change", () => { cb.checked ? set.add(x.key) : set.delete(x.key); onChange(); });
    const t = el("span", "sh-text"); t.append(el("b", null, x.label), el("small", null, x.sub));
    row.append(cb, t);
    if (x.state) row.append(el("span", "sh-state " + x.stateClass, x.state));
    if (x.extra) row.append(x.extra);
    box.append(row);
  });
  return box;
}
export function groupHead(title, items, set, onChange) {
  const h = el("div", "sh-head");
  h.append(el("h3", null, `${title}`), el("small", null, `${[...set].filter(k => items.some(x => x.key === k)).length} of ${items.length}`));
  const all = el("button", "linkbtn", items.every(x => set.has(x.key)) ? "None" : "All"); all.type = "button";
  all.addEventListener("click", () => { const on = !items.every(x => set.has(x.key)); items.forEach(x => on ? set.add(x.key) : set.delete(x.key)); onChange(); });
  h.append(all);
  return h;
}
// the Share tab: what's picked on top, the kinds of things on the left, the open kind's list on the right
export let shareKind = null, shareQ = "", shareF = "all", shareScroll = 0;
export const SHARE_ICON = { loadouts: "bag", routes: "route", keybinds: "key", builds: "gun", prices: "chart", smelts: "layers", tiers: "tiers" };
export const SHARE_UNIT = { loadouts: ["loadout", "loadouts"], routes: ["route", "routes"], keybinds: ["keybind preset", "keybind presets"], builds: ["build", "builds"], smelts: ["smelt", "smelts"], tiers: ["tier list", "tier lists"] };
export function drawSharePanel(box) {
  const src = shareSources();
  // every kind is listed, even with nothing in it yet, so you know what can go out
  const kinds = [...SHARE_KINDS, ["prices", "Market prices"]];
  if (!kinds.some(([k]) => k === shareKind)) shareKind = (kinds.find(([k]) => k === "prices" || src[k].length) || kinds[0])[0];
  const redraw = () => { const l = $("sm-body").querySelector(".sh-pane .sh-list"); shareScroll = l ? l.scrollTop : 0; drawShare(); };
  const last = [...market.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  const PRICE_OPTS = [["none", "Don't send", "Leave prices out."],
    ["latest", "Latest prices", `The newest price of each item (${market.items.length.toLocaleString("en-US")} items${last ? ", yours from " + fmtDate(last.date) : ""}). Keeps friends up to date.`],
    ["all", "Whole history", "Every reading you have, so their charts show it too."]];

  // what's picked so far, each one removable
  const picked = el("div", "sh-picked");
  const chips = [];
  SHARE_KINDS.forEach(([k]) => { const n = shareSel[k].size; if (n) chips.push([k, `${n} ${SHARE_UNIT[k][n === 1 ? 0 : 1]}`]); });
  if (shareSel.prices !== "none") chips.push(["prices", (PRICE_OPTS.find(o => o[0] === shareSel.prices) || [])[1]]); // same words as the option: "Latest prices", "Whole history"
  if (!chips.length) picked.append(el("span", "sh-none", "Nothing picked yet. Choose on the left what to send."));
  chips.forEach(([k, t]) => {
    const c = el("span", "sh-chip"); c.append(icon(SHARE_ICON[k]), t);
    const x = el("button", null, "×"); x.type = "button"; x.title = "Remove"; x.setAttribute("aria-label", "Remove " + t);
    x.addEventListener("click", () => { if (k === "prices") shareSel.prices = "none"; else shareSel[k].clear(); redraw(); });
    c.append(x); picked.append(c);
  });
  box.append(picked);

  const split = el("div", "sh-split");
  // left: the kinds, with how many are picked
  const nav = el("nav", "sh-nav"); nav.setAttribute("aria-label", "What to share");
  kinds.forEach(([k, title]) => {
    const b = el("button", "sh-kind"); b.type = "button"; b.setAttribute("aria-current", String(k === shareKind));
    const count = k === "prices" ? (PRICE_OPTS.find(o => o[0] === shareSel.prices) || [])[1] : `${shareSel[k].size} of ${src[k].length}`;
    const t = el("span"); t.append(el("b", null, title), el("small", null, count));
    b.append(icon(SHARE_ICON[k]), t);
    if (k === "prices" ? shareSel.prices !== "none" : shareSel[k].size) b.classList.add("has");
    b.addEventListener("click", () => { shareKind = k; shareQ = ""; shareF = "all"; shareScroll = 0; drawShare(); });
    nav.append(b);
  });
  // right: the open kind
  const pane = el("div", "sh-pane");
  if (shareKind === "prices") {
    pane.append(el("h3", null, "Market prices"));
    const opts = el("div", "sh-opts");
    PRICE_OPTS.forEach(([v, t, d]) => {
      const b = el("button", "sh-opt"); b.type = "button"; b.setAttribute("aria-pressed", String(shareSel.prices === v)); b.disabled = !last && v !== "none";
      b.append(el("b", null, t), el("small", null, d));
      b.addEventListener("click", () => { shareSel.prices = v; redraw(); });
      opts.append(b);
    });
    pane.append(opts);
    if (shareSel.prices !== "none") pane.append(el("p", "sh-tip", "Prices make a long code: send the file instead."));
  } else {
    const all = src[shareKind], set = shareSel[shareKind];
    // filters: search, and for loadouts the quick ones
    const fits = x => {
      if (shareQ && !norm(x.label + " " + x.sub).includes(norm(shareQ))) return false;
      if (shareKind !== "loadouts" || shareF === "all") return true;
      return shareF === "fav" ? isFav(x.item) : loLevel(x.item) === shareF;
    };
    const shown = all.filter(fits);
    const head = el("div", "sh-head");
    head.append(el("h3", null, kinds.find(k => k[0] === shareKind)[1]), el("small", null, shown.length === all.length ? `${all.length}` : `${shown.length} of ${all.length} shown`));
    const allOn = shown.length && shown.every(x => set.has(x.key));
    const ab = el("button", "linkbtn", allOn ? "None" : "All"); ab.type = "button"; ab.title = allOn ? "Untick the ones shown" : "Tick the ones shown";
    ab.addEventListener("click", () => { shown.forEach(x => allOn ? set.delete(x.key) : set.add(x.key)); redraw(); });
    head.append(ab);
    pane.append(head);
    const tools = el("div", "sh-tools");
    if (all.length > 6) {
      const q = el("input"); q.type = "search"; q.value = shareQ; q.placeholder = "Find…"; q.setAttribute("aria-label", "Find");
      q.addEventListener("input", () => { shareQ = q.value; shareScroll = 0; drawShare(); const n = $("sm-body").querySelector(".sh-tools input"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
      tools.append(q);
    }
    if (shareKind === "loadouts") {
      const seg = el("div", "g-seg");
      [["all", "All"], ["fav", "Favorites"]].forEach(([v, t]) => { // levels are the groups below
        const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(shareF === v));
        b.addEventListener("click", () => { shareF = v; shareScroll = 0; drawShare(); });
        seg.append(b);
      });
      tools.append(seg);
    }
    if (tools.children.length) pane.append(tools);
    const visual = shareKind === "loadouts" || shareKind === "builds";
    const NONE = { loadouts: "No loadouts yet. Make one in Loadouts.", routes: "No routes saved yet. In Maps, pick your spawn, then save a route or draw your own.",
      keybinds: "No keybind presets of your own yet.", builds: "No builds added by someone other than So1o yet.", smelts: "No smelts logged yet. Log them in Smelter.", tiers: "Nothing ranked yet. Drag items into Tier list." };
    const list = !all.length ? emptyNote(NONE[shareKind]) : !shown.length ? emptyNote("Nothing matches your search.") : visual ? groupedPick(shareKind, shown, set, redraw) : pickList(shown, set, redraw);
    pane.append(list);
    if (shown.length) setTimeout(() => { list.scrollTop = shareScroll; }, 0);
  }
  split.append(nav, pane);
  box.append(split);
}
// loadouts by level and builds by weapon kind: a header ticks the whole group; rows show the weapon
export function groupedPick(kind, items, set, redraw) {
  const box = el("div", "sh-list sh-grouped");
  const guns = data.categories.flatMap(c => c.weapons.map(w => [w.name, w]));
  const gunOf = name => (guns.find(g => g[0] === name) || [])[1];
  const groups = [];
  if (kind === "loadouts") LO_TIERS.forEach(t => groups.push([t.label, items.filter(x => loLevel(x.item) === t.key), t.key]));
  else data.categories.forEach(c => groups.push([c.name, items.filter(x => x.item.cat === c.name), null]));
  groups.filter(g => g[1].length).forEach(([title, list, level]) => {
    const on = list.filter(x => set.has(x.key)).length;
    const head = el("label", "sh-ghead");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = on === list.length; cb.indeterminate = on > 0 && on < list.length;
    cb.addEventListener("change", () => { list.forEach(x => cb.checked ? set.add(x.key) : set.delete(x.key)); redraw(); });
    const t = el("span", "sh-gtitle"); t.append(level ? loTierChip(level) : el("b", null, title));
    head.append(cb, t, el("small", null, `${on} of ${list.length}`));
    box.append(head);
    list.forEach(x => {
      const row = el("label", "sh-vrow");
      const c = el("input"); c.type = "checkbox"; c.checked = set.has(x.key);
      c.addEventListener("change", () => { c.checked ? set.add(x.key) : set.delete(x.key); redraw(); });
      let gun, name, sub, chip, cost;
      if (kind === "loadouts") {
        const lo = x.item, w = findBuild(lo.build, lo.gun);
        gun = w ? w.gun : gunOf(lo.gun); name = lo.name; sub = lo.gun + (isFav(lo) ? " · favorite" : "");
        const k = loCost(lo).total; cost = k ? fmtK(k) : "";
      } else {
        const b = x.item; gun = gunOf(b.weapon); name = b.weapon; sub = "by " + (b.build.author || "Unknown author");
        chip = loTierChip(b.build.tier); cost = b.build.cost ? fmtCost(b.build.cost) : "";
      }
      const pic = gun ? thumb(gun) : el("div", "thumb");
      const t = el("span", "sh-text"); t.append(el("b", null, name), el("small", null, sub));
      // when importing: how it compares with yours (and keep both / replace) under the name, so the name keeps its room
      if (x.state || x.extra) {
        const st = el("span", "sh-badges");
        if (x.state) st.append(el("span", "sh-state " + x.stateClass, x.state));
        if (x.extra) st.append(x.extra);
        t.append(st);
      }
      const trail = el("span", "sh-trail");
      if (chip) trail.append(chip);
      trail.append(el("span", "sh-cost", cost));
      row.append(c, pic, t, trail);
      box.append(row);
    });
  });
  return box;
}
// the Backup tab: the same drop zone as Import, for your own file; downloading is in the footer
export function drawBackupPanel(box) {
  const zone = el("div", "sh-drop");
  const ic = el("span", "sh-drop-ic"); ic.append(icon("download"));
  const file = el("input"); file.type = "file"; file.accept = ".json,application/json"; file.hidden = true;
  const msg = el("p", "sh-drop-msg");
  const load = async text => { const why = await restoreBackup(text); msg.textContent = why; msg.classList.toggle("err", !!why); zone.classList.toggle("bad", !!why); };
  const open = el("button", null, "Restore a backup"); open.type = "button"; open.prepend(icon("upload")); open.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { const f = file.files[0]; file.value = ""; if (f) f.text().then(load); });
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) f.text().then(load); });
  const btns = el("div", "sh-drop-btns"); btns.append(open, file);
  zone.dataset.tip = "Loadouts, builds, routes, keybinds and prices you added, tier lists, smelts, trading codes, favourites and filters";
  zone.append(ic, el("b", null, "Everything you made here, in one file"), el("small", null, "It all lives in this browser. Download a backup to keep it safe or move it to another PC, then restore it there."), btns, msg);
  box.append(zone);
}
// the Import tab: a drop zone until something is read, then the same layout as Share
export let importKind = null;
export function drawImportPanel(box) {
  if (!importPack) {
    const zone = el("div", "sh-drop");
    const ic = el("span", "sh-drop-ic"); ic.append(icon("share"));
    const ta = el("textarea", "sh-paste"); ta.rows = 3; ta.placeholder = "Paste the code your friend sent you"; ta.setAttribute("aria-label", "Code to import");
    const file = el("input"); file.type = "file"; file.accept = ".abihub,.txt,application/json"; file.hidden = true;
    const msg = el("p", "sh-drop-msg");
    const load = async text => {
      let why = "That isn't an ABI Hub code or file.";
      try { importPack = await unpackText(text); } catch (e) { importPack = null; if (e.message === "old-browser") why = "This browser is too old to open this code. Try an up-to-date Firefox, Chrome or Edge."; }
      if (!importPack) { msg.textContent = why; msg.classList.add("err"); zone.classList.add("bad"); return; }
      importPick = null; importKind = null; drawShare();
    };
    const read = el("button", "primary", "Read code"); read.type = "button"; read.addEventListener("click", () => load(ta.value));
    const open = el("button", null, "Open a file"); open.type = "button"; open.prepend(icon("upload")); open.addEventListener("click", () => file.click());
    ta.addEventListener("paste", () => setTimeout(() => load(ta.value), 0));
    file.addEventListener("change", () => { const f = file.files[0]; if (f) f.text().then(load); });
    // drop a .abihub file anywhere on the zone
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) f.text().then(load); });
    const btns = el("div", "sh-drop-btns"); btns.append(read, open, file);
    zone.append(ic, el("b", null, "Bring in what a friend sent you"), el("small", null, "Paste a code, open a .abihub file, or drop the file here. Route codes (ABI1-…) work too."), ta, btns, msg);
    box.append(zone);
    return;
  }
  const items = importItems();
  if (!importPick) { // first look: tick everything new or different, leave out what you already have
    importPick = new Set(); importPick.prices = !!importPack.prices;
    Object.values(items).flat().forEach(x => { if (x.stateClass !== "have" && !x.skip) importPick.add(x.key); });
  }
  const redraw = () => { const l = $("sm-body").querySelector(".gm-panel:not(.off) .sh-pane .sh-list"); shareScroll = l ? l.scrollTop : 0; drawShare(); };
  // differs from yours: keep both, or replace yours
  Object.entries(items).forEach(([k, list]) => list.forEach(x => {
    if (x.stateClass !== "diff" || !x.mine || k === "builds") return;
    const sel = el("select", "sh-how"); sel.setAttribute("aria-label", "What to do with " + x.label);
    [["both", "Keep both"], ["replace", "Replace mine"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); });
    sel.value = (importPick.how || {})[x.key] || "both";
    sel.addEventListener("click", e => e.stopPropagation());
    sel.addEventListener("change", () => { (importPick.how = importPick.how || {})[x.key] = sel.value; });
    x.extra = sel;
  }));
  const pn = priceNews();
  const kinds = [...SHARE_KINDS.filter(([k]) => items[k] && items[k].length), ...(pn ? [["prices", "Market prices"]] : [])];
  if (!kinds.some(([k]) => k === importKind)) importKind = kinds[0] && kinds[0][0];

  // who it's from and what's inside
  const head = el("div", "sh-from");
  const what = kinds.map(([k, t]) => k === "prices" ? "prices" : `${items[k].length} ${SHARE_UNIT[k][items[k].length === 1 ? 0 : 1]}`).join(" · ");
  const ht = el("div"); ht.append(el("b", null, `From ${importPack.app || "a friend"}${importPack.at ? " · made " + fmtDate(importPack.at) : ""}`), el("small", null, what + ". New and changed things are ticked."));
  const again = el("button", "linkbtn", "Read another"); again.type = "button"; again.addEventListener("click", () => { importPack = null; importPick = null; drawShare(); });
  head.append(ht, again);
  box.append(head);

  const split = el("div", "sh-split");
  const nav = el("nav", "sh-nav"); nav.setAttribute("aria-label", "What came in");
  kinds.forEach(([k, title]) => {
    const b = el("button", "sh-kind"); b.type = "button"; b.setAttribute("aria-current", String(k === importKind));
    const n = k === "prices" ? null : items[k].filter(x => importPick.has(x.key)).length;
    const t = el("span"); t.append(el("b", null, title), el("small", null, k === "prices" ? (importPick.prices ? "Bring in" : "Leave out") : `${n} of ${items[k].length} to bring in`));
    b.append(icon(SHARE_ICON[k]), t);
    if (k === "prices" ? importPick.prices : n) b.classList.add("has");
    b.addEventListener("click", () => { importKind = k; shareScroll = 0; drawShare(); });
    nav.append(b);
  });
  const pane = el("div", "sh-pane");
  if (importKind === "prices") {
    pane.append(el("h3", null, "Market prices"));
    const cmp = el("div", "sh-cmp");
    const side = (label, date, extra) => { const d = el("div"); d.append(el("small", null, label), el("b", null, date ? fmtDate(date) : "—"), el("span", null, extra)); return d; };
    cmp.append(side("Theirs", pn.theirLast, `${pn.items.toLocaleString("en-US")} items`), el("span", "sh-cmp-vs", "vs"), side("Yours", pn.mineLast, `${market.items.length.toLocaleString("en-US")} items`));
    pane.append(cmp);
    const s = pn.newer || pn.added ? `${pn.newer} newer price${pn.newer === 1 ? "" : "s"}${pn.added ? ` and ${pn.added} new item${pn.added === 1 ? "" : "s"}` : ""} would come in.` : "Nothing newer than yours: bringing these in changes nothing.";
    pane.append(el("p", "sh-tip" + (pn.newer || pn.added ? " good" : ""), s));
    const opts = el("div", "sh-opts");
    [[true, "Bring in the newer ones", "Item by item, the newest price wins. Yours stay where they are newer."], [false, "Leave prices out", "Keep only your own prices."]].forEach(([v, t, d]) => {
      const b = el("button", "sh-opt"); b.type = "button"; b.setAttribute("aria-pressed", String(importPick.prices === v));
      b.append(el("b", null, t), el("small", null, d));
      b.addEventListener("click", () => { importPick.prices = v; drawShare(); });
      opts.append(b);
    });
    pane.append(opts);
  } else if (importKind) {
    const list = items[importKind], on = list.filter(x => importPick.has(x.key)).length;
    const h = el("div", "sh-head");
    h.append(el("h3", null, kinds.find(k => k[0] === importKind)[1]), el("small", null, `${on} of ${list.length}`));
    const allOn = on === list.length, ab = el("button", "linkbtn", allOn ? "None" : "All"); ab.type = "button";
    ab.addEventListener("click", () => { list.forEach(x => allOn ? importPick.delete(x.key) : !x.skip && importPick.add(x.key)); redraw(); });
    h.append(ab); pane.append(h);
    const visual = importKind === "loadouts" || importKind === "builds";
    const l = visual ? groupedPick(importKind, list, importPick, redraw) : pickList(list, importPick, redraw);
    pane.append(l);
    setTimeout(() => { l.scrollTop = shareScroll; }, 0);
  }
  split.append(nav, pane);
  box.append(split);
}

/* import: compare what came in with what you have, tick what to keep */
export function importItems() {
  const p = importPack, out = {};
  const same = (a, b) => JSON.stringify({ ...a, id: 0, added: 0 }) === JSON.stringify({ ...b, id: 0, added: 0 });
  const state = (mine, theirs) => !mine ? ["new", "new"] : same(mine, theirs) ? ["already have", "have"] : ["different from yours", "diff"];
  if (p.loadouts) out.loadouts = p.loadouts.map(lo => { const mine = (data.loadouts || []).find(x => x.id && x.id === lo.id); const { _build, ...clean } = lo; const [s, c] = state(mine, clean);
    return { key: "lo:" + (lo.id || lo.name), label: lo.name, sub: lo.gun, state: s, stateClass: c, item: lo, mine }; });
  if (p.routes) out.routes = p.routes.map(r => { const mine = (data.routes || []).find(x => x.id === r.id); const [s, c] = state(mine, r);
    return { key: "rt:" + r.id, label: r.name, sub: `${(MAP_LIST.find(m => m[0] === r.map) || [, r.map])[1]} · ${r.pts.length} points`, state: s, stateClass: c, item: r, mine }; });
  if (p.keybinds) out.keybinds = p.keybinds.map(k => { const mine = kbUserPresets().find(x => x.id === k.id); const [s, c] = state(mine, k);
    return { key: "kb:" + k.id, label: k.name, sub: "Keybind preset", state: s, stateClass: c, item: k, mine }; });
  if (p.builds) out.builds = p.builds.map(b => { const w = data.categories.flatMap(c => c.weapons).find(x => x.name === b.weapon); const have = w && w.builds.some(x => x.code === b.build.code);
    return { key: "bd:" + b.weapon + "|" + b.build.code, label: `${b.weapon} ${tierLabel(b.build.tier)}`, sub: `by ${b.build.author || "Unknown author"}`, state: have ? "already have" : w ? "new" : "weapon not on your list", stateClass: have ? "have" : w ? "new" : "diff", item: b, skip: have || !w }; });
  if (p.smelts) out.smelts = p.smelts.map(e => { const have = smd.log.some(x => x.id === e.id);
    return { key: "sm:" + e.id, label: smeltLabel(e), sub: `${fmtDate(e.at)} · ${fmtKoen(e.outV)}`, state: have ? "already have" : "new", stateClass: have ? "have" : "new", item: e, skip: have }; });
  // a friend's tier list takes the place of yours for that kind (yours only when you tick it)
  if (p.tiers) out.tiers = p.tiers.filter(t => tlLabel(t.kind)).map(t => {
    const n = t.rows.reduce((s, r) => s + r.items.length, 0), mineN = tlCount(t.kind);
    const same = mineN && JSON.stringify(tlList(t.kind).rows) === JSON.stringify(t.rows);
    return { key: "tl:" + t.kind, label: tlLabel(t.kind), sub: `${plural(n, "item")} ranked`, state: same ? "already have" : mineN ? "replaces yours" : "new", stateClass: same ? "have" : mineN ? "diff" : "new", item: t, skip: same };
  });
  return out;
}
export function priceNews() {
  const p = importPack.prices; if (!p) return null;
  let newer = 0, added = 0, theirLast = "";
  const theirs = {};
  p.snapshots.forEach(s => { theirLast = s.date > theirLast ? s.date : theirLast; Object.keys(s.prices).forEach(id => { if (!theirs[id] || s.date > theirs[id]) theirs[id] = s.date; }); });
  Object.entries(theirs).forEach(([id, d]) => { const l = latest(id); if (!l) added++; else if (d > l.date) newer++; });
  const mineLast = [...market.snapshots].map(s => s.date).sort().pop() || "";
  return { newer, added, theirLast, mineLast, items: Object.keys(theirs).length };
}
export function drawShareFoot() {
  const foot = $("sm-foot"); foot.textContent = "";
  const acts = el("div", "m-actions"), info = el("span", "sh-info");
  if (shareTab === "share") {
    const n = SHARE_KEYS.reduce((s, k) => s + shareSel[k].size, 0) + (shareSel.prices !== "none" ? 1 : 0);
    info.textContent = n ? `${n} thing${n === 1 ? "" : "s"} picked` : "Tick what to send";
    const dl = el("button", null, "Download file"); dl.type = "button"; dl.prepend(icon("download")); dl.disabled = !n;
    const code = el("button", "primary", "Copy code"); code.type = "button"; code.prepend(icon("share")); code.disabled = !n;
    dl.addEventListener("click", async () => {
      const text = await packText(sharePayload());
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = `abi-hub-share-${today()}.abihub`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast([el("span", null, "File ready: "), el("b", null, a.download)]);
    });
    code.addEventListener("click", async () => {
      const text = await packText(sharePayload());
      if (text.length > CODE_SOFT_LIMIT) info.innerHTML = "", info.append(el("span", "warn", `This code is long (${text.length.toLocaleString("en-US")} characters): chat apps may cut it. The file is safer.`));
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        () => toast([el("span", null, "Code copied"), el("span", null, ` · ${text.length.toLocaleString("en-US")} characters`)]),
        () => window.prompt("Copy this code:", text));
    });
    acts.append(dl, code);
  } else if (shareTab === "backup") {
    info.textContent = "Saved by itself in this browser";
    acts.append(button("Download backup", { cls: "primary", icon: "download", onClick: downloadBackup }));
  } else {
    const n = importPick ? importPick.size + (importPick.prices ? 1 : 0) : 0;
    info.textContent = importPack ? (n ? `${n} thing${n === 1 ? "" : "s"} to bring in` : "Nothing ticked") : "Paste a code or open a file";
    const go = el("button", "primary", "Import"); go.type = "button"; go.disabled = !n; go.addEventListener("click", applyImport);
    acts.append(go);
  }
  foot.append(info, acts);
}

export function applyImport() {
  const items = importItems(), how = importPick.how || {}, done = [];
  const newId = base => base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  let builds = false, keys = false, routes = false, los = false, prices = false;
  const addBuild = b => { // into its weapon, if that weapon is on your list and the build isn't there yet
    const w = data.categories.flatMap(c => c.weapons).find(x => x.name === b.weapon);
    if (w && !w.builds.some(x => x.code === b.build.code)) { insertBuild(w, clone(b.build)); builds = true; return true; } // in tier order, like the add form
    return false;
  };
  (items.builds || []).forEach(x => { if (importPick.has(x.key) && addBuild(x.item)) done.push("build"); });
  (items.loadouts || []).forEach(x => {
    if (!importPick.has(x.key)) return;
    const { _build, ...lo } = clone(x.item);
    if (_build) addBuild(_build);
    if (x.mine && how[x.key] === "replace") data.loadouts[data.loadouts.indexOf(x.mine)] = { ...lo, id: x.mine.id };
    else if (x.mine) data.loadouts.push({ ...lo, id: newId("lo"), name: lo.name + " (shared)" });
    else data.loadouts.push({ ...lo, id: lo.id || newId("lo") });
    los = true; done.push("loadout");
  });
  (items.routes || []).forEach(x => {
    if (!importPick.has(x.key)) return;
    const r = clone(x.item); if (!Array.isArray(data.routes)) data.routes = [];
    if (x.mine && how[x.key] === "replace") data.routes[data.routes.indexOf(x.mine)] = r;
    else data.routes.push(x.mine ? { ...r, id: newId("r"), name: r.name + " (shared)" } : r);
    routes = true; done.push("route");
  });
  (items.keybinds || []).forEach(x => {
    if (!importPick.has(x.key)) return;
    const p = clone(x.item), list = kbUserPresets();
    if (x.mine && how[x.key] === "replace") list[list.indexOf(x.mine)] = p;
    else list.push(x.mine ? { ...p, id: newId("kb"), name: p.name + " (shared)" } : p);
    keys = true; done.push("keybind preset");
  });
  let smelts = 0;
  (items.smelts || []).forEach(x => { // a friend's smelts join yours, marked as theirs
    if (!importPick.has(x.key) || smd.log.some(e => e.id === x.item.id)) return;
    smd.log.push({ ...clone(x.item), by: x.item.by || "a friend" }); smelts++; done.push("smelt");
  });
  if (smelts) { smd.log.sort((a, b) => b.at.localeCompare(a.at)); saveSm(); if (PAGES.smelter) PAGES.smelter.redraw(); }
  let tiers = 0;
  (items.tiers || []).forEach(x => { if (!importPick.has(x.key)) return; tl.lists[x.item.kind] = { rows: clone(x.item.rows) }; tiers++; done.push("tier list"); });
  if (tiers) { saveTl(); tlDraw(); renderGear(); } // the sections sorted by your tier list follow (Builds and Loadouts redraw below)
  if (importPick.prices && importPack.prices) {
    // items you don't have, then every reading you don't have; latest() then picks the newest per item on its own
    const P = importPack.prices;
    P.items.forEach(it => { if (!market.items.some(i => i.id === it.id)) market.items.push(clone(it)); });
    P.snapshots.forEach(s => {
      const mine = market.snapshots.find(x => x.date === s.date && x.source === s.source);
      if (!mine) market.snapshots.push(clone(s));
      else Object.entries(s.prices).forEach(([id, v]) => { if (mine.prices[id] == null) mine.prices[id] = clone(v); });
    });
    prices = true; done.push("prices");
  }
  if (builds || los || routes || keys) setDirty(true);
  if (prices) setPricesDirty(true);
  render(); renderLoadouts(); if (PAGES.keybinds) PAGES.keybinds.draw(); refreshMaps();
  if (prices) { renderMarket(); renderGear(); }
  const count = done.filter(d => d !== "prices").length;
  toast([el("span", null, "Imported: "), el("b", null, [count ? `${count} item${count === 1 ? "" : "s"}` : "", prices ? "prices" : ""].filter(Boolean).join(" + "))]);
  importPack = null; importPick = null; shareTab = "import"; drawShare();
}
export function closeShare() {
  navReset();
  if (!sm.open) return;
  closeDialog(sm);
}
wireDialog(sm, closeShare, "sm-close");
$("share-open").addEventListener("click", () => openShare());
$("share-open").prepend(icon("share"));
