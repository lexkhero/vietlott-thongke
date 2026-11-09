/* Sinh tự động bởi mobile/build.js từ js/tool/stats.js và js/tool/ticket.js - không sửa tay. */
(function () {
  'use strict';
  var defs = {
    './stats': function (module, exports, require) {
'use strict';
/*
 * stats.js - Thống kê cho các kỳ quay Vietlott (không phụ thuộc DB).
 *
 * Dữ liệu vào: draws = [{ no, date, main:[...], bonus:[...] }] theo kỳ tăng dần.
 * game = { nMain: k, max: M, hasBonus, bonusMax, label } - mỗi kỳ rút k số khác nhau trong 1..M.
 *
 * Phương pháp (đều là phương pháp chuẩn, được kiểm chứng bằng mô phỏng trong test/verify-stats.js):
 *  - Các số có ra đều không: kiểm định khi bình phương Pearson có hiệu chỉnh vì mỗi kỳ rút không lặp lại,
 *    J = (M-1)/(M-k) * Σ(O-E)²/E  ~ khi bình phương bậc M-1 (Joe 1993; Genest, Lockhart & Stephens 2002).
 *  - Số ra nhiều/ít nhất, cặp số: kiểm định nhị thức chính xác + hiệu chỉnh Bonferroni.
 *  - Ổn định theo thời gian: cộng J của từng giai đoạn (cách làm của Spiegelhalter với xổ số Anh).
 *  - Khoảng cách giữa các lần ra: kiểm định khoảng cách (Knuth) so với phân phối hình học,
 *    dùng kỳ vọng chính xác trong cửa sổ W kỳ: M (W-g) p² (1-p)^(g-1).
 *  - Kỷ lục vắng mặt: xấp xỉ Poisson cho dãy vắng dài nhất (sai lệch vài % so với mô phỏng).
 *  - Chẵn/lẻ, số lặp lại kỳ trước: phân phối siêu bội. Tổng các số: phân phối chính xác (quy hoạch động).
 *  - Kết luận chung: hiệu chỉnh Holm (1979) vì làm nhiều phép kiểm định cùng lúc.
 */

// ----------------------------------------------------------------- Toán cơ bản
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Hàm gamma không hoàn chỉnh chính quy (phần đuôi trên) Q(a, x).
function gammaQ(a, x) {
  if (x <= 0) return 1;
  const front = Math.exp(-x + a * Math.log(x) - lgamma(a));
  if (x < a + 1) { // chuỗi cho P rồi lấy 1 - P
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 2000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return Math.max(0, 1 - sum * front);
  }
  // phân số liên tục (Lentz)
  const TINY = 1e-300;
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 2000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return front * h;
}

const chi2Sf = (stat, df) => (stat <= 0 ? 1 : gammaQ(df / 2, stat / 2)); // P(X >= stat)
const normP2 = (z) => gammaQ(0.5, (z * z) / 2);                          // 2 phía: P(|Z| >= |z|)
const normCdf = (z) => (z >= 0 ? 1 - normP2(z) / 2 : normP2(-z) / 2);

// Xác suất 2 phía CHÍNH XÁC cho X ~ Nhị thức(n, q) khi quan sát được c.
function binomP2(c, n, q) {
  if (q <= 0 || q >= 1) return 1;
  const mean = n * q, r = q / (1 - q);
  const logPmf = (i) => lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) + i * Math.log(q) + (n - i) * Math.log(1 - q);
  let tail = 0;
  if (c >= mean) {
    let t = Math.exp(logPmf(c));
    for (let i = c; i <= n; i++) {
      tail += t;
      t *= ((n - i) / (i + 1)) * r;
      if (t < tail * 1e-17) break;
    }
  } else {
    let t = Math.exp(logPmf(c));
    for (let i = c; i >= 0; i--) {
      tail += t;
      t *= (i / (n - i + 1)) / r;
      if (t < tail * 1e-17) break;
    }
  }
  return Math.min(1, 2 * tail);
}

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
// Cơ hội trúng giải cao nhất của một vé: 1 / jackpotOdds. Nếu người chơi tự chọn thêm số đặc biệt
// riêng (Lotto 5/35: 1..12) thì giải cao nhất cần trùng cả số đó -> nhân thêm bonusMax.
const jackpotOdds = (game) =>
  comb(game.max, game.nMain) * (game.hasBonus && game.bonusMax && game.bonusMax !== game.max ? game.bonusMax : 1);
const hyperPmf = (N, K, n, j) => (comb(K, j) * comb(N - K, n - j)) / comb(N, n);

// Kiểm định phù hợp (khi bình phương): gộp các ô liền nhau cho đến khi kỳ vọng >= minExp.
function gof(obs, probs, total, minExp = 5) {
  const bins = [];
  let o = 0, e = 0;
  for (let i = 0; i < obs.length; i++) {
    o += obs[i]; e += probs[i] * total;
    if (e >= minExp) { bins.push({ obs: o, exp: e }); o = 0; e = 0; }
  }
  if (o > 0 || e > 0) {
    if (bins.length) { bins[bins.length - 1].obs += o; bins[bins.length - 1].exp += e; }
    else bins.push({ obs: o, exp: e });
  }
  const stat = bins.reduce((s, b) => s + (b.obs - b.exp) ** 2 / b.exp, 0);
  const df = bins.length - 1;
  return { stat, df, p: df > 0 ? chi2Sf(stat, df) : 1 };
}

// Hiệu chỉnh Holm (1979) cho m phép kiểm định cùng lúc; trả về mảng xác suất đã hiệu chỉnh (đúng thứ tự vào).
function holm(ps) {
  const m = ps.length, order = ps.map((p, i) => [p == null ? 1 : p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m);
  let run = 0;
  order.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}

// Phân phối CHÍNH XÁC của tổng k số khác nhau rút từ 1..M: mảng xác suất theo tổng (quy hoạch động).
function sumProbs(M, k) {
  const maxS = (k * (2 * M - k + 1)) / 2;
  const dp = Array.from({ length: k + 1 }, () => new Float64Array(maxS + 1));
  dp[0][0] = 1;
  for (let n = 1; n <= M; n++) {
    for (let j = Math.min(k, n); j >= 1; j--) for (let s = maxS; s >= n; s--) dp[j][s] += dp[j - 1][s - n];
  }
  const total = comb(M, k);
  return Array.from(dp[k], (x) => x / total);
}

// Kiểm định khoảng cách (Knuth): gaps = khoảng cách (số kỳ) giữa 2 lần ra liên tiếp của cùng một số.
// Kỳ vọng chính xác trong cửa sổ W kỳ cho độ dài g: M (W-g) p² (1-p)^(g-1).
function gapTest(gaps, W, M, k) {
  const p = k / M, G = Math.max(1, Math.min(W - 1, 80));
  const e = [];
  for (let g = 1; g <= G; g++) e.push((W - g) * p * p * (1 - p) ** (g - 1));
  let tail = 0, meanNum = 0, meanDen = 0;
  for (let g = 1; g < W; g++) {
    const x = (W - g) * p * p * (1 - p) ** (g - 1);
    if (g > G) tail += x;
    meanNum += g * x; meanDen += x;
  }
  e.push(tail);
  const tot = e.reduce((a, b) => a + b, 0), prob = e.map((x) => x / tot);
  const obs = new Array(G + 1).fill(0);
  for (const g of gaps) obs[Math.min(g, G + 1) - 1]++;
  const r = gaps.length ? gof(obs, prob, gaps.length) : { stat: 0, df: 0, p: 1 };
  return { ...r, obs, prob, meanTheory: meanDen ? meanNum / meanDen : 1 / p };
}

// ----------------------------------------------------------------- Định dạng chữ số kiểu Việt Nam
const fi = (x) => Math.round(x).toLocaleString('vi-VN');
const fd = (x, d = 1) => Number(x).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fpct = (x) => { const v = x * 100; return (v >= 10 ? fd(v, 0) : v >= 1 ? fd(v, 1) : fd(v, 2)) + '%'; };
const fdate = (s) => (s ? s.split('-').reverse().join('/') : '');

// ----------------------------------------------------------------- Kiểm định đều
// Số lần mỗi số xuất hiện có đều không? (đã hiệu chỉnh rút không hoàn lại, bậc tự do M-1)
function uniformityTest(draws, game) {
  const k = game.nMain, M = game.max, W = draws.length, p = k / M;
  const count = new Array(M + 1).fill(0);
  for (const d of draws) for (const n of d.main) count[n]++;
  const e = W * p;
  let ss = 0, maxZ = 0, maxN = 1, minP = 1;
  for (let n = 1; n <= M; n++) {
    ss += (count[n] - e) ** 2;
    const z = (count[n] - e) / Math.sqrt(W * p * (1 - p));
    if (Math.abs(z) > Math.abs(maxZ)) { maxZ = z; maxN = n; }
    minP = Math.min(minP, binomP2(count[n], W, p));
  }
  const stat = ((M - 1) / M) * (ss / (W * p * (1 - p)));
  const pMax = Math.min(1, M * minP); // Bonferroni: trong M số, số lệch nhất có đáng ngờ không
  return { stat, df: M - 1, p: chi2Sf(stat, M - 1), maxZ, maxN, pMaxAdj: pMax, count };
}

// ----------------------------------------------------------------- Phân tích đầy đủ
const LEVEL_TEXT = { ok: 'Bình thường', watch: 'Cần theo dõi', alert: 'Bất thường' };

function analyze(allDraws, game, opts = {}) {
  const last = opts.last || 0;
  const draws = last > 0 ? allDraws.slice(-last) : allDraws;
  const W = draws.length, k = game.nMain, M = game.max;
  if (W < 10) return { error: 'Quá ít kỳ để thống kê (cần ít nhất 10 kỳ).' };
  const p0 = k / M, e0 = W * p0, sd0 = Math.sqrt(W * p0 * (1 - p0));

  // --- Tần suất, khoảng cách, kỷ lục vắng của từng số
  const count = new Array(M + 1).fill(0), bonusCount = new Array(Math.max(M, game.bonusMax || 0) + 1).fill(0);
  const lastIdx = new Array(M + 1).fill(-1), gapSum = new Array(M + 1).fill(0), gapN = new Array(M + 1).fill(0);
  const longest = new Array(M + 1).fill(-1), longestAt = new Array(M + 1).fill(null);
  const gaps = [];
  draws.forEach((d, t) => {
    for (const n of d.main) {
      const run = lastIdx[n] >= 0 ? t - lastIdx[n] - 1 : t; // số kỳ vắng liền trước lần ra này
      if (lastIdx[n] >= 0) { const g = t - lastIdx[n]; gaps.push(g); gapSum[n] += g; gapN[n]++; }
      if (run > longest[n]) { longest[n] = run; longestAt[n] = { from: t - run, to: t - 1, current: false }; }
      count[n]++; lastIdx[n] = t;
    }
    for (const n of d.bonus) if (n >= 1 && n < bonusCount.length) bonusCount[n]++;
  });
  const numbers = [];
  for (let n = 1; n <= M; n++) {
    const wait = lastIdx[n] >= 0 ? W - 1 - lastIdx[n] : W;
    if (wait > longest[n]) { longest[n] = wait; longestAt[n] = { from: W - wait, to: W - 1, current: true }; }
    numbers.push({
      n, count: count[n], expected: e0, rate: count[n] / W, devPct: (count[n] - e0) / e0,
      z: (count[n] - e0) / sd0, unusual: Math.min(1, M * binomP2(count[n], W, p0)) < 0.05,
      wait, avgGap: gapN[n] ? gapSum[n] / gapN[n] : null, maxWait: longest[n],
      lastNo: lastIdx[n] >= 0 ? draws[lastIdx[n]].no : null,
      lastDate: lastIdx[n] >= 0 ? draws[lastIdx[n]].date : null,
      bonus: bonusCount[n] || 0,
    });
  }
  const byCount = numbers.slice().sort((a, b) => b.count - a.count || a.n - b.n);
  byCount.forEach((x, i) => { x.rank = i + 1; });
  const hi = byCount[0], lo = byCount[M - 1];

  const tests = [];
  const add = (t) => tests.push(t);

  // 1) Các số có ra đều không
  const uni = uniformityTest(draws, game);
  add({
    key: 'uniform', question: 'Các số có ra đều nhau không?',
    method: 'Kiểm định khi bình phương Pearson, có hiệu chỉnh vì mỗi kỳ rút các số không lặp lại (Joe 1993).',
    p: uni.p, stat: uni.stat, df: uni.df,
    facts: `Trong ${fi(W)} kỳ, mỗi số ra trung bình ${fd(e0)} lần; nhiều nhất là số ${hi.n} (${fi(hi.count)} lần), ít nhất là số ${lo.n} (${fi(lo.count)} lần).`,
    ok: 'Mức chênh lệch giữa các số nằm trong dao động bình thường của quay ngẫu nhiên.',
    bad: 'Mức chênh lệch giữa các số lớn hơn dao động thường thấy của quay ngẫu nhiên.',
  });

  // 2) Số ra nhiều / ít nhất
  const most = numbers[uni.maxN - 1];
  add({
    key: 'extreme', question: 'Có số nào ra nhiều hoặc ít bất thường không?',
    method: 'Kiểm định nhị thức chính xác cho từng số, hiệu chỉnh Bonferroni vì xét cùng lúc tất cả các số.',
    p: uni.pMaxAdj,
    facts: `Số ${hi.n} ra nhiều hơn trung bình ${fpct(hi.devPct)}, số ${lo.n} ra ít hơn trung bình ${fpct(-lo.devPct)}.`,
    ok: `Với ${M} số, có vài số chênh cỡ này là chuyện bình thường; không có số nào lệch bất thường.`,
    bad: `Số ${most.n} ra ${most.count > e0 ? 'nhiều' : 'ít'} hơn hẳn mức thường gặp khi quay ngẫu nhiên.`,
  });

  // 3) Ổn định qua các giai đoạn
  const P = Math.min(8, Math.floor(W / ((10 * M) / k)));
  let periods = null;
  if (P >= 2) {
    let tot = 0, worst = null;
    periods = [];
    for (let b = 0; b < P; b++) {
      const part = draws.slice(Math.floor((b * W) / P), Math.floor(((b + 1) * W) / P));
      const u = uniformityTest(part, game);
      tot += u.stat;
      const per = { from: part[0].date, to: part[part.length - 1].date, fromNo: part[0].no, toNo: part[part.length - 1].no, draws: part.length, p: u.p };
      periods.push(per);
      if (!worst || u.p < worst.p) worst = per;
    }
    add({
      key: 'stability', question: 'Tần suất các số có ổn định qua các giai đoạn không?',
      method: 'Chia lịch sử thành các giai đoạn bằng nhau, kiểm định khi bình phương (có hiệu chỉnh) từng giai đoạn rồi cộng gộp.',
      p: chi2Sf(tot, P * (M - 1)), stat: tot, df: P * (M - 1),
      facts: `Chia ${fi(W)} kỳ thành ${P} giai đoạn liên tiếp, mỗi giai đoạn khoảng ${fi(W / P)} kỳ.`,
      ok: 'Trong mọi giai đoạn các số đều ra đều nhau ở mức bình thường; không có thời kỳ nào bị thiên lệch.',
      bad: `Giai đoạn ${fdate(worst.from)} – ${fdate(worst.to)} có chênh lệch đáng chú ý nhất.`,
    });
  }

  // 4) Khoảng cách giữa các lần ra
  const gt = gapTest(gaps, W, M, k);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  add({
    key: 'gaps', question: 'Khoảng cách giữa các lần ra có đúng quy luật ngẫu nhiên không?',
    method: 'Kiểm định khoảng cách (Knuth): so số lần gặp từng độ dài khoảng cách với phân phối hình học.',
    p: gt.p, stat: gt.stat, df: gt.df,
    facts: `Một số trung bình cách ${fd(meanGap)} kỳ thì ra lại (lý thuyết ${fd(gt.meanTheory)} kỳ).`,
    ok: 'Tỷ lệ khoảng cách ngắn và dài khớp lý thuyết: số lâu chưa ra không vì thế mà dễ ra hơn ở kỳ sau.',
    bad: 'Tỷ lệ khoảng cách ngắn và dài lệch so với lý thuyết.',
  });

  // 5) Kỷ lục vắng mặt ("số gan")
  let rec = { n: 1, length: -1 };
  for (let n = 1; n <= M; n++) if (longest[n] > rec.length) rec = { n, length: longest[n], ...longestAt[n] };
  const lam = (L) => M * (1 - p0) ** L * (1 + (W - L) * p0);
  const pRec = Math.min(1, 1 - Math.exp(-lam(rec.length)));
  const cur = numbers.reduce((a, b) => (b.wait > a.wait ? b : a));
  const pCur = 1 - (1 - (1 - p0) ** cur.wait) ** M;
  const record = {
    n: rec.n, length: rec.length, current: !!rec.current,
    fromNo: draws[rec.from] ? draws[rec.from].no : null, fromDate: draws[rec.from] ? draws[rec.from].date : null,
    toNo: rec.current ? null : draws[rec.to] ? draws[rec.to].no : null, toDate: rec.current ? null : draws[rec.to] ? draws[rec.to].date : null,
    prob: pRec,
  };
  const recRange = record.current ? `từ ${fdate(record.fromDate)} đến nay` : `từ ${fdate(record.fromDate)} đến ${fdate(record.toDate)}`;
  add({
    key: 'record', question: 'Số vắng lâu nhất ("số gan") có bất thường không?',
    method: 'So độ dài kỷ lục vắng mặt với xác suất lý thuyết (xấp xỉ Poisson, đã đối chiếu bằng mô phỏng).',
    p: pRec,
    facts: `Kỷ lục: số ${record.n} vắng ${fi(record.length)} kỳ liên tiếp (${recRange}). Hiện số ${cur.n} đang vắng lâu nhất: ${fi(cur.wait)} kỳ.`,
    ok: `Với ${M} số, khả năng có một kỷ lục dài như vậy là khoảng ${fpct(pRec)}, hoàn toàn bình thường.`,
    bad: `Kỷ lục này dài hơn mức thường gặp (chỉ khoảng ${fpct(pRec)} khả năng xảy ra).`,
  });

  // 6) Số đặc biệt
  if (game.hasBonus) {
    const B = game.bonusMax || M, bo = bonusCount.slice(1, B + 1);
    const bg = gof(bo, bo.map(() => 1 / B), W);
    let bMax = 0, bMin = 0;
    bo.forEach((c, i) => { if (c > bo[bMax]) bMax = i; if (c < bo[bMin]) bMin = i; });
    add({
      key: 'bonus', question: 'Số đặc biệt có ra đều nhau không?',
      method: 'Kiểm định khi bình phương Pearson trên số lần ra của từng số đặc biệt.',
      p: bg.p, stat: bg.stat, df: bg.df,
      facts: `Mỗi số đặc biệt (1–${B}) ra trung bình ${fd(W / B)} lần; nhiều nhất là số ${bMax + 1} (${fi(bo[bMax])} lần), ít nhất là số ${bMin + 1} (${fi(bo[bMin])} lần).`,
      ok: 'Chênh lệch nằm trong dao động bình thường.',
      bad: 'Chênh lệch lớn hơn dao động thường thấy.',
    });
  }

  // 7) Chẵn / lẻ
  const kOdd = Math.ceil(M / 2);
  const oddObs = new Array(k + 1).fill(0);
  for (const d of draws) oddObs[d.main.filter((n) => n % 2 === 1).length]++;
  const oddProb = oddObs.map((_, j) => hyperPmf(M, kOdd, k, j));
  const og = gof(oddObs, oddProb, W);
  const jMode = oddProb.indexOf(Math.max(...oddProb));
  add({
    key: 'parity', question: 'Số lượng số lẻ, số chẵn mỗi kỳ có bình thường không?',
    method: 'So với phân phối siêu bội (xác suất chính xác khi rút không lặp lại).',
    p: og.p, stat: og.stat, df: og.df,
    facts: `Phổ biến nhất là kỳ có ${jMode} số lẻ: thực tế ${fpct(oddObs[jMode] / W)} số kỳ, lý thuyết ${fpct(oddProb[jMode])}. Kỳ toàn lẻ hoặc toàn chẵn: thực tế ${fpct((oddObs[0] + oddObs[k]) / W)}, lý thuyết ${fpct(oddProb[0] + oddProb[k])}.`,
    ok: 'Phân bố chẵn lẻ khớp lý thuyết.',
    bad: 'Phân bố chẵn lẻ lệch so với lý thuyết.',
  });
  const parityDist = oddObs.map((c, j) => ({ j, obs: c, exp: oddProb[j] * W }));

  // 8) Tổng các số (phân phối chính xác)
  const sp = sumProbs(M, k);
  const sums = draws.map((d) => d.main.reduce((a, b) => a + b, 0));
  const sObs = new Array(sp.length).fill(0);
  for (const s of sums) sObs[s]++;
  const nb = Math.max(5, Math.min(20, Math.floor(W / 50)));
  const bo = [], bp = [];
  { let o = 0, q = 0;
    for (let s = 0; s < sp.length; s++) { o += sObs[s]; q += sp[s]; if (q >= 1 / nb && bp.length < nb - 1) { bo.push(o); bp.push(q); o = 0; q = 0; } }
    bo.push(o); bp.push(q); }
  const sg = gof(bo, bp, W);
  const mu = (k * (M + 1)) / 2, meanS = sums.reduce((a, b) => a + b, 0) / W;
  const quant = (qq) => { let c = 0; for (let s = 0; s < sp.length; s++) { c += sp[s]; if (c >= qq) return s; } return sp.length - 1; };
  const sorted = sums.slice().sort((a, b) => a - b), oq = (qq) => sorted[Math.floor(qq * (W - 1))];
  const sumInfo = { mean: meanS, meanTheory: mu, q1: oq(0.25), q3: oq(0.75), q1Theory: quant(0.25), q3Theory: quant(0.75) };
  add({
    key: 'sum', question: 'Tổng các số trong mỗi kỳ có bình thường không?',
    method: 'So với phân phối chính xác của tổng (tính bằng quy hoạch động), gom thành các nhóm có xác suất bằng nhau.',
    p: sg.p, stat: sg.stat, df: sg.df,
    facts: `Tổng trung bình ${fd(meanS)} (lý thuyết ${fd(mu)}); một nửa số kỳ có tổng từ ${sumInfo.q1} đến ${sumInfo.q3} (lý thuyết ${sumInfo.q1Theory} đến ${sumInfo.q3Theory}).`,
    ok: 'Phân bố tổng khớp lý thuyết.',
    bad: 'Phân bố tổng lệch so với lý thuyết.',
  });
  const sumHist = [];
  for (let b = 0; b < sp.length; b += 10) {
    let o = 0, q = 0;
    for (let s = b; s < Math.min(b + 10, sp.length); s++) { o += sObs[s]; q += sp[s]; }
    sumHist.push({ from: b, to: b + 9, obs: o, exp: q * W });
  }
  while (sumHist.length && sumHist[0].obs === 0 && sumHist[0].exp < 0.5) sumHist.shift();
  while (sumHist.length && sumHist[sumHist.length - 1].obs === 0 && sumHist[sumHist.length - 1].exp < 0.5) sumHist.pop();

  // 9) Hai số liền nhau trong cùng kỳ (vd 12-13)
  const pAdj = 1 - comb(M - k + 1, k) / comb(M, k);
  let adjObs = 0;
  for (const d of draws) { const s = [...d.main].sort((a, b) => a - b); if (s.some((v, i) => i && v - s[i - 1] === 1)) adjObs++; }
  add({
    key: 'adjacent', question: 'Tỷ lệ kỳ có hai số liền nhau (như 12 và 13) có bình thường không?',
    method: 'Kiểm định nhị thức chính xác, xác suất lý thuyết tính bằng tổ hợp.',
    p: binomP2(adjObs, W, pAdj),
    facts: `${fpct(adjObs / W)} số kỳ có ít nhất một cặp số liền nhau (lý thuyết ${fpct(pAdj)}).`,
    ok: 'Khớp lý thuyết.',
    bad: 'Lệch so với lý thuyết.',
  });

  // 10) Lặp lại số của kỳ liền trước
  const repObs = new Array(k + 1).fill(0);
  for (let t = 1; t < W; t++) { const prev = new Set(draws[t - 1].main); repObs[draws[t].main.filter((n) => prev.has(n)).length]++; }
  const repProb = repObs.map((_, j) => hyperPmf(M, k, k, j));
  const rg = gof(repObs, repProb, W - 1);
  const meanRep = repObs.reduce((a, c, j) => a + c * j, 0) / Math.max(1, W - 1);
  add({
    key: 'repeat', question: 'Kỳ sau có hay lặp lại số của kỳ trước không?',
    method: 'So với phân phối siêu bội của số quả trùng giữa hai kỳ liên tiếp.',
    p: rg.p, stat: rg.stat, df: rg.df,
    facts: `Trung bình mỗi kỳ có ${fd(meanRep, 2)} số trùng với kỳ ngay trước (lý thuyết ${fd((k * k) / M, 2)}); ${fpct(repObs[0] / Math.max(1, W - 1))} số kỳ không trùng số nào (lý thuyết ${fpct(repProb[0])}).`,
    ok: 'Kết quả kỳ trước không ảnh hưởng đến kỳ sau.',
    bad: 'Có dấu hiệu kỳ sau phụ thuộc kỳ trước.',
  });
  const repeatDist = repObs.map((c, j) => ({ j, obs: c, exp: repProb[j] * (W - 1) }));

  // 11) Cặp số
  const q = (k * (k - 1)) / (M * (M - 1)), eP = W * q, sdP = Math.sqrt(W * q * (1 - q));
  const pc = new Uint16Array((M + 1) * (M + 1));
  for (const d of draws) {
    const s = [...d.main].sort((a, b) => a - b);
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) pc[s[i] * (M + 1) + s[j]]++;
  }
  const nPairs = (M * (M - 1)) / 2;
  const pairs = [], heat = new Array(M * M).fill(0), counts = new Array(M * M).fill(0), pCache = new Map();
  let minPairP = 1;
  for (let a = 1; a <= M; a++) for (let b = a + 1; b <= M; b++) {
    const c = pc[a * (M + 1) + b], z = (c - eP) / sdP;
    if (!pCache.has(c)) pCache.set(c, binomP2(c, W, q));
    const pv = pCache.get(c);
    minPairP = Math.min(minPairP, pv);
    pairs.push({ a, b, count: c, z, unusual: nPairs * pv < 0.05 });
    heat[(a - 1) * M + (b - 1)] = heat[(b - 1) * M + (a - 1)] = Math.round(z * 100) / 100;
    counts[(a - 1) * M + (b - 1)] = counts[(b - 1) * M + (a - 1)] = c;
  }
  pairs.sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b);
  const pairNote = { expected: eP, count: nPairs, minP: minPairP, pAdj: Math.min(1, nPairs * minPairP) };
  add({
    key: 'pairs', question: 'Có cặp số nào hay ra cùng nhau bất thường không?',
    method: 'Kiểm định nhị thức chính xác cho từng cặp, hiệu chỉnh Bonferroni vì xét cùng lúc tất cả các cặp.',
    p: pairNote.pAdj,
    facts: `Có ${fi(nPairs)} cặp số; mỗi cặp trung bình ra cùng nhau ${fd(eP)} lần. Cặp ra cùng nhau nhiều nhất là ${pairs[0].a} và ${pairs[0].b} (${fi(pairs[0].count)} lần).`,
    ok: 'Với số lượng cặp lớn như vậy, vài cặp ra nhiều hơn là chuyện bình thường; không có cặp nào "hay đi cùng nhau" thật sự.',
    bad: 'Có cặp số ra cùng nhau nhiều hơn hẳn mức thường gặp.',
  });

  // 12) Chọn số theo thống kê có trúng nhiều hơn không (thử trên dữ liệu quá khứ)
  const bt = opts.skipBacktest ? null : backtest(draws, game);
  if (bt) {
    const minP = Math.min(...bt.strategies.map((s) => s.p));
    const desc = bt.strategies.map((s) => `${s.short} trúng trung bình ${fd(s.mean, 2)} số/kỳ`).join(', ');
    add({
      key: 'predict', question: 'Chọn số theo thống kê quá khứ có trúng nhiều hơn chọn ngẫu nhiên không?',
      method: `Thử lại trên ${fi(bt.draws)} kỳ: mỗi kỳ chỉ dùng dữ liệu trước kỳ đó để chọn số, rồi so với kết quả thật.`,
      p: Math.min(1, bt.strategies.length * minP),
      facts: `${desc[0].toUpperCase()}${desc.slice(1)}; chọn ngẫu nhiên trúng trung bình ${fd(bt.expectedHits, 2)} số/kỳ.`,
      ok: 'Không cách chọn nào trúng nhiều hơn chọn ngẫu nhiên một cách đáng kể.',
      bad: 'Có cách chọn cho kết quả khác hẳn chọn ngẫu nhiên.',
    });
  }

  // --- Kết luận chung (hiệu chỉnh Holm)
  const adj = holm(tests.map((t) => t.p));
  tests.forEach((t, i) => {
    t.pAdj = adj[i];
    t.level = adj[i] < 0.01 ? 'alert' : adj[i] < 0.05 ? 'watch' : 'ok';
    t.levelText = LEVEL_TEXT[t.level];
    t.summary = `${t.facts} ${t.level === 'ok' ? t.ok : t.bad}`;
    delete t.ok; delete t.bad;
  });
  const flagged = tests.filter((t) => t.level !== 'ok');
  const level = flagged.some((t) => t.level === 'alert') ? 'alert' : flagged.length ? 'watch' : 'ok';
  const verdict = {
    level, levelText: LEVEL_TEXT[level], total: tests.length, flagged: flagged.length,
    text: level === 'ok'
      ? `Không phát hiện dấu hiệu bất thường: cả ${tests.length} phép kiểm tra đều cho kết quả phù hợp với quay số ngẫu nhiên.`
      : level === 'watch'
        ? `${flagged.length}/${tests.length} phép kiểm tra có chênh lệch cần theo dõi (${flagged.map((t) => t.question.replace(/\?$/, '').toLowerCase()).join('; ')}). Chưa đủ cơ sở để kết luận có bất thường.`
        : `${flagged.length}/${tests.length} phép kiểm tra cho thấy chênh lệch lớn hơn hẳn dao động ngẫu nhiên (${flagged.map((t) => t.question.replace(/\?$/, '').toLowerCase()).join('; ')}).`,
  };

  // Biểu đồ khoảng cách: nhóm 5 kỳ, đến 50, phần còn lại gộp
  const gapDist = [];
  for (let a = 1; a <= 50; a += 5) {
    let o = 0, e = 0;
    for (let g = a; g < a + 5; g++) { if (g - 1 < gt.obs.length - 1) { o += gt.obs[g - 1]; e += gt.prob[g - 1] * gaps.length; } }
    gapDist.push({ label: `${a}–${a + 4}`, obs: o, exp: e });
  }
  { let o = 0, e = 0;
    for (let i = 50; i < gt.obs.length; i++) { o += gt.obs[i]; e += gt.prob[i] * gaps.length; }
    gapDist.push({ label: 'trên 50', obs: o, exp: e }); }

  return {
    window: { draws: W, from: draws[0].date, to: draws[W - 1].date, fromNo: draws[0].no, toNo: draws[W - 1].no },
    game: { nMain: k, max: M, hasBonus: game.hasBonus, bonusMax: game.bonusMax || 0, label: game.label, p0, jackpotOdds: jackpotOdds(game) },
    verdict, tests, numbers, periods,
    gapInfo: { meanGap, meanTheory: gt.meanTheory, record, current: { n: cur.n, wait: cur.wait, prob: pCur }, dist: gapDist },
    parityDist, repeatDist, sumHist, sumInfo,
    pairs: { top: pairs.slice(0, 15), bottom: pairs.slice(-15).reverse(), note: pairNote, heat, counts, size: M },
    backtest: bt,
  };
}

// ----------------------------------------------------------------- Thử chiến lược trên dữ liệu quá khứ
// Mỗi kỳ t, chọn k số bằng một chiến lược chỉ dùng DỮ LIỆU TRƯỚC t, rồi đếm số quả trùng với kỳ t.
// Nếu chiến lược có sức dự đoán thì trung bình số quả trúng phải cao hơn k*k/M.
function topK(score, M, k) {
  const idx = [];
  for (let n = 1; n <= M; n++) idx.push(n);
  idx.sort((a, b) => score[b] - score[a] || a - b);
  return idx.slice(0, k);
}

function backtest(draws, game, warm = 100, recent = 50) {
  const W = draws.length, k = game.nMain, M = game.max;
  if (W < warm + 50) return null;
  const cnt = new Array(M + 1).fill(0), win = new Array(M + 1).fill(0), lastI = new Array(M + 1).fill(-1);
  const strat = {
    hot: { label: 'Chọn các số ra nhiều nhất từ trước đến nay', short: 'chọn số ra nhiều nhất từ trước đến nay', score: () => cnt },
    hot50: { label: `Chọn các số ra nhiều nhất trong ${recent} kỳ gần nhất`, short: `chọn số ra nhiều nhất ${recent} kỳ gần đây`, score: () => win },
    cold: { label: 'Chọn các số lâu chưa ra nhất', short: 'chọn số lâu chưa ra nhất', score: (t) => lastI.map((l) => (l < 0 ? t : t - 1 - l)) },
  };
  const res = {};
  for (const key of Object.keys(strat)) res[key] = { key, label: strat[key].label, short: strat[key].short, dist: new Array(k + 1).fill(0), sum: 0 };

  for (let t = 0; t < W; t++) {
    if (t >= warm) {
      const actual = new Set(draws[t].main);
      for (const key of Object.keys(strat)) {
        const hits = topK(strat[key].score(t), M, k).filter((n) => actual.has(n)).length;
        res[key].dist[hits]++; res[key].sum += hits;
      }
    }
    for (const n of draws[t].main) { cnt[n]++; win[n]++; lastI[n] = t; }
    if (t - recent >= 0) for (const n of draws[t - recent].main) win[n]--;
  }

  const n = W - warm, exp = (k * k) / M;
  const varH = k * (k / M) * (1 - k / M) * ((M - k) / (M - 1));
  const pmf = Array.from({ length: k + 1 }, (_, j) => hyperPmf(M, k, k, j));
  const expAtLeast3 = pmf.slice(3).reduce((a, b) => a + b, 0) * n;
  return {
    draws: n, warmup: warm, expectedHits: exp,
    strategies: Object.values(res).map((r) => {
      const mean = r.sum / n, z = (mean - exp) / Math.sqrt(varH / n);
      return {
        key: r.key, label: r.label, short: r.short, mean, z, p: normP2(z),
        atLeast3: { obs: r.dist.slice(3).reduce((a, b) => a + b, 0), exp: expAtLeast3 },
        dist: r.dist.map((c, j) => ({ j, obs: c, exp: pmf[j] * n })),
      };
    }),
  };
}

// ----------------------------------------------------------------- Gợi ý bộ số
// Lấy k số khác nhau, xác suất tỉ lệ với trọng số. LƯU Ý: mọi bộ số đều có cùng xác suất trúng.
function suggest(draws, game, mode = 'uniform', howMany = 5, rnd = Math.random) {
  const k = game.nMain, M = game.max, W = draws.length;
  const count = new Array(M + 1).fill(0), lastI = new Array(M + 1).fill(-1);
  draws.forEach((d, t) => d.main.forEach((n) => { count[n]++; lastI[n] = t; }));
  const w = [0];
  for (let n = 1; n <= M; n++) {
    if (mode === 'hot') w.push(count[n] + 1);
    else if (mode === 'cold') w.push((lastI[n] < 0 ? W : W - 1 - lastI[n]) + 1);
    else if (mode === 'rare') w.push(n > 31 ? 3 : 1); // số > 31 tránh kiểu chọn theo ngày sinh (1..31)
    else w.push(1);
  }
  const sets = [];
  for (let i = 0; i < howMany; i++) {
    const pool = w.map((x, n) => ({ n, x })).filter((o) => o.n >= 1);
    const pick = [];
    while (pick.length < k) {
      const total = pool.reduce((s, o) => s + o.x, 0);
      let r = rnd() * total, j = 0;
      for (; j < pool.length - 1; j++) { r -= pool[j].x; if (r <= 0) break; }
      pick.push(pool[j].n); pool.splice(j, 1);
    }
    pick.sort((a, b) => a - b);
    sets.push({ numbers: pick, sum: pick.reduce((a, b) => a + b, 0), odd: pick.filter((n) => n % 2).length });
  }
  return { mode, odds: jackpotOdds(game), sets };
}

module.exports = {
  analyze, backtest, suggest, uniformityTest, jackpotOdds,
  // xuất thêm để test
  gammaQ, chi2Sf, normP2, normCdf, binomP2, comb, hyperPmf, gof, lgamma, holm, sumProbs, gapTest,
};

    },
    './ticket': function (module, exports, require) {
'use strict';
/**
 * ticket.js - Kiểm tra một vé (bộ số người chơi chọn):
 *  1) Xác suất trúng từng hạng giải, tính CHÍNH XÁC bằng tổ hợp. Kết quả giống hệt nhau với mọi bộ số.
 *  2) Giá trị kỳ vọng của một vé theo bảng giải của kỳ gần nhất.
 *  3) "Chơi lại" vé qua các kỳ đã quay, dùng bảng giải thực tế từng kỳ lưu trong DB (prizes_json).
 */
const { comb } = require('./stats');

const PRICE = 10000; // đồng / bộ số (Power 6/55, Mega 6/45, Lotto 5/35)

// Hạng giải theo đúng thứ tự dòng trong bảng giải Vietlott (prizes_json):
//   m      : số lượng số chính trùng (chính xác)
//   mMax   : trùng từ 0 đến mMax số chính (giải Khuyến khích Lotto 5/35)
//   s      : phải trùng thêm số đặc biệt
//   jackpot: giải tích lũy, chia đều cho những người cùng trúng
// special: 'pool' = số đặc biệt quay thêm từ các số còn lại (vé trùng nếu có số đó, Power 6/55)
//          'pick' = người chơi tự chọn số đặc biệt riêng (1..bonusMax, Lotto 5/35)
const RULES = {
  '655': { special: 'pool', tiers: [{ m: 6, jackpot: true }, { m: 5, s: true, jackpot: true }, { m: 5 }, { m: 4 }, { m: 3 }] },
  '645': { special: null, tiers: [{ m: 6, jackpot: true }, { m: 5 }, { m: 4 }, { m: 3 }] },
  '535': {
    special: 'pick',
    tiers: [{ m: 5, s: true, jackpot: true }, { m: 5 }, { m: 4, s: true }, { m: 4 }, { m: 3, s: true }, { m: 3 }, { mMax: 2, s: true }],
  },
};

const toInt = (s) => Number(String(s == null ? '' : s).replace(/[^\d]/g, '')) || 0;
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

// Hạng giải cao nhất mà vé đạt được khi trùng m số chính (s: có trùng số đặc biệt); -1 nếu không trúng.
function tierIndex(rule, m, s) {
  return rule.tiers.findIndex((t) => (t.m != null ? m === t.m : m <= t.mMax) && (!t.s || s));
}

function describe(t) {
  const main = t.m != null ? `Trùng ${t.m} số` : `Trùng 0–${t.mMax} số`;
  return t.s ? `${main} + số đặc biệt` : main;
}

// P(trùng đúng m số chính), m = 0..k (siêu bội).
function matchProbs(game) {
  const k = game.nMain, M = game.max, total = comb(M, k);
  return Array.from({ length: k + 1 }, (_, m) => (comb(k, m) * comb(M - k, k - m)) / total);
}

// P(trùng số đặc biệt | đã trùng m số chính).
function specialProb(rule, game, m) {
  if (rule.special === 'pool') return (game.nMain - m) / (game.max - game.nMain);
  if (rule.special === 'pick') return 1 / game.bonusMax;
  return 0;
}

// Xác suất từng hạng giải của MỘT vé bất kỳ; none = xác suất không trúng giải nào.
function tierProbs(code, game) {
  const rule = RULES[code], match = matchProbs(game), tiers = rule.tiers.map(() => 0);
  let none = 0;
  match.forEach((p, m) => {
    const ps = specialProb(rule, game, m);
    for (const [s, w] of [[true, ps], [false, 1 - ps]]) {
      if (!w) continue;
      const i = tierIndex(rule, m, s);
      if (i >= 0) tiers[i] += p * w; else none += p * w;
    }
  });
  return { tiers, none, match };
}

// Đọc & kiểm tra bộ số nhập vào: "5 12 23 34 45 51", "05,12,..." đều được.
function parseTicket(code, game, numStr, spStr) {
  const rule = RULES[code];
  if (!rule) throw badRequest('Chưa hỗ trợ sản phẩm ' + code);
  const nums = String(numStr || '').split(/[^\d]+/).filter(Boolean).map(Number);
  const k = game.nMain;
  if (nums.length !== k) throw badRequest(`Cần đúng ${k} số chính (đang có ${nums.length}).`);
  const bad = nums.find((n) => !(n >= 1 && n <= game.max));
  if (bad != null) throw badRequest(`Số ${bad} không hợp lệ: số chính phải từ 1 đến ${game.max}.`);
  if (new Set(nums).size !== k) throw badRequest('Các số chính không được trùng nhau.');
  let special = null;
  if (rule.special === 'pick') {
    special = parseInt(spStr, 10);
    if (!(special >= 1 && special <= game.bonusMax)) throw badRequest(`Cần chọn số đặc biệt từ 1 đến ${game.bonusMax}.`);
  }
  return { numbers: nums.sort((a, b) => a - b), special };
}

/**
 * draws: [{ no, date, main:[], bonus:[], prizes:[[tên, mẫu, số người trúng, giá trị], ...] }] theo kỳ tăng dần.
 * ticket: { numbers:[], special }
 */
function checkTicket(code, game, draws, ticket) {
  const rule = RULES[code];
  if (!draws.length) throw badRequest('Chưa có dữ liệu kỳ quay.');
  const set = new Set(ticket.numbers);
  const latest = draws[draws.length - 1];
  const { tiers: pt, none, match } = tierProbs(code, game);

  const tiers = rule.tiers.map((t, i) => {
    const row = (latest.prizes || [])[i] || [];
    const value = toInt(row[3]);
    return { name: row[0] || `Hạng ${i + 1}`, desc: describe(t), p: pt[i], oneIn: 1 / pt[i], value, jackpot: !!t.jackpot, ev: pt[i] * value };
  });
  const ev = tiers.reduce((a, t) => a + t.ev, 0);

  // Chơi lại vé ở từng kỳ đã quay, tính tiền thưởng theo bảng giải của chính kỳ đó.
  const counts = tiers.map(() => 0), matchObs = match.map(() => 0), wins = [];
  let won = 0;
  for (const d of draws) {
    const m = d.main.reduce((a, x) => a + (set.has(x) ? 1 : 0), 0);
    const s = rule.special === 'pool' ? d.bonus.some((x) => set.has(x))
      : rule.special === 'pick' ? d.bonus[0] === ticket.special : false;
    matchObs[m]++;
    const i = tierIndex(rule, m, s);
    if (i < 0) continue;
    counts[i]++;
    const row = (d.prizes || [])[i] || [];
    let prize = toInt(row[3]);
    if (rule.tiers[i].jackpot) prize = Math.round(prize / (toInt(row[2]) + 1)); // chia đều với người cùng trúng
    won += prize;
    wins.push({ no: d.no, date: d.date, m, s, tier: i, name: tiers[i].name, prize });
  }
  const W = draws.length, spent = W * PRICE;
  const best = wins.slice().sort((a, b) => b.prize - a.prize || b.no - a.no).slice(0, 30);

  return {
    game: { code, label: game.label, nMain: game.nMain, max: game.max, bonusMax: game.bonusMax, special: rule.special, price: PRICE },
    ticket,
    sum: ticket.numbers.reduce((a, b) => a + b, 0),
    odd: ticket.numbers.filter((n) => n % 2).length,
    tiers,
    anyPrize: { p: 1 - none, oneIn: 1 / (1 - none) },
    ev, evPct: ev / PRICE,
    matchDist: match.map((p, m) => ({ m, p, obs: matchObs[m], exp: p * W })),
    replay: {
      draws: W, from: draws[0].date, to: latest.date, fromNo: draws[0].no, toNo: latest.no,
      spent, won, net: won - spent,
      tiers: tiers.map((t, i) => ({ name: t.name, count: counts[i], exp: t.p * W })),
      winCount: wins.length, lastWin: wins.length ? wins[wins.length - 1] : null, best,
    },
  };
}

module.exports = { PRICE, RULES, tierIndex, tierProbs, matchProbs, parseTicket, checkTicket };

    }
  };
  var cache = {};
  function req(n) {
    if (cache[n]) return cache[n].exports;
    if (!defs[n]) throw new Error('Thiếu module ' + n);
    var m = { exports: {} };
    cache[n] = m;
    defs[n](m, m.exports, req);
    return m.exports;
  }
  window.VL = { GAMES: {"535":{"page":"535","webpart":"Game535ResultDetailWebPart","nMain":5,"hasBonus":true,"max":35,"bonusMax":12,"label":"Lotto 5/35","schedule":{"days":[0,1,2,3,4,5,6],"times":["13:00","21:00"]}},"645":{"page":"645","webpart":"Game645ResultDetailWebPart","nMain":6,"hasBonus":false,"max":45,"bonusMax":0,"label":"Mega 6/45","schedule":{"days":[0,3,5],"times":["18:00"]}},"655":{"page":"655","webpart":"Game655ResultDetailWebPart","nMain":6,"hasBonus":true,"max":55,"bonusMax":55,"label":"Power 6/55","schedule":{"days":[2,4,6],"times":["18:00"]}}}, S: req('./stats'), T: req('./ticket') };
})();
