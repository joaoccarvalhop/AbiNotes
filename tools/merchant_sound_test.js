// How well the Merchant recognises sounds: paste into the console of index.html (Edge/Chrome, online), or load it with
//   await (await fetch("tools/merchant_sound_test.js")).text().then(eval)
// Each of the 76 reference sounds is played through the same path as the game's sound, with white noise under it
// (12 dB and 6 dB quieter than the sound, and almost none), and the first match is checked against the sound played.
// Then the pairs: each item picked up and dropped (read together), and picked up followed by a wrong drop (a sound
// from another item), which should not change the answer.
(async () => {
  const ctx = new AudioContext({ sampleRate: 48000 }); merRate = ctx.sampleRate; merBandEdges = null;
  await merLoadRefs(ctx);
  const raw = {};
  await Promise.all(MER.sounds.flatMap(([id]) => ["u", "d"].map(async act => {
    const b = await ctx.decodeAudioData(await (await fetch(merSoundUrl(id, act))).arrayBuffer());
    const a = b.getChannelData(0), c = b.numberOfChannels > 1 ? b.getChannelData(1) : a, m = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) m[i] = (a[i] + c[i]) / 2;
    raw[id + act] = m;
  })));
  const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  const peakRms = a => { let m = 0; for (let i = 0; i + 1024 <= a.length; i += 512) m = Math.max(m, rms(a.subarray(i, i + 1024))); return m; };
  const fresh = () => Object.assign(merLive, { frames: [], tail: new Float32Array(0), floor: null, wait: null, quiet: 0, prev: null });
  // plays the sounds one after another (a second apart) with noise under them
  const play = (keys, snr) => {
    const g = .5, amp = peakRms(raw[keys[0]]) * g * Math.pow(10, -snr / 20) * Math.sqrt(3), gap = 48000;
    const len = 19200 + keys.reduce((s, k) => s + raw[k].length + gap, 0), buf = new Float32Array(len);
    for (let i = 0; i < len; i++) buf[i] = (Math.random() * 2 - 1) * amp;
    let at = 19200 + Math.floor(Math.random() * 512);
    keys.forEach(k => { const s = raw[k]; for (let i = 0; i < s.length && at + i < len; i++) buf[at + i] += s[i] * g; at += s.length + gap; });
    for (let i = 0; i < len; i += 2048) merFeed(buf.subarray(i, Math.min(len, i + 2048)));
  };
  const run = (snr, kind) => {
    let got = [], ok = 0, miss = 0; const wrong = [];
    const real = merHeard; merHeard = (id, act, s) => got.push({ id, act, s });
    const ids = MER.sounds.map(s => s[0]);
    const cases = kind === "single" ? Object.keys(raw).map(k => ({ keys: [k], want: +k.slice(0, -1) }))
      : ids.map(id => ({ keys: kind === "pair" ? [id + "u", id + "d"] : [id + "u", (id === 10 ? 22 : 10) + "d"], want: id }));
    cases.forEach(c => {
      got = []; fresh(); play(c.keys, snr);
      const r = got[got.length - 1]; // what the page shows at the end
      if (!r) { miss++; wrong.push(c.keys.join("+") + ": nothing"); } else if (r.id === c.want) ok++; else wrong.push(c.keys.join("+") + " shown as " + r.id);
    });
    merHeard = real;
    return { test: kind, noise: snr + " dB under", right: ok, missed: miss, wrong: cases.length - ok - miss, of: cases.length, examples: wrong.slice(0, 6) };
  };
  const out = [run(40, "single"), run(12, "single"), run(6, "single"), run(12, "pair"), run(6, "pair"), run(12, "wrong drop")];
  fresh(); console.table(out);
  return out;
})();
