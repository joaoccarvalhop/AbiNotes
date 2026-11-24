/* The Field Merchant's items (merchant.js), shared by the Merchant and the Smelter pages. Loaded by loadPage in
   app.js after merchant.js. */
import { el } from "../js/base.js";

export const MER = window.ABI_MERCHANT || null;
export const merPic = it => { // the item on its rarity's colour
  const p = el("span", "mc-pic r" + it[1]);
  if (it[8]) { const im = el("img"); im.loading = "lazy"; im.alt = ""; im.referrerPolicy = "no-referrer"; im.src = it[8]; im.addEventListener("error", () => im.remove()); p.append(im); }
  return p;
};
