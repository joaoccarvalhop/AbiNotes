// Builds merchant-ocr.js: the price reader's built-in digits and coin, so nobody has to teach it (the game's font never
// changes; the game draws each digit the same way every time). Run in the console of index.html served over http:
//   await (await fetch("tools/merchant_ocr_defaults.js")).text().then(eval)
// 1. Digits and commas from a market screen whose prices are known (tools/merchant_ocr_market.jpg: the game at
//    1920x1080, the market grid as cut by price_frames.py, 1460x880 from 370,110). Its 14 prices hold every digit.
// 2. The digits and the coin of a cargo's price card (tools/merchant_ocr_sample.webp, "16,000 20,000").
// 3. Reads that card again with only these, as is and moved elsewhere, and prints the file's text to save as
//    merchant-ocr.js (identical glyphs are kept once). What you taught in the page is put back afterwards.
(async () => {
  const keep = JSON.stringify(merOcr);
  const load = async f => { const im = await createImageBitmap(await (await fetch(f)).blob()); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); return c; };
  const market = await load("tools/merchant_ocr_market.jpg"), card = await load("tools/merchant_ocr_sample.webp");
  const teach = (src, box, text) => { merOcr.box = box; merSetAnchor(src); return merTeach(merAfterCoin(src), text); };
  merOcr.glyphs = []; const errs = [];
  // every price on the market picture first: two rows of seven cards 206 px apart, each strip from the coin on
  const prices = [["888", "936", "1,092", "494", "518", "1,162", "1,176"], ["1,064", "1,078", "518", "1,092", "1,185", "1,080", "1,185"]];
  prices.forEach((row, r) => row.forEach((p, i) => {
    const e = teach(market, { x: (13 + 206 * i + 58) / market.width, y: [296, 562][r] / market.height, w: 120 / market.width, h: 24 / market.height }, p);
    if (e) errs.push(p + ": " + e);
  }));
  // then the card (its own look of 0, 1, 2, 6 and the comma: last, since Teach keeps the newest few of each character),
  // and its coin: the one the reader looks for in game
  const W = card.width, H = card.height, cardBox = { x: 1418 / W, y: 659 / H, w: 130 / W, h: 20 / H };
  const e0 = teach(card, cardBox, "16,000 20,000"); if (e0) errs.push("card: " + e0);
  const box = merOcr.box, A = merOcr.anchor;
  const q = v => Array.from(v, x => Math.round(x * 9)).join(""), hex = a => a.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
  const seen = new Set(), glyphs = merOcr.glyphs.map(g => [g.ch, q(g.v), +g.ar.toFixed(3), +g.rh.toFixed(3), +(g.top || 0).toFixed(3)])
    .filter(g => { const k = g.join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
  const data = { v: 1, fw: A.fw, box: Object.fromEntries(Object.entries(box).map(([k, x]) => [k, +x.toFixed(5)])),
    anchor: { aw: A.aw, bw: A.bw, bh: A.bh, tw: A.tw, th: A.th, t: hex(A.t), fW: A.fW, fH: A.fH, f: hex(A.f) }, glyphs };
  // read the card with only these, as index.html will (merBuiltin), where it was and moved over other things
  window.ABI_MERCHANT_OCR = data; merOcr.glyphs = []; merUseBuiltin();
  const moved = document.createElement("canvas"); moved.width = W; moved.height = H; const g = moved.getContext("2d");
  g.drawImage(card, 0, 0); g.drawImage(card, 1405, 625, 156, 90, 640, 420, 156, 90); g.fillStyle = "#141516"; g.fillRect(1405, 625, 156, 90);
  const read = cv => { const h = merFind(cv).filter(h => h.words.length)[0]; return h ? h.words.map(w => `${w.txt} ${Math.round(w.score * 100)}%`).join("  ") : "nothing"; };
  const out = { "as taught": read(card), moved: read(moved) };
  Object.assign(merOcr, JSON.parse(keep)); ls.set(K.merOcr, merOcr);
  const text = "window.ABI_MERCHANT_OCR = " + JSON.stringify(data) + ";\n";
  console.log("problems:", errs.join("; ") || "none"); console.table(out);
  return { errs, out, glyphs: glyphs.length, text };
})();
