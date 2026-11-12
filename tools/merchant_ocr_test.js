// How well the Merchant's price reader reads: paste into the console of index.html, or load it with
//   await (await fetch("tools/merchant_ocr_test.js")).text().then(eval)
// Draws prices the way a game might (light text on a dark box, a stray line under it), teaches three of them,
// then reads others, also bigger. What you taught in the page is put back afterwards.
(() => {
  const pic = (txt, size = 20) => {
    const W = 240, H = 64, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    g.fillStyle = "#1b1c1e"; g.fillRect(0, 0, W, H); g.fillStyle = "#e8d9a0"; g.font = `bold ${size}px Segoe UI, Arial`; g.fillText(txt, 14, 40);
    g.fillStyle = "#555"; g.fillRect(160, 56, 60, 2);
    const d = g.getImageData(0, 0, W, H).data, grey = new Float32Array(W * H);
    for (let i = 0; i < grey.length; i++) grey[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    return { w: W, h: H, grey };
  };
  const keep = JSON.stringify(merOcr); merOcr.glyphs = [];
  const taught = ["70,000", "12,345", "6,789"].map(s => s + ": " + (merTeach(pic(s), s) || "ok"));
  const read = (s, size) => { const r = merRead(pic(s, size)); return { price: s, size, read: r ? r.txt : "nothing", sure: r ? Math.round(r.score * 100) + "%" : "", right: !!r && r.txt === s }; };
  const out = ["250,000", "470,000", "15,000", "1,000,000", "98,765", "550,000"].flatMap(s => [read(s, 20), read(s, 24)]);
  Object.assign(merOcr, JSON.parse(keep)); ls.set(K.merOcr, merOcr);
  console.log(taught.join("\n")); console.table(out);
  return { taught, right: out.filter(x => x.right).length + " of " + out.length, out };
})();
