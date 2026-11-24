/* Shared pieces of interface: overlays (wiring, closing, opening one from inside another with ← Back), the confirmation
   box, the picker with pictures, dropdowns (ddSelect), filter boxes and range filters, thumbnails. */
import { $, clearButton, el, icon, motion, norm, reduceMotion } from "./base.js";

/* ---------- overlays: closing and wiring, the same for all of them ---------- */
// closes with the short fade-out (at once with reduced motion, or when asked to)
export function closeDialog(dlg, now) {
  if (!dlg.open) return;
  if (now || reduceMotion) { dlg.close(); return; }
  dlg.classList.add("closing");
  setTimeout(() => { dlg.close(); dlg.classList.remove("closing"); }, 150);
}
// its X, Esc (back to the overlay you came from first, if any) and a click on the dimmed area all close it
export function wireDialog(dlg, close, xId) {
  if (xId) $(xId).addEventListener("click", () => close());
  dlg.addEventListener("cancel", e => { e.preventDefault(); navBack() || close(); });
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
}

/* ---------- overlay navigation: open one overlay from inside another, then ← Back ----------   Every detail overlay opens through present(dialog, label, reopen). If another overlay is showing,
   it is remembered and swapped out, and the new one gets a "← Back to …" button (Esc does the same). */
export const navStack = [];
export let navCur = null, navReturning = false, navReplace = false, navSwapping = false;
// another module refreshes the overlay on show in place (not a new step back)
export function setNavReplace(v) { navReplace = v; }
export function present(dlg, label, reopen) {
  const prev = navCur;
  const switching = prev && prev.dlg.open && !(prev.dlg === dlg && prev.label === label);
  if (switching && !navReturning && !navReplace) navStack.push(prev);
  navReturning = false; navReplace = false;
  navCur = { dlg, label, reopen };
  navSwapping = true;
  document.querySelectorAll("dialog.modal[open]").forEach(d => { if (d !== dlg && d.id !== "confirm") { d.close(); d.classList.remove("closing"); } });
  navSwapping = false;
  // the back button sits above the title
  const head = dlg.querySelector(".m-head");
  let back = head.querySelector(".nav-back");
  if (navStack.length) {
    if (!back) { back = el("button", "nav-back"); back.type = "button"; back.addEventListener("click", navBack); head.prepend(back); }
    back.textContent = "← Back to " + navStack[navStack.length - 1].label;
  } else if (back) back.remove();
  // coming from another overlay it reads as the same one: same size, no opening animation, only the content changes
  const fromOther = switching && prev.dlg !== dlg;
  const wasOpen = dlg.open;
  if (!wasOpen) { dlg.classList.remove("closing"); dlg.classList.toggle("swapin", !!fromOther); dlg.showModal(); }
  if (fromOther || (wasOpen && (switching || prev?.label !== label))) motion.in(dlg.querySelector(".gm-body, .m-body")); // the new content fades in (shared motion)
}
// returns false when there is nothing to go back to
export function navBack() {
  const p = navStack.pop(); if (!p) return false;
  navReturning = true; p.reopen();
  return true;
}
export function navReset() { navStack.length = 0; navCur = null; document.querySelectorAll(".nav-back").forEach(b => b.remove()); }
// however a detail overlay closes (X, backdrop, a second Esc the browser won't let us stop), forget the trail
// (the close event comes a moment later, so a swap is told apart by the dialog: only the one on show resets)
["gearmodal", "lomodal", "pricemodal", "sharemodal", "about", "meritem", "searchall", "merocr", "loedit", "addmodal", "kbpick"].forEach(id => $(id).addEventListener("close", e => { e.target.classList.remove("swapin"); if (!navSwapping && (!navCur || navCur.dlg === e.target) && !e.target.open) navReset(); }));


// a dropdown like Order in Builds
// options: [value, label] or [value, label, a short line under it]. One click listener on the page closes whichever is open
// (one per dropdown would pile up: some are rebuilt on every redraw)
export const ddOpen = new Set();
document.addEventListener("click", e => ddOpen.forEach(d => { if (!d.contains(e.target)) d.close(); }));
// a floating menu would be left behind when the page or its filter box scrolls: close it instead
addEventListener("scroll", e => ddOpen.forEach(d => { if (!d.contains(e.target)) d.close(); }), true);
addEventListener("resize", () => ddOpen.forEach(d => d.close()));
export function ddSelect(label, options, get, set) {
  const dd = el("div", "dd"), btn = el("button"), menu = el("ul");
  btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", label);
  btn.append(el("span", "k", label), el("span", "v"));
  menu.setAttribute("role", "listbox"); menu.tabIndex = -1; menu.hidden = true;
  // options: [value, label, sub] rows; also { group: "Title" } headers, { sep: true } lines and { act: "Label", run } actions (they do, not pick)
  const items = [];
  options.forEach(o => {
    if (!Array.isArray(o)) {
      if (o.group) { const li = el("li", "dd-group", o.group); li.setAttribute("role", "presentation"); menu.append(li); }
      else if (o.sep) menu.append(el("li", "dd-sep"));
      else if (o.act) { const li = el("li", "dd-act", o.act); li.setAttribute("role", "option"); li._run = o.run; menu.append(li); items.push(li); }
      return;
    }
    const [v, t, sub] = o, li = el("li", null, t); if (sub) li.append(el("small", null, sub)); li.setAttribute("role", "option"); li.dataset.value = v; li.dataset.label = t; menu.append(li); items.push(li);
  });
  let active = 0;
  const values = () => items.filter(li => !li._run);
  const sync = () => { const cur = values().find(li => li.dataset.value === get()) || values()[0]; btn.querySelector(".v").textContent = cur.dataset.label; values().forEach(li => li.setAttribute("aria-selected", String(li === cur))); };
  const mark = () => items.forEach((li, i) => li.classList.toggle("active", i === active));
  const close = focus => { ddOpen.delete(dd); dd.classList.remove("open"); menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); };
  const open = () => {
    ddOpen.add(dd); dd.classList.add("open"); menu.hidden = false; btn.setAttribute("aria-expanded", "true");
    // inside a filter box that scrolls sideways the menu would be cut off, so it floats over the page, under its button
    if (dd.closest(".lo-filters")) {
      const r = btn.getBoundingClientRect();
      const top = r.bottom + 4, right = Math.min(innerWidth - 8, r.right);
      Object.assign(menu.style, { position: "fixed", top: top + "px", left: "auto", right: innerWidth - right + "px", minWidth: r.width + "px" });
      // a parent with a transform moves "fixed" off the page's corner: measure and correct by that much
      const m = menu.getBoundingClientRect();
      menu.style.top = 2 * top - m.top + "px"; menu.style.right = innerWidth - right - (right - m.right) + "px";
    } else if (dd.closest(".mc-side, .mp-col")) {
      // the Merchant's filters column scrolls inside itself: the menu floats over the page, under its button (above it when there's no room)
      const r = btn.getBoundingClientRect(), below = innerHeight - r.bottom - 12, h = Math.min(320, Math.max(below, r.top - 12));
      const mw = Math.max(r.width, 64) + "px"; // (a small chip's menu still gets room for its words)
      Object.assign(menu.style, { position: "fixed", left: r.left + "px", right: "auto", width: mw, minWidth: mw, maxWidth: mw, maxHeight: h + "px", zIndex: 60 });
      if (below >= Math.min(320, menu.scrollHeight) || below >= r.top) { menu.style.top = r.bottom + 4 + "px"; menu.style.bottom = "auto"; }
      else { menu.style.top = "auto"; menu.style.bottom = innerHeight - r.top + 4 + "px"; }
    }
    active = Math.max(0, items.findIndex(li => li.dataset.value === get())); mark(); menu.focus();
  };
  dd.close = close;
  const pick = li => { close(true); if (li._run) { li._run(); return; } const v = li.dataset.value; if (v !== get()) { set(v); sync(); } };
  btn.addEventListener("click", () => (menu.hidden ? open() : close()));
  items.forEach((li, i) => { li.addEventListener("click", () => pick(li)); li.addEventListener("mousemove", () => { active = i; mark(); }); });
  menu.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { active = (active + 1) % items.length; mark(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + items.length) % items.length; mark(); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { pick(items[active]); e.preventDefault(); }
    else if (e.key === "Escape" || e.key === "Tab") close(e.key === "Escape");
  });
  dd.append(btn, menu); dd.sync = sync; sync();
  return dd;
}

// the filter box every section uses (the Loadouts look): small labelled groups side by side; "Sort by" sits last, on the right
// on a phone the box would fill the screen: it folds behind a "Filters" button (shown only there, by CSS); open or shut
// is kept for the visit, so a section drawn again keeps it as it was
export let filtersOpen = false;
export function filterBox() {
  const box = el("div", "lo-filters" + (filtersOpen ? " open" : ""));
  const fold = el("button", "f-fold"); fold.type = "button"; fold.append(icon("tiers"), el("span", null, "Filters"));
  fold.setAttribute("aria-expanded", String(filtersOpen));
  fold.addEventListener("click", () => { filtersOpen = !filtersOpen; box.classList.toggle("open", filtersOpen); fold.setAttribute("aria-expanded", String(filtersOpen)); });
  box.append(fold);
  box.group = (label, node, tip, cls) => { const g = el("div", "lo-f" + (cls ? " " + cls : "")), h = el("small", null, label); if (tip) h.dataset.tip = tip; g.append(h, node); box.append(g); return g; };
  box.sort = dd => box.group("Sort by", dd, null, "f-sort");
  // Clear: right after the last filter, on the buttons' line, only while something is filtered (call it after the groups, before Sort by)
  box.clear = fn => {
    const b = clearButton(fn);
    const g = box.group(" ", b, null, "f-clearg"); return g;
  };
  return box;
}
// a money range with two handles, for any filter box (Loadouts' total cost, Gear's prices): "Any" until you narrow it.
// onChange(lo, hi) gets hi = null when the top handle is at the end (no upper limit); set(lo, hi, top, step) draws it
// exact: a range of two real values (Trading's prices): the label always shows both ends, onChange always gets both, and set()
// takes a bottom too (the scale needn't start at 0)
export function rangeFilter(what, fmt, onChange, { exact = false } = {}) {
  const val = el("span", "lo-rv"), range = el("div", "lo-range"), fill = el("span", "fill");
  const a = el("input"), b = el("input");
  [a, b].forEach(r => { r.type = "range"; r.min = 0; });
  a.setAttribute("aria-label", "Lowest " + what); b.setAttribute("aria-label", "Highest " + what);
  range.append(el("span", "track"), fill, a, b);
  let top = 1, bottom = 0;
  const draw = (lo, hi) => {
    a.value = lo; b.value = hi;
    const f = v => (v - bottom) / ((top - bottom) || 1);
    a.style.zIndex = f(lo) > .5 ? 3 : 1; // so the low handle can still be grabbed at the right end
    fill.style.left = `calc(6px + (100% - 12px) * ${f(lo)})`; fill.style.right = `calc(6px + (100% - 12px) * ${1 - f(hi)})`;
    val.textContent = exact ? (lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`)
      : !lo && hi >= top ? "Any" : !lo ? `Up to ${fmt(hi)}` : hi >= top ? `${fmt(lo)} or more` : `${fmt(lo)} – ${fmt(hi)}`;
  };
  const onRange = e => {
    let lo = +a.value, hi = +b.value;
    if (lo > hi) { if (e.target === a) lo = hi; else hi = lo; }
    draw(lo, hi); onChange(lo, exact ? hi : hi >= top ? null : hi);
  };
  a.addEventListener("input", onRange); b.addEventListener("input", onRange);
  const node = el("div", "lo-cost-f"); node.append(range, val);
  node.set = (lo, hi, newTop, step, newBottom = 0) => {
    top = newTop; bottom = newBottom; a.min = b.min = bottom; a.max = b.max = top; a.step = b.step = step;
    const clamp = v => Math.max(bottom, Math.min(v, top));
    draw(clamp(lo || 0), hi == null ? top : clamp(hi));
  };
  return node;
}

/* ---------- picker: a button that opens a searchable list with pictures ---------- */
export function makePicker(host, { placeholder, groups, none, onChange }) {
  let value = "";
  const btn = el("button", "pk-btn"); btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox");
  const pop = el("div", "pk-pop"); pop.hidden = true;
  const q = el("input", "pk-q"); q.type = "search"; q.placeholder = "Search…"; q.autocomplete = "off";
  const listEl = el("div", "pk-list"); listEl.setAttribute("role", "listbox");
  pop.append(q, listEl);
  host.append(btn, pop);
  let active = -1;
  const item = v => { for (const g of groups()) for (const it of g.items) if (it.value === v) return it; return null; };
  const face = () => {
    btn.textContent = "";
    const it = item(value);
    if (!it) { btn.append(el("span", "g-img none", "+"), el("span", "pk-ph", value ? value : (none && !value ? none : placeholder))); return; }
    const txt = el("span", "g-label"); txt.append(el("b", null, it.title), el("small", null, it.sub || ""));
    btn.append(it.img(), txt);
    if (it.tier) btn.append(el("span", "g-tier t" + it.tier, "T" + it.tier));
  };
  const opts = () => [...listEl.querySelectorAll(".pk-opt")];
  const fill = () => {
    listEl.textContent = "";
    const v = norm(q.value.trim());
    if (none) {
      const o = el("div", "pk-opt pk-none"); o.dataset.v = ""; o.append(el("span", "g-img none", "—"), el("span", "g-label", none));
      o.setAttribute("aria-selected", String(!value)); o.addEventListener("click", () => pick("")); listEl.append(o);
    }
    groups().forEach(g => {
      const items = g.items.filter(it => !v || norm(it.title + " " + (it.sub || "")).includes(v));
      if (!items.length) return;
      listEl.append(el("div", "wp-cat", g.label));
      items.forEach(it => {
        const o = el("div", "pk-opt"); o.dataset.v = it.value; o.setAttribute("role", "option");
        o.setAttribute("aria-selected", String(it.value === value));
        const txt = el("span", "g-label"); txt.append(el("b", null, it.title), el("small", null, it.sub || ""));
        o.append(it.img(), txt);
        if (it.tier) o.append(el("span", "g-tier t" + it.tier, "T" + it.tier));
        o.addEventListener("click", () => pick(it.value));
        listEl.append(o);
      });
    });
    if (!opts().length) listEl.append(el("div", "wp-none", "Nothing matches your search."));
    active = Math.max(0, opts().findIndex(o => o.getAttribute("aria-selected") === "true"));
    mark();
  };
  const mark = () => { opts().forEach((o, i) => o.classList.toggle("active", i === active)); const a = opts()[active]; if (a) a.scrollIntoView({ block: "nearest" }); };
  // fixed position so the list is never cut off by the overlay
  const place = () => {
    const r = btn.getBoundingClientRect();
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const h = Math.min(380, Math.max(below, above));
    pop.style.left = r.left + "px"; pop.style.width = Math.max(r.width, 320) + "px";
    pop.style.maxHeight = h + "px";
    if (below >= 260 || below >= above) { pop.style.top = r.bottom + 4 + "px"; pop.style.bottom = "auto"; }
    else { pop.style.top = "auto"; pop.style.bottom = innerHeight - r.top + 4 + "px"; }
  };
  const open = () => { document.querySelectorAll(".pk-pop:not([hidden])").forEach(p => p !== pop && p._close && p._close()); pop.hidden = false; host.classList.add("open"); q.value = ""; fill(); place(); q.focus(); };
  const close = focus => { pop.hidden = true; host.classList.remove("open"); if (focus) btn.focus(); };
  pop._close = close;
  const pick = v => { value = v; face(); close(true); onChange && onChange(v); };
  btn.addEventListener("click", () => (pop.hidden ? open() : close()));
  q.addEventListener("input", () => { fill(); active = opts().length ? 0 : -1; mark(); });
  q.addEventListener("keydown", e => {
    const n = opts().length;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(n - 1, active + 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); const o = opts()[active]; if (o) pick(o.dataset.v); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
  });
  document.addEventListener("click", e => { if (!host.contains(e.target)) close(); });
  addEventListener("resize", () => { if (!pop.hidden) place(); });
  face();
  return { get: () => value, set: v => { value = v || ""; face(); }, isOpen: () => !pop.hidden, close, refresh: face };
}


export function thumb(g) {
  const t = el("div", "thumb");
  const ph = () => { const p = el("div", "ph", g.name.toUpperCase()); t.textContent = ""; t.append(p); };
  if (g.image) {
    const img = new Image(); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
    img.addEventListener("load", () => {
      if (img.naturalWidth > img.naturalHeight * 1.25) { img.classList.add("flat"); t.classList.add("shot"); }
      img.classList.add("ok");
    });
    img.addEventListener("error", ph);
    img.src = g.image; t.append(img);
  } else ph();
  return t;
}


/* ---------- confirmation overlay ---------- */
// resolves true when the person confirms, false on cancel / Esc / click outside
export function confirmBox({ title, body, ok, cancel = "Cancel", danger = false }) {
  const dlg = $("confirm");
  $("c-title").textContent = title;
  const b = $("c-body"); b.textContent = ""; b.append(...body);
  const okBtn = $("c-ok"), noBtn = $("c-cancel");
  okBtn.textContent = ok; noBtn.textContent = cancel;
  okBtn.className = danger ? "danger" : "primary";
  dlg.classList.toggle("danger", danger);
  dlg.classList.remove("closing");
  return new Promise(resolve => {
    const finish = v => {
      okBtn.onclick = noBtn.onclick = dlg.oncancel = dlg.onclick = null;
      const done = () => { dlg.close(); dlg.classList.remove("closing"); resolve(v); };
      if (reduceMotion) done(); else { dlg.classList.add("closing"); setTimeout(done, 150); }
    };
    okBtn.onclick = () => finish(true);
    noBtn.onclick = () => finish(false);
    dlg.oncancel = e => { e.preventDefault(); finish(false); };
    dlg.onclick = e => { if (e.target === dlg) finish(false); };
    dlg.showModal();
    (danger ? noBtn : okBtn).focus(); // deleting needs a deliberate second click
  });
}

// a small ⓘ that keeps sources, dates and how-tos out of the way until you hover it
export function infoDot(text, href) {
  const i = el(href ? "a" : "span", "g-info", "i");
  if (href) { i.href = href; i.target = "_blank"; i.rel = "noopener"; }
  i.dataset.tip = text; i.setAttribute("aria-label", text.replace(/\n/g, ". ")); i.tabIndex = 0;
  return i;
}

export let toastT = 0;
// shown as a popover (top layer), so it is seen above an open overlay; reopened each time so it sits above the newest one
export function toast(nodes) {
  const t = $("toast"); t.textContent = ""; t.append(...nodes);
  const show = on => { if (t.showPopover) { try { if (t.matches(":popover-open")) t.hidePopover(); if (on) t.showPopover(); } catch { /* not supported */ } } else t.hidden = !on; };
  show(true);
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  clearTimeout(toastT); toastT = setTimeout(() => show(false), 4000);
}
