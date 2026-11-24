/* The Merchant page: loaded the first time the page opens (loadPage in app.js), after merchant.js, merchant-ocr.js, merchant-sounds.js and pages/merchant-items.js. */
import { area, registerPage } from "../app.js";
import { $, button, el, emptyNote, fmtKoen, icon, isPhone, K, ls, motion, norm, pageEl, plural } from "../js/base.js";
import { today } from "../js/market-data.js";
import { gmSection } from "../js/overlays/weapon.js";
import { fitToScreen } from "../js/page-data.js";
import { closeDialog, confirmBox, ddSelect, present, toast, wireDialog } from "../js/ui.js";
import { MER, merPic } from "./merchant-items.js";

/* ---------- Merchant: what a Field Merchant cargo holds, by the sound its item makes when you pick it up or drop it ---------- */
// The data (merchant.js, from ABI Builder) says which items each cargo can hold and how likely each is. In game every item makes
// one of 38 sounds; hearing it narrows the cargo down to the items with that sound. The page can listen to the game itself:
// the browser's screen share brings the window's sound (and picture, for reading the price) with nothing installed.
export const merUI = Object.assign({ map: null, mode: null, q: "", sizes: [], rot: true, ctype: null, cprice: null, sound: null, also: [], act: "u", need: .65 }, ls.get(K.merchant) || {});
export const saveMerUI = () => ls.set(K.merchant, merUI);
export const merModeName = m => m.replace(/([a-z])([A-Z])/g, "$1 $2");
// "Prop_Acc_Battery_Small_UP_01" -> "Battery Small", "Item_Misc_ElectronicDevice_Up" -> "Misc Electronic Device"
export const merSoundName = id => { const s = MER && MER.sounds.find(x => x[0] === id); return s ? s[1].replace(/^(Item|Prop)_(Acc_)?/i, "").replace(/_up(_\d+)?$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ") : "Sound " + id; };
// a sound: from merchant-sounds.js in the folder, else from ABI Builder online
export const merSoundUrl = (id, act) => {
  const s = MER.sounds.find(x => x[0] === id); if (!s) return "";
  const n = act === "d" ? s[2] : s[1];
  return (window.ABI_MERCHANT_SOUNDS && ABI_MERCHANT_SOUNDS[n]) || MER.soundUrl + n + ".ogg";
};
// every map, and its modes, as the data names them (a profile is the stock several map/modes share)
export function merPlaces() {
  const out = new Map();
  MER.profiles.forEach(([pid, maps]) => maps.forEach(([m, mode]) => { if (!out.has(m)) out.set(m, []); out.get(m).push([mode, pid]); }));
  return out;
}
export function merProfile() {
  const pl = merPlaces();
  if (!pl.has(merUI.map)) merUI.map = [...pl.keys()][0];
  const modes = pl.get(merUI.map), hit = modes.find(([m]) => m === merUI.mode) || modes[0]; merUI.mode = hit[0];
  return hit[1];
}
// the cargos you can buy on this map/mode: same name and price count as one (nothing in game tells them apart)
export function merCargos() {
  const pid = merProfile(), by = new Map();
  MER.pools.filter(p => p[0] === pid).forEach(p => {
    const k = p[1] + ":" + p[2];
    if (!by.has(k)) by.set(k, { key: k, name: MER.types[p[1]] || "Cargo", price: p[2], pools: [] });
    by.get(k).pools.push(p);
  });
  const list = [...by.values()].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  list.forEach(c => { c.odds = merOdds(c.pools); c.value = [...c.odds].reduce((s, [id, p]) => s + p * MER.items[id][2], 0); });
  return list;
}
// the chance of each item in a cargo: its weight in each pool, the pools mixed by their own weight; adds up to 1
export function merOdds(pools) {
  const tot = pools.reduce((s, p) => s + p[3], 0) || 1, out = new Map();
  pools.forEach(p => { const wt = p[5].reduce((s, x) => s + x[1], 0) || 1; p[5].forEach(([id, w]) => out.set(id, (out.get(id) || 0) + p[3] / tot * w / wt)); });
  return out;
}
export const MER_RARITY = ["", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
export const MER_SIZES = ["1x1", "1x2", "2x1", "2x2", "2x3", "3x2"];
// what the filters leave: the cargos (by type and price), and the items they can hold that match the search and the size.
// Chances only mean something inside one cargo: with several picked, the list goes dearest first instead
export function merView() {
  const cargos = merCargos();
  const picked = cargos.filter(c => (!merUI.ctype || c.name === merUI.ctype) && (!merUI.cprice || c.price === merUI.cprice));
  const one = picked.length === 1 ? picked[0] : null, q = norm(merUI.q || ""), sizes = merUI.sizes || [];
  const fits = it => (!q || norm(it[0]).includes(q)) && (!sizes.length || sizes.some(s => {
    const [w, h] = s.split("x").map(Number); return (it[4] === w && it[5] === h) || (merUI.rot !== false && it[4] === h && it[5] === w);
  }));
  const where = new Map();
  picked.forEach(c => c.odds.forEach((p, id) => { if (!where.has(id)) where.set(id, []); where.get(id).push(c); }));
  const items = [...where.keys()].filter(id => fits(MER.items[id])).map(id => ({ id, it: MER.items[id], where: where.get(id), p: one ? one.odds.get(id) : null }));
  return { cargos, picked, one, items };
}
// in one cargo, with the filters (and the sound) applied: the chance its item sells for more than the cargo costs
export function merProfit(c, v, sounds) {
  const list = v.items.filter(x => x.where.includes(c) && (!sounds.length || sounds.includes(x.it[6]))).map(x => [c.odds.get(x.id) || 0, x.it[2]]);
  const s = list.reduce((a, [p]) => a + p, 0); if (!s) return null;
  return { pc: list.reduce((a, [p, price]) => a + (price > c.price ? p : 0), 0) / s, ev: list.reduce((a, [p, price]) => a + p * price, 0) / s }; // chance of profit, and what comes back on average
}
// the sounds picked: the one heard or clicked, plus any added when unsure which it was
export const merSel = () => merUI.sound ? [merUI.sound, ...(merUI.also || [])] : [];
// the items left once the sounds are known (or all of them), with their chance among those when there is one cargo
export function merCandidates(v, sounds) {
  const list = v.items.filter(x => !sounds.length || sounds.includes(x.it[6])).map(x => ({ ...x }));
  if (!v.one) return list.sort((a, b) => b.it[2] - a.it[2] || a.it[0].localeCompare(b.it[0]));
  const s = list.reduce((a, x) => a + x.p, 0) || 1; list.forEach(x => { x.p /= s; });
  return list.sort((a, b) => b.p - a.p || b.it[2] - a.it[2]);
}

/* sounds, as numbers: each short frame becomes its loudness and the shape of its spectrum in 24 bands (low to high) */
export const MF = { N: 1024, HOP: 512, BANDS: 24, LEN: 30 };
export const merFFT = (() => {
  const N = MF.N, rev = new Uint16Array(N), cos = new Float32Array(N / 2), sin = new Float32Array(N / 2), win = new Float32Array(N);
  for (let i = 0; i < N; i++) { let r = 0; for (let b = 1, x = i; b < N; b <<= 1, x >>= 1) r = (r << 1) | (x & 1); rev[i] = r; win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)); }
  for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = -Math.sin(2 * Math.PI * i / N); }
  const re = new Float32Array(N), im = new Float32Array(N), mag = new Float32Array(N / 2);
  return x => { // power spectrum of one windowed frame
    for (let i = 0; i < N; i++) { re[rev[i]] = x[i] * win[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) for (let j = 0; j < half; j++) {
        const k = j * step, a = i + j, b = a + half, tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    for (let i = 0; i < N / 2; i++) mag[i] = re[i] * re[i] + im[i] * im[i];
    return mag;
  };
})();
export let merBandEdges = null, merRate = 48000;
// another sample rate (the sound test, tools/merchant_sound_test.js): the bands are worked out again for it
export function merSetRate(r) { merRate = r; merBandEdges = null; }
export function merFeature(frame) {
  if (!merBandEdges) { // log-spaced bands, 120 Hz to 16 kHz
    merBandEdges = []; const lo = 120, hi = 16000;
    for (let i = 0; i <= MF.BANDS; i++) merBandEdges.push(Math.max(1, Math.round(lo * Math.pow(hi / lo, i / MF.BANDS) * MF.N / merRate)));
  }
  const mag = merFFT(frame), b = new Float32Array(MF.BANDS); let tot = 0;
  for (let i = 0; i < MF.BANDS; i++) { let s = 0; for (let k = merBandEdges[i]; k < Math.max(merBandEdges[i] + 1, merBandEdges[i + 1]); k++) s += mag[k]; tot += s; b[i] = 10 * Math.log10(s + 1e-9); }
  return { e: 10 * Math.log10(tot + 1e-9), b };
}
// a reference sound -> its frames from where it starts, up to MF.LEN of them
export function merTemplate(samples) {
  const f = [];
  for (let i = 0; i + MF.N <= samples.length; i += MF.HOP) f.push(merFeature(samples.subarray(i, i + MF.N)));
  if (!f.length) return null;
  return merTrim(f);
}
// frames from where the sound starts (30 dB under its peak), up to MF.LEN, without its quiet tail
export function merTrim(f) {
  const peak = Math.max(...f.map(x => x.e)), start = Math.max(0, f.findIndex(x => x.e > peak - 30));
  const t = f.slice(start, start + MF.LEN);
  while (t.length > 4 && t[t.length - 1].e < peak - 45) t.pop();
  return { e: t.map(x => +x.e.toFixed(1)), b: t.map(x => Array.from(x.b, v => +v.toFixed(1))) };
}
// how alike a reference and what was heard (from frame s on): one correlation over the whole time x band picture, louder
// moments counting more; the background's own sound (bg, power per band) is taken off first, so a noisy raid matters less.
// Volume doesn't matter: a quiet copy of a sound scores the same as a loud one.
export function merSimilar(T, F, s, bg) {
  const n = Math.min(T.e.length, F.length - s); if (n < 3) return 0;
  const peak = Math.max(...T.e); let sw = 0, mx = 0, my = 0;
  const xs = new Float32Array(n * MF.BANDS), ys = new Float32Array(n * MF.BANDS), ws = new Float32Array(n * MF.BANDS);
  for (let i = 0, j = 0; i < n; i++) {
    const w = Math.pow(10, (T.e[i] - peak) / 20), fb = F[s + i].b;
    for (let k = 0; k < MF.BANDS; k++, j++) {
      let p = Math.pow(10, fb[k] / 10); if (bg) p = Math.max(p - bg[k], p * .02);
      xs[j] = T.b[i][k]; ys[j] = 10 * Math.log10(p + 1e-9); ws[j] = w;
      sw += w; mx += w * xs[j]; my += w * ys[j];
    }
  }
  mx /= sw; my /= sw;
  let c = 0, vx = 0, vy = 0;
  for (let j = 0; j < xs.length; j++) { const a = xs[j] - mx, b = ys[j] - my; c += ws[j] * a * b; vx += ws[j] * a * a; vy += ws[j] * b * b; }
  return c / Math.sqrt(vx * vy + 1e-9);
}

/* the references: the game's 38 sounds (picked up and dropped), read once from ABI Builder and kept, plus the ones you taught */
export const merRefs = { list: [], state: "none" }; // list: [{ id, act: "u"|"d", T, mine }]
export async function merLoadRefs(ctx) {
  if (merRefs.state === "ready" || merRefs.state === "loading") return;
  merRefs.state = "loading"; merDraw();
  const cache = ls.get(K.merRefs), ok = cache && cache.v === 1 && cache.rate === ctx.sampleRate && cache.ver === MER.dataVersion;
  let t = ok ? cache.t : {};
  if (!ok) {
    await Promise.all(MER.sounds.flatMap(([id]) => ["u", "d"].map(async act => {
      try {
        const buf = await ctx.decodeAudioData(await (await fetch(merSoundUrl(id, act))).arrayBuffer());
        const ch = buf.getChannelData(0), ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch, mono = new Float32Array(ch.length);
        for (let i = 0; i < ch.length; i++) mono[i] = (ch[i] + ch2[i]) / 2;
        const T = merTemplate(mono); if (T) t[id + act] = T;
      } catch (e) { /* offline or moved: the ones you taught still work */ }
    })));
    if (Object.keys(t).length) ls.set(K.merRefs, { v: 1, rate: ctx.sampleRate, ver: MER.dataVersion, t });
  }
  merRefs.list = Object.entries(t).map(([k, T]) => ({ id: +k.slice(0, -1), act: k.slice(-1), T }));
  (ls.get(K.merMine) || []).forEach(m => merRefs.list.push({ id: m.id, act: m.act, T: m.T, mine: true }));
  merRefs.state = merRefs.list.length ? "ready" : "failed"; merDraw();
}

/* listening: the shared window's sound, cut into frames; a sudden sound is compared with every reference */
export const merLive = { on: false, mic: false, stream: null, ctx: null, node: null, video: null, frames: [], tail: new Float32Array(0), floor: null, wait: null, quiet: 0, level: -90, last: null, clip: null, hist: [] };
// what this browser can do: share a window with its sound (Chrome or Edge on a computer; not Firefox, Safari or phones),
// and listen through a microphone (any browser, on https or a local file)
export const merCan = (() => {
  const ua = navigator.userAgent, md = navigator.mediaDevices;
  const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua), chromium = /Chrome\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  return { share: !!(md && md.getDisplayMedia) && chromium && !phone, mic: !!(md && md.getUserMedia) && (isSecureContext || location.protocol === "file:"), phone };
})();
// the match a sound needs: heard through the air (the mic) it never comes as close as from the game itself, so it has its own
export const merNeed = () => merLive.mic || (!merLive.on && !merCan.share) ? (merUI.needMic ?? .55) : merUI.need;
export async function merListen(mic = false) {
  if (merLive.on) return merStop();
  if (!mic && !merCan.share) { toast([el("b", null, "Needs Chrome or Edge on a computer"), el("span", null, merCan.mic ? " · Listen with mic works here" : "")]); return; }
  let stream;
  if (mic) {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { toast([el("b", null, "No microphone"), el("span", null, " · allow it in the browser to listen")]); return; }
  } else {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 8 }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: "include", windowAudio: "window", selfBrowserSurface: "exclude" });
    } catch (e) { return; } // you closed the share window
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach(t => t.stop());
      toast([el("b", null, "No sound came with the share"), el("span", null, "Share again and tick \"Share audio\". If the window has no such box, share the entire screen with \"Share system audio\".")]);
      return;
    }
  }
  const ctx = new AudioContext({ sampleRate: 48000 }); merRate = ctx.sampleRate; merBandEdges = null;
  const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  const node = ctx.createScriptProcessor(2048, 2, 1);
  node.onaudioprocess = e => {
    const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : a, m = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) / 2;
    merFeed(m);
  };
  const mute = ctx.createGain(); mute.gain.value = 0; // the processor needs an output to run; nothing is played back
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);
  let video = null; // the game's picture, for the price reader (a mic has none)
  if (!mic) { video = el("video"); video.muted = true; video.playsInline = true; video.srcObject = new MediaStream(stream.getVideoTracks()); video.play().catch(() => {}); }
  Object.assign(merLive, { on: true, mic, stream, ctx, node, video, frames: [], tail: new Float32Array(0), floor: null, wait: null, prev: null });
  stream.getTracks().forEach(t => t.addEventListener("ended", () => merStop()));
  merLoadRefs(ctx);
  if (!mic) merOcrStart();
  merDraw();
}
export function merStop() {
  if (!merLive.on) return;
  merLive.on = false; merLive.mic = false;
  merLive.stream.getTracks().forEach(t => t.stop());
  try { merLive.node.disconnect(); merLive.ctx.close(); } catch (e) { /* already closed */ }
  merOcrStop();
  merDraw();
}
// raw sound in: frames out, and a match when something starts
export function merFeed(m) {
  const all = new Float32Array(merLive.tail.length + m.length); all.set(merLive.tail); all.set(m, merLive.tail.length);
  let i = 0;
  for (; i + MF.N <= all.length; i += MF.HOP) merFrame(merFeature(all.subarray(i, i + MF.N)));
  merLive.tail = all.slice(i);
}
export function merFrame(f) {
  const L = merLive, F = L.frames; F.push(f); if (F.length > 400) { F.splice(0, 100); if (L.wait) L.wait.at -= 100; }
  L.level = f.e;
  // the background: starts where the sound starts, follows quiet moments down at once and loud ones up slowly
  L.floor = L.floor == null || f.e < L.floor ? f.e : L.floor + .04;
  if (L.quiet > 0) L.quiet--;
  // something 5 dB over the background starts a look: from a few frames back (the start can be soft), once enough has come in
  if (!L.wait && !L.quiet && f.e > L.floor + 5 && f.e > -75) L.wait = { at: Math.max(0, F.length - 6) };
  if (L.wait && F.length >= L.wait.at + MF.LEN + 10) { const at = L.wait.at; L.wait = null; L.quiet = 12; merMatch(F.slice(at), F.slice(Math.max(0, at - 40), at)); }
}
export function merMatch(F, before) {
  const clip = F.slice(0, MF.LEN + 10);
  merLive.clip = clip; // kept for "Teach": the last sound that stood out
  if (merRefs.state !== "ready") { merDraw(); return; }
  // the background: the average power per band just before the sound
  let bg = null;
  if (before.length > 5) { bg = new Float32Array(MF.BANDS); before.forEach(f => f.b.forEach((v, k) => { bg[k] += Math.pow(10, v / 10) / before.length; })); }
  const best = new Map(); // per sound and action, its best score
  merRefs.list.forEach(r => {
    let s = 0; for (let o = 0; o <= 10; o++) s = Math.max(s, merSimilar(r.T, clip, o, bg));
    const k = r.id + r.act; if (!best.has(k) || best.get(k).s < s) best.set(k, { id: r.id, act: r.act, s, mine: r.mine });
  });
  const ranked = [...best.values()].sort((a, b) => b.s - a.s);
  if (!ranked.length) { merDraw(); return; }
  // per item sound, how well this one fits it (picked up or dropped, whichever fits better)
  const ids = new Map(); ranked.forEach(r => { if (!ids.has(r.id) || ids.get(r.id) < r.s) ids.set(r.id, r.s); });
  const ev = { t: Date.now(), ids, top: ranked[0] };
  // picking an item up and dropping it are the same item: a second sound soon after the first is read together with it.
  // An item wins the pair only if it is among the best few for each sound (within .05 of that sound's best), the weaker
  // fit deciding between them. When no item is, the two disagree and the first answer stays: drops sound more alike
  // between items, so a drop on its own must not replace a good pick-up
  const prev = merLive.prev;
  if (prev && ev.t - prev.t < 20000) {
    const pTop = Math.max(...prev.ids.values()), cTop = ev.top.s;
    const both = [...ids].filter(([id, s]) => s >= cTop - .05 && (prev.ids.get(id) || 0) >= pTop - .05)
      .map(([id, s]) => ({ id, s: Math.min(s, prev.ids.get(id)) })).sort((a, b) => b.s - a.s);
    merLive.prev = null; // a pair is used once: the next sound starts a new item
    if (both.length && both[0].s >= merNeed() - .05) {
      const alt = both.slice(1, 3).filter(r => r.s > both[0].s - .06);
      merHeard(both[0].id, "ud", both[0].s, alt); return;
    }
    if (prev.shown) { merDraw(); return; } // they disagree: keep what the first sound said
  }
  if (ev.top.s >= merNeed() - .15) merLive.prev = ev; // a near miss still helps the next sound
  if (ev.top.s < merNeed()) { merDraw(); return; }
  ev.shown = true;
  const top = ev.top, alt = ranked.filter(r => r.id !== top.id).slice(0, 2).filter(r => r.s > top.s - .08 && r.s >= merNeed() - .1);
  merHeard(top.id, top.act, top.s, alt);
}
// a sound, heard or picked by hand
export function merHeard(id, act, score, alt) {
  merUI.sound = id; merUI.also = []; if (act === "u" || act === "d") merUI.act = act; saveMerUI(); // "ud": a pick-up and a drop read together
  const h = { id, act, score, alt: alt || [], t: Date.now() };
  merLive.last = h; merLive.hist.unshift(h); merLive.hist.length = Math.min(merLive.hist.length, 8);
  merDraw();
}

/* the price, read off the game. In game the price shows in a card that follows the mouse, so the reader looks for the
   card's coin anywhere on the picture and reads what is right of it. You draw a box once, from the coin to the end of the
   price, and teach the digits from what you see. Without a coin in the box, it reads the box where it is */
export const merOcr = Object.assign({ box: null, glyphs: [], anchor: null }, ls.get(K.merOcr) || {}); // box: fractions of the picture; glyphs: [{ ch, v, ar, rh, top }]; anchor: the coin, see merSetAnchor
if (merOcr.v !== 2) Object.assign(merOcr, { v: 2, box: null, glyphs: [], anchor: null }); // taught before the reader looked for the coin: measured differently, so taught again
// built in (merchant-ocr.js): the game's digits and the price card's coin, so it reads with nothing taught. The font never
// changes; the picture's size does, and the reader scales the coin to the window. Used until you teach it, and again
// after "Forget the digits"; what you teach goes on top of them
export function merBuiltin() {
  const B = window.ABI_MERCHANT_OCR; if (!B || B.v !== 1) return null;
  const unhex = s => Array.from({ length: s.length / 2 }, (_, i) => parseInt(s.substr(i * 2, 2), 16));
  return { box: { ...B.box }, anchor: { ...B.anchor, fw: B.fw, t: unhex(B.anchor.t), f: unhex(B.anchor.f) },
    glyphs: B.glyphs.map(([ch, v, ar, rh, top]) => ({ ch, v: [...v].map(d => +d / 9), ar, rh, top })) };
}
export function merUseBuiltin() { const B = merBuiltin(); if (B) Object.assign(merOcr, B, { builtin: true }); return !!B; }
// the letters of the cargo names (merchant-ocr.js): each a few looks, a look being one to three marks (an "m" falls in three)
export const MER_LETTERS = (() => {
  const L = window.ABI_MERCHANT_OCR && window.ABI_MERCHANT_OCR.letters; if (!L) return null;
  const out = {}; Object.entries(L).forEach(([ch, looks]) => { out[ch] = looks.map(seq => seq.map(([v, ar, rh, top]) => ({ v: [...v].map(d => +d / 9), ar, rh, top }))); });
  return out;
})();
// how unlike two marks are (the same measure merReadAll uses for digits)
export function merMarkGap(a, b) { let s = 0; for (let i = 0; i < a.v.length; i++) s += Math.abs(a.v[i] - b.v[i]); return s / a.v.length + .3 * Math.abs(a.ar - b.ar) + .5 * Math.abs(a.rh - b.rh) + .3 * Math.abs((a.top || 0) - (b.top || 0)); }
// how well a line of marks spells a name: each letter takes one to three marks, a stray mark or a missed letter costs a
// little; the lower the better (per letter)
export function merSpells(marks, name) {
  const ch = [...name.replace(/\s/g, "")], n = marks.length, m = ch.length, INF = 1e9;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF)); dp[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const c0 = dp[i][j]; if (c0 >= INF) continue;
    if (i < n) dp[i + 1][j] = Math.min(dp[i + 1][j], c0 + .6); // a stray mark (the card's edge, a speck)
    if (j < m) dp[i][j + 1] = Math.min(dp[i][j + 1], c0 + .7); // a letter not seen
    if (j < m) for (let k = 1; k <= 3 && i + k <= n; k++) {
      const looks = ((MER_LETTERS || {})[ch[j]] || []).filter(l => l.length === k);
      const c = (looks.length ? Math.min(...looks.map(l => l.reduce((s, t, q) => s + merMarkGap(marks[i + q], t), 0) / k)) : (k === 1 ? .45 : .55)) + (k - 1) * .05;
      dp[i + k][j + 1] = Math.min(dp[i + k][j + 1], c0 + c);
    }
  }
  return dp[n][m] / Math.max(m, 1);
}
// which of these cargo types the price card names: the line over the price (found at its coin, at), spelled against each.
// The card's text scales with the window (it was measured with the game at 1919 wide). null when none is clearly closest
export function merNameOf(src, at, names) {
  if (!MER_LETTERS || !at || names.length < 2) return null;
  const W = src.videoWidth || src.width, H = src.videoHeight || src.height, s = W / 1919, [X, Y] = at;
  const x = Math.max(0, X - 4 * s), y = Math.max(0, Y - 24 * s);
  const img = merGrab({ x: x / W, y: y / H, w: Math.min(230 * s, W - x) / W, h: 20 * s / H }, src); if (!img) return null;
  const line = merGlyphs(img).sort((a, b) => b.length - a.length)[0]; if (!line) return null;
  const ranked = names.map(n => [n, merSpells(line, n)]).sort((a, b) => a[1] - b[1]);
  return ranked[0][1] < .55 && ranked[1][1] - ranked[0][1] > .04 ? ranked[0][0] : null;
}
if (!merOcr.glyphs.length) merUseBuiltin();
export const merOcrRun = { timer: 0, read: null, price: null, canvas: el("canvas") };
export const MG = { W: 10, H: 14 };
export function merGrab(box, src, scale = 1) { // the box out of a picture (the shared window now, or a still of it), as grey values
  const v = src || merLive.video, W = v && (v.videoWidth || v.width), H = v && (v.videoHeight || v.height); if (!W || !H) return null;
  const sx = Math.round(box.x * W), sy = Math.round(box.y * H), sw = Math.max(4, Math.round(box.w * W)), sh = Math.max(4, Math.round(box.h * H));
  const w = Math.max(4, Math.round(sw * scale)), h = Math.max(4, Math.round(sh * scale));
  const c = merOcrRun.canvas; c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  return { w, h, grey };
}
// ink and paper: the threshold that splits the box's greys best; the ink is whichever side has fewer pixels
export function merInk({ w, h, grey }) {
  const hist = new Array(256).fill(0); grey.forEach(v => hist[Math.min(255, v | 0)]++);
  const n = w * h; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sb = 0, wb = 0, best = 0, th = 128;
  for (let i = 0; i < 256; i++) { wb += hist[i]; if (!wb || wb === n) continue; sb += i * hist[i]; const mb = sb / wb, mf = (sum - sb) / (n - wb), v = wb * (n - wb) * (mb - mf) ** 2; if (v > best) { best = v; th = i; } }
  let bright = 0; grey.forEach(v => { if (v > th) bright++; });
  const inkBright = bright < n / 2, ink = new Uint8Array(n);
  // a little past the split, towards the ink: the soft edges between letters stay paper, so letters don't touch
  const sorted = Float32Array.from(grey).sort(), far = inkBright ? sorted[Math.floor(n * .995)] : sorted[Math.floor(n * .005)];
  const cut = th + (far - th) * .3;
  grey.forEach((v, i) => { ink[i] = (inkBright ? v > cut : v < cut) ? 1 : 0; });
  return ink;
}
// lines of text, then the characters in each (split where a column has no ink)
export function merGlyphs(img) {
  const { w, h } = img, ink = merInk(img), rows = [];
  // a column inked nearly top to bottom is the card's edge, not a letter: left out, so lines keep the letters' height
  for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) s += ink[y * w + x]; if (h >= 8 && s > h * .85) for (let y = 0; y < h; y++) ink[y * w + x] = 0; }
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += ink[y * w + x]; rows.push(s); }
  const lines = []; let y0 = -1;
  for (let y = 0; y <= h; y++) { const on = y < h && rows[y] > 0; if (on && y0 < 0) y0 = y; if (!on && y0 >= 0) { if (y - y0 >= 5) lines.push([y0, y]); y0 = -1; } }
  return lines.map(([a, b]) => {
    const out = [], col = x => { let s = 0; for (let y = a; y < b; y++) s += ink[y * w + x]; return s; };
    const span = (x0, x) => { let t = b, bt = a; for (let y = a; y < b; y++) for (let xx = x0; xx < x; xx++) if (ink[y * w + xx]) { t = Math.min(t, y); bt = Math.max(bt, y + 1); } return [t, bt]; };
    // the runs of columns with ink; one wider than a digit is two letters touching: split it where the ink is thinnest
    const runs = []; let x0 = -1;
    for (let x = 0; x <= w; x++) { const on = x < w && col(x) > 0; if (on && x0 < 0) x0 = x; if (!on && x0 >= 0) { runs.push([x0, x]); x0 = -1; } }
    // the letters' height and top: the middle of the runs' (most are digits), so other things on the line don't change them
    const mid = a => a.sort((p, q) => p - q)[Math.floor(a.length / 2)], spans = runs.map(([s, e]) => span(s, e));
    const lh = Math.max(4, mid(spans.map(([t, bt]) => bt - t))), lt = mid(spans.map(([t]) => t));
    const split = ([s, e]) => {
      if (e - s <= lh * .8) return [[s, e]];
      let best = -1, bv = 1e9; for (let x = s + Math.round(lh * .3); x < e - Math.round(lh * .3); x++) { const v = col(x); if (v < bv) { bv = v; best = x; } }
      return best < 0 ? [[s, e]] : [...split([s, best]), ...split([best + (bv ? 0 : 1), e])];
    };
    runs.flatMap(split).forEach(([x0, x]) => {
      // the letter's own box, shrunk to a 10 x 14 grid of how much ink each cell holds
      const [t, bt] = span(x0, x);
      if (bt <= t) return;
      const gw = x - x0, gh = bt - t, v = new Float32Array(MG.W * MG.H);
      for (let j = 0; j < MG.H; j++) for (let i = 0; i < MG.W; i++) {
        const sx = x0 + Math.floor(i * gw / MG.W), sy = t + Math.floor(j * gh / MG.H), ex = x0 + Math.max(Math.floor((i + 1) * gw / MG.W), Math.floor(i * gw / MG.W) + 1), ey = t + Math.max(Math.floor((j + 1) * gh / MG.H), Math.floor(j * gh / MG.H) + 1);
        let s = 0, c = 0; for (let yy = sy; yy < ey; yy++) for (let xx = sx; xx < ex; xx++) { s += ink[yy * w + xx]; c++; }
        v[j * MG.W + i] = c ? s / c : 0;
      }
      out.push({ v, ar: gw / gh, rh: gh / lh, top: (t - lt) / lh, x0, x1: x });
    });
    out.lh = lh; out.y0 = a; out.y1 = b; // the line's height in the box, so a box can be narrowed to it (merFitBox)
    return out;
  }).filter(l => l.length);
}
// thousands with commas, as the game writes them: "270000" -> "270,000", "16000 20000" -> "16,000 20,000"
export const merCommas = t => t.replace(/\d{4,}/g, d => (+d).toLocaleString("en-US"));
// a box drawn round more than the price (the whole card: name, price, "Add to Cart"): find the price's line by what you
// typed (the coin, then as many characters), with or without the commas, and narrow the box to it, from the coin to a
// little past the end. Returns the text as the game shows it, or null when no line fits (the box is left as drawn)
export function merFitBox(src, text) {
  const b = merOcr.box, img = b && merGrab(b, src); if (!img) return null;
  const lines = merGlyphs(img);
  for (const t of [merCommas(text.trim()), text.trim()]) {
    // seen in a big box the coin can fall into a few pieces and a comma can join a digit, so the count is only near:
    // the line nearest the coin plus what you typed, and with as many commas (small marks low on the line) wins
    const n = t.replace(/\s/g, "").length, commas = (t.match(/,/g) || []).length;
    const fitOf = l => Math.abs(l.length - (n + 1)) + 2 * Math.abs(l.filter(g => g.rh < .5 && g.top > .4).length - commas);
    const line = lines.filter(l => Math.abs(l.length - (n + 1)) <= 3).sort((a, b) => fitOf(a) - fitOf(b))[0];
    if (!line || fitOf(line) > 4) continue;
    const pad = Math.max(2, Math.round(line.lh * .25)), x0 = Math.max(0, line[0].x0 - pad), end = line[line.length - 1].x1;
    const x1 = Math.min(img.w, end + Math.round((end - line[0].x0) * .4)); // room for a longer price than this one
    const y0 = Math.max(0, line.y0 - pad), y1 = Math.min(img.h, line.y1 + pad);
    merOcr.box = { x: b.x + x0 / img.w * b.w, y: b.y + y0 / img.h * b.h, w: (x1 - x0) / img.w * b.w, h: (y1 - y0) / img.h * b.h };
    merSetAnchor(src); ls.set(K.merOcr, merOcr);
    return t;
  }
  return null;
}
// every number in the picture made of taught characters, best first. A wide gap starts a new number: a card on sale
// shows the sale price and the full one side by side
export function merReadAll(img) {
  if (!merOcr.glyphs.length || !img) return [];
  const words = [];
  merGlyphs(img).forEach(line => {
    let word = [];
    const end = () => {
      if (!word.length) return;
      let txt = "", score = 0;
      word.forEach(g => {
        let bc = null, bd = 9;
        merOcr.glyphs.forEach(t => {
          let d = 0; for (let i = 0; i < t.v.length; i++) d += Math.abs(t.v[i] - g.v[i]);
          d = d / t.v.length + .3 * Math.abs(t.ar - g.ar) + .5 * Math.abs(t.rh - g.rh) + .3 * Math.abs((t.top || 0) - g.top);
          if (d < bd) { bd = d; bc = t.ch; }
        });
        txt += bc; score += 1 - bd;
      });
      score /= word.length; const x = word[0].x0; word = [];
      const num = /\d/.test(txt) ? +txt.replace(/[^\d]/g, "") : NaN;
      if (!isNaN(num) && score > .7) words.push({ txt, num, score, x });
    };
    line.forEach((g, i) => { if (i && g.x0 - line[i - 1].x1 > line.lh * .4) end(); word.push(g); });
    end();
  });
  return words.sort((a, b) => b.score - a.score);
}
export function merRead(img) { return merReadAll(img)[0] || null; } // the number it is surest of
// the coin left of the price: the first run of columns with ink in the box you drew
export function merCoin(img) {
  const ink = merInk(img), col = x => { let s = 0; for (let y = 0; y < img.h; y++) s += ink[y * img.w + x]; return s; };
  let x = 0; while (x < img.w && !col(x)) x++;
  if (x >= img.w) return null;
  while (x < img.w && col(x)) x++;
  return x < img.w * .6 ? x + 1 : null; // where the coin ends; nothing after it means there is no coin, only a number
}
// from the box you drew on a picture: the coin to look for, at half size, and where the price sits from it
export function merSetAnchor(src) {
  merOcr.anchor = null;
  const b = merOcr.box, img = b && merGrab(b, src); if (!img) return;
  const W = src.videoWidth || src.width, aw = merCoin(img); if (!aw) return;
  const t = merGrab({ x: b.x, y: b.y, w: aw / W, h: b.h }, src, .5), f = merGrab({ x: b.x, y: b.y, w: aw / W, h: b.h }, src);
  merOcr.anchor = { fw: W, aw, bw: img.w, bh: img.h, tw: t.w, th: t.h, t: Array.from(t.grey, v => Math.round(v)), f: Array.from(f.grey, v => Math.round(v)), fW: f.w, fH: f.h };
}
// a picture of the coin resized by r, less its mean: what the correlation compares
export function merPatch(src, sw, sh, r) {
  const tw = Math.max(3, Math.round(sw * r)), th = Math.max(3, Math.round(sh * r)), n = tw * th, T = new Float32Array(n);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) T[j * tw + i] = src[Math.min(sh - 1, Math.floor(j / r)) * sw + Math.min(sw - 1, Math.floor(i / r))];
  let m = 0; T.forEach(v => m += v); m /= n; let tn = 0; for (let k = 0; k < n; k++) { T[k] -= m; tn += T[k] * T[k]; }
  return { T, tw, th, n, tn };
}
// the part of the box right of the coin: where the digits are
export function merAfterCoin(src) {
  const b = merOcr.box, A = merOcr.anchor, W = src.videoWidth || src.width;
  return A ? merGrab({ x: b.x + A.aw / W, y: b.y, w: b.w - A.aw / W, h: b.h }, src) : merGrab(b, src);
}
// where the coin is in a picture now: the few spots that look most like it (normalised correlation at half size),
// each with the numbers read right of it
export function merFind(src) {
  const A = merOcr.anchor;
  if (!A) { const img = merOcr.box && merGrab(merOcr.box, src); return img ? [{ score: 1, words: merReadAll(img) }] : []; }
  const W = src.videoWidth || src.width, H = src.videoHeight || src.height; if (!W || !H) return [];
  const r = W / A.fw, S = .5, G = merGrab({ x: 0, y: 0, w: 1, h: 1 }, src, S); if (!G) return [];
  // the coin at this picture's size (the same if you taught it on this window)
  const { T, tw, th, n, tn } = merPatch(A.t, A.tw, A.th, r);
  if (tn < n * 25) return []; // a flat box: nothing to look for
  const gw = G.w, gh = G.h, g = G.grey, I = new Float64Array((gw + 1) * (gh + 1)), I2 = new Float64Array((gw + 1) * (gh + 1));
  for (let y = 0; y < gh; y++) { let s = 0, s2 = 0; for (let x = 0; x < gw; x++) { const v = g[y * gw + x]; s += v; s2 += v * v; I[(y + 1) * (gw + 1) + x + 1] = I[y * (gw + 1) + x + 1] + s; I2[(y + 1) * (gw + 1) + x + 1] = I2[y * (gw + 1) + x + 1] + s2; } }
  const box = (A2, x, y) => A2[(y + th) * (gw + 1) + x + tw] - A2[y * (gw + 1) + x + tw] - A2[(y + th) * (gw + 1) + x] + A2[y * (gw + 1) + x];
  const spots = [];
  for (let y = 0; y + th <= gh; y++) for (let x = 0; x + tw <= gw; x++) {
    const s = box(I, x, y), vr = box(I2, x, y) - s * s / n; if (vr < n * 25) continue;
    let d = 0; for (let j = 0; j < th; j++) { const o = (y + j) * gw + x, p = j * tw; for (let i = 0; i < tw; i++) d += T[p + i] * g[o + i]; }
    const c = d / Math.sqrt(vr * tn); if (c > .75) spots.push({ x, y, c });
  }
  spots.sort((a, b) => b.c - a.c);
  const best = [];
  for (const s of spots) { if (best.length >= 5) break; if (!best.some(o => Math.abs(o.x - s.x) < tw && Math.abs(o.y - s.y) < th)) best.push(s); }
  // each spot to the pixel, at full size (half size can be a pixel or two off, and the digits' height must match)
  const F = A.f && merPatch(A.f, A.fW, A.fH, r);
  return best.map(s => {
    let X = s.x / S, Y = s.y / S;
    if (F) {
      const P = 3, area = merGrab({ x: Math.max(0, X - P) / W, y: Math.max(0, Y - P) / H, w: (F.tw + 2 * P) / W, h: (F.th + 2 * P) / H }, src);
      const ox = Math.max(0, X - P), oy = Math.max(0, Y - P); let bc = -2, bx = X, by = Y;
      if (area) for (let y = 0; y + F.th <= area.h; y++) for (let x = 0; x + F.tw <= area.w; x++) {
        let s1 = 0, s2 = 0, d = 0;
        for (let j = 0; j < F.th; j++) for (let i = 0; i < F.tw; i++) { const v = area.grey[(y + j) * area.w + x + i]; s1 += v; s2 += v * v; d += F.T[j * F.tw + i] * v; }
        const c = d / Math.sqrt(Math.max(1e-6, (s2 - s1 * s1 / F.n) * F.tn)); if (c > bc) { bc = c; bx = ox + x; by = oy + y; }
      }
      X = bx; Y = by;
    }
    const x0 = X + A.aw * r, x1 = Math.min(W, X + A.bw * r * 1.3), y0 = Y, y1 = Math.min(H, Y + A.bh * r);
    if (x1 - x0 < 8 || y1 - y0 < 5) return { score: s.c, words: [] };
    return { score: s.c, at: [X, Y], words: merReadAll(merGrab({ x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H }, src)) };
  });
}
export function merTeach(img, text) { // what you typed, character by character, onto the line with the most characters
  const chars = [...text.replace(/\s/g, "")], lines = merGlyphs(img);
  const line = lines.sort((a, b) => b.length - a.length)[0] || [];
  if (line.length !== chars.length) return `No line in the box has ${plural(chars.length, "character")} after a coin (the longest has ${line.length}). Check the price you typed, or draw the box round the card again.`;
  line.forEach((g, i) => {
    const same = merOcr.glyphs.filter(t => t.ch === chars[i]);
    if (same.length >= 6) merOcr.glyphs.splice(merOcr.glyphs.indexOf(same[0]), 1); // up to 6 looks per character (a struck-out full price looks different)
    merOcr.glyphs.push({ ch: chars[i], v: Array.from(g.v, x => +x.toFixed(2)), ar: +g.ar.toFixed(3), rh: +g.rh.toFixed(3), top: +g.top.toFixed(3) });
  });
  ls.set(K.merOcr, merOcr);
  return null;
}
export function merOcrStart() {
  clearInterval(merOcrRun.timer);
  merOcrRun.timer = setInterval(() => {
    if (!merOcr.box || !merOcr.glyphs.length || !merLive.video || !merLive.video.videoWidth) return;
    // only a price some cargo here costs counts: anything else (your money, the cart's total, a sale price) is ignored
    const cargos = merCargos(); let r = null, hit = null;
    for (const h of merFind(merLive.video)) { const w = h.words.find(w => cargos.some(c => c.price === w.num)); if (w) { r = w; hit = h; break; } }
    merOcrRun.read = r;
    if (!r) return;
    // a price several cargo types share: the name on the card tells which
    const names = [...new Set(cargos.filter(c => c.price === r.num).map(c => c.name))];
    const type = names.length > 1 ? merNameOf(merLive.video, hit.at, names) : null;
    if (r.num !== merOcrRun.price || type !== merOcrRun.type) {
      merOcrRun.price = r.num; merOcrRun.type = type; merUI.cprice = r.num;
      if (type) merUI.ctype = type;
      else if (merUI.ctype && !cargos.some(c => c.price === r.num && c.name === merUI.ctype)) merUI.ctype = null;
      saveMerUI(); merDraw();
    }
  }, 400);
}
export function merOcrStop() { clearInterval(merOcrRun.timer); merOcrRun.read = null; }

/* drawing: filters on the left; the 38 sounds as cards (with the items that make each one), then the candidates */
export let merTeachOn = false;
// listening and the price reader, on top of the left column (the status shows only while listening)
export function merTools() {
  const box = el("div", "mc-tools");
  const micTip = "Listen through this device's microphone, with the game's sound on speakers: put it near them. Less sure than the game's own sound; Teach a sound helps it learn your room";
  if (merLive.on) box.append(button("Stop listening", { cls: "mc-live", tip: merLive.mic ? "Stop the microphone" : "Stop sharing the game window", onClick: () => merListen() }));
  else if (merCan.share) {
    box.append(button("Listen to game", { cls: "primary", tip: "Share the game window with its sound: the page tells which item a cargo holds by the sound it makes", onClick: () => merListen() }));
    if (merCan.mic) box.append(button("Listen with mic", { cls: "linkbtn mc-mic", tip: micTip, onClick: () => merListen(true) }));
  } else {
    // this browser can't share the game's sound: say so where the button would be, and offer the mic
    const why = el("p", "mc-cant", merCan.phone ? "On a phone the page listens through the mic" : "Listening to the game needs Chrome or Edge on a computer");
    why.dataset.tip = "Sharing a window with its sound only exists in Chrome and Edge on a computer. Without it, the mic hears the game from the speakers, or click the sound you heard";
    box.append(why);
    if (merCan.mic) box.append(button("Listen with mic", { cls: "primary", tip: micTip, onClick: () => merListen(true) }));
  }
  if (merCan.share && !merLive.mic) box.append(button("Price reader", { icon: "chart", tip: "Reads the cargo's price off the game and sets Cargo price for you", onClick: openMerOcr }));
  if (merLive.on) {
    const st = el("div", "mc-status"), lv = el("i", "mc-level"); lv.style.setProperty("--p", Math.max(0, Math.min(100, (merLive.level + 80) * 1.4)) + "%");
    st.append(lv, el("span", null, merRefs.state === "loading" ? "Getting the game's sounds…" : merRefs.state === "failed" ? "No reference sounds: teach some" : merLive.mic ? "Listening · mic" : "Listening"));
    box.append(st);
  }
  return box;
}
export function renderMerchant() { merDraw(); }
// the page fits the window: filters, sounds and candidates take the height left, and each scrolls inside (wide windows only)
export function merFit() { if (area === "merchant" && $("merchant")) fitToScreen($("merchant").querySelector(".mc-grid")); }
addEventListener("resize", () => { if (area === "merchant") merFit(); });
export const merSizeGlyph = s => { const [w, h] = s.split("x").map(Number), g = el("i", "mc-glyph"); g.style.setProperty("--w", w); g.style.setProperty("--h", h); for (let i = 0; i < w * h; i++) g.append(el("b")); return g; };
// plays a reference sound; the button lights up while it plays (the sounds come from the internet: say so if one can't load)
export let merAudio = null;
export const merPlay = (id, act, btn) => {
  if (merAudio) { merAudio.pause(); if (merAudio.btn) merAudio.btn.classList.remove("playing"); }
  const a = new Audio(merSoundUrl(id, act)); a.btn = btn; merAudio = a;
  // the sounds last a third of a second: stay lit a little longer so it's seen
  const t0 = Date.now(), done = () => { if (btn) setTimeout(() => { if (merAudio === a || !btn.isConnected || merAudio.btn !== btn) btn.classList.remove("playing"); }, Math.max(0, 900 - (Date.now() - t0))); };
  if (btn) btn.classList.add("playing");
  a.addEventListener("ended", done); a.addEventListener("pause", done);
  a.play().catch(() => { done(); toast([el("b", null, "Couldn't play the sound"), el("span", null, " · it needs internet")]); });
};
export let merShow = 90; // candidates shown; "Show more" adds to it, a filter change starts again
// one item in full: what it is, its sound, and every cargo it comes in here with the chance and what you'd make
export function openMerItem(id) {
  const it = MER.items[id]; if (!it) return;
  const [name, rar, price, , w, h, sid, cat] = it, dlg = $("meritem");
  if (!dlg.wired) { dlg.wired = true; wireDialog(dlg, () => closeDialog(dlg), "meritem-x"); }
  const top = $("meritem-top"); top.textContent = "";
  const pic = merPic(it); pic.classList.add("mc-pic-big");
  const titles = el("div", "gm-titles"), h2 = el("h2", null, name); h2.id = "meritem-h";
  const sub = el("p", "mi-sub"), size = el("span", "mi-size"); size.append(merSizeGlyph(`${w}x${h}`), `${w}×${h}`);
  size.dataset.tip = "The room it takes in the cargo";
  sub.append(`${MER_RARITY[rar] || ""} · ${cat}`, size);
  titles.append(h2, sub);
  top.append(pic, titles);
  const body = $("meritem-body"); body.textContent = "";
  // what it sells for, and its sound
  const head = el("div", "mi-head");
  const sell = el("div", "mc-fig"); sell.append(el("small", null, "Sells for"), el("b", null, fmtKoen(price)));
  const snd = el("div", "mi-snd");
  snd.append(button("Pick up", { cls: "mc-play", icon: "pickup", tip: "Hear the pick-up sound", onClick: e => merPlay(sid, "u", e.currentTarget) }),
    button("Drop", { cls: "mc-play", icon: "drop", tip: "Hear the drop sound", onClick: e => merPlay(sid, "d", e.currentTarget) }));
  head.append(sell, snd);
  body.append(gmSection("Item", head));
  // every cargo here that can hold it: its cost, the chance it's this item, and the gain if it is
  const cs = merCargos().filter(c => c.odds.has(id)).sort((a, b) => b.odds.get(id) - a.odds.get(id) || a.price - b.price);
  const t = el("table", "mi-table"), hr = el("tr");
  [["Cargo"], ["Cost"], ["Chance", "Chance a cargo of this type holds this item"], ["Gain", "What it sells for against the cargo's cost"]].forEach(([x, tip]) => { const th = el("th", null, x); if (tip) th.dataset.tip = tip; hr.append(th); });
  t.append(hr);
  cs.forEach(c => {
    const p = c.odds.get(id), g = price - c.price, tr = el("tr");
    if (merUI.ctype === c.name && merUI.cprice === c.price) tr.classList.add("on");
    tr.append(el("td", null, c.name), el("td", null, fmtKoen(c.price)), el("td", null, (p < .001 ? "<0.1" : (p * 100).toFixed(p < .1 ? 1 : 0)) + "%"), el("td", g >= 0 ? "up" : "down", (g >= 0 ? "+" : "−") + fmtKoen(Math.abs(g))));
    t.append(tr);
  });
  body.append(gmSection(`Comes in · ${merUI.map} · ${merModeName(merUI.mode)}`, cs.length ? t : el("p", "gm-note", "No cargo here holds it.")));
  present(dlg, name, () => openMerItem(id));
}
export function merDraw() {
  const sec = $("merchant"); if (!sec || area !== "merchant") return;
  const keepTop = pageEl.scrollTop, keepSounds = sec.querySelector(".mc-sgrid")?.scrollTop || 0;
  sec.textContent = "";
  if (!MER) { sec.append(el("p", "nores", "The merchant's file (merchant.js) is missing from the folder.")); return; }
  merProfile();
  merBar();
  if (merUI.tab === "practice") { prDraw(sec); return; }
  let v = merView();
  // what the filters took away stops being picked: a cargo type with nothing left in it (or not at this price), a sound no item left makes
  if (merUI.ctype && (!v.picked.length || !v.items.length)) { merUI.ctype = null; saveMerUI(); v = merView(); }
  if (!merTeachOn && merSel().some(id => !v.items.some(x => x.it[6] === id))) { const keep = merSel().filter(id => v.items.some(x => x.it[6] === id)); merUI.sound = keep[0] || null; merUI.also = keep.slice(1); saveMerUI(); }
  const grid = el("div", "mc-grid");
  const redraw = () => { merShow = 90; saveMerUI(); merDraw(); };
  const first = motion.opened("merchant"); // just opened: the panels come in; after that only what changed moves

  /* filters */
  const side = el("aside", "mc-panel mc-side");
  side.append(merTools());
  const fh = el("h3", "mc-h", "Filters");
  fh.append(button(null, { cls: "linkbtn", icon: "undo", tip: "Clear the filters (keeps the map)", onClick: () => { Object.assign(merUI, { q: "", sizes: [], rot: true, ctype: null, cprice: null, sound: null, also: [] }); redraw(); } }));
  side.append(fh);
  const group = (label, tip, ...nodes) => { const g = el("div", "mc-f"), s = el("small", null, label); if (tip) s.dataset.tip = tip; g.append(s, ...nodes); side.append(g); return g; };
  const q = el("input"); q.type = "search"; q.placeholder = "Search items…"; q.value = merUI.q || ""; q.setAttribute("aria-label", "Search items");
  q.addEventListener("input", () => { merUI.q = q.value; saveMerUI(); clearTimeout(q.t); q.t = setTimeout(() => { merDraw(); const n = $("merchant").querySelector(".mc-side input[type=search]"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); });
  group("Search", null, q);
  // map, then the modes that map has (a mode it shares with the old map stays picked)
  const places = merPlaces(), modesOf = m => (places.get(m) || []).map(([mode]) => mode);
  const md = ddSelect("Map", [...places.keys()].map(m => [m, m]), () => merUI.map, m => {
    const mode = modesOf(m).includes(merUI.mode) ? merUI.mode : modesOf(m)[0];
    Object.assign(merUI, { map: m, mode, ctype: null, cprice: null }); redraw();
  });
  const mm = ddSelect("Mode", modesOf(merUI.map).map(mode => [mode, merModeName(mode)]), () => merUI.mode, mode => { Object.assign(merUI, { mode, ctype: null, cprice: null }); redraw(); });
  group("Map", null, md).classList.add("mc-half"); // side by side on a phone
  group("Mode", null, mm).classList.add("mc-half");
  const sizes = el("div", "mc-sizes");
  MER_SIZES.forEach(s => {
    const on = (merUI.sizes || []).includes(s), b = el("button", null); b.type = "button"; b.setAttribute("aria-pressed", String(on));
    b.append(merSizeGlyph(s), el("small", null, s.replace("x", "×")));
    b.addEventListener("click", () => { merUI.sizes = on ? merUI.sizes.filter(x => x !== s) : [...(merUI.sizes || []), s]; redraw(); });
    sizes.append(b);
  });
  // rotation sits on the title's line, on the right: a small switch, on by default
  const rot = button("Rotate", { cls: "mc-rot", icon: "rotate", tip: "Count a size turned on its side too (2×1 also finds 1×2)", onClick: () => { merUI.rot = merUI.rot === false; redraw(); } });
  rot.setAttribute("aria-pressed", String(merUI.rot !== false));
  const sizeGroup = group("Item size", "The room the hidden item takes in the cargo. Pick one or more", sizes);
  const sizeHead = el("div", "mc-fh"); sizeHead.append(sizeGroup.firstChild, rot); sizeGroup.prepend(sizeHead);
  const types = [...new Set(v.cargos.filter(c => !merUI.cprice || c.price === merUI.cprice).map(c => c.name))].sort();
  group("Cargo type", null, ddSelect("Type", [["", "All cargo types"], ...types.map(t => [t, t])], () => merUI.ctype || "", val => { merUI.ctype = val || null; redraw(); })).classList.add("mc-half");
  const prices = [...new Set(v.cargos.filter(c => !merUI.ctype || c.name === merUI.ctype).map(c => c.price))].sort((a, b) => a - b);
  group("Cargo price", merOcrRun.price ? "Set by the price reader" : null, ddSelect("Price", [["", "All cargo prices"], ...prices.map(p => [String(p), fmtKoen(p)])], () => merUI.cprice ? String(merUI.cprice) : "", val => { merUI.cprice = val ? +val : null; redraw(); })).classList.add("mc-half");
  // recognising sounds: how alike they must be, and teaching your own
  const lis = el("div", "mc-f mc-lis");
  const need = el("label", "mc-need"); need.dataset.tip = "How alike a sound must be to count. Lower it if sounds are missed, raise it if wrong ones show";
  // the mic keeps its own level (sound through the air matches less), so the slider moves the one in use
  const micLevel = merLive.mic || (!merLive.on && !merCan.share);
  const rg = el("input"); rg.type = "range"; rg.min = 35; rg.max = 95; rg.step = 1; rg.value = Math.round(merNeed() * 100);
  const rv = el("span", null, rg.value + "%"); rg.addEventListener("input", () => { merUI[micLevel ? "needMic" : "need"] = rg.value / 100; rv.textContent = rg.value + "%"; }); rg.addEventListener("change", saveMerUI);
  need.append(rg, rv);
  const teach = button(merTeachOn ? "Done teaching" : "Teach a sound", { cls: "linkbtn", tip: "Save the last sound the page heard as one of the 38, so it's recognized next time (yours count alongside the usual ones)", onClick: () => { merTeachOn = !merTeachOn; merDraw(); } });
  lis.append(el("small", null, "Match needed"), need, teach);
  if (merTeachOn) {
    const tb = el("div", "mc-teach");
    if (!merLive.clip) tb.append(el("span", null, "Pick up or drop the item in game first, then click the sound it was."));
    else {
      const act = el("div", "g-seg");
      [["u", "Picked up"], ["d", "Dropped"]].forEach(([k, l]) => { const b = el("button", null, l); b.type = "button"; b.setAttribute("aria-pressed", String(merUI.act === k)); b.addEventListener("click", () => { merUI.act = k; merDraw(); }); act.append(b); });
      tb.append(el("span", null, "The last sound heard was"), act, el("span", null, "Now click its card."));
    }
    const mine = ls.get(K.merMine) || [];
    if (mine.length) tb.append(button(`Forget my ${plural(mine.length, "recording")}`, { cls: "linkbtn", onClick: () => { ls.set(K.merMine, []); merRefs.list = merRefs.list.filter(r => !r.mine); merDraw(); } }));
    lis.append(tb);
  }
  side.append(lis);

  /* the 38 sounds, each with the items (left by the filters) that make it */
  const main = el("div", "mc-main");
  const snd = el("section", "mc-panel");
  const sh = el("h3", "mc-h", "Sounds"); if (merTeachOn) sh.append(el("small", null, "Click the sound you just heard"));
  snd.append(sh);
  const sg = el("div", "mc-sgrid");
  const bySound = new Map(); v.items.forEach(x => { const s = x.it[6]; if (!bySound.has(s)) bySound.set(s, []); bySound.get(s).push(x); });
  MER.sounds.forEach(([id]) => {
    const list = (bySound.get(id) || []).sort((a, b) => b.it[1] - a.it[1] || b.it[2] - a.it[2]);
    if (!list.length && !merTeachOn) return; // nothing left by the filters makes this sound: not shown (all 38 show while teaching)
    const card = el("div", "mc-scard" + (merSel().includes(id) ? " on" : "") + (list.length ? "" : " none")); card.tabIndex = 0; card.setAttribute("role", "button");
    card.dataset.sid = id;
    // right click only listens: pick-up, then drop, then pick-up again… (a left click picks the sound, silently)
    card.dataset.tip = "Right click to hear it";
    card.addEventListener("contextmenu", e => {
      e.preventDefault();
      const act = card.dataset.next || "u"; card.dataset.next = act === "u" ? "d" : "u";
      merPlay(id, act, card);
    });
    card.append(el("b", "mc-stitle", "ID " + id)); // the same numbers ABI Builder uses: a fixed guide to find a sound again
    const pics = el("div", "mc-spics");
    list.slice(0, 5).forEach(x => { const p = merPic(x.it); p.dataset.tip = x.it[0] + "\nRight click to hear it"; pics.append(p); });
    if (list.length > 5) pics.append(el("span", "mc-more", "+" + (list.length - 5)));
    card.append(pics);
    const pick = () => {
      if (merTeachOn && merLive.clip) {
        const T = merTrim(merLive.clip), mine = ls.get(K.merMine) || [];
        mine.push({ id, act: merUI.act, T }); ls.set(K.merMine, mine.slice(-200));
        merRefs.list.push({ id, act: merUI.act, T, mine: true });
        toast([el("b", null, "Saved"), el("span", null, " · recognized next time")]);
      }
      if (merTeachOn) { merHeard(id, merUI.act, 0, []); return; }
      // not sure which it was? click another to add it: the chances then count all the sounds picked; click a picked one to drop it
      const sel = merSel(), next = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
      merUI.sound = next[0] || null; merUI.also = next.slice(1); saveMerUI(); merPopId = id; merDraw();
      // on a phone the candidates sit under the sounds: the first sound picked takes you down to them
      if (isPhone() && sel.length === 0 && next.length) { const cp = $("merchant").querySelector(".mc-candp"); if (cp) pageEl.scrollTop += cp.getBoundingClientRect().top - pageEl.getBoundingClientRect().top - 8; }
    };
    card.addEventListener("click", pick);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    sg.append(card);
  });
  if (!sg.children.length) sg.append(emptyNote("Nothing matches these filters."));
  snd.append(sg);

  /* candidates */
  const cands = merCandidates(v, merSel()), L = merLive.last && merLive.last.id === merUI.sound && !merUI.also.length ? merLive.last : null;
  const cp = el("section", "mc-panel mc-candp");
  const ch = el("h3", "mc-h", "Candidates"); ch.append(el("small", null, String(cands.length)));
  // what the game sounded like, when the page heard it (a sound clicked by hand needs no label: click its card again to drop it)
  if (merUI.sound && L) {
    const t = el("span", "mc-heard");
    t.append(el("b", null, { d: "Heard a drop", u: "Heard a pick-up", ud: "Heard a pick-up and drop" }[L.act] || "Heard"));
    if (L.score) { const a = el("span", "mc-dim", `${Math.round(L.score * 100)}% alike`); if (L.alt.length) a.dataset.tip = "Other sounds came close too"; t.append(a); }
    ch.append(t);
  }
  cp.append(ch);
  // the numbers for the cargo: what it costs, how likely it pays, what comes back on average. One strip per cargo type when
  // several share the price picked (the merchant shows the type, so each gets its own; a click picks that one)
  const strip = (c, many) => {
    const P = merProfit(c, v, merSel()); if (!P) return null;
    const sum = el(many ? "button" : "div", "mc-sum" + (many ? " mc-pick" : ""));
    const fig = (label, value, cls, tip) => { const d = el("div", "mc-fig"); d.append(el("small", null, label), el("b", cls || null, value)); if (tip) d.dataset.tip = tip; sum.append(d); return d; };
    const g = P.ev - c.price, withS = merSel().length ? ", with this sound" : "";
    // its numbers moved (another sound, another price): they tick in
    if (motion.changed("mer:sum:" + c.key, [Math.round(P.pc * 100), Math.round(P.ev)]) && !first) setTimeout(() => sum.querySelectorAll(".mc-fig b").forEach(b => motion.tick(b)));
    fig("Cargo", c.name, "mc-cname2");
    fig("Cost", fmtKoen(c.price));
    fig("Profit chance", Math.round(P.pc * 100) + "%", P.pc >= .5 ? "up" : "down", "How likely the item sells for more than the cargo cost" + withS);
    const avg = fig("Average back", fmtKoen(Math.round(P.ev)), null, "Each item's price times its chance" + withS);
    avg.append(el("span", "mc-gain " + (g >= 0 ? "up" : "down"), (g >= 0 ? "+" : "−") + fmtKoen(Math.abs(Math.round(g)))));
    if (!many) return sum;
    sum.type = "button"; sum.dataset.tip = "Pick " + c.name;
    sum.addEventListener("click", () => { merUI.ctype = c.name; saveMerUI(); merDraw(); });
    return sum;
  };
  const sums = el("div", "mc-sums");
  if (v.one) { const x = strip(v.one, false); if (x) sums.append(x); }
  else if (merUI.cprice && v.picked.length > 1) v.picked.forEach(c => { const x = strip(c, true); if (x) sums.append(x); });
  if (sums.children.length) cp.append(sums);
  const cg = el("div", "mc-cands");
  if (!cands.length) cg.append(el("p", "nores", merUI.sound ? "No item left by the filters makes that sound." : "Nothing matches these filters."));
  cands.slice(0, merShow).forEach(x => {
    const [name, rar, price, , w, h, , cat] = x.it, c = el("div", "mc-cand r" + rar);
    c.tabIndex = 0; c.setAttribute("role", "button"); c.dataset.tip = "Every cargo it comes in";
    c.addEventListener("click", () => openMerItem(x.id));
    c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMerItem(x.id); } });
    const top = el("div", "mc-ctop");
    top.append(el("span", "mc-rar", MER_RARITY[rar] || ""), el("span", "mc-size", `${w}×${h}`));
    if (x.p != null) { const pc = el("b", "mc-chance", Math.max(.1, x.p * 100).toFixed(x.p < .1 ? 1 : 0) + "%"); pc.dataset.tip = "Chance it's this one, in this cargo" + (merUI.sound ? " with this sound" : ""); top.append(pc); }
    const body = el("div", "mc-cbody"), nm = el("div", "mc-cname");
    nm.append(el("b", null, name), el("small", null, cat));
    body.append(merPic(x.it), nm);
    const pr = el("div", "mc-cprice"); pr.append(el("small", null, "Sells for"), el("b", v.one ? (price > v.one.price ? "up" : "down") : null, fmtKoen(price)));
    const src = el("div", "mc-src");
    const cs = [...new Map(x.where.map(c2 => [c2.key, c2])).values()].sort((a, b) => a.price - b.price);
    cs.slice(0, 3).forEach(c2 => { const r = el("span"); r.append(el("span", null, c2.name), el("b", null, fmtKoen(c2.price))); src.append(r); });
    if (cs.length > 3) src.append(el("small", null, `+${cs.length - 3} more`));
    if (v.one) { const d = price - v.one.price; pr.append(el("span", "mc-gain " + (d >= 0 ? "up" : "down"), (d >= 0 ? "+" : "−") + fmtKoen(Math.abs(d)))); c.append(top, body, pr); } // the cargo is known: no need to list it again
    else c.append(top, body, pr, src);
    cg.append(c);
  });
  if (cands.length > merShow) {
    const more = button(`Show more (${cands.length - merShow})`, { cls: "mc-more-btn", onClick: () => { const sc = cg.scrollTop; merMoreFrom = merShow; merShow += 90; merDraw(); const n = $("merchant").querySelector(".mc-cands"); if (n) n.scrollTop = sc; } });
    cg.append(more);
  }
  cp.append(cg);

  main.append(snd, cp);
  grid.append(side, main);
  sec.append(grid);
  merFit();
  const ns = sec.querySelector(".mc-sgrid"); if (ns) ns.scrollTop = keepSounds;
  pageEl.scrollTop = keepTop;

  // motion: opening the Merchant brings the panels in; then the sounds when the filters change which show, the sound you
  // clicked, the candidates when the list changes (and the ones Show more adds), the count when it moves
  const cards = [...sg.querySelectorAll(".mc-scard")], candEls = [...cg.querySelectorAll(".mc-cand")];
  const soundsMoved = motion.changed("mer:sounds", cards.map(c => c.dataset.sid));
  const candsMoved = motion.changed("mer:cands", [cands.length, cands.slice(0, 40).map(x => x.id)]);
  if (first) motion.stagger([side, snd, cp]);
  else {
    if (soundsMoved) motion.stagger(cards);
    if (merMoreFrom != null) motion.stagger(candEls, merMoreFrom);
    else if (candsMoved) { motion.stagger(candEls.slice(0, 20)); motion.tick(ch.querySelector("small")); }
  }
  if (merPopId != null) motion.pop(cards.find(c => c.dataset.sid === String(merPopId)));
  merPopId = null; merMoreFrom = null;
}
// the Merchant's own bar: Live (listen and pick a sound) or Practice (train your ear on the same cards)
export function merBar() {
  const bar = $("sub-merchant"); if (!bar) return;
  bar.textContent = "";
  const nav = el("nav", "g-jump"); nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "Merchant");
  [["live", "Live", "Listen to the game and find the item"], ["practice", "Practice", "Train your ear on the 38 sounds"]].forEach(([k, label, tip]) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.tip = tip;
    b.setAttribute("aria-selected", String((merUI.tab || "live") === k));
    b.addEventListener("click", () => { if ((merUI.tab || "live") === k) return; merUI.tab = k; saveMerUI(); prStop(); motion.changed("visit:merchant", -1); merDraw(); });
    nav.append(b);
  });
  bar.append(nav);
}

/* ---------- Merchant practice: a stall like the merchant's in game. Boxes of this map/mode's cargo types, each the size of what
   it holds: click one to hear it picked up and dropped, then answer with its card (Live's cards, in Live's place) or pick the
   item; the box then shows what it held. A free stall of 24 boxes or a timed one of 20; what's inside follows the cargo odds
   or gives every sound the same chance; the sounds you miss can come back more. Kept in this browser (K.merPractice). ---------- */
export const PR_ROUND = 20, PR_FREE = 24;
// the stall's width in cells: 9 like the game, 6 on a phone (9 would make the boxes too small to read or tap)
export const prCols = () => isPhone() ? 6 : 9;
export const prs = Object.assign({ level: "card", mode: "free", src: "cargo", weak: true, stats: {}, best: {} }, ls.get(K.merPractice) || {});
export const savePr = () => ls.set(K.merPractice, prs);
// the stall being played (not kept): boxes [{ x, y, w, h, id, cargo, ans }], cur = the box open, q = its question
export const pr = { boxes: [], cur: null, q: null, n: 0, right: 0, streak: 0, top: 0, t0: 0, t1: 0, timer: 0, done: false, on: false };
export function prStop() { clearInterval(pr.timer); clearTimeout(prPlayT); Object.assign(pr, { boxes: [], cur: null, q: null, n: 0, right: 0, streak: 0, top: 0, t0: 0, t1: 0, done: false, on: false }); }
// how often you miss a sound (a sound never heard counts as a little shaky)
export const prMiss = sid => { const [seen, ok] = prs.stats[sid] || [0, 0]; return (seen - ok + 1) / (seen + 2); };
export const prWeak = id => prs.weak ? 1 + 4 * prMiss(MER.items[id][6]) : 1;
export function prPick(weights) {
  const list = [...weights], tot = list.reduce((s, [, w]) => s + w, 0); let r = Math.random() * tot;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list.length ? list[list.length - 1][0] : null;
}
// an item of this size, turned either way (as Live's size filter with Rotate on)
export const prFits = (it, [w, h]) => (it[4] === w && it[5] === h) || (it[4] === h && it[5] === w);
// what this map/mode's cargos can hold: item id -> the cargo types it comes in
export function prPool() {
  const out = new Map();
  merCargos().forEach(c => c.odds.forEach((p, id) => { if (!out.has(id)) out.set(id, new Set()); out.get(id).add(c.name); }));
  return out;
}
// a new stall: n boxes. A box is a cargo (one of each type in turn, as the merchant lays them out), its item drawn by the
// cargo's odds, or with every sound alike; then the boxes are packed into 9 columns, biggest first
export function prFill(n) {
  const cs = merCargos(), pool = prPool(); if (!cs.length) return [];
  const bySound = new Map(); pool.forEach((t, id) => { const s = MER.items[id][6]; bySound.set(s, (bySound.get(s) || 0) + 1); });
  const items = [];
  for (let k = 0; k < n; k++) {
    // a box is one real cargo (type and price, as the game's hover card shows them)
    let id, c;
    if (prs.src === "cargo") {
      c = cs[Math.floor(Math.random() * cs.length)]; const w = new Map();
      c.odds.forEach((p, i) => w.set(i, p * prWeak(i))); id = prPick(w);
    } else {
      const w = new Map(); pool.forEach((t, i) => w.set(i, prWeak(i) / bySound.get(MER.items[i][6])));
      id = prPick(w); const holds = cs.filter(x => x.odds.has(id)); c = holds[Math.floor(Math.random() * holds.length)];
    }
    const it = MER.items[id]; let w = it[4], h = it[5];
    if (w !== h && Math.random() < .5) [w, h] = [h, w];
    if (w > prCols()) [w, h] = [h, w];
    items.push({ id, cargo: c.name, price: c.price, w, h, ans: null });
  }
  items.sort((a, b) => b.w * b.h - a.w * a.h || Math.random() - .5);
  const taken = [], free = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (taken[j] && taken[j][i]) return false; return true; };
  items.forEach(b => {
    for (let y = 0; ; y++) {
      let x = 0; while (x + b.w <= prCols() && !free(x, y, b.w, b.h)) x++;
      if (x + b.w <= prCols()) { b.x = x; b.y = y; for (let j = y; j < y + b.h; j++) { taken[j] = taken[j] || []; for (let i = x; i < x + b.w; i++) taken[j][i] = true; } return; }
    }
  });
  return items.sort((a, b) => a.y - b.y || a.x - b.x); // in reading order, for Enter (the next box)
}
// as in the game: the pick-up, then the drop
export let prPlayT = 0;
export function prSound(sid, btn) {
  clearTimeout(prPlayT);
  merPlay(sid, "u", btn);
  prPlayT = setTimeout(() => merPlay(sid, "d", btn && btn.isConnected ? btn : null), 750);
}
// both, each lighting its own button
export const prHear = () => {
  if (!pr.q) return;
  const [u, d] = document.querySelectorAll("#merchant .pr-replay"), sid = pr.q.sid;
  clearTimeout(prPlayT); merPlay(sid, "u", u);
  prPlayT = setTimeout(() => merPlay(sid, "d", d && d.isConnected ? d : null), 750);
};
// what a box's cargo can hold (as Live with that cargo type and price picked)
export const prBoxItems = b => { const c = merCargos().find(x => x.name === b.cargo && x.price === b.price); return c ? [...c.odds.keys()] : [...prPool().keys()]; };
// open a box: its question (the item level: the item and three others with other sounds, the same size first, since the
// box already shows the size), then its sound
export function prOpen(i) {
  const b = pr.boxes[i]; if (!b || b.ans || pr.done) return;
  const it = MER.items[b.id], sid = it[6], size = [it[4], it[5]];
  let opts = null;
  if (prs.level === "item") {
    const others = [...new Set([...prBoxItems(b), ...prPool().keys()])].filter(x => MER.items[x][6] !== sid).sort(() => Math.random() - .5), used = new Set([sid]);
    const same = x => prFits(MER.items[x], size);
    opts = [b.id];
    for (const x of [...others.filter(same), ...others.filter(x => !same(x))]) { if (opts.length === 4) break; if (!used.has(MER.items[x][6])) { used.add(MER.items[x][6]); opts.push(x); } }
    opts.sort(() => Math.random() - .5);
  }
  pr.cur = i; pr.q = { id: b.id, sid, size, opts };
  if (!pr.t0) pr.t0 = Date.now();
  prDraw(); setTimeout(prHear, 120);
  // on a phone the answers sit under the stall: go to them
  if (isPhone()) { const a = $("merchant").querySelector(".pr-ans"); if (a) pageEl.scrollTop += a.getBoundingClientRect().top - pageEl.getBoundingClientRect().top - 8; }
}
export function prAnswer(x) { // x: a sound id (card level) or an item id (item level)
  const b = pr.boxes[pr.cur]; if (!pr.q || !b || b.ans) return;
  const ok = prs.level === "item" ? MER.items[x][6] === pr.q.sid : x === pr.q.sid;
  b.ans = { x, ok };
  const s = prs.stats[pr.q.sid] || (prs.stats[pr.q.sid] = [0, 0]); s[0]++; if (ok) s[1]++;
  pr.n++; if (ok) { pr.right++; pr.streak++; pr.top = Math.max(pr.top, pr.streak); } else pr.streak = 0;
  if (pr.boxes.every(x => x.ans)) {
    pr.done = true; pr.t1 = Date.now(); clearInterval(pr.timer); pr.newBest = false;
    if (prs.mode === "timed") {
      const key = prs.level, best = prs.best[key], t = pr.t1 - pr.t0;
      if (!best || pr.right > best.right || (pr.right === best.right && t < best.ms)) { prs.best[key] = { right: pr.right, ms: t, at: today() }; pr.newBest = true; }
    }
  }
  savePr(); prDraw();
}
export const prNextBox = () => { const i = pr.boxes.findIndex(b => !b.ans); if (i >= 0) prOpen(i); };
export function prStart() {
  prStop(); pr.on = true;
  pr.boxes = prFill(prs.mode === "timed" ? PR_ROUND : PR_FREE);
  if (prs.mode === "timed") pr.timer = setInterval(() => { const t = document.querySelector("#merchant .pr-clock"); if (t && pr.t0 && !pr.done) t.textContent = prTime(Date.now() - pr.t0); }, 250);
  prDraw();
}
export const prTime = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// keys: Space hears the box again, Enter opens the next box, 1–4 answer the item level
document.addEventListener("keydown", e => {
  if (area !== "merchant" || merUI.tab !== "practice" || !pr.on || e.target.closest("input, textarea, select, dialog") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " ") { e.preventDefault(); prHear(); }
  else if (e.key === "Enter" && (!pr.q || pr.boxes[pr.cur].ans)) { e.preventDefault(); prNextBox(); }
  else if (prs.level === "item" && pr.q && pr.q.opts && !pr.boxes[pr.cur].ans && /^[1-4]$/.test(e.key)) { const x = pr.q.opts[+e.key - 1]; if (x != null) prAnswer(x); }
});

export function prDraw(sec = $("merchant")) {
  if (!sec || area !== "merchant" || merUI.tab !== "practice") return;
  const keepCards = sec.querySelector(".pr-cards")?.scrollTop || 0, keepStall = sec.querySelector(".pr-stallwrap")?.scrollTop || 0;
  sec.textContent = "";
  const first = motion.opened("merchant");
  const grid = el("div", "mc-grid pr-grid"); // pr-grid: on a phone the stall comes first and the settings last (CSS)

  /* the settings, on the left like Live's filters */
  const side = el("aside", "mc-panel mc-side");
  const group = (label, tip, ...nodes) => { const g = el("div", "mc-f"), s = el("small", null, label); if (tip) s.dataset.tip = tip; g.append(s, ...nodes); side.append(g); return g; };
  const seg = (key, opts) => {
    const g = el("div", "g-seg");
    opts.forEach(([v, t, tip]) => { const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(prs[key] === v)); if (tip) b.dataset.tip = tip;
      b.addEventListener("click", () => { if (prs[key] === v) return; prs[key] = v; savePr(); prStop(); prDraw(); }); g.append(b); });
    return g;
  };
  side.append(el("h3", "mc-h", "Practice"));
  const places = merPlaces(), modesOf = m => (places.get(m) || []).map(([mode]) => mode);
  group("Map", null, ddSelect("Map", [...places.keys()].map(m => [m, m]), () => merUI.map, m => { const mode = modesOf(m).includes(merUI.mode) ? merUI.mode : modesOf(m)[0]; Object.assign(merUI, { map: m, mode, ctype: null, cprice: null }); saveMerUI(); prStop(); prDraw(); }));
  group("Mode", null, ddSelect("Mode", modesOf(merUI.map).map(mode => [mode, merModeName(mode)]), () => merUI.mode, mode => { Object.assign(merUI, { mode, ctype: null, cprice: null }); saveMerUI(); prStop(); prDraw(); }));
  group("Answer with", null, seg("level", [["card", "Sound card", "Click the card that makes it: the same click as in Live"], ["item", "Item", "Pick the item out of four, each with another sound"]]));
  group("Stall", null, seg("mode", [["free", `${PR_FREE} boxes`, "At your pace"], ["timed", `${PR_ROUND}, timed`, "Against the clock: your best stall is kept"]]));
  group("What's inside", null, seg("src", [["cargo", "Cargo odds", "Each box holds what its cargo type really holds, as often"], ["even", "All alike", "Every sound as often, whatever the cargo"]]));
  const weak = button("Weak sounds first", { cls: "mc-rot", icon: "chart", tip: "The sounds you miss come back more often", onClick: () => { prs.weak = !prs.weak; savePr(); prDraw(); } });
  weak.setAttribute("aria-pressed", String(!!prs.weak));
  side.append(weak);
  // your record: the shakiest sounds (click one to hear it), and the best stalls
  const rec = el("div", "mc-f mc-lis"), all = Object.entries(prs.stats), seen = all.filter(([, [n]]) => n >= 2);
  const tot = all.reduce((a, [, [n, ok]]) => [a[0] + n, a[1] + ok], [0, 0]);
  rec.append(el("small", null, "Your ear"));
  if (tot[0] < 5) rec.append(el("p", "gm-note", "Open a few boxes to see which sounds trip you up."));
  else {
    rec.append(el("p", "pr-acc", `${Math.round(tot[1] / tot[0] * 100)}% right over ${plural(tot[0], "sound")}`));
    const worst = seen.map(([sid, [n, ok]]) => [+sid, ok / n, n]).filter(x => x[1] < 1).sort((a, b) => a[1] - b[1] || b[2] - a[2]).slice(0, 5);
    if (worst.length) {
      const ul = el("div", "pr-weak");
      worst.forEach(([sid, r]) => { const row = el("button", "pr-wrow"); row.type = "button"; row.dataset.tip = merSoundName(sid) + "\nClick to hear it"; row.append(el("b", null, "ID " + sid), el("span", null, Math.round(r * 100) + "%"));
        row.addEventListener("click", () => prSound(sid, row)); ul.append(row); });
      rec.append(ul);
    }
  }
  const bests = ["card", "item"].filter(k => prs.best[k]);
  if (bests.length) {
    const bl = el("div", "pr-best");
    bests.forEach(k => { const b = prs.best[k], r = el("div"); r.append(el("span", null, k === "card" ? "Best, cards" : "Best, items"), el("b", null, `${b.right}/${PR_ROUND} · ${prTime(b.ms)}`)); bl.append(r); });
    rec.append(bl);
  }
  if (Object.keys(prs.stats).length || bests.length) rec.append(button("Start over", { cls: "linkbtn", tip: "Forget your hits and best stalls", onClick: async () => {
    if (!(await confirmBox({ title: "Forget your practice?", body: [el("p", null, "Your hits per sound and your best stalls go.")], ok: "Forget", danger: true }))) return;
    prs.stats = {}; prs.best = {}; savePr(); prDraw();
  } }));
  side.append(rec);

  if (!pr.on) {
    // before a stall: one box, the same as every other "waiting" box
    const stage = el("section", "mc-panel pr-stage idle");
    const zone = el("div", "sh-drop mc-wait"), ic = el("span", "sh-drop-ic"); ic.append(icon("bag"));
    const btns = el("div", "sh-drop-btns"); btns.append(button(prs.mode === "timed" ? "Start the clock" : "Open a stall", { cls: "primary", onClick: prStart }));
    zone.dataset.tip = "Space hears the box again · Enter opens the next one · 1–4 pick an item";
    zone.append(ic, el("b", null, prs.level === "card" ? "Open a box, click the card it sounds like" : "Open a box, pick what's inside"),
      el("small", null, `A stall of ${merUI.map}'s cargos, ${merModeName(merUI.mode)}. You see each box's size and type, then hear it picked up and dropped.`), btns);
    if (!merCargos().length) { zone.querySelector("button").disabled = true; zone.querySelector("small").textContent = "No cargo on this map and mode."; }
    stage.append(zone);
    grid.append(side, stage);
    sec.append(grid); merFit();
    if (first) motion.stagger([side, stage]);
    return;
  }

  /* the answer side (Live's sounds column): what's playing, the verdict, then the cards or the four items */
  const ans = el("section", "mc-panel pr-ans");
  const head = el("div", "pr-head");
  const b = pr.boxes[pr.cur], q = b ? pr.q : null, done = b && b.ans;
  if (q) {
    // each sound on its own, like an item's Pick up / Drop (Space plays both, one after the other)
    head.append(button("Pick up", { cls: "mc-play pr-replay", icon: "pickup", tip: "Hear the pick-up (Space: both)", onClick: e => { clearTimeout(prPlayT); merPlay(q.sid, "u", e.currentTarget); } }),
      button("Drop", { cls: "mc-play pr-replay", icon: "drop", tip: "Hear the drop (Space: both)", onClick: e => { clearTimeout(prPlayT); merPlay(q.sid, "d", e.currentTarget); } }));
    const size = el("span", "pr-size"); size.append(merSizeGlyph(`${q.size[0]}x${q.size[1]}`), `${q.size[0]}×${q.size[1]}`); size.dataset.tip = "The room it takes, as the box shows it";
    head.append(size);
  }
  const info = el("div", "pr-info");
  if (prs.mode === "timed") info.append(el("span", null, `${pr.n} / ${PR_ROUND}`), el("b", "pr-clock", prTime((pr.t1 || Date.now()) - (pr.t0 || Date.now()))));
  else info.append(el("span", null, `${pr.right} / ${pr.n} right`), el("span", null, pr.streak > 1 ? `${pr.streak} in a row` : ""));
  if (!pr.done) info.append(button("Stop", { cls: "linkbtn", tip: "Close this stall", onClick: () => { prStop(); prDraw(); } }));
  head.append(info);
  ans.append(head);
  const verdict = el("div", "pr-verdict" + (done ? (b.ans.ok ? " ok" : " bad") : ""));
  if (pr.done) {
    verdict.classList.add("end");
    verdict.append(el("b", null, `${pr.right} of ${pr.boxes.length} right` + (prs.mode === "timed" ? ` · ${prTime(pr.t1 - pr.t0)}` : "")),
      el("span", null, pr.newBest ? "Your best stall yet" : prs.mode === "timed" && prs.best[prs.level] ? `Best ${prs.best[prs.level].right}/${PR_ROUND} in ${prTime(prs.best[prs.level].ms)}` : `Longest streak: ${pr.top}`),
      button("New stall", { cls: "primary", onClick: prStart }));
  } else if (!q) verdict.append(el("span", null, "Click a box in the stall to hear what's inside"), button("First box", { tip: "Enter", onClick: prNextBox }));
  else if (!done) verdict.append(el("span", null, prs.level === "card" ? "Which card makes this sound?" : "Which item is in the box?"));
  else {
    verdict.append(el("b", null, b.ans.ok ? "Right" : "Not that one"), el("span", null, `ID ${q.sid} · ${MER.items[q.id][0]}`), button("Next box", { cls: "primary", tip: "Enter", onClick: prNextBox }));
  }
  ans.append(verdict);
  if (q && prs.level === "card") {
    // the cards Live shows with this box's cargo and size picked: same order, look and place. Right click to hear one
    const fit = prBoxItems(b).filter(id => prFits(MER.items[id], q.size));
    const bySound = new Map(); fit.forEach(id => { const s = MER.items[id][6]; if (!bySound.has(s)) bySound.set(s, []); bySound.get(s).push(MER.items[id]); });
    const sg = el("div", "mc-sgrid pr-cards");
    MER.sounds.forEach(([sid]) => {
      if (!bySound.has(sid)) return;
      const list = bySound.get(sid).sort((a, c) => c[1] - a[1] || c[2] - a[2]);
      const card = el("div", "mc-scard" + (!done ? "" : sid === q.sid ? " ok" : sid === b.ans.x ? " bad" : " past")); card.tabIndex = 0; card.setAttribute("role", "button");
      card.dataset.tip = "Right click to hear it";
      card.addEventListener("contextmenu", e => { e.preventDefault(); prSound(sid, card); });
      card.append(el("b", "mc-stitle", "ID " + sid));
      const pics = el("div", "mc-spics");
      list.slice(0, 5).forEach(it => { const p = merPic(it); p.dataset.tip = it[0]; pics.append(p); });
      if (list.length > 5) pics.append(el("span", "mc-more", "+" + (list.length - 5)));
      card.append(pics);
      const go = () => prAnswer(sid);
      card.addEventListener("click", go); card.addEventListener("keydown", e => { if (e.key === "Enter" && !done) { e.preventDefault(); e.stopPropagation(); go(); } });
      sg.append(card);
    });
    ans.append(sg);
    requestAnimationFrame(() => { sg.scrollTop = keepCards; });
  } else if (q) {
    const opts = el("div", "pr-opts");
    q.opts.forEach((id, i) => {
      const it = MER.items[id], o = el("button", "pr-opt" + (!done ? "" : it[6] === q.sid ? " ok" : id === b.ans.x ? " bad" : " past")); o.type = "button";
      const nm = el("div", "mc-cname"); nm.append(el("b", null, it[0]), el("small", null, prFits(it, q.size) ? it[7] : `${it[7]} · ${it[4]}×${it[5]}`)); // the size only when it isn't the box's
      o.append(el("kbd", null, String(i + 1)), merPic(it), nm);
      if (done) o.dataset.tip = "ID " + it[6] + " · click to hear it";
      o.addEventListener("click", () => { if (!done) prAnswer(id); else prSound(it[6], o); });
      opts.append(o);
    });
    ans.append(opts);
  }

  /* the stall (Live's candidates column): boxes by size and type; opened ones show what they held */
  const stallP = el("section", "mc-panel pr-stallp");
  const sh = el("h3", "mc-h", "Stall"); sh.append(el("small", null, `${merUI.map} · ${merModeName(merUI.mode)}`));
  stallP.append(sh);
  const wrap = el("div", "pr-stallwrap"), stall = el("div", "pr-stall");
  const cols = Math.max(prCols(), ...pr.boxes.map(b => b.x + b.w)); stall.style.setProperty("--cols", cols); // a stall laid out on a wider screen keeps its columns
  pr.boxes.forEach((bx, i) => {
    const d = el("button", "pr-box" + (i === pr.cur && !bx.ans ? " cur" : "") + (bx.ans ? (bx.ans.ok ? " ok" : " bad") : "")); d.type = "button";
    d.style.gridColumn = `${bx.x + 1} / span ${bx.w}`; d.style.gridRow = `${bx.y + 1} / span ${bx.h}`;
    d.append(el("span", "pr-blabel", bx.cargo));
    // hover: the cargo's type and price, like the game's card; once opened, what it held against what it cost
    if (bx.ans) { const it = MER.items[bx.id], p = merPic(it); d.append(p); d.dataset.tip = `${it[0]} · ID ${it[6]} · sells for ${fmtKoen(it[2])}\n${bx.cargo} · ${fmtKoen(bx.price)}\nClick to hear it`; d.addEventListener("click", () => prSound(it[6], d)); }
    else { d.dataset.tip = `${bx.cargo}\n${fmtKoen(bx.price)}`; d.addEventListener("click", () => prOpen(i)); }
    stall.append(d);
  });
  wrap.append(stall); stallP.append(wrap);

  const main = el("div", "mc-main"); main.append(ans, stallP);
  grid.append(side, main);
  sec.append(grid);
  merFit();
  // square cells: a row as tall as a column is wide
  requestAnimationFrame(() => { stall.style.gridAutoRows = Math.floor((stall.clientWidth - (cols - 1) * 3) / cols) + "px"; wrap.scrollTop = keepStall; });
  if (first) motion.stagger([side, ans, stallP]);
  else if (done) { motion.pop(verdict); motion.flash(stall.children[pr.cur]); }
}
export let merPopId = null, merMoreFrom = null; // the sound card just clicked; where the cards Show more added start
// the level line moves while listening, without drawing everything again
setInterval(() => { if (merLive.on && area === "merchant") { const lv = document.querySelector("#merchant .mc-level"); if (lv) lv.style.setProperty("--p", Math.max(0, Math.min(100, (merLive.level + 80) * 1.4)) + "%"); } }, 120);

/* the price reader's window: draw the box on a still of the game, then teach the digits */
export function openMerOcr() {
  const dlg = $("merocr");
  if (!dlg.wired) { dlg.wired = true; wireDialog(dlg, () => closeDialog(dlg), "merocr-x"); }
  // the footer only ever holds actions (the X closes, like every overlay)
  const body = $("merocr-body"), foot = $("merocr-foot"); body.textContent = ""; foot.textContent = "";
  if (!merLive.on || !merLive.video || !merLive.video.videoWidth) {
    // nothing to read yet: the same centred box as Import and Backup
    const zone = el("div", "sh-drop mc-wait"), ic = el("span", "sh-drop-ic"); ic.append(icon("screen"));
    zone.append(ic, el("b", null, merLive.on ? "No picture from the game yet" : "Share the game window first"),
      el("small", null, merLive.on ? "Share the game window itself, not only its sound." : "The reader reads the price from the window you share with Listen to game."));
    if (!merLive.on) { const btns = el("div", "sh-drop-btns"); btns.append(button("Listen to game", { cls: "primary", onClick: async () => { await merListen(); setTimeout(openMerOcr, 600); } })); zone.append(btns); }
    body.append(zone);
    present(dlg, "Price reader", openMerOcr);
    return;
  }
  // 1. a still of the game; drag a box round the price
  const v = merLive.video, still = el("canvas", "mc-still"); still.width = v.videoWidth; still.height = v.videoHeight;
  still.getContext("2d").drawImage(v, 0, 0);
  const wrap = el("div", "mc-stillwrap"), boxEl = el("i", "mc-box"), foundEl = el("i", "mc-box found"); wrap.append(still, boxEl, foundEl);
  const place = (e, b) => { e.hidden = !b; if (b) Object.assign(e.style, { left: b.x * 100 + "%", top: b.y * 100 + "%", width: b.w * 100 + "%", height: b.h * 100 + "%" }); };
  const showBox = b => place(boxEl, b);
  showBox(merOcr.builtin ? null : merOcr.box); foundEl.hidden = true; // the built-in box is on another picture: not drawn on yours
  let from = null, drawn = !merOcr.builtin;
  const at = e => { const r = still.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  still.addEventListener("pointerdown", e => { from = at(e); still.setPointerCapture(e.pointerId); });
  still.addEventListener("pointermove", e => { if (!from) return; const p = at(e); showBox({ x: Math.min(from[0], p[0]), y: Math.min(from[1], p[1]), w: Math.abs(p[0] - from[0]), h: Math.abs(p[1] - from[1]) }); });
  still.addEventListener("pointerup", e => {
    if (!from) return; const p = at(e), b = { x: Math.min(from[0], p[0]), y: Math.min(from[1], p[1]), w: Math.abs(p[0] - from[0]), h: Math.abs(p[1] - from[1]) }; from = null;
    if (b.w > .005 && b.h > .005) { drawn = true; merOcr.box = b; merSetAnchor(still); ls.set(K.merOcr, merOcr); test(); }
  });
  // 2. teach: type what the box shows
  const known = el("p", "gm-note"), out = el("p", "mc-read");
  const inp = el("input"); inp.type = "text"; inp.placeholder = "e.g. 16,000 20,000"; inp.setAttribute("aria-label", "What the price says");
  const learn = button("Learn these digits", { onClick: () => {
    if (!inp.value.trim()) return;
    if (!drawn || !merOcr.box) { out.textContent = "Draw a box round the card on the picture first."; out.classList.add("bad"); return; }
    // the box may hold the whole card: narrow it to the price's line first (and take the commas the game shows)
    const fit = merFitBox(still, inp.value); if (fit) showBox(merOcr.box);
    const img = merAfterCoin(still); if (!img) return; // the picture you see, not what the window shows now
    const err = merTeach(img, fit || merCommas(inp.value)); out.textContent = err || (fit ? "Learned. The box now holds just the price." : "Learned."); out.classList.toggle("bad", !!err); if (!err) { inp.value = ""; test(); }
  } });
  const forget = button(merOcr.builtin ? "Start again" : "Forget the digits", { cls: "linkbtn", tip: "Back to the digits it came with", onClick: () => { merOcr.glyphs = []; merOcr.builtin = false; ls.del(K.merOcr); if (!merUseBuiltin()) Object.assign(merOcr, { box: null, anchor: null }); showBox(merOcr.box); test(); } });
  const row = el("div", "mc-teachrow"); row.append(inp, learn, forget);
  function test() {
    const have = [...new Set(merOcr.glyphs.map(g => g.ch))].sort().join(" ");
    known.textContent = have ? "Knows: " + have : "Knows no digits yet.";
    out.classList.remove("bad"); foundEl.hidden = true;
    if (!merOcr.box) { out.textContent = ""; return; }
    // the same search the reader does in game, on this picture: the card it found, and what it reads there
    const price = w => MER.pools.some(p => p[2] === w.num), hits = merFind(still).filter(h => h.words.length);
    const hit = hits.find(h => h.words.some(price)) || hits[0];
    if (!hit) { out.textContent = merOcr.glyphs.length ? "Can't read it yet." : ""; return; }
    if (hit.at && merOcr.anchor) { const A = merOcr.anchor, r = still.width / A.fw; place(foundEl, { x: hit.at[0] / still.width, y: hit.at[1] / still.height, w: A.bw * r / still.width, h: A.bh * r / still.height }); }
    const p = hit.words.find(price), txt = [...hit.words].sort((a, b) => a.x - b.x).map(w => w.txt).join("  ");
    // a price shared by several cargo types: the name it reads on the card as well
    const names = p ? [...new Set(merCargos().filter(c => c.price === p.num).map(c => c.name))] : [];
    const nm = names.length > 1 ? merNameOf(still, hit.at, names) : null;
    out.textContent = `Reads ${txt}` + (p ? ` (${Math.round(p.score * 100)}% sure). The cargo price is ${p.txt}` + (nm ? `, and the card says ${nm}.` : names.length > 1 ? `; ${names.join(" or ")}: the name isn't clear.` : ".") : ", not a cargo price.");
  }
  body.append(
    gmSection("1. Where the price shows", el("p", "gm-note", "In game, hold the mouse over a cargo so its card shows the price. Take a new picture, then drag a box round the card. The card follows the mouse, so the reader looks for its coin anywhere on screen."), wrap,
      button("Take a new picture", { cls: "linkbtn", onClick: () => { still.getContext("2d").drawImage(v, 0, 0); test(); } })),
    gmSection(merOcr.builtin ? "2. Teach it (only if it misreads)" : "2. Teach the digits", el("p", "gm-note", merOcr.builtin
      ? "It already knows the game's digits. If step 3 reads a price wrong, type what the card shows (commas or not) and Learn: it adds yours."
      : "Type the price (commas or not). On sale it shows two: type both, e.g. 16000 20000. The box then shrinks to the price. Do it with a few cargos until every digit is known."), row, known),
    gmSection("3. Check", out, button("Read again", { cls: "linkbtn", onClick: test })));
  test();
  present(dlg, "Price reader", openMerOcr);
}

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("merchant", { draw: renderMerchant });
