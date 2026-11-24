/* The Add build overlay (also edits a build). */
import { render, setArea, showSections } from "../../app.js";
import { $, autoName, data, el, icon, insertBuild, K, ls, norm, openSet, saved, saveName, setDirty, setTabId, slug, tab, tierLabel, TIERS } from "../base.js";
import { closeDialog, confirmBox, navBack, present, thumb, toast } from "../ui.js";
import { refreshWeapon } from "./weapon.js";

/* ---------- add build (overlay) ---------- */
export const modal = $("addmodal"), openBtn = $("add-open");
openBtn.prepend(icon("plus")); // "Add …" buttons are the plus icon and the word, everywhere
export let fTier = "budget";
export let fGun = null; // { cat, gun }

export function findGun(name) {
  let hit = null;
  data.categories.forEach(c => c.weapons.forEach(g => { if (!hit && g.name === name) hit = { cat: c, gun: g }; }));
  return hit;
}

/* weapon picker */
export const wp = $("f-gun"), wpBtn = wp.querySelector(".wp-btn"), wpPop = wp.querySelector(".wp-pop"),
      wpQ = wp.querySelector(".wp-q"), wpList = wp.querySelector(".wp-list");
export let wpActive = -1;

export function fillGuns() {
  wpList.textContent = "";
  const v = norm(wpQ.value.trim());
  data.categories.forEach(c => {
    const guns = c.weapons.filter(g => !v || norm(g.name).includes(v));
    if (!guns.length) return;
    wpList.append(el("div", "wp-cat", c.name));
    guns.forEach(g => {
      const o = el("div", "wp-opt"); o.setAttribute("role", "option"); o.dataset.name = g.name;
      o.setAttribute("aria-selected", String(!!fGun && fGun.gun === g));
      o.append(thumb(g), el("span", null, g.name), el("small", null, g.builds.length ? `${g.builds.length} build${g.builds.length === 1 ? "" : "s"}` : "No builds yet"));
      o.addEventListener("click", () => { pickGun(g.name); closeWp(true); });
      wpList.append(o);
    });
  });
  if (!wpList.children.length) wpList.append(el("div", "wp-none", "No weapon matches your search."));
  wpActive = -1;
}
export function opts() { return [...wpList.querySelectorAll(".wp-opt")]; }
export function markActive() {
  opts().forEach((o, i) => o.classList.toggle("active", i === wpActive));
  const a = opts()[wpActive]; if (a) a.scrollIntoView({ block: "nearest" });
}
export function openWp() {
  wp.classList.add("open"); wpPop.hidden = false; wpBtn.setAttribute("aria-expanded", "true");
  wpQ.value = ""; fillGuns();
  wpActive = Math.max(0, opts().findIndex(o => o.getAttribute("aria-selected") === "true"));
  markActive(); wpQ.focus();
}
export function closeWp(focus) {
  wp.classList.remove("open"); wpPop.hidden = true; wpBtn.setAttribute("aria-expanded", "false");
  if (focus) wpBtn.focus();
}
wpBtn.addEventListener("click", () => (wpPop.hidden ? openWp() : closeWp()));
wpQ.addEventListener("input", () => { fillGuns(); wpActive = opts().length ? 0 : -1; markActive(); });
wpQ.addEventListener("keydown", e => {
  const n = opts().length;
  if (e.key === "ArrowDown") { e.preventDefault(); wpActive = Math.min(n - 1, wpActive + 1); markActive(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); wpActive = Math.max(0, wpActive - 1); markActive(); }
  else if (e.key === "Enter") { e.preventDefault(); const o = opts()[wpActive]; if (o) { pickGun(o.dataset.name); closeWp(true); } }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeWp(true); }
});
document.addEventListener("click", e => { if (!wp.contains(e.target)) closeWp(); });

export function pickGun(name) {
  fGun = findGun(name);
  const th = $("f-thumb");
  const nt = fGun ? thumb(fGun.gun) : Object.assign(el("div", "thumb"), { innerHTML: '<div class="ph">?</div>' });
  nt.id = "f-thumb"; th.replaceWith(nt);
  const val = $("f-gun-val");
  val.textContent = fGun ? fGun.gun.name : "Choose a weapon";
  val.classList.toggle("empty", !fGun);
  refresh();
}

/* tier picker: four colored buttons that also say how many builds the weapon already has there */
export const seg = $("f-tier");
TIERS.forEach(t => {
  const b = el("button", t.key); b.type = "button"; b.setAttribute("role", "radio"); b.dataset.tier = t.key;
  b.append(el("b", null, t.label), el("small"));
  b.addEventListener("click", () => setTier(t.key));
  b.addEventListener("keydown", e => {
    const i = TIERS.findIndex(x => x.key === fTier);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setTier(TIERS[(i + 1) % 4].key, true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setTier(TIERS[(i + 3) % 4].key, true); }
  });
  seg.append(b);
});
export function setTier(key, focus) {
  fTier = key;
  seg.querySelectorAll("button").forEach(b => {
    const on = b.dataset.tier === key;
    b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  // Misc has no fixed tier word, so the build's title becomes its name
  refresh();
}

export const CODE_RE = /3f[0-9A-Za-z]{10,}/;
export function refresh() {
  const g = fGun && fGun.gun;
  const hint = $("f-gun-hint"); hint.textContent = "";
  if (g) hint.append(el("b", null, fGun.cat.name), ` · ${g.builds.length} build${g.builds.length === 1 ? "" : "s"} so far`);
  else hint.textContent = "Grouped by category, like the Gunsmith";

  // while editing, the build itself doesn't count as "already there"
  const others = g ? g.builds.filter(x => !editing || x !== editing.build) : [];
  seg.querySelectorAll("button").forEach(b => {
    const n = others.filter(x => x.tier === b.dataset.tier).length;
    const keepsSpot = editing && editing.gun === g && editing.build.tier === b.dataset.tier;
    b.querySelector("small").textContent = keepsSpot ? "Current level" : n ? `${n} already · this is #${n + 1}` : "First one";
  });

  const code = $("f-code").value.trim(), ok = $("f-code-ok");
  ok.className = code ? (CODE_RE.test(code) ? "ok" : "bad") : "";
  $("f-code").classList.toggle("invalid", !!code && !CODE_RE.test(code));

  // name in game: follows the weapon/tier/position until the user types their own
  if (g && !nameCustom) $("f-name").value = currentAuto();
  syncNameState();
  msg("");
}
export let nameCustom = false;
export function currentAuto() {
  if (!fGun) return "";
  // an old Misc build with a label keeps that word in its automatic name
  const keepLabel = editing && editing.build.tier === "misc" && fTier === "misc" ? { label: editing.build.label } : null;
  return autoName(fGun.gun.name, fTier, targetIndex(), keepLabel);
}
export function syncNameState() {
  const inp = $("f-name"), pill = $("f-name-auto");
  inp.classList.toggle("auto", !nameCustom);
  pill.textContent = nameCustom ? "Custom" : "Auto";
  pill.classList.toggle("custom", nameCustom);
  $("f-name-reset").hidden = !nameCustom;
}
$("f-name").addEventListener("input", () => {
  const v = $("f-name").value.trim();
  nameCustom = !!v && v !== currentAuto();
  syncNameState();
});
$("f-name").addEventListener("blur", () => { if (!$("f-name").value.trim()) { nameCustom = false; refresh(); } });
$("f-name-reset").addEventListener("click", () => { nameCustom = false; refresh(); $("f-name").focus(); });
// where the build will sit inside its tier: same spot when editing in place, otherwise at the end
export function targetIndex() {
  const g = fGun.gun;
  if (editing && editing.gun === g && editing.build.tier === fTier) return g.builds.filter(b => b.tier === fTier).indexOf(editing.build);
  return g.builds.filter(b => b.tier === fTier && (!editing || b !== editing.build)).length;
}
["f-code", "f-title"].forEach(id => $(id).addEventListener("input", refresh));

export function msg(t, k) { const m = $("f-msg"); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }

export let editing = null; // { gun, build } while editing an existing build
export const FIELDS = ["f-code", "f-cost", "f-title", "f-author", "f-url"];

export function openModal(edit) {
  editing = edit && edit.build ? edit : null;
  if (editing) {
    const b = editing.build;
    $("add-h").textContent = "Edit build";
    $("add-sub").textContent = "Change anything below. Moving it to another level or weapon renumbers the names.";
    $("f-submit").textContent = "Save changes";
    $("f-code").value = b.code || ""; $("f-cost").value = b.cost || "";
    $("f-title").value = b.title || "";
    nameCustom = !!b.name; $("f-name").value = b.name || "";
    $("f-author").value = b.author || ""; $("f-url").value = b.url || "";
    fTier = b.tier;
    pickGun(editing.gun.name);
  } else {
    $("add-h").textContent = "Add a build";
    $("add-sub").textContent = "Paste a code from So1o, ABI Builder or a friend and choose where it goes.";
    $("f-submit").textContent = "Add build";
    if (modal.dataset.mode === "edit") FIELDS.forEach(id => $(id).value = ""); // don't carry an edited build into a new one
    nameCustom = false;
    // start on the first weapon of the tab you're looking at
    const cur = data.categories.find(c => slug(c.name) === tab) || data.categories[0];
    if (!fGun || modal.dataset.mode === "edit") { if (cur && cur.weapons[0]) pickGun(cur.weapons[0].name); }
    else pickGun(fGun.gun.name);
  }
  modal.dataset.mode = editing ? "edit" : "add";
  setTier(fTier);
  // like every overlay: from a weapon's overlay it takes its place, with ← Back to it
  present(modal, editing ? "Edit build" : "Add a build", () => openModal(edit));
  openBtn.setAttribute("aria-expanded", "true");
  (editing ? $("f-code") : wpBtn).focus();
}
export function closeModal() {
  if (!modal.open) return;
  closeWp();
  openBtn.setAttribute("aria-expanded", "false");
  closeDialog(modal);
}
openBtn.addEventListener("click", () => openModal());
$("f-close").addEventListener("click", closeModal);
$("f-cancel").addEventListener("click", () => navBack() || closeModal()); // Cancel and Esc go back to where you came from
modal.addEventListener("cancel", e => { e.preventDefault(); if (!wpPop.hidden) closeWp(true); else navBack() || closeModal(); });
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); }); // click on the dimmed area
modal.addEventListener("close", refreshWeapon); // added or edited from a weapon's overlay: it shows the change
modal.addEventListener("close", () => openBtn.focus());

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("f-code").value.trim();
  const url = $("f-url").value.trim();
  const tier = fTier;
  if (!fGun) { msg("Choose a weapon.", "err"); wpBtn.focus(); return; }
  if (!CODE_RE.test(code)) { msg("Paste a build code (it contains something like 3fsZ0RAQ…).", "err"); $("f-code").focus(); return; }
  if (url && !/^https?:\/\//i.test(url)) { msg("The link should start with https://", "err"); $("f-url").focus(); return; }
  const gun = fGun.gun;
  const prev = editing && editing.build;
  if (gun.builds.some(b => b.code === code && b !== prev)) { msg(`${gun.name} already has this code.`, "err"); $("f-code").focus(); return; }

  const b = { tier, code, cost: $("f-cost").value.trim(), author: $("f-author").value.trim() };
  if (nameCustom) b.name = $("f-name").value.trim();
  if (prev && prev.label && prev.tier === "misc" && tier === "misc") b.label = prev.label;
  const title = $("f-title").value.trim(); if (title) b.title = title;
  if (url) b.url = url;
  if (prev) { if (prev.added) b.added = prev.added; if (prev.old && prev.code === code) b.old = true; }
  else b.added = new Date().toISOString().slice(0, 10);

  // editing: show what changes and ask before saving
  if (prev) {
    const tierName = tierLabel; // a tier not in the list doesn't break the page
    const oldIdx = editing.gun.builds.filter(x => x.tier === prev.tier).indexOf(prev);
    const rows = [
      ["Weapon", editing.gun.name, gun.name],
      ["Budget level", tierName(prev.tier), tierName(tier)],
      ["Name", saveName(editing.gun.name, prev.tier, oldIdx, prev), saveName(gun.name, tier, targetIndex(), b)],
      ["Code", prev.code, b.code],
      ["Cost", prev.cost || "—", b.cost || "—"],
      ["Title", prev.title || "—", b.title || "—"],
      ["Author", prev.author || "—", b.author || "—"],
      ["Link", prev.url || "—", b.url || "—"],
    ].filter(r => r[1] !== r[2]);
    if (!rows.length) { navBack() || closeModal(); toast([el("span", null, "No changes to save")]); editing = null; return; }
    const dl = el("dl", "c-diff");
    rows.forEach(([k, a, z]) => {
      const dd = el("dd"); dd.append(el("s", null, a), el("span", "arrow", "→"), el("ins", null, z));
      dl.append(el("dt", null, k), dd);
    });
    const ok = await confirmBox({
      title: "Save changes?",
      body: [el("p", null, `${rows.length} change${rows.length === 1 ? "" : "s"} to this build:`), dl],
      ok: "Save changes", cancel: "Keep editing",
    });
    if (!ok) { $("f-submit").focus(); return; }
  }

  if (prev && editing.gun === gun && prev.tier === tier) {
    gun.builds[gun.builds.indexOf(prev)] = b; // same weapon and tier: keep its place
  } else {
    if (prev) editing.gun.builds.splice(editing.gun.builds.indexOf(prev), 1);
    insertBuild(gun, b);
  }
  if (prev && prev.code !== code && saved[prev.code]) { delete saved[prev.code]; saved[code] = 1; ls.set(K.saved, saved); }
  // loadouts made on this build follow the new code (and weapon, if it moved)
  if (prev && (prev.code !== code || editing.gun !== gun)) (data.loadouts || []).forEach(l => { if (l.build === prev.code && l.gun === editing.gun.name) { l.build = code; l.gun = gun.name; } });
  const name = saveName(gun.name, tier, gun.builds.filter(x => x.tier === tier).indexOf(b), b);

  openSet.add(gun.name); ls.set(K.open, [...openSet]);
  setDirty(true);
  if ($("q").value) $("q").value = "";
  setTabId(slug(fGun.cat.name));
  setArea("builds", { scroll: false });
  render(); showSections(false);

  navBack() || closeModal(); // added or edited from a weapon's overlay: back to it, showing the change
  FIELDS.filter(id => id !== "f-author").forEach(id => $(id).value = "");
  toast([el("span", null, prev ? "Build updated: " : "Build added: "), el("b", null, name)]);
  editing = null;
});
