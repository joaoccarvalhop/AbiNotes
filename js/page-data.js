/* What the pages in their own file share with the rest of the hub, so it works without them: the maps' list, key doors
   and route codes (search, Market, Share), the smelts log (Share, Home), the trading clock (Home), fitToScreen. The
   wrappers here (openRouteOnMap…) load the page first and then ask it through PAGES. */
import { area, loadScript, PAGES, withPage } from "../app.js";
import { $, K, ls, market, pageEl } from "./base.js";

/* ---------- maps: what the rest of the hub needs without the Maps page (its file is pages/maps.js) ---------- */
export const MAP_LIST = [["farm", "Farm"], ["valley", "Valley"], ["northridge", "Northridge"], ["armory", "Armory"], ["tv-station", "TV Station"], ["airport", "Airport"]];
export const MAP_CODE = { farm: "FARM", valley: "VALLEY", northridge: "NORTH", armory: "ARMORY", "tv-station": "TV", airport: "AIRPORT" };
export const ROUTE_COLORS = ["#e0662f", "#00d9ff", "#9fc58a", "#e0a23f", "#c77dff", "#ff5a6e", "#f1f1f1"];
// the door a key opens, and every map's markers: search, the market's key items and Home use them without the page
// the door a key opens: a "Key" marker on some map whose name is the key's, without the word key (maps loaded as needed)
export const keyWords = s => s.toLowerCase().replace(/\b(keycard|key)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export function keyDoor(name, done) {
  if (!/\bkey(card)?\b/i.test(name)) return done(null);
  allMaps(() => {
    const k = keyWords(name), doors = mapDoors();
    const d = doors.find(x => keyWords(x.mk.n) === k) || doors.find(x => { const w = keyWords(x.mk.n); return w && (` ${k} `.includes(` ${w} `) || ` ${w} `.includes(` ${k} `)); });
    done(d || null);
  });
}
// every map's markers, loaded once (search and keys need them all; a map's file is small)
export let allMapsWait = null;
export function allMaps(done) {
  if (MAP_LIST.every(([s]) => window.ABI_MAPS && ABI_MAPS[s])) return done();
  if (allMapsWait) { allMapsWait.push(done); return; }
  allMapsWait = [done]; let left = MAP_LIST.length;
  MAP_LIST.forEach(([s]) => loadMapData(s, () => { if (--left) return; const w = allMapsWait; allMapsWait = null; w.forEach(f => f()); }));
}
// key doors on the maps loaded so far: { slug, map, mk }
export const mapDoors = () => MAP_LIST.flatMap(([slug, map]) => ((window.ABI_MAPS && ABI_MAPS[slug] || {}).markers || []).filter(mk => mk.c === "Key" && mk.n).map(mk => ({ slug, map, mk })));
export function loadMapData(slug, done) {
  if (window.ABI_MAPS && ABI_MAPS[slug]) return done(ABI_MAPS[slug]);
  // the map, then its walls (not every map has them)
  loadScript(`maps/${slug}/data.js`, ok => (ok ? loadScript(`maps/${slug}/nav.js`, () => done(window.ABI_MAPS && ABI_MAPS[slug])) : done(null)));
}
// route share codes: Share reads them on any page (writing one is the Maps page's, routeCode)
export const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const b64text = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const textb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0)));
export function readRouteCode(code) {
  const m = String(code).trim().replace(/\s+/g, "").match(/^ABI1-([A-Z]+)-([A-Za-z0-9_-]*)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const map = Object.keys(MAP_CODE).find(k => MAP_CODE[k] === m[1]); if (!map || m[2].length % 4) return null;
  let extra; try { extra = JSON.parse(textb64(m[3])); } catch { return null; }
  const pts = [];
  for (let i = 0; i < m[2].length; i += 4) {
    const v = j => (B64.indexOf(m[2][i + j]) << 6) | B64.indexOf(m[2][i + j + 1]);
    const n = i / 4, note = extra.t && extra.t[n] ? String(extra.t[n]).slice(0, 60) : "";
    const floor = extra.l && extra.l[n] ? String(extra.l[n]).slice(0, 8) : String(extra.f || "").slice(0, 8);
    pts.push([v(0) * 4, v(2) * 4, note, floor]);
  }
  return { map, name: String(extra.n || "Shared route").slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(extra.c) ? extra.c : ROUTE_COLORS[1], floor: extra.f || "", pts,
    ...(extra.m ? { mode: String(extra.m).slice(0, 20) } : {}), ...(+extra.s > 0 ? { t0: Math.min(60, +extra.s) } : {}) };
}
// open one of your routes, or a marker (a key's door), from elsewhere: the Maps page first, then it
export function openRouteOnMap(r) { withPage("maps", () => PAGES.maps?.openRoute(r)); }
export function openMarkerOnMap(slug, mk) { withPage("maps", () => PAGES.maps?.openMarker(slug, mk)); }
export function planRouteOnMap() { withPage("maps", () => PAGES.maps?.planRoute()); }
// the whole data was swapped (an import): routes and walls may have changed. Nothing to redraw if the page never opened
export function refreshMaps() { if (PAGES.maps) PAGES.maps.refresh(); }

/* ---------- what the pages below share with the rest of the hub ----------
   Merchant, Smelter and Trading draw in their own files (pages/*.js), loaded the first time you open them
   (loadPage). What stays here is what other parts use: Share and Home read the smelts, Home the trading clock,
   and the tier list fits the screen like the merchant does. */
// a page that fits the screen (wide screens): its boxes scroll inside, the page itself never does. Any section can use it
export function fitToScreen(g) {
  if (!g) return;
  const fit = innerWidth > 1150;
  g.classList.toggle("fit", fit);
  if (!fit) { g.style.height = ""; return; }
  pageEl.scrollTop = 0;
  const top = g.getBoundingClientRect().top;
  g.style.height = Math.max(420, innerHeight - top - 18) + "px";
  const over = pageEl.scrollHeight - pageEl.clientHeight; // the page's own bottom padding: take it off too
  if (over > 0) g.style.height = Math.max(420, parseFloat(g.style.height) - over) + "px";
}
addEventListener("resize", () => { if (area === "tiers" && $("tiers")) fitToScreen($("tiers").querySelector(".tl-page")); });
// the smelts you logged (Share sends them, Home counts them)
export const smd = Object.assign({ log: [], rar: {}, recipes: [], slots: ["", "", ""], out: "", outV: "" }, ls.get(K.smelt) || {});
export const saveSm = () => ls.set(K.smelt, smd);
export const smItem = id => market.items.find(i => i.id === id);
export const SMELT_KINDS = { gold3same: "3 of the same gold", gold3: "3 gold", purple3: "3 purple", v300: "300k or more", v200: "200k to 300k", v45: "45k to 200k", low: "Under 45k" };

/* ---------- Trading: buy right after a market reset, sell when the market is dry (ABI Builder's ammo resets guide; timers from
   players' notes). The reset times are Sydney time: shown here in yours, live. Ammo is the classic (it resells at once; most
   other things stay locked until they've been in a raid), but the clock and the math work for anything ---------- */
// the resets of one Sydney day, in minutes from its midnight (past 24:00 = the night after); kept in a function so Home can ask early
export function trSchedule() {
  return {
    resets: [
      { at: 15 * 60 + 50, sure: false, tip: "Not every day: it depends on how many people play" },
      { at: 18 * 60 + 50, to: 19 * 60 + 30, sure: true, tip: "The first sure one comes somewhere in this window. Then one every hour" },
      { at: 20 * 60 + 30, sure: true }, { at: 21 * 60 + 30, sure: true }, { at: 22 * 60 + 30, sure: true }, { at: 23 * 60 + 30, sure: true },
      { at: 24 * 60 + 30, sure: false, tip: "The last one, not every night" },
    ],
    sell: [3 * 60, 16 * 60], // the market is dry: the time to sell
  };
}
// how far a time zone is ahead of UTC at a moment, in minutes
export function trOffset(d, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000;
}
// a Sydney day (its year, month, day) and minutes from its midnight, as a real moment
export function trSydney(day, min) {
  const guess = Date.UTC(day[0], day[1] - 1, day[2], 0, min);
  let t = guess - trOffset(new Date(guess), "Australia/Sydney") * 60000;
  return new Date(guess - trOffset(new Date(t), "Australia/Sydney") * 60000); // twice: right across a daylight-saving change
}
export const trDayOf = d => { const s = new Date(d.getTime() + trOffset(d, "Australia/Sydney") * 60000); return [s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate()]; };
export const trShift = (day, n) => { const t = new Date(Date.UTC(day[0], day[1] - 1, day[2] + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
// every reset and selling window from yesterday to the day after (Sydney days), as real moments
export function trEvents(now = new Date()) {
  const S = trSchedule(), today = trDayOf(now), resets = [], sells = [];
  [-1, 0, 1].forEach(n => {
    const day = trShift(today, n);
    S.resets.forEach((r, i) => resets.push({ ...r, n: i + 1, from: trSydney(day, r.at), to: trSydney(day, r.to || r.at + 10), syd: r.at }));
    sells.push({ from: trSydney(day, S.sell[0]), to: trSydney(day, S.sell[1]) });
  });
  return { resets: resets.sort((a, b) => a.from - b.from), sells };
}
export const trClock = d => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); // your time, 24h
export const trSydClock = min => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const trIn = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`; };
// what to do right now: buy (a reset is on), stop selling (one is near), sell (the market is dry) or wait
export function trStatus(now = new Date()) {
  const E = trEvents(now), on = E.resets.find(r => r.from <= now && now <= r.to), next = E.resets.find(r => r.from > now);
  const selling = E.sells.some(s => s.from <= now && now < s.to), soon = next && next.from - now < 30 * 60000;
  if (on) return { kind: "buy", word: "Reset on", line: "A reset is on: buy now", next, on };
  if (soon) return { kind: "hold", word: "Reset soon", line: `Reset in ${trIn(next.from - now)}: stop selling`, next };
  if (selling) return { kind: "sell", word: "Selling time", line: "The market is dry: sell", next };
  return { kind: "wait", word: "Waiting", line: next ? `Next reset in ${trIn(next.from - now)}` : "No reset soon", next };
}
