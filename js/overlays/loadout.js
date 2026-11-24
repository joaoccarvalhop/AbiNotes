/* The loadout overlays: a loadout's detail, and new / edit. */
import { goToWeapon, render, renderLoadouts } from "../../app.js";
import { $, button, copyLine, data, delButton, el, fmtCost, fmtK, fmtKoen, isMine, ls, saveName, setDirty, TIERS } from "../base.js";
import { AMMO_FAMILIES, AMMO_IMG, CAT_BY_NAME, CATALOG, gearImg, GUN_CALIBRE } from "../gear-data.js";
import { favButton, favs, findBuild, gearPriceK, isArmoredRig, K_FAV, K_LO, LEVEL_TIP, levelOf, LO_SLOTS, LO_TAGS, LO_UTILITY, loCost, loLevel, loLevelChip, loNewId, loTier, loTierChip, setLoTier } from "../loadouts-data.js";
import { CAL_TEXT, change, CONDS, fmtDate, itemByName, marketItemFor, priceHistory } from "../market-data.js";
import { tlLoChip } from "../rankings.js";
import { openShare } from "../share.js";
import { closeDialog, confirmBox, makePicker, navBack, navReset, present, thumb, toast, wireDialog } from "../ui.js";
import { editPriceFor } from "./gear.js";
import { openPrice } from "./price.js";
import { gmSection, openGear } from "./weapon.js";

/* ---------- loadout detail overlay ---------- */
export const lm = $("lomodal");
export function openLoadout(i) {
  const lo = data.loadouts[i]; if (!lo) return;
  const top = $("lm-top"); top.textContent = "";
  const titles = el("div", "gm-titles");
  const h = el("h2", null, lo.name); h.id = "lm-title";
  const sub = el("div", "gm-sub"); sub.append(favButton(lo, renderLoadouts), loLevelChip(lo)); (lo.tags || []).forEach(t => sub.append(el("span", "lo-tag", t)));
  const tlc = tlLoChip(lo); if (tlc) sub.append(tlc);
  const by = el("p");
  by.append(lo.author ? "by " : "", lo.url ? Object.assign(el("a", null, lo.author || "Unknown author"), { href: lo.url, target: "_blank", rel: "noopener" }) : (lo.author || "Unknown author"));
  if (lo.based) by.append(` · based on ${lo.based}`);
  titles.append(h, sub, by);
  top.append(titles);

  const body = $("lm-body"); body.textContent = "";
  const w = findBuild(lo.build, lo.gun);
  const ws = el("div", "lm-weapon");
  if (w) {
    const left = el("div", "lm-wleft"); left.append(thumb(w.gun));
    const right = el("div", "lm-wright");
    const nm = el("div", "lm-wname"); nm.append(el("b", null, w.gun.name));
    if (w.build) {
      nm.append(loTierChip(w.build.tier));
      if (w.build.cost) nm.append(el("span", "lo-cost", fmtCost(w.build.cost)));
      right.append(nm, copyLine(w.name, "save", "name"), copyLine(w.build.code, "code", "code"));
    } else right.append(nm, el("p", "gm-note", "This build is no longer in the list. Edit the loadout to pick another."));
    // jump to this weapon in Builds
    const go = el("button", "linkbtn", "Open in Builds"); go.type = "button";
    go.addEventListener("click", () => { closeLo(true); goToWeapon(w.gun.name); });
    nm.append(go);
    ws.append(left, right);
  } else ws.append(el("p", "gm-note", "Weapon not found."));
  body.append(gmSection("Weapon", ws));

  const kit = el("div", "lm-kit");
  LO_SLOTS.forEach(([k, label]) => {
    const n = lo[k];
    const row = el("div", "lm-item");
    if (!n) {
      row.classList.add("empty");
      row.append(el("span", "g-img none", "—"), el("div", "g-label"));
      row.lastChild.append(el("b", null, k === "rig" && isArmoredRig(lo.armor) ? "Armored rig" : "None"), el("small", null, label));
    } else {
      const c = CAT_BY_NAME[n];
      const txt = el("div", "g-label"); txt.append(el("b", null, n), el("small", null, `${label}${c ? " · " + c.sub : ""}`));
      row.append(gearImg(n), txt);
      if (c && c.tier) row.append(el("span", "g-tier t" + c.tier, "T" + c.tier));
      // the row opens the piece; a missing price can be added straight away
      row.classList.add("lm-link"); row.tabIndex = 0; row.setAttribute("role", "button"); row.setAttribute("aria-label", `Open ${n}`);
      row.addEventListener("click", () => openGear(n));
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGear(n); } });
      if (gearPriceK(n)) { const p = el("span", "lo-cost", fmtK(gearPriceK(n))); p.dataset.tip = priceTip(n); row.append(p); }
      else {
        row.append(button("Add price", { cls: "linkbtn", icon: "plus", onClick: e => { e.stopPropagation(); editPriceFor(n); } }));
      }
    }
    kit.append(row);
  });
  body.append(gmSection("Gear", kit));

  const g = el("div", "gm-stats");
  const st = (label, v) => { const d = el("div", "gm-stat wide2"); d.append(el("small", null, label), el("b", null, v || "—")); return d; };
  const cost = loCost(lo);
  const ammoBox = el("div", "gm-stat wide2"); ammoBox.append(el("small", null, "Ammo"), lo.ammo ? ammoBadges(lo.ammo, lo.gun, true) : el("b", null, "—"));
  g.append(ammoBox, st("Utility", lo.utility), st("Estimated cost", cost.total ? fmtK(cost.total) + (cost.missing ? "+ (some gear has no price yet)" : "") : ""));
  body.append(gmSection("Raid", g));
  if (lo.notes) body.append(gmSection("Notes", el("p", "lm-notes", lo.notes)));

  const foot = $("lm-foot"); foot.textContent = "";
  const del = delButton("Delete this loadout");
  del.addEventListener("click", async () => {
    const yes = await confirmBox({ title: "Delete this loadout?", body: [el("span", "c-name", lo.name), el("p", null, "Its weapon build stays in Builds.")], ok: "Delete loadout", danger: true });
    if (!yes) return;
    const at = data.loadouts.indexOf(lo);
    if (at >= 0) data.loadouts.splice(at, 1); // gone already (the data was swapped meanwhile): never splice(-1), that is the last one
    if (lo.id && favs.has(lo.id)) { favs.delete(lo.id); ls.set(K_FAV, [...favs]); }
    setDirty(true); closeLo(); render(); // render() redraws Builds (the "N loadouts" links) and the loadouts
    toast([el("span", null, "Loadout deleted: "), el("b", null, lo.name)]);
  });
  // the editor opens in this overlay's place, with ← Back to it (present())
  // a shared loadout stays as it is for everyone: editing it makes your own copy, and only yours can be deleted
  const edit = button("Edit", { icon: "edit", tip: isMine(lo) ? "Change this loadout" : "Make your own copy of this loadout and change it", onClick: () => openLoEditor(data.loadouts.indexOf(lo)) });
  const share = button("Share", { icon: "share", tip: "Send this loadout to a friend", onClick: () => openShare({ loadouts: [lo.id || lo.name] }) });
  const acts = el("div", "m-actions"); acts.append(share, edit);
  foot.append(isMine(lo) ? del : el("span"), acts);

  body.scrollTop = 0;
  present(lm, lo.name, () => openLoadout(data.loadouts.indexOf(lo)));
  edit.focus();
}
export function closeLo(now) {
  navReset();
  if (!lm.open) return;
  closeDialog(lm, now);
}
wireDialog(lm, () => closeLo(), "lm-close");


/* ---------- new / edit loadout overlay ---------- */
export const le = $("loedit");
export let leIndex = -1, leTags = new Set();
export const catItems = kind => CATALOG[kind].map(([n, t, , sub]) => ({ value: n, title: n, sub, tier: t, img: () => gearImg(n) }));
export const byTier = items => {
  const out = [];
  [6, 5, 4, 3, 2, 1, 0].forEach(t => { const list = items.filter(i => i.tier === t); if (list.length) out.push({ label: t ? "T" + t : "", items: list }); });
  return out;
};
export const pk = {};
pk.build = makePicker($("le-build"), {
  placeholder: "Choose a weapon build",
  groups: () => data.categories.map(c => ({
    label: c.name,
    items: c.weapons.flatMap(g => TIERS.flatMap(t => g.builds.filter(b => b.tier === t.key).map((b, i) => {
      const name = saveName(g.name, t.key, i, b);
      return { value: g.name + "|" + b.code, title: name, sub: [b.cost && fmtCost(b.cost), b.author].filter(Boolean).join(" · "), img: () => thumb(g), gun: g.name };
    }))),
  })).filter(g => g.items.length),
  onChange: () => {
    // ammo of the build's calibre; the budget level follows the total cost
    leMain = ""; leTop = "";
    leAmmo();
    leLevel();
  },
});
// the build picker holds "weapon|code", because a few codes repeat on two weapons
export const splitPick = v => { const i = (v || "").indexOf("|"); return i < 0 ? { gun: "", code: v || "" } : { gun: v.slice(0, i), code: v.slice(i + 1) }; };
export const pickedBuild = () => { const p = splitPick(pk.build.get()); return p.code ? findBuild(p.code, p.gun) : null; };
pk.helmet = makePicker($("le-helmet"), { placeholder: "Choose a helmet", none: "No helmet", groups: () => byTier(catItems("helmet")), onChange: () => leLevel() });
pk.armor = makePicker($("le-armor"), {
  placeholder: "Choose armor",
  none: "No armor",
  groups: () => [...byTier(catItems("armor")).map(g => ({ ...g, label: "Body armor · " + g.label })), ...byTier(catItems("arig")).map(g => ({ ...g, label: "Armored rig · " + g.label }))],
  onChange: () => { leRig(); leLevel(); },
});
pk.rig = makePicker($("le-rig"), { placeholder: "Choose a chest rig", none: "No chest rig", groups: () => [{ label: "Chest rigs", items: catItems("rig") }], onChange: () => leLevel() });
pk.pack = makePicker($("le-pack"), { placeholder: "Choose a backpack", none: "No backpack", groups: () => [{ label: "Backpacks", items: catItems("pack") }], onChange: () => leLevel() });
pk.headset = makePicker($("le-headset"), { placeholder: "Choose a headset", none: "No headset", groups: () => [{ label: "Headsets", items: catItems("headset") }], onChange: () => leLevel() });
// the editor shows the level the loadout will get, from what is picked right now
export function leGearNow() {
  const p = splitPick(pk.build.get()), lo = { gun: p.gun, build: p.code };
  LO_SLOTS.forEach(([k]) => { const v = pk[k].get(); if (v) lo[k] = v; });
  return lo;
}
export function leLevel() {
  const box = $("le-level"); box.textContent = ""; box.title = LEVEL_TIP;
  const c = loCost(leGearNow());
  if (!c.total) { box.append(el("span", null, "The budget level shows once you pick a build and gear.")); return; }
  box.append(el("span", null, "Budget level"), loTierChip(levelOf(c.total)), el("b", null, fmtK(c.total) + (c.missing ? "+" : "")));
}

// an armored rig is also the chest rig
export function leRig() {
  const merged = isArmoredRig(pk.armor.get());
  $("le-rig").classList.toggle("disabled", merged);
  $("le-rig").querySelector(".pk-btn").disabled = merged;
  $("le-rig-note").hidden = !merged;
  if (merged) pk.rig.set("");
}
// ammo: pick from the weapon's calibre, tier shown on every round
export let leMain = "", leTop = "";
export function leAmmo(keep) {
  const w = pickedBuild();
  const cal = w && GUN_CALIBRE[w.gun.name];
  const list = cal ? AMMO_FAMILIES[cal] : [];
  $("le-ammo-hint").textContent = cal ? `${cal} · ${w.gun.name}` : w ? "Type it in. This weapon's caliber isn't listed" : "Choose a weapon first";
  $("le-ammo").hidden = !w || !!cal;
  document.querySelectorAll(".am-row").forEach(r => { r.hidden = !cal; });
  if (!keep) {
    // a new weapon: start from the round its build tier calls for
    const names = list.map(a => ammoParts(a).name);
    if (!names.includes(leMain)) leMain = "";
    if (!names.includes(leTop)) leTop = "";
    if (!leMain && list.length) {
      const want = { budget: 4, balanced: 4, max: 5 }[w.build ? w.build.tier : "budget"] || 4;
      const pickA = list.find(a => ammoParts(a).tier === want) || list.find(a => ammoParts(a).tier) || list[0];
      leMain = ammoParts(pickA).name;
    }
  }
  const chips = (host, cur, set, allowNone) => {
    host.textContent = "";
    if (allowNone) { const b = el("button", "am-chip none", "None"); b.type = "button"; b.setAttribute("aria-checked", String(!cur)); b.addEventListener("click", () => { set(""); leAmmo(true); }); host.append(b); }
    list.forEach(a => {
      const p = ammoParts(a);
      const b = el("button", "am-chip" + (p.tier ? " t" + p.tier : "")); b.type = "button"; b.setAttribute("role", "radio");
      const pic = ammoPic(p.name, w.gun.name); if (pic) b.append(pic);
      b.append(el("b", null, p.name)); if (p.tag) b.append(el("small", null, p.tier ? "Lv" + p.tier : p.tag));
      b.setAttribute("aria-checked", String(cur === p.name));
      b.addEventListener("click", () => { set(p.name); leAmmo(true); });
      host.append(b);
    });
  };
  chips($("le-ammo-main"), leMain, v => { leMain = v; if (leTop === v) leTop = ""; }, false);
  chips($("le-ammo-top"), leTop, v => { leTop = v === leMain ? "" : v; }, true);
}
export function ammoPic(name, gun) {
  const src = AMMO_IMG[GUN_CALIBRE[gun] + "|" + name];
  if (!src) return null;
  const img = new Image(); img.className = "am-pic"; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = src;
  img.addEventListener("error", () => img.remove());
  return img;
}
// "M855A1 (T4)" -> { name, tier, tag }
export function ammoParts(a) {
  const m = String(a).match(/^(.*?)\s*\((?:(?:T|Lv)(\d)|([^)]*))\)\s*$/); // "(Lv4)" saved, "(T4)" in older loadouts
  return m ? { name: m[1].trim(), tier: m[2] ? +m[2] : 0, tag: m[2] ? "T" + m[2] : m[3] } : { name: String(a).trim(), tier: 0, tag: "" };
}
export function ammoTier(name, gun) {
  const fam = AMMO_FAMILIES[GUN_CALIBRE[gun]] || Object.values(AMMO_FAMILIES).flat();
  const hit = fam.map(ammoParts).find(p => p.name === name);
  return hit || { name, tier: 0, tag: "" };
}
// "M855A1 (T4), M995 on top" -> { main, top }
export function splitAmmo(s) {
  if (!s) return { main: "", top: "" };
  const [a, b] = String(s).split(/,\s*/);
  return { main: ammoParts(a).name, top: b ? b.replace(/\s*on top\s*$/i, "").replace(/\s*\(.*\)\s*$/, "").trim() : "" };
}
export function ammoText(gun) {
  if (!$("le-ammo").hidden) return $("le-ammo").value.trim();
  if (!leMain) return "";
  const m = ammoTier(leMain, gun);
  return `${m.name}${m.tier ? ` (Lv${m.tier})` : m.tag ? ` (${m.tag})` : ""}${leTop ? `, ${leTop} on top` : ""}`;
}
// small badges for cards and the detail view
// the market item of a round, e.g. "M855A1" on an M4A1 -> "5.56x45mm M855A1"
export function ammoMarketItem(round, gun) {
  const fam = GUN_CALIBRE[gun]; if (!fam) return null;
  const text = Object.keys(CAL_TEXT).find(k => CAL_TEXT[k] === fam);
  return text ? itemByName(`${text} ${round}`) || marketItemFor(`${text} ${round}`, `${text} Ammo`) : null; // the market cuts long names
}
// one line per condition with the newest price, for hover previews
export function priceTip(name, item) {
  const it = item || marketItemFor(name);
  const h = it ? priceHistory(it.id) : []; const l = h[h.length - 1];
  if (!l) return "No price yet";
  const lines = [];
  if (typeof l.all === "object") CONDS.forEach(([k, lab]) => { if (l.all[k] != null) lines.push(`${lab} ${fmtKoen(l.all[k])}${l.all[k + "Dur"] ? " (" + l.all[k + "Dur"] + ")" : ""}`); });
  else lines.push(fmtKoen(l.price));
  const c = change(h);
  lines.push(fmtDate(l.date) + (c != null ? ` · ${c > 0 ? "▲" : c < 0 ? "▼" : ""} ${Math.abs(c).toFixed(1)}%` : ""));
  return lines.join("\n");
}
export function ammoBadges(s, gun, links) {
  const box = el("span", "am-badges");
  if (!s) return box;
  const { main, top } = splitAmmo(s);
  const one = (n, extra) => { const p = ammoTier(n, gun); const b = el("span", "am-chip small" + (p.tier ? " t" + p.tier : "")); const pic = ammoPic(p.name, gun); if (pic) b.append(pic); b.append(el("b", null, p.name)); if (p.tag) b.append(el("small", null, p.tier ? "Lv" + p.tier : p.tag));
    const mi = ammoMarketItem(p.name, gun);
    b.dataset.tip = (extra ? extra + "\n" : "") + (mi ? priceTip(null, mi) : "No price yet");
    // in overlays a round opens its market price, with ← Back
    if (links && mi) { b.classList.add("am-link"); b.tabIndex = 0; b.setAttribute("role", "button"); b.addEventListener("click", () => openPrice(mi.id)); }
    return b; };
  box.append(one(main, "Main ammo"));
  if (top) { box.append(el("i", null, "+")); const t = one(top, "Loaded on top of the magazine"); t.classList.add("top"); box.append(t); }
  return box;
}
export const leTagBox = $("le-tags");
LO_TAGS.forEach(t => {
  const b = el("button", "tagbtn", t); b.type = "button"; b.dataset.t = t;
  b.addEventListener("click", () => { leTags.has(t) ? leTags.delete(t) : leTags.add(t); markTags(); });
  leTagBox.append(b);
});
export const markTags = () => leTagBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(leTags.has(b.dataset.t))));
Object.entries(LO_UTILITY).forEach(([k, v]) => {
  const b = el("button", "linkbtn", k); b.type = "button"; b.title = v;
  b.addEventListener("click", () => { $("le-utility").value = v; });
  $("le-util-presets").append(b);
});
export function leMsg(t, k) { const m = $("le-msg"); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }

export function openLoEditor(i) {
  leIndex = i;
  const lo = data.loadouts[i] || { tier: loTier !== "all" ? loTier : "budget", tags: [], author: "" };
  const shared = i >= 0 && !isMine(lo); // saving makes your own copy
  $("le-h").textContent = shared ? "Your copy of this loadout" : i >= 0 ? "Edit loadout" : "Add a loadout";
  $("le-submit").textContent = shared ? "Save as yours" : i >= 0 ? "Save changes" : "Add loadout";
  $("le-name").value = lo.name || "";
  leTags = new Set(lo.tags || []); markTags();
  pk.build.set(lo.build ? (lo.gun || "") + "|" + lo.build : ""); pk.helmet.set(lo.helmet || ""); pk.armor.set(lo.armor || "");
  pk.rig.set(lo.rig || ""); pk.pack.set(lo.pack || ""); pk.headset.set(lo.headset || "");
  leRig();
  const am = splitAmmo(lo.ammo); leMain = am.main; leTop = am.top;
  $("le-ammo").value = lo.ammo || "";
  leAmmo(i >= 0);
  $("le-build-hint").textContent = "";
  leLevel();
  $("le-utility").value = lo.utility || "";
  $("le-notes").value = lo.notes || ""; $("le-author").value = lo.author || ""; $("le-url").value = lo.url || "";
  leMsg("");
  // like every overlay: from a loadout's overlay it takes its place, with ← Back to it
  present(le, i >= 0 ? "Edit loadout" : "Add a loadout", () => openLoEditor(i));
  $("le-name").focus();
}
export function closeLe() {
  if (!le.open) return;
  Object.values(pk).forEach(p => p.close());
  closeDialog(le);
}
$("le-close").addEventListener("click", closeLe);
$("le-cancel").addEventListener("click", () => navBack() || closeLe()); // Cancel and Esc go back to where you came from
le.addEventListener("cancel", e => { e.preventDefault(); const openPk = Object.values(pk).find(p => p.isOpen()); if (openPk) openPk.close(true); else navBack() || closeLe(); });
le.addEventListener("click", e => { if (e.target === le) closeLe(); });

$("le-form").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("le-name").value.trim(), url = $("le-url").value.trim();
  if (!name) { leMsg("Give the loadout a name.", "err"); $("le-name").focus(); return; }
  if (!pk.build.get()) { leMsg("Choose a weapon build.", "err"); return; }
  if (url && !/^https?:\/\//i.test(url)) { leMsg("The link should start with https://", "err"); $("le-url").focus(); return; }
  const w = pickedBuild(), pick = splitPick(pk.build.get());
  const prev = data.loadouts[leIndex];
  if (!w && !(prev && prev.gun)) { leMsg("That build is no longer in the list. Choose another one.", "err"); return; }
  // a removed build keeps the weapon it was made for
  const copy = prev && !isMine(prev); // editing a shared loadout: the changes become your own copy, the shared one stays
  const lo = { id: prev && prev.id && !copy ? prev.id : loNewId(name), name, tier: "budget", tags: LO_TAGS.filter(t => leTags.has(t)), gun: w ? w.gun.name : (pick.gun || prev.gun), build: pick.code };
  const put = (k, v) => { if (v) lo[k] = v; };
  put("ammo", ammoText(lo.gun));
  ["helmet", "armor", "rig", "pack", "headset"].forEach(k => put(k, pk[k].get()));
  put("utility", $("le-utility").value.trim()); put("notes", $("le-notes").value.trim());
  lo.author = $("le-author").value.trim() || "Me";
  put("url", url);
  lo.tier = loLevel(lo); // saved too, so builds.js reads right without prices
  const old = data.loadouts[leIndex];
  if (old) {
    if (old.based) lo.based = old.based;
    lo.added = old.added || new Date().toISOString().slice(0, 10);
    // compare what you can edit; id, date and "based on" are bookkeeping
    const strip = o => { const c = { ...o }; delete c.id; delete c.added; delete c.based; return c; };
    const same = (a, b) => { a = strip(a); b = strip(b); return JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort()) && Object.keys(a).length === Object.keys(b).length; };
    if (same(old, lo)) { leMsg("No changes to save."); return; }
    if (copy) {
      if (lo.author === old.author) lo.author = "Me";
      lo.based = old.name; lo.added = new Date().toISOString().slice(0, 10);
      data.loadouts.splice(leIndex + 1, 0, lo); // next to the one it came from
      setDirty(); render(); closeLe(); closeLo(true); openLoadout(data.loadouts.indexOf(lo)); // the copy opens on its own, no ← Back to the editor
      toast([el("span", null, "Saved as yours: "), el("b", null, lo.name)]);
      return;
    }
    const yes = await confirmBox({ title: "Save changes?", body: [el("span", "c-name", lo.name)], ok: "Save changes", cancel: "Keep editing" });
    if (!yes) return;
    data.loadouts[leIndex] = lo;
  } else {
    lo.added = new Date().toISOString().slice(0, 10);
    data.loadouts.push(lo);
  }
  setDirty(true);
  if (loTier !== "all" && loTier !== "fav" && loTier !== "mine" && loTier !== lo.tier) { setLoTier("all"); $("sub-loadouts").querySelectorAll(".g-jump button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.k === "all"))); }
  render(); navBack() || closeLe(); // saved from a loadout's overlay: back to it, showing the change
  toast([el("span", null, old ? "Loadout updated: " : "Loadout added: "), el("b", null, lo.name)]);
});
