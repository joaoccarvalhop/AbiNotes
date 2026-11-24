/* The weapon overlay (its builds by tier, what we know about it, the loadouts on it) and the build card it shares with
   the Builds page. */
import { render, renderLoadouts, setArea } from "../../app.js";
import { $, button, copyLine, costNum, data, el, fmtCost, fmtK, fmtKoen, icon, K, ls, pageEl, saved, saveName, setDirty, TIERS } from "../base.js";
import { AMMO_FAMILIES, AREA_NAME, ARIG_LAYOUT, buildStatsChip, EXTRA_KIND, extraByName, fullName, GEAR_CAT, GEAR_KIND, GEAR_PLURAL, gearByName, gearImg, GUN_CALIBRE, HELMET_NOTES, layoutUrl, MATERIALS, tierOf, WEAPON_SRC, WEAPON_STAT_INFO, WEAPON_STATS } from "../gear-data.js";
import { K_LO, loTier, setLoTier } from "../loadouts-data.js";
import { extraOffers, fmtDate } from "../market-data.js";
import { tlChip } from "../rankings.js";
import { openShare } from "../share.js";
import { closeDialog, confirmBox, infoDot, navCur, navReplace, navReset, present, setNavReplace, thumb, toast, wireDialog } from "../ui.js";
import { openModal, pickGun } from "./add-build.js";
import { gearInfo, gm, gmTabs, loadoutList, marketTools, usedIn } from "./gear.js";
import { ammoMarketItem, ammoParts, ammoPic, priceTip } from "./loadout.js";
import { openPrice } from "./price.js";

/* ---------- weapon overlay: its builds by tier, what we know about it, the loadouts on it ---------- */
export function openWeapon(g) {
  const cat = data.categories.find(c => c.weapons.includes(g));
  const cal = GUN_CALIBRE[g.name];
  const top = $("gm-top"); top.textContent = "";
  const titles = el("div", "gm-titles");
  const tt = el("h2", null, g.name); tt.id = "gm-title";
  const sub = el("div", "gm-sub");
  if (cat) sub.append(el("span", null, cat.name.replace(/s$/, "")));
  if (cal) sub.append(el("span", null, cal));
  if (g.so1o) {
    const r = el("span", "gm-rank" + (g.so1o === 1 ? " top" : ""), `#${g.so1o} on So1o's list`); r.prepend(icon("medal"));
    r.dataset.tip = "So1o's ranking of every weapon in the game: the lower, the better";
    sub.append(r);
  }
  const tc = tlChip("guns", g.name); if (tc) sub.append(tc);
  titles.append(tt, sub);
  const tools = el("div", "gm-tools");
  tools.append(button("Add build", { icon: "plus", onClick: () => { openModal(); pickGun(g.name); } }));
  // its builds that others added can be sent (So1o's are everyone's already)
  const mine = g.builds.filter(b => b.author && b.author !== "So1o").map(b => g.name + "|" + b.code);
  if (mine.length) tools.append(button("Share", { icon: "share", tip: "Send the builds others added for this weapon", onClick: () => openShare({ builds: mine }) }));
  titles.append(tools);
  const pic = thumb(g); pic.classList.add("big");
  top.append(pic, titles);
  const body = $("gm-body"); body.textContent = ""; $("gm-foot").textContent = "";

  // builds, one column per tier
  const builds = el("div", "gm-panel"), grid = el("div", "gbody");
  TIERS.forEach(t => {
    const col = el("div", "tier " + t.key);
    col.append(el("div", "label", `${t.n} ${t.label}`));
    const items = g.builds.filter(b => b.tier === t.key);
    if (!items.length) col.append(el("div", "none", "No build"));
    items.forEach((b, i) => col.append(buildCard(g, t.key, b, i)));
    grid.append(col);
  });
  builds.append(grid);

  // stats
  const info = el("div", "gm-panel");
  const stat = (label, val, tip) => { const d = el("div", "gm-stat"); d.append(el("small", null, label), el("b", null, String(val))); if (tip) d.title = tip; return d; };
  const costs = g.builds.filter(b => b.tier !== "misc").map(b => costNum(b.cost)).filter(v => v != null);
  const los = (data.loadouts || []).filter(l => l.gun === g.name);
  const sg = el("div", "gm-stats");
  sg.append(stat("Caliber", cal || "—"), stat("Builds", g.builds.length),
    stat("Cheapest build", costs.length ? fmtK(Math.min(...costs)) : "—", "The lowest price of its builds, not counting Misc"),
    stat("Priciest build", costs.length ? fmtK(Math.max(...costs)) : "—", "The highest price of its builds, not counting Misc"),
    stat("So1o's list", g.so1o ? "#" + g.so1o : "Not listed", "So1o's ranking of every weapon in the game: the lower, the better"),
    stat("Gunsmith", cat ? `#${cat.weapons.indexOf(g) + 1} of ${cat.weapons.length}` : "—", "Where it sits in the in-game Gunsmith list of its kind"),
    stat("Loadouts", los.length), stat("In game", g.builds.filter(b => saved[b.code]).length + " of " + g.builds.length, "Builds you marked as saved in game"));
  // the weapon itself, before any attachment (builds change these)
  const ws = WEAPON_STATS[g.name];
  if (ws) {
    const wg = el("div", "gm-stats");
    WEAPON_STAT_INFO.forEach(([label, tip, max, unit], i) => {
      const d = stat(label, ws[i] + (unit || ""), tip);
      if (max) { const bar = el("i", "gm-bar"); bar.style.setProperty("--p", Math.min(100, ws[i]) + "%"); d.append(bar); }
      wg.append(d);
    });
    wg.append(stat("Firing power", ws[10], "How hard each hit lands, as the game rates it"));
    const modes = stat("Firing modes", ws[9]); modes.classList.add("wide2"); wg.append(modes);
    const h = gmSection("Weapon", wg);
    h.firstChild.append(infoDot("The weapon with no attachments: a build changes these.\nSource: ABI Builder wiki (click to open)", WEAPON_SRC));
    info.append(h);
  }
  info.append(gmSection(ws ? "Builds" : "Stats", sg));
  const rounds = AMMO_FAMILIES[cal];
  if (rounds) {
    const box = el("div", "am-badges wrap");
    rounds.map(ammoParts).forEach(p => {
      const b = el("span", "am-chip small" + (p.tier ? " t" + p.tier : ""));
      const ap = ammoPic(p.name, g.name); if (ap) b.append(ap);
      b.append(el("b", null, p.name)); if (p.tag) b.append(el("small", null, p.tier ? "Lv" + p.tier : p.tag));
      const mi = ammoMarketItem(p.name, g.name);
      b.dataset.tip = mi ? priceTip(null, mi) : "No price yet";
      if (mi) { b.classList.add("am-link"); b.tabIndex = 0; b.setAttribute("role", "button"); b.addEventListener("click", () => openPrice(mi.id)); }
      box.append(b);
    });
    info.append(gmSection("Ammo", box));
  }

  const tabs = [[`Builds (${g.builds.length})`, builds], ["Stats", info]];
  if (los.length) { const used = el("div", "gm-panel"); used.append(loadoutList(los)); tabs.push([`Used in ${los.length} loadout${los.length === 1 ? "" : "s"}`, used]); }
  gmTabs(body, tabs);
  body.scrollTop = 0;
  present(gm, g.name, () => openWeapon(g));
  navCur.weapon = g;
  $("gm-close").focus();
}
// after a build is added, edited or deleted, an open weapon overlay shows it
export function refreshWeapon() { if (gm.open && navCur && navCur.dlg === gm && navCur.weapon && !$("addmodal").open) { const k = $("gm-body").scrollTop; setNavReplace(true); openWeapon(navCur.weapon); $("gm-body").scrollTop = k; } }
export function openExtra(x) {
  const top = $("gm-top"); top.textContent = "";
  const titles = el("div", "gm-titles");
  const tt = el("h2", null, x.name); tt.id = "gm-title";
  const sub = el("div", "gm-sub");
  if (x.tier) { const t = el("span"); tierCell(t, x.tier); sub.append(t.firstChild); }
  sub.append(el("span", null, EXTRA_KIND[x.kind]));
  const tc = (x.kind === "rig" || x.kind === "pack") && tlChip(x.kind === "rig" ? "rigs" : "packs", x.name); if (tc) sub.append(tc);
  titles.append(tt, sub);
  top.append(gearImg(x.name, "huge"), titles);
  const body = $("gm-body"); body.textContent = ""; $("gm-foot").textContent = "";
  titles.append(marketTools(x.name, x.cat)); // price buttons in the header
  const stat = (label, val, cls) => { const d = el("div", "gm-stat" + (cls ? " " + cls : "")); d.append(el("small", null, label), el("b", null, String(val))); return d; };
  const grid = el("div", "gm-stats");
  if (x.kind === "mask") grid.append(stat("Durability", x.dur), stat("Material", x.mat), stat("Ricochet", x.ric), stat("Weight", x.w + " kg"));
  if (x.kind === "gas") grid.append(stat("Durability", x.dur), stat("Anti-flash", x.flash), stat("Anti-poison", x.poison), stat("Weight", x.w + " kg"));
  if (x.kind === "headset") grid.append(stat("Sound pickup", x.pickup), stat("Noise reduction", x.noise), stat("Weight", x.w + " kg"));
  if (x.kind === "pack" || x.kind === "rig") grid.append(stat("Slots", x.slots + (x.bonus ? ` (${x.bonus} bonus)` : "")), stat("Grid", x.grid), stat("Weight", x.w + " kg"), stat("Slots per kg", (x.slots / x.w).toFixed(1)));
  body.append(gmSection("Stats", grid));
  if (x.fits) {
    const list = el("div", "gm-combos");
    x.fits.forEach(h => {
      const b = el("button", "gm-combo"); b.type = "button";
      b.append(gearImg(h), el("span", "gm-cname")); b.lastChild.append(el("b", null, h));
      b.addEventListener("click", () => openGear(h));
      list.append(b);
    });
    body.append(gmSection("Fits on", list));
  }
  if (x.layout) {
    const pic = new Image(); pic.className = "gm-layout"; pic.alt = `${x.name} storage grid`; pic.referrerPolicy = "no-referrer"; pic.src = x.layout;
    pic.addEventListener("error", () => pic.closest(".gm-sec")?.remove());
    body.append(gmSection("Storage grid", pic));
  }
  const offers = extraOffers(x);
  if (offers.length) {
    const vg = el("div", "gm-stats");
    offers.forEach(o => {
      const d = stat(o.cur && o.max ? `${o.label} · ${o.cur}/${o.max}` : o.label, fmtKoen(o.price));
      if (x.slots) d.append(el("small", null, `${Math.round(o.price / x.slots).toLocaleString("en-US")} per slot`));
      else if (o.ppd) d.append(el("small", null, `${o.ppd.toLocaleString("en-US")} per point`));
      vg.append(d);
    });
    body.append(gmSection("Market", vg));
  } else body.append(gmSection("Market", el("p", "gm-note", "No price yet.")));
  usedIn(x.name, body);
  body.scrollTop = 0;
  present(gm, x.name, () => openExtra(x));
  $("gm-close").focus();
}
export function openGear(name) {
  const xtra = !gearByName(name) && extraByName(fullName(name));
  if (xtra) return openExtra(xtra);
  const { g, offers, rank, combos } = gearInfo(name);
  const full = g ? g.name : fullName(name);
  const t = g ? g.tier : tierOf(name);
  const top = $("gm-top"); top.textContent = "";
  const titles = el("div", "gm-titles");
  const tt = el("h2", null, full); tt.id = "gm-title";
  const sub = el("div", "gm-sub");
  const tier = el("span"); tierCell(tier, t);
  sub.append(tier.firstChild, el("span", null, g ? GEAR_KIND[g.kind] : "Gear"));
  // where it ranks for value among its kind and tier: the cheapest protection per point is #1
  if (rank) {
    const r = el("span", "gm-rank" + (rank.pos === 1 ? " top" : ""), `#${rank.pos} of ${rank.of} in T${g.tier}`); r.prepend(icon("medal"));
    r.dataset.tip = `Value among the ${rank.of} T${g.tier} ${GEAR_PLURAL[g.kind].toLowerCase()} with a market price: the lowest price per point of protection (any condition) is #1`;
    const o = el("span", "gm-rank all" + (rank.allPos === 1 ? " top" : ""), `#${rank.allPos} of ${rank.allOf} overall`);
    o.dataset.tip = `Value among all ${rank.allOf} ${GEAR_PLURAL[g.kind].toLowerCase()} with a market price, any tier`;
    sub.append(r, o);
  }
  const tc = g && tlChip(g.kind === "helmet" ? "helmets" : "armor", g.name); if (tc) sub.append(tc);
  titles.append(tt, sub);
  top.append(gearImg(full, "huge"), titles);

  const body = $("gm-body"); body.textContent = ""; $("gm-foot").textContent = "";
  if (g) titles.append(marketTools(full, GEAR_CAT[g.kind])); // price buttons in the header
  const stat = (label, val, cls) => { const d = el("div", "gm-stat" + (cls ? " " + cls : "")); d.append(el("small", null, label), el("b", null, val)); return d; };
  if (g) {
    const grid = el("div", "gm-stats");
    grid.append(stat("Durability", String(g.dur)), stat("Real durability", String(Math.round(g.dur * g.factor))),
      stat("Ergonomics", String(g.ergo), g.ergo < 0 ? "neg" : ""), stat("Move speed", g.spd + "%", g.spd < 0 ? "neg" : ""),
      stat("Material", g.mat), stat("Weight", g.w + " kg"));
    if (g.kind === "helmet") {
      grid.append(stat("Ricochet", g.extra || "—"));
      const n = HELMET_NOTES[g.name];
      if (n) grid.append(stat("Sound blocking", n[0]), stat("Face mask", n[1]), stat("Headset", n[2] || "—"));
    }
    if (g.kind === "arig") grid.append(stat("Storage", g.extra + " slots"));
    const areas = el("div", "gm-stat wide"); areas.append(el("small", null, "Protects"));
    const list = el("b"); g.areas.split(" ").forEach(x => list.append(el("span", "g-area", AREA_NAME[x])));
    areas.append(list); grid.append(areas);
    body.append(gmSection("Stats", grid));
    if (g.kind === "arig" && ARIG_LAYOUT[g.name]) {
      const pic = new Image(); pic.className = "gm-layout"; pic.alt = `${g.name} storage grid`; pic.referrerPolicy = "no-referrer";
      pic.src = layoutUrl("armored_rig", ARIG_LAYOUT[g.name]);
      pic.addEventListener("error", () => pic.closest(".gm-sec")?.remove());
      body.append(gmSection("Storage grid", pic));
    }
    const m = MATERIALS.find(x => x[0].toLowerCase() === g.mat.toLowerCase());
    if (m) {
      const mg = el("div", "gm-stats");
      mg.append(stat("Durability factor", "×" + g.factor), stat("Armor damage reduced", m[1] + "%"), stat("Lost on repair", m[2] + "%"));
      body.append(gmSection(`Material: ${g.mat}`, mg));
    }
  }
  if (offers.length) {
    const best = Math.min(...offers.map(o => o.ppd).filter(v => v != null));
    const vg = el("div", "gm-stats");
    offers.forEach(o => {
      const d = stat(`${o.label} · ${o.cur}/${o.max}`, fmtKoen(o.price), o.ppd != null && o.ppd === best ? "best" : "");
      if (o.ppd != null) d.append(el("small", null, `${o.ppd.toLocaleString("en-US")} per point`));
      vg.append(d);
    });
    body.append(gmSection("Market", vg));
  } else if (g) body.append(gmSection("Market", el("p", "gm-note", "No price yet.")));
  if (combos.length) {
    const list = el("div", "gm-combos");
    combos.forEach(c => {
      const b = el("button", "gm-combo"); b.type = "button";
      b.append(gearImg(c.other), el("span", "gm-cname"));
      b.lastChild.append(el("b", null, c.otherLabel || c.other), el("small", null, c.group));
      const notes = el("span", "g-notes"); notes.append(el("span", "pro", c.pro)); if (c.con) notes.append(el("span", "con", c.con));
      b.append(notes);
      b.setAttribute("aria-label", `Open ${c.other}`);
      b.addEventListener("click", () => openGear(c.other));
      list.append(b);
    });
    body.append(gmSection("Pairs well with", list));
  }
  if (!g && !offers.length) body.append(el("p", "gm-note", "No stats for this one yet."));
  usedIn(full, body);
  body.scrollTop = 0;
  present(gm, full, () => openGear(full));
  $("gm-close").focus();
}
export function gmSection(title, ...nodes) { const s = el("section", "gm-sec"); s.append(el("h3", null, title), ...nodes); return s; }
export function closeGear() {
  navReset();
  if (!gm.open) return;
  closeDialog(gm);
}
export function tierCell(td, t) {
  const s = el("span", "g-tier t" + t, t ? "T" + t : "—");
  s.dataset.tip = t ? `Tier ${t}` : "No tier";
  td.append(s);
}
export function buildCard(g, tier, b, i) {
  const card = el("div", "build");
  card.classList.toggle("saved", !!saved[b.code]);
  const name = saveName(g.name, tier, i, b);
  card.append(copyLine(name, "save", "name"), copyLine(b.code, "code", "code"));
  if (b.title) { const tt = el("div", "meta"); tt.append(el("span", "title", `“${b.title}”`)); tt.title = b.title; card.append(tt); }

  // two groups: what the build is (may wrap onto a second line) and what you do with it (always on the first, at the right)
  const meta = el("div", "meta b-meta"), info = el("span", "left");
  if (b.cost) info.append(el("span", "cost", fmtCost(b.cost)));
  const st = buildStatsChip(g, b); if (st) info.append(st);
  const who = b.author || "Unknown author";
  if (b.url) { const a = el("a", null, who); a.href = b.url; a.target = "_blank"; a.rel = "noopener"; a.title = "Open the original build"; info.append(a); }
  else info.append(el("span", null, who));
  if (b.added) info.append(el("span", "new", "Added " + fmtDate(b.added)));
  if (b.old) { const o = el("span", "old", "Last season"); o.dataset.tip = "Made for an earlier season. The code may not work anymore."; info.append(o); }
  // the same code listed on another weapon: a code is one saved preset, so only one of them works in game
  const others = data.categories.flatMap(c => c.weapons).filter(w => w !== g && w.builds.some(x => x.code === b.code)).map(w => w.name);
  if (others.length) {
    const s = el("span", "old", "Shared code");
    s.dataset.tip = `This code is also listed for ${others.join(", ")}.\nA code points to one saved preset, so only one of them still works in game.`;
    info.append(s);
  }
  // loadouts built on this exact build
  const used = (data.loadouts || []).filter(l => l.build === b.code && (!l.gun || l.gun === g.name)).length;
  if (used) {
    const lk = el("button", "linkbtn lo-links", `${used} loadout${used === 1 ? "" : "s"}`); lk.type = "button";
    lk.title = "See the gear people wear with this build";
    lk.addEventListener("click", () => {
      closeGear();
      setLoTier("all");
      $("sub-loadouts").querySelectorAll(".g-jump button").forEach(x => x.setAttribute("aria-selected", String(x.dataset.k === "all")));
      $("lo-q").value = g.name;
      setArea("loadouts"); renderLoadouts(); pageEl.scrollTo({ top: 0, behavior: "instant" });
    });
    info.append(lk);
  }

  const right = el("span", "right");
  // "in game", edit and delete as small icons: the line has little room. In game is a toggle that lights up green
  const inGameTip = on => on ? "Saved in game: click to unmark" : "Mark as saved in game";
  const lab = button(null, { cls: "b-act b-ingame", icon: "check", tip: inGameTip(!!saved[b.code]) });
  lab.setAttribute("aria-pressed", String(!!saved[b.code])); lab.setAttribute("aria-label", `${name} saved in game`);
  lab.addEventListener("click", () => {
    const on = !saved[b.code];
    if (on) saved[b.code] = 1; else delete saved[b.code];
    ls.set(K.saved, saved); card.classList.toggle("saved", on);
    lab.setAttribute("aria-pressed", String(on)); lab.dataset.tip = inGameTip(on);
    // the weapon overlay counts these ("In game 2 of 3"): just that number, so the tick doesn't redraw the overlay under you
    const st = gm.open && [...gm.querySelectorAll(".gm-stat")].find(s => s.firstChild && s.firstChild.textContent === "In game");
    if (st && navCur && navCur.weapon) st.querySelector("b").textContent = navCur.weapon.builds.filter(x => saved[x.code]).length + " of " + navCur.weapon.builds.length;
  });
  const edit = button(null, { cls: "b-act", icon: "edit", tip: "Edit", onClick: () => openModal({ gun: g, build: b }) });
  edit.setAttribute("aria-label", `Edit ${name}`);
  const del = button(null, { cls: "b-act del", icon: "trash", tip: "Delete" });
  del.setAttribute("aria-label", `Delete ${name}`);
  del.addEventListener("click", async () => {
    const yes = await confirmBox({
      title: "Delete this build?",
      body: [el("span", "c-name", name), el("p", null, `It will be removed from ${g.name}. Builds after it in the same level move up one letter.`)],
      ok: "Delete build", danger: true,
    });
    if (!yes) { del.focus(); return; }
    g.builds.splice(g.builds.indexOf(b), 1);
    setDirty(true); render();
    toast([el("span", null, "Build deleted: "), el("b", null, name)]);
  });
  right.append(lab, edit, del);
  meta.append(info, right);
  card.append(meta);
  return card;
}
