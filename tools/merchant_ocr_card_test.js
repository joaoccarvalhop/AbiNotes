// The price reader on a real Merchant screen (tools/merchant_ocr_sample.webp: the price card of a Flammables cargo on
// sale, "16,000 20,000"). Paste into the console of index.html served over http, or load it with
//   await (await fetch("tools/merchant_ocr_card_test.js")).text().then(eval)
// Teaches the box from the coin to the end of the price once, then looks for the card: where it was, moved elsewhere
// over other things, and in a smaller window (a video). What you taught in the page is put back afterwards.
(async () => {
  const keep = JSON.stringify(merOcr);
  const im = await createImageBitmap(await (await fetch("tools/merchant_ocr_sample.webp")).blob()); // (Image.decode stalls in a hidden tab)
  const W = im.width, H = im.height, canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const c = canvas(W, H); c.getContext("2d").drawImage(im, 0, 0);
  merOcr.glyphs = []; merOcr.box = { x: 1418 / W, y: 659 / H, w: 130 / W, h: 20 / H };
  merSetAnchor(c);
  const taught = merTeach(merAfterCoin(c), "16,000 20,000") || "ok";
  const look = (name, cv) => {
    const t0 = performance.now(), hits = merFind(cv), ms = Math.round(performance.now() - t0);
    const words = hits.flatMap(h => h.words), price = words.find(w => w.num === 20000);
    return { picture: name, found: price ? "yes" : "no", reads: (hits.find(h => h.words.length) || { words: [] }).words.map(w => w.txt).join("  "), sure: price ? Math.round(price.score * 100) + "%" : "", ms };
  };
  const moved = canvas(W, H), g = moved.getContext("2d"); g.drawImage(c, 0, 0);
  g.drawImage(c, 1405, 625, 156, 90, 640, 420, 156, 90); g.fillStyle = "#141516"; g.fillRect(1405, 625, 156, 90);
  const small = canvas(1280, Math.round(H * 1280 / W)); small.getContext("2d").drawImage(moved, 0, 0, small.width, small.height);
  const out = [look("as taught", c), look("card moved", moved), look("1280 wide", small)];
  Object.assign(merOcr, JSON.parse(keep)); ls.set(K.merOcr, merOcr);
  console.log("taught: " + taught); console.table(out);
  return { taught, out };
})();
