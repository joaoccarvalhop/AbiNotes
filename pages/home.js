/* The Home page: one card per page with what is in it right now, your favourites and routes, and the About overlay
   (every source the hub draws on). Loaded the first time it opens (loadPage in app.js). */
import { go, registerPage } from "../app.js";
import { $, button, data, el, fmtK, icon, market, motion, plural } from "../js/base.js";
import { GEAR_SRC } from "../js/gear-data.js";
import { KB_GAME, kbChanged, kbCurrent } from "../js/keybinds-data.js";
import { isFav, loCost, loLevelChip } from "../js/loadouts-data.js";
import { fmtDate } from "../js/market-data.js";
import { openModal } from "../js/overlays/add-build.js";
import { openLoadout, openLoEditor } from "../js/overlays/loadout.js";
import { gmSection } from "../js/overlays/weapon.js";
import { MAP_LIST, openRouteOnMap, planRouteOnMap, smd, trStatus } from "../js/page-data.js";
import { tl, tlCount } from "../js/rankings.js";
import { closeDialog, present, wireDialog } from "../js/ui.js";

/* ---------- home: one card per section with what's in it right now, then your favourites and routes ---------- */
/* ---------- About: every source the hub draws on, by section (one place, so credits never get lost in tooltips) ---------- */
export const ABOUT_SOURCES = [
  ["Builds and weapons", [
    ["So1o", "Weapon builds and his ranking of every weapon (\"So1o's list\")", "https://docs.google.com/spreadsheets/d/1WNkmeWRRZm74_FuDeTpHkTlwBP1kXt_GpVaVLgWP5VE"],
    ["ABI Builder builds", "The builds others posted, under their authors' names", "https://abibuilder.com/builds"],
    ["ABI Builder wiki", "Weapon stats, bare and with each build's attachments", "https://abibuilder.com/wiki/weapons"],
  ]],
  ["Gear and ammo", [
    ["ABI Builder game database (S7)", "Helmets, armor, rigs, backpacks, masks and headsets: stats and pictures", "https://abibuilder.com/wiki"],
    ["Arena Breakout: Infinite wiki", "Gear and ammo pictures and full names", "https://arena-breakout-infinite.fandom.com"],
    ["skrux's data sheet", "The value-for-money math in Gear", GEAR_SRC],
  ]],
  ["Maps", [
    ["maps.tcno.co (TroubleChute)", "The six maps, their floors and markers, kept here for use between friends", "https://maps.tcno.co"],
  ]],
  ["Merchant", [
    ["ABI Builder Field Merchant", "The items, their sounds and what each cargo can hold", "https://abibuilder.com/merchant"],
    ["abi-assets (hexaov91)", "Item pictures", "https://github.com/hexaov91/abi-assets"],
  ]],
  ["Smelter", [
    ["ABI Builder smelter guide", "The rules players found", "https://abibuilder.com/guides/smelter-guide"],
    ["MoreFun's notes, via senseos.gg", "What the developers said about smelting", "https://senseos.gg"],
  ]],
  ["Trading", [
    ["ABI Builder ammo resets guide", "The reset times, the profit math, the hauling codes and the tricks", "https://abibuilder.com/guides/ammo-resets-guide"],
    ["l1as_tv", "The red row alarm, the mail trick and the hauling loadouts (credited in the guide)", null],
  ]],
  ["Tier list", [
    ["ABI Builder tier list maker", "The idea behind Tier list", "https://abibuilder.com/tier-list"],
  ]],
  ["Yours", [
    ["Market prices", "What you and your friends read in the game, shared with Share", null],
    ["Keybinds", "The game's own presets, plus yours", null],
  ]],
];
export function openAbout() {
  const dlg = $("about");
  if (!dlg.wired) { dlg.wired = true; wireDialog(dlg, () => closeDialog(dlg), "about-x"); }
  const body = $("about-body"); body.textContent = "";
  ABOUT_SOURCES.forEach(([title, rows]) => {
    const list = el("div", "ab-list");
    rows.forEach(([name, what, href]) => {
      const r = el(href ? "a" : "div", "ab-row");
      if (href) { r.href = href; r.target = "_blank"; r.rel = "noopener"; r.dataset.tip = href.replace(/^https?:\/\//, "").replace(/\/edit.*$/, ""); }
      r.append(el("b", null, name), el("small", null, what));
      if (href) r.append(icon("exit"));
      list.append(r);
    });
    body.append(gmSection(title, list));
  });
  body.append(el("p", "gm-note ab-foot", "Made by XeruD. A fan-made tool for friends, not made or endorsed by the game's developers."));
  present(dlg, "About", openAbout);
}

export function renderHome() {
  const sec = $("home"); sec.textContent = "";
  const guns = data.categories.flatMap(c => c.weapons), builds = guns.reduce((s, g) => s + g.builds.length, 0);
  const los = data.loadouts || [], favs = los.filter(isFav);
  const last = [...market.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  const routes = data.routes || [];
  const kp = kbCurrent(), def = KB_GAME[0].binds;
  const changed = kbChanged(kp);
  const ranked = Object.keys(tl.lists).reduce((s, k) => s + tlCount(k), 0);
  // one quiet tile per section (the same order as the top bar): icon, name, one short line of what's in it
  const cards = [
    ["builds", "Builds", "gun", `${plural(builds, "build")} for ${guns.length} weapons`],
    ["loadouts", "Loadouts", "bag", `${plural(los.length, "loadout")}${favs.length ? " · " + plural(favs.length, "favorite") : ""}`],
    ["market", "Market", "chart", last ? `Prices from ${fmtDate(last.date)}` : "No prices yet"],
    ["gear", "Gear", "shield", "Value for money, by tier"],
    ["maps", "Maps", "map", `${MAP_LIST.length} maps${routes.length ? " · " + plural(routes.length, "route") : ""}`],
    ["merchant", "Merchant", "pickup", window.ABI_MERCHANT ? `${plural(ABI_MERCHANT.sounds.length, "item sound")} to recognize` : "Tell a cargo by its sound"],
    ["smelter", "Smelter", "layers", smd.log.length ? `${plural(smd.log.length, "smelt")} logged` : "No smelts logged yet"],
    ["trading", "Trading", "clock", trStatus().line],
    ["keybinds", "Keybinds", "key", changed ? `${kp.name} · ${plural(changed, "change")}` : kp.name],
    ["tiers", "Tier list", "tiers", ranked ? `${plural(ranked, "item")} ranked` : "Nothing ranked yet"],
  ];
  // the welcome band: a strip of Farm behind (the map's own tiles, dimmed), the name, what you have, and the usual first steps
  const hero = el("section", "home-hero"), art = el("div", "home-art");
  // tiles are named column_row; rows 4–6, columns 4–20 are the busiest part of Farm
  for (let r = 4; r <= 6; r++) for (let c = 4; c <= 20; c++) { const im = new Image(); im.alt = ""; im.decoding = "async"; im.src = `maps/farm/tiles/base/${c}_${r}.webp`; art.append(im); }
  const intro = el("div", "home-intro");
  const brand = el("h1", "home-brand"); brand.append(el("b", null, "ABI"), el("span", null, "/"), "Hub");
  intro.append(el("small", null, "Arena Breakout: Infinite"), brand, el("p", null, "Builds, loadouts, prices, maps and the tools around a raid, in one place."));
  const stats = el("div", "home-stats");
  [[builds, "builds"], [los.length, "loadouts"], [routes.length, "routes"], [ranked, "ranked"]].forEach(([n, w]) => { const d = el("div"); d.append(el("b", null, n.toLocaleString("en-US")), el("small", null, w)); stats.append(d); });
  const acts = el("div", "home-acts");
  acts.append(
    button("Add build", { icon: "plus", onClick: () => openModal() }),
    button("Add loadout", { icon: "plus", onClick: () => openLoEditor(-1) }),
    button("Plan a route", { cls: "primary", icon: "route", onClick: planRouteOnMap }));
  intro.append(stats, acts);
  hero.append(art, intro);
  sec.append(hero);
  const grid = el("div", "home-grid");
  cards.forEach(([key, title, ic, line]) => {
    const b = el("button", "home-card"); b.type = "button";
    const ib = el("span", "home-ic"); ib.append(icon(ic));
    const t = el("span", "home-t"); t.append(el("b", null, title), el("small", null, line));
    b.append(ib, t, el("span", "home-go", "›"));
    b.addEventListener("click", () => go(key));
    grid.append(b);
  });
  sec.append(grid);
  // shortcuts, only when there is something to show
  const lists = el("div", "home-lists");
  const list = (title, rows) => { if (!rows.length) return; const s = el("section", "home-list"); s.append(el("h3", null, title), ...rows); lists.append(s); };
  list("Favorite loadouts", favs.slice(0, 6).map(lo => {
    const r = el("button", "home-row"); r.type = "button";
    const cost = loCost(lo).total;
    r.append(el("b", null, lo.name), el("small", null, lo.gun), loLevelChip(lo), el("span", "home-num", cost ? fmtK(cost) : ""));
    r.addEventListener("click", () => openLoadout(data.loadouts.indexOf(lo)));
    return r;
  }));
  list("Your routes", routes.slice(-6).reverse().map(rt => {
    const r = el("button", "home-row"); r.type = "button";
    const dot = el("span", "mp-rdot"); dot.style.background = rt.color;
    r.append(el("b", null, rt.name || "Route"), el("small", null, (MAP_LIST.find(m => m[0] === rt.map) || [, ""])[1]), dot, el("span", "home-num", plural(rt.pts.length, "point")));
    r.addEventListener("click", () => openRouteOnMap(rt)); // its map, its spawn, the route picked
    return r;
  }));
  if (lists.children.length) sec.append(lists);
  // the credits, one click away
  const foot = el("footer", "home-foot");
  foot.append(el("span", null, "A fan-made tool for friends"), button("About & sources", { cls: "linkbtn", icon: "info", onClick: openAbout }));
  sec.append(foot);
  if (motion.opened("home")) motion.stagger([hero, ...grid.children, ...(lists.isConnected ? [lists] : []), foot]); // fades in, one after another
}


// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("home", { draw: renderHome });
