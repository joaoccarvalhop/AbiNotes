// Builds the letters in merchant-ocr.js (window.ABI_MERCHANT_OCR.letters): how the game draws each letter of the cargo
// names, so the price reader can tell two cargo types with the same price apart by the name on the card.
// Run in the console of index.html served over http, with a market video's frames and reads in tools/out
// (price_frames.py's keep/ and the read/batch_N.json files; set DIR below):
//   await (await fetch("tools/merchant_ocr_letters.js")).text().then(eval)
// 1. The item names of the first two rows of each category's first frame (the grid at the top): names whose marks count
//    the same as their letters give each letter's look (the two most typical of each).
// 2. All the names again, lined up (merSpells' way) against those: letters that fall into two or three marks (m, k, M, W,
//    a wide C or R…) give their looks in pieces.
// 3. Keeps only the letters in the cargo names and returns the JSON to paste after "window.ABI_MERCHANT_OCR.letters = ".
// The output isn't byte for byte the shipped set (that one came from the same frames by hand in the console), but it
// names the sample card's cargo the same way.
(async () => {
  const DIR = "tools/out/prices-2026-11-12";
  const reads = []; for (const n of [1, 2, 3, 4, 5, 6]) { try { reads.push(...await (await fetch(`${DIR}/read/batch_${n}.json`)).json()); } catch (e) { /* fewer batches */ } }
  const firsts = {};
  reads.forEach(fr => { const m = fr.frame.match(/^k_(\d+)_c(\d+)/); if (!m || !fr.category || fr.tab) return; if (!firsts[m[2]] || +m[1] < +firsts[m[2]].frame.slice(2, 5)) firsts[m[2]] = fr; });
  const load = async f => { const im = await createImageBitmap(await (await fetch(f)).blob()); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); return c; };
  const mark = g => ({ v: Array.from(g.v), ar: g.ar, rh: g.rh, top: g.top });
  const lines = [];
  for (const fr of Object.values(firsts)) {
    const m = await load(`${DIR}/keep/${fr.frame}`);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      const it = fr.items[r * 7 + i]; if (!it) continue;
      const img = merGrab({ x: (13 + 206 * i + 4) / m.width, y: [72, 338][r] / m.height, w: 192 / m.width, h: 22 / m.height }, m);
      const line = merGlyphs(img).sort((a, b) => b.length - a.length)[0] || [], chars = [...it.name.replace(/\s/g, "")];
      if (line.length >= chars.length && line.length - chars.length <= 8) lines.push({ chars, marks: line.map(mark) });
    }
  }
  // 1. one mark per letter
  const groups = {};
  lines.filter(l => l.marks.length === l.chars.length).forEach(l => l.marks.forEach((g, k) => (groups[l.chars[k]] = groups[l.chars[k]] || []).push(g)));
  const typical = (list, gap) => list.map(a => [a, list.reduce((s, b) => s + gap(a, b), 0)]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
  const L = {}; Object.entries(groups).forEach(([ch, g]) => { L[ch] = typical(g, merMarkGap).slice(0, 2).map(a => [a]); });
  // 2. letters in pieces: line every name up against the one-mark letters and keep what a letter took 2 or 3 marks for
  const spell = (marks, chars) => { // merSpells, with the path
    const n = marks.length, m = chars.length, INF = 1e9, dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF)), bk = Array.from({ length: n + 1 }, () => []);
    dp[0][0] = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const c0 = dp[i][j]; if (c0 >= INF) continue;
      if (i < n && c0 + .6 < dp[i + 1][j]) { dp[i + 1][j] = c0 + .6; bk[i + 1][j] = [i, j, 0]; }
      if (j < m && c0 + .7 < dp[i][j + 1]) { dp[i][j + 1] = c0 + .7; bk[i][j + 1] = [i, j, -1]; }
      if (j < m) for (let k = 1; k <= 3 && i + k <= n; k++) {
        const looks = (L[chars[j]] || []).filter(l => l.length === k);
        const c = (looks.length ? Math.min(...looks.map(l => l.reduce((s, t, q) => s + merMarkGap(marks[i + q], t), 0) / k)) : (k === 1 ? .45 : .55)) + (k - 1) * .05;
        if (c0 + c < dp[i + k][j + 1]) { dp[i + k][j + 1] = c0 + c; bk[i + k][j + 1] = [i, j, k]; }
      }
    }
    const path = []; let i = n, j = m; while (i > 0 || j > 0) { const b = bk[i][j]; if (!b) break; if (b[2] > 0) path.unshift([j - 1, b[0], b[2]]); [i, j] = b; }
    return { cost: dp[n][m] / Math.max(m, 1), path };
  };
  const pieces = {};
  lines.forEach(({ chars, marks }) => { const { cost, path } = spell(marks, chars); if (cost > .35) return; path.forEach(([j, i, k]) => { if (k > 1) (pieces[chars[j] + k] = pieces[chars[j] + k] || []).push(marks.slice(i, i + k)); }); });
  const seqGap = (a, b) => a.reduce((s, p, q) => s + merMarkGap(p, b[q]), 0);
  Object.entries(pieces).forEach(([key, seqs]) => { if (seqs.length >= 3) (L[key.slice(0, -1)] = L[key.slice(0, -1)] || []).push(typical(seqs, seqGap)[0]); });
  // 3. only the letters cargo names use, written compactly (each mark's 10x14 grid as digits 0-9)
  const need = new Set([...Object.values(MER.types).join("").replace(/\s/g, "")]), q = v => v.map(x => Math.round(x * 9)).join("");
  const out = {}; Object.entries(L).forEach(([ch, looks]) => { if (need.has(ch)) out[ch] = looks.map(seq => seq.map(p => [q(p.v), +p.ar.toFixed(3), +p.rh.toFixed(3), +(p.top || 0).toFixed(3)])); });
  const missing = [...need].filter(c => !out[c]).join("");
  console.log("names read:", lines.length, "letters:", Object.keys(out).length, missing ? "missing: " + missing : "");
  return { missing, json: JSON.stringify(out) };
})();
