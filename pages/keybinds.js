/* The Keybinds page: loaded the first time it opens (loadPage in app.js). The presets themselves (KB_LAYOUT,
   KB_GAME, kbUserPresets, kbCurrent, kbChanged) are in app.js: Home and Share use them on any page. */
import { registerPage } from "../app.js";
import { $, button, clone, el, K, ls, setDirty } from "../js/base.js";
import { K_KB, KB_ACTIONS, KB_GAME, KB_ID, KB_LAYOUT, kbActive, kbAll, kbChanged, kbCurrent, kbEditable, kbLabel, kbUserPresets, MODE, setKbActive } from "../js/keybinds-data.js";
import { openShare } from "../js/share.js";
import { closeDialog, confirmBox, ddSelect, infoDot, present, toast, wireDialog } from "../js/ui.js";

/* ---------- key picker: the whole keyboard and the mouse, to click ----------
   Some keys never reach a web page (Alt+Tab, Windows keys, some F-keys), so you click them here instead.
   Pressing a key or turning the wheel over the mouse still works. Nothing changes until Save. */
export const kp = $("kbpick");
// [the game's name for it, width in key widths, short text on the key]; a number alone is an empty gap
export const KP_MAIN = [
  [1, ...[1, 2, 3, 4].map(n => ["F" + n]), .5, ...[5, 6, 7, 8].map(n => ["F" + n]), .5, ...[9, 10, 11, 12].map(n => ["F" + n])],
  [["~"], ..."1234567890".split("").map(k => [k]), ["-"], ["="], ["Backspace", 2, "Back"]],
  [["Tab", 1.5], ..."QWERTYUIOP".split("").map(k => [k]), ["["], ["]"], ["\\", 1.5]],
  [["Caps Lock", 1.75, "Caps"], ..."ASDFGHJKL".split("").map(k => [k]), [";"], ["'"], ["Enter", 2.25]],
  [["Left Shift", 2.25, "Shift"], ..."ZXCVBNM".split("").map(k => [k]), [","], ["."], ["/"], ["Right Shift", 2.75, "Shift"]],
  [["Left Ctrl", 1.25, "Ctrl"], ["", 1.25, "Win"], ["Left Alt", 1.25, "Alt"], ["Space", 6.25], ["Right Alt", 1.25, "Alt"], ["", 1.25, "Win"], ["", 1.25, "Menu"], ["Right Ctrl", 1.25, "Ctrl"]],
];
export const KP_NAV = [
  [3],
  [["Insert", 1, "Ins"], ["Home"], ["Page Up", 1, "PgUp"]],
  [["Delete", 1, "Del"], ["End"], ["Page Down", 1, "PgDn"]],
  [3],
  [1, ["Up", 1, "↑"], 1],
  [["Left", 1, "←"], ["Down", 1, "↓"], ["Right", 1, "→"]],
];
export const numKey = n => ["Num " + n, 1, n];
export const KP_NUM = [[3], [3], [7, 8, 9].map(numKey), [4, 5, 6].map(numKey), [1, 2, 3].map(numKey), [["Num 0", 3, "0"]]];
export let kpState = null; // { id, p, sel, alt }

export function kpUses(p, label) { return KB_ACTIONS.filter(a => p.binds[a.id] && p.binds[a.id][0] === label); }
export function kpRender() {
  const { id, p, sel, alt } = kpState;
  const action = KB_ACTIONS.find(a => a.id === id), now = p.binds[id];
  const top = $("kp-top"); top.textContent = "";
  const titles = el("div", "gm-titles"), t = el("h2", null, action.name); t.id = "kp-title";
  titles.append(t, el("p", null, now ? `Now: ${now[0]}${now[1] ? " · " + MODE[now[1]] : ""}` : "Not bound yet"));
  top.append(titles);

  const body = $("kp-body"); body.textContent = "";
  const tools = el("div", "kp-tools");
  // two ways to pick: click it on the drawing, or press the real key / mouse button
  const how = el("div", "g-seg");
  [["click", "Click", "Click the key on the keyboard below"], ["press", "Press", "Press the real key, or click the box with any mouse button"]].forEach(([v, txt, tip]) => {
    const b = el("button", null, txt); b.type = "button"; b.title = tip; b.setAttribute("aria-pressed", String((kpState.listen ? "press" : "click") === v));
    b.addEventListener("click", () => { kpState.listen = v === "press"; ls.set(K.kbPress, kpState.listen); kpRender(); });
    how.append(b);
  });
  const altBtn = el("button", "tagbtn", "Alt +"); altBtn.type = "button"; altBtn.setAttribute("aria-pressed", String(alt));
  altBtn.title = "Hold Alt in the game: the next key you click becomes Alt + that key";
  altBtn.addEventListener("click", () => { kpState.alt = !kpState.alt; kpRender(); });
  tools.append(how, altBtn);
  const legend = el("div", "kp-legend");
  [["l-cur", "Now"], ["l-sel", "New"], ["l-used", "Used by another action"]].forEach(([c, txt]) => { const s = el("span"); s.append(el("i", c), txt); legend.append(s); });
  tools.append(legend);
  body.append(tools);
  if (kpState.listen) {
    // any mouse button on this box (side buttons too) and the wheel count; keys are heard everywhere
    const pad = el("div", "kp-listen", sel ? `Got ${sel}. Press another to change it` : "Press a key, or click here with any mouse button");
    pad.tabIndex = 0;
    pad.addEventListener("mousedown", e => { e.preventDefault(); const l = kbLabel(e); if (l) { kpState.sel = (e.altKey || kpState.alt) ? "Alt+" + l : l; kpRender(); } });
    pad.addEventListener("contextmenu", e => e.preventDefault());
    pad.addEventListener("auxclick", e => e.preventDefault());
    pad.addEventListener("wheel", e => { e.preventDefault(); kpState.sel = (e.altKey || kpState.alt ? "Alt+" : "") + kbLabel(e); kpRender(); }, { passive: false });
    body.append(pad);
    setTimeout(() => pad.focus(), 0);
  }

  // one key: its name with Alt+ when that's on, marked when it is the current key, the new one, or used elsewhere
  const key = ([name, w = 1, short], cls = "") => {
    const b = el("button", "kp-key " + cls); b.type = "button";
    if (!name) { b.disabled = true; b.textContent = short; b.title = "The game doesn't use this key"; b.style.width = `calc(var(--u) * ${w} + ${(w - 1) * 4}px)`; return b; }
    const label = alt && !/Alt$/.test(name) ? "Alt+" + name : name;
    b.textContent = short || name; b.dataset.k = label;
    if (w === 1 && b.textContent.length > 3) b.classList.add("tight"); // Home, PgUp… on a one-wide key
    if (w) b.style.width = `calc(var(--u) * ${w} + ${(w - 1) * 4}px)`;
    const others = kpUses(p, label).filter(a => a.id !== id);
    if (now && now[0] === label) b.classList.add("cur");
    if (sel === label) b.classList.add("sel");
    if (others.length) b.classList.add("used");
    b.dataset.tip = label + (others.length ? "\nUsed by: " + others.map(a => a.name).join(", ") : "");
    b.addEventListener("click", () => { kpState.sel = label; kpRender(); });
    return b;
  };
  const block = rows => {
    const bl = el("div", "kp-block");
    rows.forEach(r => {
      const row = el("div", "kp-row");
      r.forEach(k => {
        if (typeof k === "number") { const g = el("span", "kp-gap"); g.style.width = `calc(var(--u) * ${k} + ${(k - 1) * 4}px)`; row.append(g); }
        else row.append(key(k));
      });
      bl.append(row);
    });
    return bl;
  };
  const board = el("div", "kp-board");
  board.append(block(KP_MAIN), block(KP_NAV), block(KP_NUM));
  // the mouse from above: left, wheel (up, click, down), right; side buttons on the left
  const mouse = el("div", "kp-mouse");
  const side = el("div", "kp-side"); side.append(key(["Mouse 5", 0, "M5"]), key(["Mouse 4", 0, "M4"]));
  const shape = el("div", "kp-body"), wheel = el("div", "kp-wheel");
  wheel.append(key(["Wheel Up", 0, "▲"]), key(["Middle Mouse", 0, "Mid"]), key(["Wheel Down", 0, "▼"]));
  const palm = el("div", "kp-palm", "Mouse");
  shape.append(key(["Left Mouse", 0, "Left"]), wheel, key(["Right Mouse", 0, "Right"]), palm);
  shape.title = "Scroll here to pick Wheel Up or Wheel Down";
  shape.addEventListener("wheel", e => { e.preventDefault(); kpState.sel = (kpState.alt ? "Alt+" : "") + (e.deltaY < 0 ? "Wheel Up" : "Wheel Down"); kpRender(); }, { passive: false });
  mouse.append(side, shape);
  board.append(mouse);
  body.append(board);

  const foot = $("kp-foot"); foot.textContent = "";
  const pick = el("p", "kp-pick");
  if (sel) {
    pick.append("New key: ", el("b", null, sel));
    const others = kpUses(p, sel).filter(a => a.id !== id);
    if (others.length) pick.append(" ", el("span", "warn", "· also " + others.map(a => a.name).join(", ")));
  } else pick.append("Pick a key above");
  const clear = el("button", "linkbtn", "No key"); clear.type = "button"; clear.dataset.tip = "Leave this action without a key";
  clear.addEventListener("click", () => kpSave(""));
  const acts = el("div", "m-actions");
  const cancel = el("button", null, "Cancel"); cancel.type = "button"; cancel.addEventListener("click", kpClose);
  const save = el("button", "primary", "Save key"); save.type = "button"; save.disabled = !sel; save.addEventListener("click", () => kpSave(sel));
  acts.append(cancel, save);
  foot.append(pick, now ? clear : "", acts);
}
export function kpSave(label) {
  const { id, p } = kpState;
  if (label) p.binds[id] = [label, (p.binds[id] || [])[1] || ""]; else delete p.binds[id];
  setDirty(true); kpClose(); renderKeys();
}
export function kpOpen(id, p) {
  kpState = { id, p, sel: null, alt: false, listen: !!ls.get(K.kbPress) };
  kpRender();
  present(kp, "Pick a key", () => kpOpen(id, p)); // like every overlay
  $("kp-close").focus();
}
export function kpClose() {
  if (!kp.open) return;
  closeDialog(kp);
}
wireDialog(kp, kpClose, "kp-close"); // (Esc now closes it with its animation too)
// a real key press picks that key; Alt then a key makes Alt+key, Alt alone is Left/Right Alt. Esc still closes
// (listened on the whole page: clicking a key redraws the overlay and focus can land outside it)
{
  let altHeld = false, sawOther = false;
  const isAlt = e => e.code === "AltLeft" || e.code === "AltRight";
  addEventListener("keydown", e => {
    if (!kp.open || !kpState.listen || e.code === "Escape" || $("confirm").open) return;
    e.preventDefault(); e.stopPropagation(); // also keeps Space and Enter from pressing a focused button
    if (isAlt(e)) { altHeld = true; sawOther = false; return; }
    sawOther = true;
    const l = kbLabel(e); if (!l) return;
    kpState.sel = (e.altKey || kpState.alt) && !/Alt$/.test(l) ? "Alt+" + l : l;
    kpRender();
  }, true);
  addEventListener("keyup", e => {
    if (!kp.open || !kpState.listen) return;
    e.preventDefault();
    if (isAlt(e) && altHeld && !sawOther) { kpState.sel = e.code === "AltLeft" ? "Left Alt" : "Right Alt"; kpRender(); }
    if (isAlt(e)) altHeld = false;
  }, true);
}

// keys that differ from the game's default: another key, another way to press it, or none at all (the same rows the ● marks)
export function renderKeys() {
  const sec = $(KB_ID); sec.textContent = "";
  const p = kbCurrent(), edit = kbEditable(p), def = KB_GAME[0].binds;
  const changed = kbChanged(p);
  // the preset's name is in the dropdown above, so no heading here; tips go in the sub-bar's ⓘ
  kbInfo = edit
    ? `${changed} keys differ from the game's default (marked with ●)\nHover an action to see what it does\nClick a key to pick the new one`
    : "A game preset, it can't be changed\nHover an action to see what it does\nDuplicate it to make your own";
  const grid = el("div", "kb-grid");
  KB_LAYOUT.forEach(col => {
    const c = el("div");
    col.forEach(([title, rows]) => {
      const s = el("section"); s.append(el("h3", null, title));
      rows.forEach(([id, name, desc]) => {
        const b = p.binds[id], d = def[id];
        const r = el("div", "kb-row"); r.dataset.tip = desc;
        const txt = el("div", "kb-txt"); const nm = el("span", "name", name); nm.dataset.tipAnchor = ""; txt.append(nm);
        const key = el(edit ? "button" : "span", "kb-key" + (b ? "" : " unset"), b ? b[0] : "—");
        if (edit) {
          key.type = "button"; key.title = "Click to pick a new key on the keyboard";
          key.setAttribute("aria-label", `${name}: ${b ? b[0] : "not bound"}. Change key`);
          key.addEventListener("click", () => kpOpen(id, p));
        }
        let mode;
        if (edit) {
          mode = el("select", "kb-mode " + (b ? b[1] : "")); mode.setAttribute("aria-label", `${name}: how to press`);
          Object.entries(MODE).forEach(([k, v]) => { const o = el("option", null, v); o.value = k; mode.append(o); });
          mode.value = b ? b[1] : ""; mode.disabled = !b;
          mode.addEventListener("change", () => { p.binds[id] = [b[0], mode.value]; setDirty(true); renderKeys(); });
        } else mode = el("span", "kb-mode " + (b ? b[1] : ""), b ? MODE[b[1]] : "");
        const diff = el("span", "kb-diff");
        if (!d) { diff.textContent = "?"; diff.title = "Game default not on file for this action"; diff.classList.add("unknown"); }
        else if (!b || b[0] !== d[0] || b[1] !== d[1]) {
          // a different key, or the same key pressed differently (press / hold / double / release)
          diff.textContent = "●";
          diff.title = `Game default: ${d[0]} · ${MODE[d[1]]}`;
          diff.classList.add("changed");
        }
        r.append(txt, key, mode, diff);
        s.append(r);
      });
      c.append(s);
    });
    grid.append(c);
  });
  sec.append(grid);
  kbBar();
}

/* sub-bar: a preset dropdown (the shared ddSelect, with its groups and actions) and what you can do with the preset */
export let kbInfo = "";
export function kbBar() {
  const bar = $("sub-keybinds"); bar.textContent = "";
  const cur = kbCurrent();
  const dd = ddSelect("Preset", [
    ...(kbUserPresets().length ? [{ group: "My presets" }] : []), ...kbUserPresets().map(p => [p.id, p.name, `Your preset · ${kbChanged(p)} changed from default`]),
    { group: "Game presets" }, ...KB_GAME.map(p => [p.id, p.name, "Game preset · read only"]),
    { sep: true }, { act: "Add preset (a copy of the game default)", run: () => kbNew(KB_GAME[0]) }, { act: `Duplicate “${cur.name}”`, run: () => kbNew(cur) },
  ], () => cur.id, id => { setKbActive(id); renderKeys(); });
  dd.classList.add("kb-dd");
  if (!kbEditable(cur)) dd.querySelector("button").append(el("span", "kb-ro", "game"));

  const left = el("div", "kb-left"); left.append(dd);
  // the same buttons as everywhere: an icon and its word
  if (kbEditable(cur)) {
    left.append(button("Rename", { icon: "edit", tip: "Rename this preset", onClick: () => kbRename(cur) }));
    left.append(button("Share", { icon: "share", tip: "Send this preset to a friend", onClick: () => openShare({ keybinds: [cur.id] }) }));
    left.append(button("Delete", { icon: "trash", tip: "Delete this preset", onClick: () => kbDelete(cur) }));
  } else left.append(button("Duplicate to edit", { icon: "copy", tip: "Make your own copy of this game preset", onClick: () => kbNew(cur) }));
  if (kbInfo) left.append(infoDot(kbInfo));
  bar.append(left);
}

export function kbNew(from) {
  const base = from === KB_GAME[0] ? "New preset" : from.name + " copy";
  let name = base, n = 2; while (kbAll().some(p => p.name === name)) name = `${base} ${n++}`;
  const p = { id: "kb-" + Date.now().toString(36), name, binds: clone(from.binds) };
  kbUserPresets().push(p); setKbActive(p.id);
  setDirty(true); renderKeys();
  toast([el("span", null, "Preset created: "), el("b", null, name)]);
  kbRename(p, true);
}
// rename inline in the heading
export function kbRename(p, fresh) {
  // rename in place of the dropdown
  const h = $("sub-keybinds").querySelector(".kb-dd"); if (!h) return;
  const inp = el("input", "kb-name"); inp.value = p.name; inp.maxLength = 30; inp.setAttribute("aria-label", "Preset name");
  h.replaceWith(inp); inp.focus(); inp.select();
  let finished = false;
  const done = save => {
    if (finished) return; finished = true; // Enter/Esc and the blur that follows must act once
    const v = inp.value.trim();
    if (save && v && v !== p.name) { p.name = v; setDirty(true); }
    renderKeys();
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
  inp.addEventListener("blur", () => done(true));
}
export async function kbDelete(p) {
  const yes = await confirmBox({ title: "Delete this preset?", body: [el("span", "c-name", p.name), el("p", null, "Its keybinds will be gone.")], ok: "Delete preset", danger: true });
  if (!yes) return;
  const list = kbUserPresets(); list.splice(list.indexOf(p), 1);
  setKbActive((list[0] || KB_GAME[0]).id); // with none of yours left, back to the game's default
  setDirty(true); renderKeys();
  toast([el("span", null, "Preset deleted: "), el("b", null, p.name)]);
}

// what this page offers the rest of the hub (app.js calls it through PAGES)
registerPage("keybinds", { draw: renderKeys });
