/* Sinh tự động bởi mobile/build.js từ js/tool/{rules,stats,mathx,ticket,prob,explore,popular,portfolio,strategy}.js - không sửa tay. */
(function () {
  'use strict';
  var defs = {
    './rules': function (module, exports, require) {
'use strict';
/**
 * rules.js - Luật chơi của từng loại Vietlott, quản lý theo PHIÊN BẢN (ngày bắt đầu áp dụng).
 * Đây là nơi DUY NHẤT khai báo cách trúng thưởng; ticket.js, prob.js, backtest.js đều đọc từ đây.
 * Thêm loại mới hoặc đổi luật: thêm một phần tử vào RULESETS (không phải sửa thuật toán).
 *
 * Mỗi phiên bản:
 *   from     : ngày bắt đầu áp dụng (YYYY-MM-DD). Phiên bản sau thay phiên bản trước từ ngày đó.
 *   nMain/max: mỗi kỳ quay nMain số khác nhau trong 1..max
 *   special  : null   = không có số đặc biệt (Mega 6/45)
 *              'pool' = số đặc biệt quay thêm từ các số còn lại, vé trùng nếu CÓ số đó (Power 6/55)
 *              'pick' = người chơi tự chọn số đặc biệt riêng trong 1..bonusMax (Lotto 5/35)
 *   tiers    : hạng giải theo đúng thứ tự dòng trong bảng giải của Vietlott
 *              m = trùng đúng m số chính; mMax = trùng từ 0 đến mMax số chính; s = phải trùng số đặc biệt
 *              jackpot = giải tích lũy, chia đều cho người cùng trúng (min = mức khởi điểm)
 *              value = tiền thưởng cố định; roll = phần giải Độc Đắc được chia thêm ở "kỳ chia giải"
 *   cap      : (Power 6/55) Jackpot 1 vượt `max` mà kỳ đó không ai trúng Jackpot 1 nhưng có người trúng Jackpot 2
 *              thì toàn bộ phần vượt được cộng cho Jackpot 2 của kỳ đó, Jackpot 1 quay về `max`.
 *              (Có người trúng Jackpot 1 thì nhận toàn bộ; không ai trúng cả hai thì tiếp tục tích lũy.)
 *   rolldown : (Lotto 5/35) Độc Đắc vượt `over` mà chưa ai trúng thì kỳ quay `time` của NGÀY KẾ TIẾP là kỳ chia giải:
 *              nếu kỳ đó vẫn không ai trúng Độc Đắc, toàn bộ giá trị Độc Đắc chia cho các hạng có `roll`
 *              (hạng nào không có người trúng thì phần của hạng đó chia đều cho các hạng còn lại).
 * Nguồn: thể lệ do Vietlott công bố; đã đối chiếu với bảng giải của toàn bộ kỳ quay trong DB (js/tool/validate.js).
 */
const PRICE = 10000; // đồng / bộ số
// Thuế thu nhập cá nhân với giải thưởng xổ số: 10% trên phần vượt 10 triệu đồng của mỗi giải.
const TAX = { threshold: 10000000, rate: 0.1 };

const RULESETS = {
  '655': [{
    from: '2017-08-01', label: 'Power 6/55', nMain: 6, max: 55, special: 'pool', bonusMax: 55, price: PRICE,
    tiers: [
      { id: 'jp1', name: 'Jackpot 1', m: 6, jackpot: true, min: 30e9 },
      { id: 'jp2', name: 'Jackpot 2', m: 5, s: true, jackpot: true, min: 3e9 },
      { id: 'g1', name: 'Giải Nhất', m: 5, value: 40e6 },
      { id: 'g2', name: 'Giải Nhì', m: 4, value: 500e3 },
      { id: 'g3', name: 'Giải Ba', m: 3, value: 50e3 },
    ],
    cap: { tier: 0, max: 300e9, to: 1 },
  }],
  '645': [{
    from: '2016-07-20', label: 'Mega 6/45', nMain: 6, max: 45, special: null, bonusMax: 0, price: PRICE,
    tiers: [
      { id: 'jp', name: 'Jackpot', m: 6, jackpot: true, min: 12e9 },
      { id: 'g1', name: 'Giải Nhất', m: 5, value: 10e6 },
      { id: 'g2', name: 'Giải Nhì', m: 4, value: 300e3 },
      { id: 'g3', name: 'Giải Ba', m: 3, value: 30e3 },
    ],
  }],
  '535': [{
    from: '2025-06-29', label: 'Lotto 5/35', nMain: 5, max: 35, special: 'pick', bonusMax: 12, price: PRICE,
    tiers: [
      { id: 'dd', name: 'Giải Độc Đắc', m: 5, s: true, jackpot: true, min: 6e9 },
      { id: 'g1', name: 'Giải Nhất', m: 5, value: 10e6, roll: 1 / 3 },
      { id: 'g2', name: 'Giải Nhì', m: 4, s: true, value: 5e6, roll: 1 / 6 },
      { id: 'g3', name: 'Giải Ba', m: 4, value: 500e3, roll: 1 / 6 },
      { id: 'g4', name: 'Giải Tư', m: 3, s: true, value: 100e3, roll: 1 / 6 },
      { id: 'g5', name: 'Giải Năm', m: 3, value: 30e3, roll: 1 / 6 },
      { id: 'kk', name: 'Giải Khuyến Khích', mMax: 2, s: true, value: 10e3 },
    ],
    rolldown: { over: 12e9, time: '21:00' },
  }],
};

// Phiên bản luật có hiệu lực vào ngày `date` (YYYY-MM-DD); không truyền ngày thì lấy phiên bản mới nhất.
function rulesAt(code, date) {
  const list = RULESETS[code];
  if (!list) return null;
  let cur = list[0];
  for (const r of list) if (!date || r.from <= date) cur = r;
  return date ? cur : list[list.length - 1];
}
const currentRules = (code) => rulesAt(code);

// game dạng cũ { nMain, max, hasBonus, bonusMax, label } suy ra từ luật (dùng cho stats.js, ticket.js).
function gameOf(code, date) {
  const r = rulesAt(code, date);
  return r && { code, label: r.label, nMain: r.nMain, max: r.max, hasBonus: !!r.special, bonusMax: r.bonusMax };
}

const toInt = (s) => Number(String(s == null ? '' : s).replace(/[^\d]/g, '')) || 0;

/**
 * Tổng giá trị giải tích lũy hạng j của kỳ thứ i (draws tăng dần).
 * Bảng giải của Vietlott từ khoảng năm 2020 ghi số tiền MỖI VÉ nhận khi có từ 2 vé cùng trúng (trước đó ghi tổng).
 * Nhận biết: có >= 2 vé trúng mà số tiền ghi nhỏ hơn giá trị tích lũy của kỳ liền trước (hoặc nhỏ hơn mức khởi điểm) thì đó là số mỗi vé.
 */
function jackpotTotal(code, draws, i, j) {
  const d = draws[i], row = d.prizes && d.prizes[j];
  if (!row) return 0;
  const v = toInt(row[3]), w = toInt(row[2]);
  if (w < 2) return v;
  const t = rulesAt(code, d.date).tiers[j], prev = i > 0 ? draws[i - 1].prizes && draws[i - 1].prizes[j] : null;
  const ref = prev && toInt(prev[2]) === 0 && !isRolldownDraw(code, draws[i - 1]) ? toInt(prev[3]) : (t.min || 0);
  return v < ref ? v * w : v;
}

// Kỳ này có phải "kỳ chia giải" đã diễn ra không: tiền thưởng các hạng cố định cao hơn mức chuẩn.
function isRolldownDraw(code, draw) {
  const r = rulesAt(code, draw.date);
  if (!r || !r.rolldown || !draw.prizes) return false;
  return r.tiers.some((t, i) => t.roll && draw.prizes[i] && toInt(draw.prizes[i][3]) > t.value);
}

/**
 * Trạng thái "kỳ chia giải" của Lotto 5/35 tính từ các kỳ đã quay (draws tăng dần, có prizes).
 * Trả về null nếu loại này không có cơ chế chia giải, ngược lại:
 *   { pending, jackpot, overNo, overDate, rollDate, rollTime, drawsLeft, note }
 *   pending = true: kỳ chia giải đã được xác định và CHƯA quay.
 */
function rolldownStatus(code, draws) {
  const r = currentRules(code);
  if (!r || !r.rolldown || !draws.length) return null;
  const jpOf = (d) => (d.prizes && d.prizes[0] ? toInt(d.prizes[0][3]) : 0);
  const wonOf = (d) => (d.prizes && d.prizes[0] ? toInt(d.prizes[0][2]) > 0 : false);
  // lùi về đầu chu kỳ tích lũy hiện tại (sau lần gần nhất có người trúng Độc Đắc hoặc đã chia giải)
  let start = draws.length;
  while (start > 0 && !wonOf(draws[start - 1]) && !isRolldownDraw(code, draws[start - 1])) start--;
  const cycle = draws.slice(start);
  const latest = draws[draws.length - 1];
  const base = { pending: false, jackpot: cycle.length ? jpOf(latest) : r.tiers[0].min, over: r.rolldown.over, rollTime: r.rolldown.time };
  const first = cycle.find((d) => jpOf(d) > r.rolldown.over);
  if (!first) return base;
  const next = new Date(first.date + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  const rollDate = next.toISOString().slice(0, 10);
  // mỗi ngày quay 2 kỳ: kỳ `time` là kỳ thứ hai trong ngày. Đếm số kỳ còn lại từ kỳ mới nhất đến kỳ chia giải.
  const perDay = 2, slotOf = (d) => draws.filter((x) => x.date === d.date && x.no < d.no).length;
  const days = Math.round((Date.parse(rollDate) - Date.parse(latest.date)) / 864e5);
  const drawsLeft = days * perDay + (perDay - 1 - slotOf(latest));
  if (drawsLeft <= 0) return base; // kỳ chia giải đã qua (đã được xử lý ở vòng lặp trên)
  return {
    ...base, pending: true, overNo: first.no, overDate: first.date, rollDate, drawsLeft, rollNo: latest.no + drawsLeft,
  };
}

module.exports = { PRICE, TAX, RULESETS, rulesAt, currentRules, gameOf, isRolldownDraw, rolldownStatus, jackpotTotal, toInt };

    },
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
    './mathx': function (module, exports, require) {
'use strict';
/**
 * mathx.js - Hàm toán dùng chung cho các engine (chạy được cả trên Node lẫn trình duyệt, không phụ thuộc gì ngoài stats.js).
 *  - rng(seed)        : bộ sinh số ngẫu nhiên có hạt giống (mulberry32) để mọi mô phỏng lặp lại được y hệt
 *  - betaI/betaQuantile: phân phối Beta (khoảng tin cậy Bayes)
 *  - binomSf/poisPmf  : đuôi nhị thức chính xác, Poisson
 *  - bh               : hiệu chỉnh Benjamini–Hochberg (kiểm soát tỷ lệ phát hiện sai, FDR)
 *  - wilson           : khoảng tin cậy Wilson cho một tỷ lệ
 */
const { lgamma } = require('./stats');

function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rút k số khác nhau trong 1..M (Fisher–Yates từng phần). Trả về mảng tăng dần.
function sampleK(M, k, rnd) {
  const a = new Array(M);
  for (let i = 0; i < M; i++) a[i] = i + 1;
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (M - i));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.slice(0, k).sort((x, y) => x - y);
}

// Phân số liên tục của hàm beta không hoàn chỉnh (Lentz).
function betaCf(x, a, b) {
  const TINY = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}
// Hàm beta không hoàn chỉnh chính quy I_x(a, b) = P(Beta(a,b) <= x).
function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaCf(x, a, b)) / a : 1 - (bt * betaCf(1 - x, b, a)) / b;
}
function betaQuantile(p, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaI(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// P(X >= c) CHÍNH XÁC với X ~ Nhị thức(n, q).
function binomSf(c, n, q) {
  if (c <= 0) return 1;
  if (c > n || q <= 0) return 0;
  if (q >= 1) return 1;
  const logPmf = (i) => lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) + i * Math.log(q) + (n - i) * Math.log(1 - q);
  const r = q / (1 - q);
  let t = Math.exp(logPmf(c)), tail = 0;
  for (let i = c; i <= n; i++) {
    tail += t;
    t *= ((n - i) / (i + 1)) * r;
    if (t < tail * 1e-17) break;
  }
  return Math.min(1, tail);
}
const poisPmf = (x, lam) => Math.exp(-lam + x * Math.log(lam) - lgamma(x + 1));

// Benjamini–Hochberg: trả về q-value theo đúng thứ tự vào.
function bh(ps) {
  const m = ps.length, order = ps.map((p, i) => [p == null ? 1 : p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m);
  let run = 1;
  for (let r = m - 1; r >= 0; r--) {
    run = Math.min(run, (order[r][0] * m) / (r + 1));
    adj[order[r][1]] = run;
  }
  return adj;
}

// Khoảng tin cậy Wilson 95% cho tỷ lệ x/n.
function wilson(x, n, z = 1.959964) {
  if (!n) return [0, 1];
  const p = x / n, z2 = z * z, den = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / den, half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

module.exports = { rng, sampleK, betaI, betaQuantile, binomSf, poisPmf, bh, wilson, mean, sd, quantile };

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
const { PRICE, RULESETS, rulesAt, jackpotTotal } = require('./rules');

// Luật trúng thưởng khai báo ở rules.js (một nơi duy nhất, có phiên bản theo ngày áp dụng).
// RULES[code] = phiên bản đang có hiệu lực: { special, tiers: [{ m | mMax, s, jackpot, value, ... }] }
//   m      : số lượng số chính trùng (chính xác)
//   mMax   : trùng từ 0 đến mMax số chính (giải Khuyến khích Lotto 5/35)
//   s      : phải trùng thêm số đặc biệt
//   jackpot: giải tích lũy, chia đều cho những người cùng trúng
// special: 'pool' = số đặc biệt quay thêm từ các số còn lại (vé trùng nếu có số đó, Power 6/55)
//          'pick' = người chơi tự chọn số đặc biệt riêng (1..bonusMax, Lotto 5/35)
const RULES = {};
for (const code of Object.keys(RULESETS)) RULES[code] = RULESETS[code][RULESETS[code].length - 1];

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
  for (let di = 0; di < draws.length; di++) {
    const d = draws[di];
    const dr = rulesAt(code, d.date) || rule; // luật có hiệu lực vào ngày quay của kỳ đó
    const m = d.main.reduce((a, x) => a + (set.has(x) ? 1 : 0), 0);
    const s = dr.special === 'pool' ? d.bonus.some((x) => set.has(x))
      : dr.special === 'pick' ? d.bonus[0] === ticket.special : false;
    matchObs[m]++;
    const i = tierIndex(dr, m, s);
    if (i < 0) continue;
    counts[i]++;
    const row = (d.prizes || [])[i] || [];
    let prize = toInt(row[3]);
    // Giải tích lũy: lấy TỔNG giá trị (bảng giải có lúc ghi số tiền mỗi vé khi nhiều vé cùng trúng) rồi chia đều cho cả vé này
    if (dr.tiers[i].jackpot) prize = Math.round(jackpotTotal(code, draws, di, i) / (toInt(row[2]) + 1));
    won += prize;
    wins.push({ no: d.no, date: d.date, m, s, tier: i, name: tiers[i].name, prize, main: d.main, bonus: d.bonus || [] });
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

    },
    './prob': function (module, exports, require) {
'use strict';
/**
 * prob.js - Probability Engine: xác suất và giá trị kỳ vọng, tách riêng khỏi phần đề xuất bộ số.
 *
 *  tierTable        : số vé trúng từng hạng (đếm chính xác bằng tổ hợp / siêu bội) -> xác suất từng hạng
 *  expectedValue    : giá trị kỳ vọng của một vé (có/không thuế, có/không tính khả năng phải chia jackpot)
 *  breakEvenJackpot : jackpot cần đạt để kỳ vọng bằng giá vé
 *  rolldownEV       : kỳ vọng của một vé ở "kỳ chia giải" Lotto 5/35
 *  evHistory        : kỳ vọng và tỷ lệ trả thưởng của TỪNG KỲ đã quay, tính từ bảng giải thực tế
 *  simulatePortfolio: mô phỏng Monte Carlo một tập vé (xác suất có ít nhất 1 vé trúng, phân phối tiền thưởng)
 *  exactAnyPrize    : duyệt toàn bộ kết quả có thể để tính CHÍNH XÁC xác suất có ít nhất 1 vé trúng (dùng để kiểm chứng)
 *
 * Mọi vé (bộ số) có cùng xác suất trúng từng hạng. Khác nhau giữa các tập vé chỉ là ĐỘ TRÙNG LẶP:
 * kỳ vọng tiền thưởng cố định không đổi, nhưng xác suất "có ít nhất 1 vé trúng" thì đổi.
 */
const { comb } = require('./stats');
const { TAX, rulesAt, currentRules, isRolldownDraw, rolldownStatus, jackpotTotal, toInt } = require('./rules');
const { tierIndex } = require('./ticket');
const { rng, poisPmf } = require('./mathx');

// ------------------------------------------------------------------ Xác suất từng hạng giải
const tableCache = new Map();
function tierTable(code, date) {
  const r = rulesAt(code, date);
  if (!r) throw new Error('Chưa có luật cho sản phẩm ' + code);
  const key = code + '|' + r.from;
  if (tableCache.has(key)) return tableCache.get(key);
  const k = r.nMain, M = r.max;
  // tổng số vé khác nhau; với 'pick' mỗi bộ số chính đi kèm bonusMax lựa chọn số đặc biệt
  const total = comb(M, k) * (r.special === 'pick' ? r.bonusMax : 1);
  const ways = r.tiers.map(() => 0), match = [];
  let none = 0;
  for (let m = 0; m <= k; m++) {
    const base = comb(k, m);
    let withS = 0, noS;
    if (r.special === 'pool') { // 1 trong M-k số còn lại là số đặc biệt
      withS = base * comb(M - k - 1, k - m - 1);
      noS = base * comb(M - k - 1, k - m);
    } else if (r.special === 'pick') {
      withS = base * comb(M - k, k - m);
      noS = withS * (r.bonusMax - 1);
    } else noS = base * comb(M - k, k - m);
    match.push(withS + noS);
    for (const [s, w] of [[true, withS], [false, noS]]) {
      if (!w) continue;
      const i = tierIndex(r, m, s);
      if (i >= 0) ways[i] += w; else none += w;
    }
  }
  const out = {
    rules: r, total, ways, none, match,
    tiers: r.tiers.map((t, i) => ({ ...t, ways: ways[i], p: ways[i] / total, oneIn: total / ways[i] })),
    pAny: 1 - none / total, pNone: none / total,
  };
  tableCache.set(key, out);
  return out;
}

// ------------------------------------------------------------------ Giá trị kỳ vọng
const afterTax = (v) => (v > TAX.threshold ? v - (v - TAX.threshold) * TAX.rate : v);

// E[g(1 + X)] với X ~ Poisson(lam): X là số vé KHÁC cùng trúng hạng đó.
function overWinners(lam, g) {
  if (!(lam > 1e-12)) return g(1);
  const sdev = Math.sqrt(lam), lo = Math.max(0, Math.floor(lam - 12 * sdev)), hi = Math.ceil(lam + 12 * sdev + 30);
  let s = 0, tot = 0;
  for (let x = lo; x <= hi; x++) { const p = poisPmf(x, lam); tot += p; s += p * g(x + 1); }
  return s / tot;
}

/**
 * Giá trị kỳ vọng (đồng) của MỘT vé.
 *   values      : giá trị từng hạng theo thứ tự tiers (hạng jackpot = số đang tích lũy). Thiếu thì lấy mức chuẩn/khởi điểm.
 *   opts.tax    : true = trừ thuế 10% phần vượt 10 triệu của mỗi giải
 *   opts.tickets: số vé bán ra trong kỳ, để tính khả năng phải chia jackpot (0 = coi như không ai cùng trúng)
 */
function expectedValue(code, values, opts = {}) {
  const tb = tierTable(code, opts.date), n = opts.tickets || 0, vals = values || [], cap = tb.rules.cap;
  const f = (v) => (opts.tax ? afterTax(v) : v);
  const parts = tb.tiers.map((t, i) => {
    let v = vals[i] != null ? vals[i] : (t.value || t.min || 0);
    // Power 6/55: Jackpot 1 vượt trần mà không ai trúng thì phần vượt cộng cho người trúng Jackpot 2
    if (cap && i === cap.to) {
      const top = vals[cap.tier] != null ? vals[cap.tier] : 0;
      if (top > cap.max) v += (top - cap.max) * Math.exp(-n * tb.tiers[cap.tier].p);
    }
    const each = t.jackpot ? overWinners(n * t.p, (w) => f(v / w)) : f(v);
    return { id: t.id, name: t.name, jackpot: !!t.jackpot, p: t.p, value: v, each, ev: t.p * each };
  });
  const ev = parts.reduce((a, x) => a + x.ev, 0), fixed = parts.filter((x) => !x.jackpot).reduce((a, x) => a + x.ev, 0);
  return { ev, ratio: ev / tb.rules.price, fixed, fixedRatio: fixed / tb.rules.price, price: tb.rules.price, parts };
}

// Jackpot (hạng cao nhất) cần đạt để kỳ vọng của vé bằng giá vé; null nếu không thể hòa vốn (do phải chia giải và thuế).
function breakEvenJackpot(code, values, opts = {}) {
  const price = tierTable(code, opts.date).rules.price, vals = (values || []).slice();
  const gap = (J) => { vals[0] = J; return expectedValue(code, vals, opts).ev - price; };
  let lo = 0, hi = 2e12;
  if (gap(hi) < 0) return null;
  for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (gap(mid) < 0) lo = mid; else hi = mid; }
  return hi;
}

/**
 * Kỳ chia giải (Lotto 5/35): kỳ vọng của một vé khi giải Độc Đắc là J và kỳ đó bán n vé.
 *  - Có người trúng Độc Đắc: họ chia nhau J, các hạng khác nhận mức chuẩn.
 *  - Không ai trúng: toàn bộ J chia cho các hạng có `roll`; hạng không có ai trúng thì phần đó chia đều cho các hạng còn lại.
 * Số người cùng trúng mỗi hạng xấp xỉ Poisson. Tổng tiền trả = tiền chuẩn + J nên kỳ vọng ≈ kỳ vọng chuẩn + J / n.
 */
function rolldownEV(code, J, n, opts = {}) {
  const tb = tierTable(code, opts.date), tiers = tb.tiers;
  if (!tb.rules.rolldown) return null;
  const f = (v) => (opts.tax ? afterTax(v) : v);
  const noJp = Math.exp(-n * tiers[0].p); // xác suất không vé nào khác trúng Độc Đắc
  const rollIdx = tiers.map((t, i) => (t.roll ? i : -1)).filter((i) => i >= 0);
  const parts = tiers.map((t, i) => {
    if (t.jackpot) return { id: t.id, name: t.name, p: t.p, ev: t.p * overWinners(n * t.p, (w) => f(J / w)) };
    if (!t.roll) return { id: t.id, name: t.name, p: t.p, ev: t.p * f(t.value) };
    let share = t.roll; // cộng phần dồn về từ các hạng chia giải không có ai trúng
    for (const j of rollIdx) if (j !== i) share += (tiers[j].roll * Math.exp(-n * tiers[j].p)) / (rollIdx.length - 1);
    const rolled = overWinners(n * t.p, (w) => f(t.value + (share * J) / w));
    return { id: t.id, name: t.name, p: t.p, share, ev: t.p * (noJp * rolled + (1 - noJp) * f(t.value)) };
  });
  const ev = parts.reduce((a, x) => a + x.ev, 0);
  return { ev, ratio: ev / tb.rules.price, parts, pNoJackpot: noJp, price: tb.rules.price };
}

/**
 * Kỳ vọng và tỷ lệ trả thưởng của từng kỳ ĐÃ QUAY (draws tăng dần, có prizes = bảng giải thực tế).
 *   tickets  : số vé bán ra ước tính = số giải hạng thấp nhất / xác suất hạng đó (sai số vài %, do độ ưa chuộng của các số)
 *   evNominal: kỳ vọng danh nghĩa 1 vé (chưa thuế, coi như không ai cùng trúng jackpot)
 *   evShared : có tính khả năng phải chia jackpot theo số vé bán ra ước tính
 *   payout   : tổng tiền trả thưởng thực tế / doanh thu ước tính của kỳ
 */
function evHistory(code, draws) {
  const rows = [];
  draws.forEach((d, idx) => {
    if (!d.prizes || !d.prizes.length) return;
    const tb = tierTable(code, d.date), tiers = tb.tiers, price = tb.rules.price;
    const winners = tiers.map((t, i) => toInt((d.prizes[i] || [])[2]));
    // giá trị từng hạng; giải tích lũy quy về TỔNG (bảng giải có lúc ghi số tiền mỗi vé khi nhiều vé cùng trúng)
    const values = tiers.map((t, i) => (t.jackpot ? jackpotTotal(code, draws, idx, i) : toInt((d.prizes[i] || [])[3])));
    const L = tiers.length - 1, tickets = winners[L] / tiers[L].p;
    if (!(tickets > 0)) return;
    const roll = isRolldownDraw(code, d);
    // kỳ được XÁC ĐỊNH TRƯỚC là kỳ chia giải (chỉ dùng dữ liệu trước kỳ đó), dù sau đó có người trúng Độc Đắc hay không
    let scheduled = roll;
    if (tb.rules.rolldown && !roll && idx > 0 && values[0] > tb.rules.rolldown.over) {
      const stt = rolldownStatus(code, draws.slice(0, idx));
      scheduled = !!(stt && stt.pending && stt.rollNo === d.no);
    }
    let evNominal, evShared, paid = 0;
    tiers.forEach((t, i) => { paid += t.jackpot ? (winners[i] > 0 ? values[i] : 0) : winners[i] * values[i]; });
    if (scheduled) { // toàn bộ Độc Đắc chắc chắn được trả (cho người trúng, hoặc chia xuống các hạng dưới): kỳ vọng ≈ chuẩn + J / số vé
      const std = tiers.reduce((a, t) => a + (t.jackpot ? 0 : t.p * t.value), 0);
      evNominal = evShared = std + values[0] / tickets;
    } else {
      evNominal = expectedValue(code, values, { date: d.date }).ev;
      evShared = expectedValue(code, values, { date: d.date, tickets }).ev;
    }
    rows.push({
      no: d.no, date: d.date, tickets: Math.round(tickets), jackpot: values[0], jackpotWon: winners[0] > 0, rolldown: roll, scheduled,
      evNominal, evShared, ratio: evShared / price, payout: paid / (tickets * price),
    });
  });
  const avg = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
  const normal = rows.filter((x) => !x.scheduled), rolls = rows.filter((x) => x.scheduled);
  const sales = rows.reduce((s, x) => s + x.tickets, 0);
  return {
    rows,
    summary: {
      draws: rows.length,
      meanRatio: avg(rows, (x) => x.ratio), meanRatioNormal: avg(normal, (x) => x.ratio), meanRatioRoll: avg(rolls, (x) => x.ratio),
      rolldowns: rolls.length, rolled: rows.filter((x) => x.rolldown).length, above1: rows.filter((x) => x.ratio >= 1).length,
      // tỷ lệ trả thưởng thực tế tính gộp cả lịch sử (tổng tiền trả / tổng doanh thu ước tính)
      payout: sales ? rows.reduce((s, x) => s + x.payout * x.tickets, 0) / sales : 0,
      meanTickets: avg(rows.slice(-30), (x) => x.tickets), best: rows.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 10),
    },
  };
}

/**
 * Dự tính cho KỲ KẾ TIẾP từ các kỳ đã quay: giá trị từng hạng và số vé bán ra.
 *  - Giải tích lũy: kỳ gần nhất có người trúng (hoặc vừa chia giải) thì về mức khởi điểm; chưa ai trúng thì cộng mức tăng trung vị gần đây.
 *  - Số vé: trung vị 10 kỳ thường gần nhất. Với kỳ chia giải (Lotto 5/35) doanh số tăng mạnh nên trả thêm các kịch bản riêng.
 * Vietlott không công bố các số này trước kỳ quay, nên đây là ƯỚC TÍNH.
 */
function forecast(code, draws) {
  const r = currentRules(code), tb = tierTable(code), n = draws.length;
  if (!n) return null;
  const hist = evHistory(code, draws.slice(-120)).rows;
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const last = draws[n - 1], lastRolled = isRolldownDraw(code, last);
  const values = r.tiers.map((t, j) => {
    if (!t.jackpot) return t.value;
    const cur = jackpotTotal(code, draws, n - 1, j), won = toInt(((last.prizes || [])[j] || [])[2]) > 0;
    if (won || lastRolled) return t.min;
    const inc = [];
    for (let i = Math.max(1, n - 40); i < n; i++) {
      const a = draws[i - 1].prizes && draws[i - 1].prizes[j], b = draws[i].prizes && draws[i].prizes[j];
      if (a && b && toInt(a[2]) === 0 && !isRolldownDraw(code, draws[i - 1]) && !isRolldownDraw(code, draws[i])) {
        const dlt = toInt(b[3]) - toInt(a[3]);
        if (dlt > 0) inc.push(dlt);
      }
    }
    let v = cur + med(inc);
    // Power 6/55: kỳ trước Jackpot 1 vượt trần và có người trúng Jackpot 2 thì Jackpot 1 đã về mức trần
    if (r.cap && j === r.cap.tier && cur > r.cap.max && toInt(((last.prizes || [])[r.cap.to] || [])[2]) > 0) v = r.cap.max;
    return v;
  });
  const tickets = Math.round(med(hist.filter((x) => !x.scheduled).slice(-10).map((x) => x.tickets)));
  const out = { values, tickets, jackpots: r.tiers.map((t, j) => (t.jackpot ? j : -1)).filter((j) => j >= 0) };
  const status = rolldownStatus(code, draws);
  if (status) {
    out.rolldown = status;
    const past = evHistory(code, draws).rows, sched = past.filter((x) => x.scheduled);
    // tỷ lệ doanh thu cộng vào Độc Đắc ngay trong kỳ chia giải, và doanh số các kỳ chia giải gần đây
    const byNo = new Map(past.map((x) => [x.no, x]));
    const rates = sched.map((x) => { const prev = byNo.get(x.no - 1); return prev ? (x.jackpot - prev.jackpot) / (x.tickets * tb.rules.price) : null; }).filter((v) => v != null && v > 0 && v < 1);
    out.rollStats = { count: sched.length, rolled: sched.filter((x) => x.rolldown).length, rate: med(rates), tickets: med(sched.slice(-5).map((x) => x.tickets)) };
  }
  return out;
}

// ------------------------------------------------------------------ Tập nhiều vé
// tickets: [{ numbers: [...], special }] ; trả về mảng số (1 = có trong vé) cho từng vé
function membership(tickets, M) {
  return tickets.map((t) => { const a = new Uint8Array(M + 1); for (const n of t.numbers) a[n] = 1; return a; });
}

/**
 * Mô phỏng một tập vé qua `sims` kỳ quay ngẫu nhiên (có hạt giống nên lặp lại được).
 * Tiền thưởng chỉ tính các hạng CỐ ĐỊNH (jackpot quá hiếm để mô phỏng; xác suất jackpot tính chính xác bằng công thức).
 */
function simulatePortfolio(code, tickets, opts = {}) {
  const tb = tierTable(code), r = tb.rules, M = r.max, k = r.nMain, n = tickets.length;
  const sims = opts.sims || 100000, rnd = rng(opts.seed || 20260101);
  const mem = membership(tickets, M), pool = new Int32Array(M), mark = new Uint8Array(M + 1);
  const tierHits = r.tiers.map(() => 0), winnersHist = new Array(n + 1).fill(0);
  let any = 0, sum = 0, sum2 = 0;
  for (let i = 0; i < M; i++) pool[i] = i + 1;
  const need = r.special === 'pool' ? k + 1 : k;
  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < need; i++) { // rút không hoàn lại
      const j = i + Math.floor(rnd() * (M - i)), t = pool[i];
      pool[i] = pool[j]; pool[j] = t;
    }
    for (let i = 0; i < k; i++) mark[pool[i]] = 1;
    const bonus = r.special === 'pool' ? pool[k] : r.special === 'pick' ? 1 + Math.floor(rnd() * r.bonusMax) : 0;
    let w = 0, prize = 0;
    for (let t = 0; t < n; t++) {
      const nums = tickets[t].numbers;
      let m = 0;
      for (let i = 0; i < nums.length; i++) m += mark[nums[i]];
      const sp = r.special === 'pool' ? mem[t][bonus] === 1 : r.special === 'pick' ? tickets[t].special === bonus : false;
      const ti = tierIndex(r, m, sp);
      if (ti >= 0) { w++; tierHits[ti]++; if (!r.tiers[ti].jackpot) prize += r.tiers[ti].value; }
    }
    for (let i = 0; i < k; i++) mark[pool[i]] = 0;
    if (w) any++;
    winnersHist[w]++;
    sum += prize; sum2 += prize * prize;
  }
  const pAny = any / sims, meanPrize = sum / sims;
  return {
    sims, pAny, se: Math.sqrt((pAny * (1 - pAny)) / sims),
    meanPrize, sdPrize: Math.sqrt(Math.max(0, sum2 / sims - meanPrize * meanPrize)),
    tierMean: tierHits.map((c) => c / sims), winnersDist: winnersHist.map((c) => c / sims),
  };
}

// Các con số tính được CHÍNH XÁC cho một tập vé (không cần mô phỏng).
function portfolioExact(code, tickets) {
  const tb = tierTable(code), n = tickets.length;
  const keys = new Set(tickets.map((t) => t.numbers.slice().sort((a, b) => a - b).join(',') + '|' + (t.special || '')));
  const fixedEv = tb.tiers.filter((t) => !t.jackpot).reduce((a, t) => a + t.p * t.value, 0);
  return {
    tickets: n, distinct: keys.size, cost: n * tb.rules.price,
    pJackpot: keys.size * tb.tiers[0].p, // các vé khác nhau thì các biến cố trúng giải cao nhất loại trừ nhau
    expectedPrizes: tb.tiers.map((t) => n * t.p), expectedFixed: n * fixedEv,
    pAnyIndependent: 1 - Math.pow(1 - tb.pAny, n), pAnyUpper: Math.min(1, n * tb.pAny),
  };
}

/**
 * Duyệt TOÀN BỘ kết quả quay có thể để tính chính xác P(ít nhất 1 vé trúng giải).
 * Chỉ dùng cho kiểm chứng (Mega 6/45: 8,1 triệu kết quả; Lotto 5/35: 324.632 x 12).
 */
function exactAnyPrize(code, tickets) {
  const tb = tierTable(code), r = tb.rules, M = r.max, k = r.nMain, n = tickets.length;
  const has = Array.from({ length: M + 1 }, () => []);
  tickets.forEach((t, i) => t.numbers.forEach((x) => has[x].push(i)));
  // số đặc biệt chỉ ảnh hưởng tới "có trúng hay không" ở loại 'pick'
  const minM = Math.min(...r.tiers.filter((t) => !t.s && t.m != null).map((t) => t.m));
  const spOnly = r.special === 'pick' && r.tiers.some((t) => t.s && t.mMax != null);
  const specials = spOnly ? r.bonusMax : 1;
  const cnt = new Int8Array(n);
  let win = 0;
  const rec = (start, depth) => {
    if (depth === k) {
      let anyMain = false;
      for (let i = 0; i < n; i++) if (cnt[i] >= minM) { anyMain = true; break; }
      if (anyMain) { win += specials; return; }
      if (!spOnly) return;
      const seen = new Set();
      for (let i = 0; i < n; i++) seen.add(tickets[i].special); // trùng số đặc biệt là đủ trúng Khuyến khích
      win += seen.size;
      return;
    }
    for (let x = start; x <= M - (k - depth) + 1; x++) {
      const list = has[x];
      for (let j = 0; j < list.length; j++) cnt[list[j]]++;
      rec(x + 1, depth + 1);
      for (let j = 0; j < list.length; j++) cnt[list[j]]--;
    }
  };
  rec(1, 0);
  return win / (comb(M, k) * specials);
}

module.exports = {
  tierTable, afterTax, expectedValue, breakEvenJackpot, rolldownEV, evHistory, forecast,
  simulatePortfolio, portfolioExact, exactAnyPrize,
};

    },
    './explore': function (module, exports, require) {
'use strict';
/**
 * explore.js - Statistical Engine (phần chuyên sâu): thống kê mô tả chi tiết và các kiểm định bổ sung.
 * Không phụ thuộc DB, chạy được trên trình duyệt. Dữ liệu vào giống stats.js: draws tăng dần { no, date, main, bonus }.
 *
 * Nguyên tắc:
 *  - Mọi "kỳ vọng" đều tính theo đúng mô hình rút KHÔNG hoàn lại k số từ M số (siêu bội), không dùng công thức độc lập.
 *  - Mọi nhóm phép thử nhiều giả thuyết (từng số, từng cặp, từng bộ ba, từng giai đoạn...) đều có hiệu chỉnh
 *    (Bonferroni / Holm / Benjamini–Hochberg) để không nhầm dao động ngẫu nhiên thành quy luật.
 *  - Kết quả là MÔ TẢ quá khứ. Một con số "nóng", "lạnh" hay "đến chu kỳ" không có xác suất ra cao hơn ở kỳ sau.
 */
const S = require('./stats');
const { betaI, betaQuantile, binomSf, bh, rng } = require('./mathx');

const WINDOWS = [10, 20, 30, 50, 100];
const fi = (x) => Math.round(x).toLocaleString('vi-VN');
const fd = (x, d = 1) => Number(x).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fpct = (x) => { const v = x * 100; return (v >= 10 ? fd(v, 0) : v >= 1 ? fd(v, 1) : fd(v, 2)) + '%'; };

// ------------------------------------------------------------------ Tần suất theo nhiều cửa sổ
function frequency(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max, p0 = k / M;
  const wins = WINDOWS.filter((w) => w < W);
  const all = new Array(M + 1).fill(0), win = {};
  for (const w of wins) win[w] = new Array(M + 1).fill(0);
  // xu hướng: so tần suất `ws` kỳ gần nhất với phần lịch sử còn lại (hai mẫu độc lập)
  const ws = Math.min(30, Math.floor(W / 3)), recent = new Array(M + 1).fill(0);
  // ổn định: chia lịch sử thành B khối bằng nhau, xem số lần ra của từng số có dao động quá mức ngẫu nhiên không
  const B = Math.max(2, Math.min(10, Math.floor(W / 50))), blocks = Array.from({ length: M + 1 }, () => new Array(B).fill(0));
  const blockLen = new Array(B).fill(0);
  draws.forEach((d, t) => {
    const b = Math.min(B - 1, Math.floor((t * B) / W));
    blockLen[b]++;
    for (const n of d.main) {
      all[n]++; blocks[n][b]++;
      if (t >= W - ws) recent[n]++;
      for (const w of wins) if (t >= W - w) win[w][n]++;
    }
  });
  const sdAll = Math.sqrt(W * p0 * (1 - p0));
  const rows = [];
  for (let n = 1; n <= M; n++) {
    const w = {};
    for (const x of wins) w[x] = { c: win[x][n], z: (win[x][n] - x * p0) / Math.sqrt(x * p0 * (1 - p0)) };
    const rest = W - ws;
    const trendZ = (recent[n] / ws - (all[n] - recent[n]) / rest) / Math.sqrt(p0 * (1 - p0) * (1 / ws + 1 / rest));
    // Σ (c_b - L_b p̂)² / (L_b p̂ (1-p̂)) ~ khi bình phương bậc B-1 (xấp xỉ) nếu tần suất của số này ổn định qua các khối
    const ph = Math.min(0.999, Math.max(0.001, all[n] / W));
    let disp = 0;
    for (let b = 0; b < B; b++) disp += (blocks[n][b] - blockLen[b] * ph) ** 2 / (blockLen[b] * ph * (1 - ph));
    rows.push({
      n, all: all[n], rate: all[n] / W, z: (all[n] - W * p0) / sdAll, w, trendZ,
      disp: disp / (B - 1), dispP: S.chi2Sf(disp, B - 1),
    });
  }
  const trendQ = bh(rows.map((r) => S.normP2(r.trendZ))), dispQ = bh(rows.map((r) => r.dispP));
  rows.forEach((r, i) => { r.trendQ = trendQ[i]; r.dispQ = dispQ[i]; });
  return {
    windows: wins, trendWindow: ws, blocks: B, expectedRate: p0, rows,
    trendFlag: rows.filter((r) => r.trendQ < 0.05).length, unstable: rows.filter((r) => r.dispQ < 0.05).length,
  };
}

// ------------------------------------------------------------------ Chu kỳ / khoảng cách
function cycles(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max, p0 = k / M;
  const lastIdx = new Array(M + 1).fill(-1), gaps = Array.from({ length: M + 1 }, () => []);
  draws.forEach((d, t) => { for (const n of d.main) { if (lastIdx[n] >= 0) gaps[n].push(t - lastIdx[n]); lastIdx[n] = t; } });
  const rows = [];
  for (let n = 1; n <= M; n++) {
    const g = gaps[n].slice().sort((a, b) => a - b), c = g.length;
    const mean = c ? g.reduce((a, b) => a + b, 0) / c : null;
    const sd = c > 1 ? Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (c - 1)) : null;
    const wait = lastIdx[n] >= 0 ? W - 1 - lastIdx[n] : W;
    rows.push({
      n, wait, gaps: c, mean, median: c ? g[Math.floor((c - 1) / 2)] : null, min: c ? g[0] : null, max: c ? g[c - 1] : null, sd,
      cv: sd != null && mean ? sd / mean : null,
      due: mean ? (wait + 1) / mean : null,   // khoảng cách đang chạy so với chu kỳ trung bình của chính số đó
      pWait: Math.pow(1 - p0, wait),          // xác suất một số vắng ít nhất chừng đó kỳ (quay ngẫu nhiên)
    });
  }
  // chu kỳ theo từng giai đoạn: khoảng cách trung bình của các lần ra rơi vào mỗi 1/3 lịch sử
  const parts = [0, 1, 2].map((i) => ({ from: draws[Math.floor((i * W) / 3)].date, to: draws[Math.floor(((i + 1) * W) / 3) - 1].date, sum: 0, n: 0 }));
  const li = new Array(M + 1).fill(-1);
  draws.forEach((d, t) => { for (const n of d.main) { if (li[n] >= 0) { const p = parts[Math.min(2, Math.floor((t * 3) / W))]; p.sum += t - li[n]; p.n++; } li[n] = t; } });
  return {
    rows,
    theory: { mean: 1 / p0, median: Math.ceil(Math.log(0.5) / Math.log(1 - p0)), sd: Math.sqrt(1 - p0) / p0 },
    parts: parts.map((p) => ({ from: p.from, to: p.to, mean: p.n ? p.sum / p.n : null, gaps: p.n })),
  };
}

// ------------------------------------------------------------------ Cấu trúc dãy số
function structure(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max, H = Math.floor(M / 2), fpc = (M - 1) / (M - k), C = S.comb;
  const lowObs = new Array(k + 1).fill(0), conObs = new Array(k).fill(0);
  const G = Math.ceil((M + 1) / 10), decObs = new Array(G).fill(0), decSize = new Array(G).fill(0);
  const digObs = new Array(10).fill(0), digSize = new Array(10).fill(0);
  for (let n = 1; n <= M; n++) { decSize[Math.floor(n / 10)]++; digSize[n % 10]++; }
  const cls = new Map();
  let spanSum = 0, minSum = 0, maxSum = 0, sdSum = 0, sumSum = 0, sumSq = 0;
  const feat = (main) => {
    const s = main.slice().sort((a, b) => a - b);
    const sum = s.reduce((a, b) => a + b, 0), mean = sum / k;
    let con = 0, gmin = Infinity, gmax = 0;
    for (let i = 1; i < k; i++) { const g = s[i] - s[i - 1]; if (g === 1) con++; if (g < gmin) gmin = g; if (g > gmax) gmax = g; }
    return {
      sorted: s, sum, mean, median: k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2,
      sd: Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (k - 1)),
      odd: s.filter((n) => n % 2 === 1).length, low: s.filter((n) => n <= H).length,
      consecutive: con, gapMin: gmin, gapMax: gmax, span: s[k - 1] - s[0], first: s[0], last: s[k - 1],
    };
  };
  for (const d of draws) {
    const f = feat(d.main);
    lowObs[f.low]++; conObs[f.consecutive]++;
    for (const n of d.main) { decObs[Math.floor(n / 10)]++; digObs[n % 10]++; }
    const key = f.odd + '|' + f.low;
    cls.set(key, (cls.get(key) || 0) + 1);
    spanSum += f.span; minSum += f.first; maxSum += f.last; sdSum += f.sd; sumSum += f.sum; sumSq += f.sum * f.sum;
  }
  const lowProb = lowObs.map((_, j) => S.hyperPmf(M, H, k, j));
  const conProb = conObs.map((_, r) => (C(k - 1, r) * C(M - k + 1, k - r)) / C(M, k));
  const groupTest = (obs, size) => {
    let x2 = 0;
    obs.forEach((o, g) => { if (size[g]) { const e = (W * k * size[g]) / M; x2 += (o - e) ** 2 / e; } });
    const df = size.filter(Boolean).length - 1, stat = x2 * fpc;
    return { stat, df, p: S.chi2Sf(stat, df) };
  };
  // phân lớp (số lẻ, số nhỏ): xác suất chính xác bằng siêu bội nhiều chiều
  let nOL = 0, nOH = 0, nEL = 0, nEH = 0;
  for (let n = 1; n <= M; n++) { if (n % 2) { if (n <= H) nOL++; else nOH++; } else if (n <= H) nEL++; else nEH++; }
  const classes = [];
  for (let o = 0; o <= k; o++) for (let l = 0; l <= k; l++) {
    let ways = 0;
    for (let a = 0; a <= Math.min(o, l); a++) ways += C(nOL, a) * C(nOH, o - a) * C(nEL, l - a) * C(nEH, k - o - l + a);
    if (ways > 0) classes.push({ odd: o, low: l, p: ways / C(M, k), obs: cls.get(o + '|' + l) || 0, exp: (ways / C(M, k)) * W });
  }
  classes.sort((a, b) => b.p - a.p);
  const meanSum = sumSum / W;
  const lowT = S.gof(lowObs, lowProb, W), conT = S.gof(conObs, conProb, W), decT = groupTest(decObs, decSize), digT = groupTest(digObs, digSize);
  const jMode = lowProb.indexOf(Math.max(...lowProb));
  return {
    half: H,
    low: lowObs.map((c, j) => ({ j, obs: c, exp: lowProb[j] * W })),
    consecutive: conObs.map((c, r) => ({ r, obs: c, exp: conProb[r] * W })),
    decades: decObs.map((o, g) => ({ label: (g === 0 ? 1 : g * 10) + '–' + Math.min(M, g * 10 + 9), obs: o, exp: (W * k * decSize[g]) / M })).filter((x, g) => decSize[g]),
    digits: digObs.map((o, g) => ({ label: String(g), obs: o, exp: (W * k * digSize[g]) / M })).filter((x, g) => digSize[g]),
    classes: classes.slice(0, 14),
    means: {
      sum: { obs: meanSum, theory: (k * (M + 1)) / 2 },
      sumSd: { obs: Math.sqrt(Math.max(0, sumSq / W - meanSum * meanSum)), theory: Math.sqrt((k * (M + 1) * (M - k)) / 12) },
      span: { obs: spanSum / W, theory: ((k - 1) * (M + 1)) / (k + 1) },
      first: { obs: minSum / W, theory: (M + 1) / (k + 1) },
      last: { obs: maxSum / W, theory: (k * (M + 1)) / (k + 1) },
      sd: { obs: sdSum / W },
    },
    latest: feat(draws[W - 1].main),
    tests: [
      { key: 'lowhigh', question: `Số lượng số nhỏ (1–${H}) và số lớn mỗi kỳ có bình thường không?`,
        method: 'So với phân phối siêu bội (xác suất chính xác khi rút không lặp lại).', ...lowT,
        facts: `Phổ biến nhất là kỳ có ${jMode} số nhỏ: thực tế ${fpct(lowObs[jMode] / W)}, lý thuyết ${fpct(lowProb[jMode])}.` },
      { key: 'consec', question: 'Số cặp số liền nhau trong một kỳ có đúng phân phối lý thuyết không?',
        method: 'So với phân phối chính xác của số cặp liền nhau: C(k−1, r)·C(M−k+1, k−r) / C(M, k).', ...conT,
        facts: `${fpct(conObs[0] / W)} số kỳ không có cặp liền nhau (lý thuyết ${fpct(conProb[0])}).` },
      { key: 'decades', question: 'Các số có phân bố đều giữa các khoảng chục (1–9, 10–19, ...) không?',
        method: 'Khi bình phương theo nhóm, có hiệu chỉnh rút không hoàn lại (nhân (M−1)/(M−k)).', ...decT,
        facts: `Chia ${M} số thành ${decSize.filter(Boolean).length} khoảng; so số lần ra của mỗi khoảng với kỳ vọng theo kích thước khoảng.` },
      { key: 'digits', question: 'Chữ số cuối (đuôi 0–9) của các số ra có đều không?',
        method: 'Khi bình phương theo nhóm đuôi số, có hiệu chỉnh rút không hoàn lại.', ...digT,
        facts: 'So số lần ra của từng đuôi với kỳ vọng theo số lượng số mang đuôi đó.' },
    ],
  };
}

// ------------------------------------------------------------------ Theo thời gian
const QUARTER = (date) => date.slice(0, 4) + ' Q' + (Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1);
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
function periodTable(draws, game, unit) {
  const k = game.nMain, M = game.max, p0 = k / M;
  const slot = new Map();
  const keyOf = (d, i) => {
    if (unit === 'year') return d.date.slice(0, 4);
    if (unit === 'quarter') return QUARTER(d.date);
    if (unit === 'month') return d.date.slice(0, 7);
    if (unit === 'moy') return 'Tháng ' + Number(d.date.slice(5, 7));
    if (unit === 'weekday') return WD[new Date(d.date + 'T00:00:00Z').getUTCDay()];
    // slot: kỳ thứ mấy trong ngày (Lotto 5/35 quay 13h và 21h)
    const prev = i > 0 && draws[i - 1].date === d.date ? slot.get(i - 1) + 1 : 0;
    slot.set(i, prev);
    return 'Kỳ thứ ' + (prev + 1) + ' trong ngày';
  };
  const groups = new Map();
  draws.forEach((d, i) => { const key = keyOf(d, i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(d); });
  const rows = [];
  for (const [label, list] of groups) {
    const n = list.length, count = new Array(M + 1).fill(0);
    for (const d of list) for (const x of d.main) count[x]++;
    const order = [];
    for (let x = 1; x <= M; x++) order.push(x);
    order.sort((a, b) => count[b] - count[a] || a - b);
    const enough = n * p0 >= 4; // kỳ vọng mỗi số đủ lớn thì mới làm kiểm định khi bình phương
    const u = enough ? S.uniformityTest(list, game) : null;
    rows.push({
      label, draws: n, from: list[0].date, to: list[n - 1].date, p: u ? u.p : null, stat: u ? u.stat : null,
      hot: order.slice(0, 3).map((x) => ({ n: x, c: count[x] })), cold: order.slice(-3).reverse().map((x) => ({ n: x, c: count[x] })),
      z: unit === 'year' ? count.slice(1).map((c) => Math.round(((c - n * p0) / Math.sqrt(n * p0 * (1 - p0))) * 10) / 10) : undefined,
    });
  }
  if (unit === 'moy') rows.sort((a, b) => Number(a.label.replace(/\D/g, '')) - Number(b.label.replace(/\D/g, '')));
  if (unit === 'weekday') rows.sort((a, b) => ((WD.indexOf(a.label) + 6) % 7) - ((WD.indexOf(b.label) + 6) % 7));
  const tested = rows.filter((r) => r.p != null), adj = S.holm(tested.map((r) => r.p));
  tested.forEach((r, i) => { r.pAdj = adj[i]; });
  const tot = tested.reduce((a, r) => a + r.stat, 0), df = tested.length * (M - 1);
  return { unit, rows, tested: tested.length, pooled: tested.length ? { stat: tot, df, p: S.chi2Sf(tot, df) } : null, minPAdj: tested.length ? Math.min(...adj) : null };
}

// Trung bình và độ lệch chuẩn của "tương quan giữa hai nửa lịch sử" khi máy quay hoàn toàn ngẫu nhiên.
// Các cặp có chung một số phụ thuộc lẫn nhau nên công thức chuẩn (coi 990 cặp là độc lập) cho p quá nhỏ (đã kiểm chứng bằng mô phỏng);
// vì vậy lấy phân phối gốc từ `sims` lần mô phỏng máy quay công bằng có cùng số kỳ (hạt giống cố định nên lặp lại được).
const halvesCache = new Map();
function halvesNull(W, k, M, sims = 400, seed = 31337) {
  const key = W + '|' + k + '|' + M;
  if (halvesCache.has(key)) return halvesCache.get(key);
  const rnd = rng(seed), D = M + 1, half = Math.floor(W / 2), nP = (M * (M - 1)) / 2;
  const h1 = new Uint16Array(D * D), h2 = new Uint16Array(D * D), pool = new Int32Array(M);
  for (let i = 0; i < M; i++) pool[i] = i + 1;
  let sum = 0, sum2 = 0;
  for (let s = 0; s < sims; s++) {
    h1.fill(0); h2.fill(0);
    for (let t = 0; t < W; t++) {
      for (let i = 0; i < k; i++) { const j = i + Math.floor(rnd() * (M - i)), tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
      const h = t < half ? h1 : h2;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { const a = pool[i], b = pool[j]; h[a < b ? a * D + b : b * D + a]++; }
    }
    let s1 = 0, s2 = 0, s11 = 0, s22 = 0, s12 = 0;
    for (let a = 1; a <= M; a++) for (let b = a + 1; b <= M; b++) { const x = h1[a * D + b], y = h2[a * D + b]; s1 += x; s2 += y; s11 += x * x; s22 += y * y; s12 += x * y; }
    const cov = s12 / nP - (s1 / nP) * (s2 / nP), v1 = s11 / nP - (s1 / nP) ** 2, v2 = s22 / nP - (s2 / nP) ** 2;
    const r = v1 > 0 && v2 > 0 ? cov / Math.sqrt(v1 * v2) : 0;
    sum += r; sum2 += r * r;
  }
  const out = { mean: sum / sims, sd: Math.sqrt(Math.max(1e-12, sum2 / sims - (sum / sims) ** 2)), sims };
  halvesCache.set(key, out);
  return out;
}

// ------------------------------------------------------------------ Cặp số: support / confidence / lift, có hiệu chỉnh
function pairTable(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max, D = M + 1;
  const q = (k * (k - 1)) / (M * (M - 1)), eP = W * q;
  const cnt = new Array(D).fill(0), pc = new Uint16Array(D * D), lastT = new Int32Array(D * D).fill(-1);
  const half = Math.floor(W / 2), h1 = new Uint16Array(D * D);
  draws.forEach((d, t) => {
    const s = d.main.slice().sort((a, b) => a - b);
    for (let i = 0; i < k; i++) {
      cnt[s[i]]++;
      for (let j = i + 1; j < k; j++) { const key = s[i] * D + s[j]; pc[key]++; lastT[key] = t; if (t < half) h1[key]++; }
    }
  });
  const rows = [], pCache = new Map();
  for (let a = 1; a <= M; a++) for (let b = a + 1; b <= M; b++) {
    const key = a * D + b, c = pc[key];
    if (!pCache.has(c)) pCache.set(c, S.binomP2(c, W, q));
    rows.push({
      a, b, c, lift: c / eP, support: c / W, confA: cnt[a] ? c / cnt[a] : 0, confB: cnt[b] ? c / cnt[b] : 0,
      since: lastT[key] >= 0 ? W - 1 - lastT[key] : null, p: pCache.get(c), h1: h1[key], h2: c - h1[key],
    });
  }
  const qv = bh(rows.map((r) => r.p)), nPairs = rows.length;
  rows.forEach((r, i) => { r.q = qv[i]; });
  // Ổn định qua hai nửa lịch sử: nếu có cặp "hay đi cùng nhau" thật thì số lần ở nửa đầu và nửa sau phải tương quan dương.
  const m1 = rows.reduce((a, r) => a + r.h1, 0) / nPairs, m2 = rows.reduce((a, r) => a + r.h2, 0) / nPairs;
  let sxy = 0, sxx = 0, syy = 0;
  for (const r of rows) { sxy += (r.h1 - m1) * (r.h2 - m2); sxx += (r.h1 - m1) ** 2; syy += (r.h2 - m2) ** 2; }
  const corr = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, nul = halvesNull(W, k, M), corrZ = (corr - nul.mean) / nul.sd;
  const byCount = rows.slice().sort((x, y) => y.c - x.c || x.a - y.a || x.b - y.b);
  const slim = (r) => ({ a: r.a, b: r.b, c: r.c, lift: r.lift, support: r.support, confA: r.confA, confB: r.confB, since: r.since, p: r.p, q: r.q });
  return {
    nPairs, expected: eP, q0: q, confTheory: (k - 1) / (M - 1),
    top: byCount.slice(0, 40).map(slim), bottom: byCount.slice(-20).reverse().map(slim),
    raw05: rows.filter((r) => r.p < 0.05).length, raw05Expected: 0.05 * nPairs,
    fdr05: rows.filter((r) => r.q < 0.05).length, bonf05: rows.filter((r) => r.p * nPairs < 0.05).length,
    halves: { corr, z: corrZ, p: S.normP2(corrZ), draws1: half, draws2: W - half, nullSd: nul.sd, sims: nul.sims },
  };
}

// ------------------------------------------------------------------ Nhóm 3, 4 số và độ trùng giữa các kỳ
function popcount(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
function groupTable(draws, game, size) {
  const W = draws.length, k = game.nMain, M = game.max, C = S.comb;
  const nGroups = C(M, size), q = C(M - size, k - size) / C(M, k), exp = W * q;
  const map = new Map(), idx = [];
  const rec = (s, start, key, depth) => {
    if (depth === size) { map.set(key, (map.get(key) || 0) + 1); return; }
    for (let i = start; i < k; i++) rec(s, i + 1, key * 64 + s[i], depth + 1);
  };
  for (const d of draws) rec(d.main.slice().sort((a, b) => a - b), 0, 0, 0);
  const hist = [];
  let maxC = 0;
  for (const c of map.values()) { hist[c] = (hist[c] || 0) + 1; if (c > maxC) maxC = c; }
  hist[0] = nGroups - map.size;
  const top = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 12).map(([key, c]) => {
    const nums = [];
    for (let i = 0; i < size; i++) { nums.unshift(key % 64); key = Math.floor(key / 64); }
    return { nums, c, pOne: binomSf(c, W, q) };
  });
  // Xác suất có ÍT NHẤT MỘT nhóm đạt mức cao nhất quan sát được, nếu quay hoàn toàn ngẫu nhiên (xấp xỉ Poisson)
  const pMax = 1 - Math.exp(-nGroups * binomSf(maxC, W, q));
  const dist = [];
  for (let c = 0; c <= maxC; c++) {
    const pmf = Math.exp(S.lgamma(W + 1) - S.lgamma(c + 1) - S.lgamma(W - c + 1) + c * Math.log(q) + (W - c) * Math.log(1 - q));
    dist.push({ c, obs: hist[c] || 0, exp: nGroups * pmf });
  }
  return { size, nGroups, expected: exp, max: maxC, pMax, top, dist };
}
function overlaps(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max;
  const lo = new Int32Array(W), hi = new Int32Array(W);
  draws.forEach((d, t) => { for (const n of d.main) { if (n <= 30) lo[t] |= 1 << (n - 1); else hi[t] |= 1 << (n - 31); } });
  const obs = new Array(k + 1).fill(0);
  for (let i = 0; i < W; i++) { const a = lo[i], b = hi[i]; for (let j = i + 1; j < W; j++) obs[popcount(a & lo[j]) + popcount(b & hi[j])]++; }
  const pairs = (W * (W - 1)) / 2;
  return { pairs, dist: obs.map((c, m) => ({ m, obs: c, exp: pairs * S.hyperPmf(M, k, k, m) })), identical: obs[k] };
}

// ------------------------------------------------------------------ Phụ thuộc theo thời gian: runs test, tự tương quan
function serial(draws, game) {
  const W = draws.length, k = game.nMain, M = game.max;
  const seq = Array.from({ length: M + 1 }, () => new Uint8Array(W));
  draws.forEach((d, t) => { for (const n of d.main) seq[n][t] = 1; });
  const runs = [];
  let chi = 0;
  for (let n = 1; n <= M; n++) {
    const x = seq[n];
    let n1 = 0, R = 1;
    for (let t = 0; t < W; t++) { n1 += x[t]; if (t && x[t] !== x[t - 1]) R++; }
    const n0 = W - n1;
    if (!n1 || !n0) { runs.push({ n, z: 0, p: 1 }); continue; }
    const mu = (2 * n1 * n0) / W + 1, v = (2 * n1 * n0 * (2 * n1 * n0 - W)) / (W * W * (W - 1));
    const z = v > 0 ? (R - mu) / Math.sqrt(v) : 0;
    chi += z * z;
    runs.push({ n, runs: R, expected: mu, z, p: S.normP2(z) });
  }
  const qv = bh(runs.map((r) => r.p));
  runs.forEach((r, i) => { r.q = qv[i]; });
  // Tự tương quan dạng tập hợp: số quả trùng giữa kỳ t và kỳ t-lag, so với siêu bội (trung bình k²/M)
  const mu = (k * k) / M, varH = k * (k / M) * (1 - k / M) * ((M - k) / (M - 1));
  const lags = [];
  for (let lag = 1; lag <= Math.min(10, W - 2); lag++) {
    let sum = 0;
    for (let t = lag; t < W; t++) { const prev = draws[t - lag].main; for (const n of draws[t].main) if (prev.includes(n)) sum++; }
    const cnt = W - lag, z = (sum / cnt - mu) / Math.sqrt(varH / cnt);
    lags.push({ lag, mean: sum / cnt, expected: mu, z, p: S.normP2(z) });
  }
  const lagAdj = S.holm(lags.map((l) => l.p));
  lags.forEach((l, i) => { l.pAdj = lagAdj[i]; });
  return {
    runs, runsRaw05: runs.filter((r) => r.p < 0.05).length, runsFdr05: runs.filter((r) => r.q < 0.05).length,
    runsPooled: { stat: chi, df: M, p: S.chi2Sf(chi, M) }, lags, lagMinPAdj: Math.min(...lagAdj),
  };
}

// ------------------------------------------------------------------ Ước lượng Bayes cho tần suất từng số
// Tiên nghiệm Beta tập trung tại p0 = k/M với "độ mạnh" tương đương `strength` kỳ quay; hậu nghiệm Beta(a0 + c, b0 + W - c).
function bayes(draws, game, strength = 100) {
  const W = draws.length, k = game.nMain, M = game.max, p0 = k / M, a0 = strength * p0, b0 = strength * (1 - p0);
  const count = new Array(M + 1).fill(0);
  for (const d of draws) for (const n of d.main) count[n]++;
  const rows = [];
  for (let n = 1; n <= M; n++) {
    const a = a0 + count[n], b = b0 + W - count[n];
    rows.push({ n, c: count[n], raw: count[n] / W, mean: a / (a + b), lo: betaQuantile(0.025, a, b), hi: betaQuantile(0.975, a, b), pAbove: 1 - betaI(p0, a, b) });
  }
  const outside = rows.filter((r) => r.lo > p0 || r.hi < p0);
  return { strength, p0, rows, outside: outside.map((r) => r.n), outsideExpected: 0.05 * M };
}

// ------------------------------------------------------------------ Tổng hợp
function explore(allDraws, game, opts = {}) {
  const last = opts.last || 0, draws = last > 0 ? allDraws.slice(-last) : allDraws;
  const W = draws.length, M = game.max;
  if (W < 30) return { error: 'Quá ít kỳ để phân tích chuyên sâu (cần ít nhất 30 kỳ).' };
  const freq = frequency(draws, game), cyc = cycles(draws, game), st = structure(draws, game);
  const pairs = pairTable(draws, game), ser = serial(draws, game), by = bayes(draws, game, opts.prior || 100);
  const triples = groupTable(draws, game, 3), quads = groupTable(draws, game, 4), over = overlaps(draws, game);
  const multi = draws.some((d, i) => i && draws[i - 1].date === d.date);
  const periods = { year: periodTable(draws, game, 'year'), quarter: periodTable(draws, game, 'quarter'), moy: periodTable(draws, game, 'moy'), weekday: periodTable(draws, game, 'weekday') };
  if (multi) periods.slot = periodTable(draws, game, 'slot');

  // Các phép kiểm định bổ sung (ngoài 12 phép của stats.analyze)
  const tests = st.tests.slice();
  const add = (t) => tests.push(t);
  add({ key: 'pairsFdr', question: 'Có cặp số nào lệch khỏi ngẫu nhiên sau khi kiểm soát tỷ lệ phát hiện sai (FDR) không?',
    method: 'Nhị thức chính xác cho từng cặp với xác suất chuẩn k(k−1)/(M(M−1)), hiệu chỉnh Benjamini–Hochberg.',
    p: Math.min(1, Math.min(...pairs.top.concat(pairs.bottom).map((r) => r.q))),
    facts: `${fi(pairs.raw05)}/${fi(pairs.nPairs)} cặp có p < 5% khi chưa hiệu chỉnh (ngẫu nhiên thuần túy đã cho khoảng ${fi(pairs.raw05Expected)} cặp); sau hiệu chỉnh còn ${pairs.fdr05} cặp.` });
  add({ key: 'pairsHalves', question: 'Cặp hay ra cùng nhau ở nửa đầu lịch sử có tiếp tục như vậy ở nửa sau không?',
    method: `Hệ số tương quan giữa số lần cùng ra của mỗi cặp ở hai nửa lịch sử, so với phân phối của chính hệ số đó trong ${pairs.halves.sims} lần mô phỏng máy quay công bằng (Monte Carlo).`, p: pairs.halves.p,
    facts: `Tương quan = ${fd(pairs.halves.corr, 3)} (bằng 0 nghĩa là cặp "hay đi cùng" ở nửa đầu không giữ được ở nửa sau).` });
  add({ key: 'triples', question: 'Bộ ba số ra cùng nhau nhiều nhất có bất thường không?',
    method: 'Xác suất có ít nhất một bộ ba đạt mức đó trong toàn bộ C(M,3) bộ ba (xấp xỉ Poisson).', p: triples.pMax,
    facts: `Bộ ba ${triples.top[0].nums.join('-')} ra cùng nhau ${triples.max} lần (trung bình một bộ ba: ${fd(triples.expected, 2)} lần, có ${fi(triples.nGroups)} bộ ba).` });
  add({ key: 'quads', question: 'Bộ bốn số ra cùng nhau nhiều nhất có bất thường không?',
    method: 'Xác suất có ít nhất một bộ bốn đạt mức đó trong toàn bộ C(M,4) bộ bốn (xấp xỉ Poisson).', p: quads.pMax,
    facts: `Bộ bốn ${quads.top[0].nums.join('-')} ra cùng nhau ${quads.max} lần (trung bình một bộ bốn: ${fd(quads.expected, 3)} lần, có ${fi(quads.nGroups)} bộ bốn).` });
  add({ key: 'runs', question: 'Từng số có ra theo "chuỗi" hay "đan xen" bất thường không (runs test)?',
    method: 'Kiểm định Wald–Wolfowitz trên dãy có/không ra của từng số; gộp bằng tổng z² và hiệu chỉnh FDR.', p: ser.runsPooled.p, stat: ser.runsPooled.stat, df: ser.runsPooled.df,
    facts: `${ser.runsRaw05}/${M} số có p < 5% khi chưa hiệu chỉnh (ngẫu nhiên đã cho khoảng ${fd(0.05 * M, 1)} số); sau hiệu chỉnh FDR còn ${ser.runsFdr05} số.` });
  add({ key: 'autocorr', question: 'Kết quả có phụ thuộc vào các kỳ cách đó 1–10 kỳ không (tự tương quan)?',
    method: 'Số quả trùng giữa kỳ t và kỳ t−lag so với siêu bội, lag = 1..10, hiệu chỉnh Holm.', p: ser.lagMinPAdj,
    facts: `Trung bình số quả trùng theo từng độ trễ dao động ${fd(Math.min(...ser.lags.map((l) => l.mean)), 2)}–${fd(Math.max(...ser.lags.map((l) => l.mean)), 2)} (lý thuyết ${fd(ser.lags[0].expected, 2)}).` });
  for (const [unit, name] of [['year', 'từng năm'], ['weekday', 'từng thứ trong tuần'], ['moy', 'từng tháng trong năm'], ['slot', 'từng khung giờ quay']]) {
    const pt = periods[unit];
    if (!pt || pt.tested < 2) continue;
    add({ key: 'period-' + unit, question: `Tần suất các số có khác nhau giữa ${name} không?`,
      method: 'Khi bình phương (có hiệu chỉnh) trong từng nhóm rồi cộng gộp.', p: pt.pooled.p, stat: pt.pooled.stat, df: pt.pooled.df,
      facts: `Xét ${pt.tested} nhóm; nhóm lệch nhất sau hiệu chỉnh Holm có p = ${fpct(pt.minPAdj)}.` });
  }
  const base = opts.baseTests || [];
  const allT = base.map((t) => ({ key: t.key, question: t.question, method: t.method, p: t.p, stat: t.stat, df: t.df, facts: t.summary || t.facts || '', base: true })).concat(tests);
  const adj = S.holm(allT.map((t) => t.p));
  allT.forEach((t, i) => { t.pAdj = adj[i]; t.level = adj[i] < 0.01 ? 'alert' : adj[i] < 0.05 ? 'watch' : 'ok'; });
  const flagged = allT.filter((t) => t.level !== 'ok');
  return {
    window: { draws: W, from: draws[0].date, to: draws[W - 1].date, fromNo: draws[0].no, toNo: draws[W - 1].no },
    freq, cycle: cyc, structure: st, periods, pairs, triples, quads, overlaps: over, serial: ser, bayes: by,
    tests: allT,
    verdict: {
      total: allT.length, flagged: flagged.length, raw05: allT.filter((t) => t.p < 0.05).length, expectedRaw05: 0.05 * allT.length,
      level: flagged.some((t) => t.level === 'alert') ? 'alert' : flagged.length ? 'watch' : 'ok',
    },
  };
}

module.exports = { explore, frequency, cycles, structure, periodTable, pairTable, groupTable, overlaps, serial, bayes, WINDOWS };

    },
    './popular': function (module, exports, require) {
'use strict';
/**
 * popular.js - Ước lượng ĐỘ ƯA CHUỘNG của từng số (người chơi hay chọn số nào) từ dữ liệu thật: số giải mỗi hạng của từng kỳ.
 *
 * Ý tưởng: nếu người chơi chọn số đều nhau thì tỷ số (số vé trùng 4 số) / (số vé trùng 3 số) của mọi kỳ đều bằng hằng số lý thuyết.
 * Thực tế tỷ số này cao hơn ở những kỳ ra các số được nhiều người chọn. Mô hình (xấp xỉ bậc nhất):
 *     log(W_m) ≈ log(số vé bán ra) + c_m + (m / k) · Σ θ_n   (cộng trên các số n ra ở kỳ đó, θ_n = log độ ưa chuộng của số n)
 * Lấy hiệu hai hạng liền nhau (m+1 và m) thì số vé bán ra triệt tiêu:  y = log(W_{m+1} / W_m) = c + (1/k) · Σ θ_n
 * -> hồi quy tuyến tính y theo biến chỉ báo từng số, không cần biết doanh thu.
 *
 * Ý nghĩa: độ ưa chuộng KHÔNG làm thay đổi xác suất trúng. Nó chỉ cho biết nếu trúng jackpot thì khả năng phải chia với người khác
 * nhiều hay ít. "Hệ số đông người" của một bộ số = tích độ ưa chuộng của các số trong bộ (1 = trung bình).
 * Kiểm chứng: ước lượng trên hai nửa lịch sử độc lập phải tương quan dương, và hệ số tính từ nửa đầu phải dự báo được nửa sau.
 */
const { rulesAt, currentRules, toInt } = require('./rules');
const { normP2 } = require('./stats');
const { bh } = require('./mathx');

// Nghịch đảo ma trận đối xứng xác định dương (Gauss–Jordan có chọn trụ). Trả về null nếu suy biến.
function invert(A) {
  const n = A.length, a = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-9) return null;
    [a[i], a[p]] = [a[p], a[i]];
    const d = a[i][i];
    for (let c = 0; c < 2 * n; c++) a[i][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = a[r][i];
      if (f) for (let c = 0; c < 2 * n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return a.map((r) => r.slice(n));
}

// Hồi quy y theo biến chỉ báo của M số (không có hệ số chặn vì mỗi kỳ luôn có đúng k số).
function fitRows(rows, M) {
  if (rows.length < M + 20) return null;
  const A = Array.from({ length: M }, () => new Array(M).fill(0)), b = new Array(M).fill(0);
  for (const r of rows) for (const i of r.x) { b[i - 1] += r.y; for (const j of r.x) A[i - 1][j - 1]++; }
  const inv = invert(A);
  if (!inv) return null;
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  let rss = 0, tss = 0;
  const my = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  for (const r of rows) { const e = r.y - r.x.reduce((s, n) => s + beta[n - 1], 0); rss += e * e; tss += (r.y - my) ** 2; }
  return { beta, inv, sigma2: rss / (rows.length - M), r2: tss ? 1 - rss / tss : 0 };
}
function corr(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

// Hai hạng không cần số đặc biệt, hơn kém nhau đúng 1 số trùng, thấp nhất có thể (nhiều vé trúng nhất -> ít nhiễu nhất).
function tierPair(r) {
  const plain = r.tiers.map((t, i) => ({ i, m: t.m, s: t.s })).filter((t) => t.m != null && !t.s);
  const lo = plain.reduce((a, t) => (t.m < a.m ? t : a));
  const hi = plain.find((t) => t.m === lo.m + 1);
  return hi ? { lo: lo.i, hi: hi.i, mLo: lo.m } : null;
}

function buildRows(code, draws) {
  const rows = [];
  for (const d of draws) {
    if (!d.prizes || !d.prizes.length) continue;
    const tp = tierPair(rulesAt(code, d.date));
    if (!tp) continue;
    const hi = toInt((d.prizes[tp.hi] || [])[2]), lo = toInt((d.prizes[tp.lo] || [])[2]);
    if (hi > 0 && lo > 0) rows.push({ no: d.no, x: d.main, y: Math.log(hi / lo) });
  }
  return rows;
}

// θ (log độ ưa chuộng, trung bình 0) của M số từ một tập kỳ quay; null nếu chưa đủ dữ liệu.
function thetaOf(code, draws) {
  const r = currentRules(code), f = fitRows(buildRows(code, draws), r.max);
  if (!f) return null;
  const mean = f.beta.reduce((s, v) => s + v, 0) / r.max;
  return f.beta.map((v) => r.nMain * (v - mean));
}

/**
 * Độ ưa chuộng của từng số, kèm sai số và kiểm chứng.
 * Trả về null nếu chưa đủ dữ liệu, ngược lại:
 *   { draws, r2, halvesCorr, oosCorr, numbers: [{ n, theta, index, lo, hi, z, q }], theta: [..M..], special: [{ s, share }] }
 */
function popularity(code, draws) {
  const r = currentRules(code), M = r.max, k = r.nMain, rows = buildRows(code, draws);
  const f = fitRows(rows, M);
  if (!f) return null;
  const mean = f.beta.reduce((s, v) => s + v, 0) / M;
  const numbers = f.beta.map((v, i) => {
    const theta = k * (v - mean), se = k * Math.sqrt(Math.max(0, f.sigma2 * f.inv[i][i])), z = se ? theta / se : 0;
    return { n: i + 1, theta, se, index: Math.exp(theta), lo: Math.exp(theta - 1.96 * se), hi: Math.exp(theta + 1.96 * se), z, p: normP2(z) };
  });
  const q = bh(numbers.map((x) => x.p));
  numbers.forEach((x, i) => { x.q = q[i]; });
  // Kiểm chứng 1: hai nửa lịch sử cho ước lượng giống nhau không? Kiểm chứng 2: hệ số nửa đầu có dự báo được nửa sau không?
  const h = Math.floor(rows.length / 2), f1 = fitRows(rows.slice(0, h), M), f2 = fitRows(rows.slice(h), M);
  let halvesCorr = null, oosCorr = null;
  if (f1 && f2) {
    halvesCorr = corr(f1.beta, f2.beta);
    oosCorr = corr(rows.slice(h).map((x) => x.x.reduce((s, n) => s + f1.beta[n - 1], 0)), rows.slice(h).map((x) => x.y));
  }
  const theta = numbers.map((x) => x.theta), sorted = theta.slice().sort((a, b) => a - b);
  const out = {
    draws: rows.length, r2: f.r2, halvesCorr, oosCorr, numbers, theta,
    crowdMax: Math.exp(sorted.slice(-k).reduce((s, v) => s + v, 0)), crowdMin: Math.exp(sorted.slice(0, k).reduce((s, v) => s + v, 0)),
    significant: numbers.filter((x) => x.q < 0.05).length,
  };
  // Số đặc biệt tự chọn (Lotto 5/35): tỷ lệ vé chọn từng số đặc biệt = W(có ĐB) / (W(có ĐB) + W(không ĐB)) ở cùng số trùng.
  if (r.special === 'pick') {
    const withS = r.tiers.findIndex((t) => t.s && t.m != null && r.tiers.some((u) => !u.s && u.m === t.m && !u.jackpot) && !t.jackpot && t.m <= 3);
    const noS = withS >= 0 ? r.tiers.findIndex((u) => !u.s && u.m === r.tiers[withS].m) : -1;
    if (withS >= 0 && noS >= 0) {
      const a = new Array(r.bonusMax + 1).fill(0), b = new Array(r.bonusMax + 1).fill(0);
      for (const d of draws) {
        if (!d.prizes || !d.prizes.length || !d.bonus || !d.bonus.length) continue;
        a[d.bonus[0]] += toInt((d.prizes[withS] || [])[2]); b[d.bonus[0]] += toInt((d.prizes[noS] || [])[2]);
      }
      out.special = [];
      for (let s = 1; s <= r.bonusMax; s++) if (a[s] + b[s] > 0) out.special.push({ s, share: a[s] / (a[s] + b[s]), index: (a[s] / (a[s] + b[s])) * r.bonusMax });
    }
  }
  return out;
}

// Hệ số đông người của một bộ số: 1 = trung bình; 2 = nếu trúng jackpot thì số người cùng trúng kỳ vọng gấp đôi trung bình.
function crowdFactor(theta, numbers) {
  if (!theta) return 1;
  return Math.exp(numbers.reduce((s, n) => s + (theta[n - 1] || 0), 0));
}

module.exports = { popularity, thetaOf, crowdFactor, buildRows };

    },
    './portfolio': function (module, exports, require) {
'use strict';
/**
 * portfolio.js - Tối ưu và phân tích một TẬP nhiều vé (Portfolio Optimization).
 *
 * Điều tối ưu được và điều KHÔNG tối ưu được (với máy quay công bằng):
 *  - Xác suất jackpot của n vé KHÁC NHAU luôn là n / (tổng số tổ hợp), bất kể chọn thế nào.
 *  - Tiền thưởng kỳ vọng của các hạng cố định cũng không đổi theo cách chọn (tính chất cộng của kỳ vọng).
 *  - Thứ thay đổi là ĐỘ TRÙNG LẶP: vé càng ít trùng số nhau thì xác suất "có ít nhất 1 vé trúng" càng cao
 *    (trúng thường xuyên hơn nhưng mỗi lần ít vé trúng hơn); vé trùng nhiều (bao số) thì hiếm trúng hơn nhưng trúng là trúng chùm.
 *
 *  optimize : dựng n vé phủ đều các số và các cặp số, ưu tiên số điểm cao nếu có bảng điểm của một chiến lược
 *  bao      : bao số (mọi tổ hợp k số từ một nhóm số) -> trùng lặp tối đa
 *  coverage : đo độ bao phủ và độ trùng lặp của một tập vé
 */
const { comb } = require('./stats');
const { rng } = require('./mathx');

/**
 * Dựng n vé theo thứ tự ưu tiên (tham lam):
 *  1) dùng các số đều nhau (n·k <= M thì không vé nào trùng số với vé nào),
 *  2) hạn chế lặp lại cặp số đã có ở vé trước,
 *  3) có bảng điểm (opts.score, hoặc opts.scores = nhiều bảng xoay vòng theo vé) thì ưu tiên số điểm cao; còn lại ngẫu nhiên.
 */
function optimize(game, n, opts = {}) {
  const M = game.max, k = game.nMain, D = M + 1, rnd = opts.rnd || rng(opts.seed || 1);
  const use = new Int32Array(D), pairUse = new Uint16Array(D * D), noise = new Float64Array(D), inPick = new Uint8Array(D);
  const tickets = [], seen = new Set();
  for (let t = 0; t < n; t++) {
    const score = opts.scores ? opts.scores[t % opts.scores.length] : opts.score;
    for (let x = 1; x <= M; x++) noise[x] = rnd();
    const pick = [];
    for (let i = 0; i < k; i++) {
      let best = 0, bu = 0, bp = 0, bs = 0, bn = 0;
      for (let x = 1; x <= M; x++) {
        if (inPick[x]) continue;
        let pr = 0;
        for (let j = 0; j < pick.length; j++) pr += pairUse[x * D + pick[j]];
        const sc = score ? score[x] : 0;
        if (!best || use[x] < bu || (use[x] === bu && (pr < bp || (pr === bp && (sc > bs || (sc === bs && noise[x] > bn)))))) {
          best = x; bu = use[x]; bp = pr; bs = sc; bn = noise[x];
        }
      }
      pick.push(best); inPick[best] = 1;
    }
    for (const x of pick) inPick[x] = 0;
    pick.sort((a, b) => a - b);
    const key = pick.join(',');
    if (seen.has(key)) { // hiếm: đã có vé y hệt -> đổi một số sang số ít dùng nhất chưa có trong vé
      for (let x = 1; x <= M && seen.has(pick.join(',')); x++) if (!pick.includes(x)) { pick[pick.length - 1] = x; pick.sort((a, b) => a - b); }
    }
    seen.add(pick.join(','));
    for (const x of pick) { use[x]++; for (const y of pick) if (x !== y) pairUse[x * D + y]++; }
    tickets.push(pick);
  }
  return tickets;
}

// Bao số: mọi tổ hợp k số từ nhóm `numbers` (ví dụ bao 7 của 6/45 = 7 vé). Giới hạn `max` vé để tránh bùng nổ.
function bao(numbers, k, max = 5000) {
  const s = numbers.slice().sort((a, b) => a - b), out = [];
  const rec = (start, cur) => {
    if (out.length >= max) return;
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i <= s.length - (k - cur.length); i++) { cur.push(s[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

/**
 * Độ bao phủ và độ trùng lặp. tickets: mảng các mảng số, hoặc mảng { numbers, special }.
 */
function coverage(game, tickets) {
  const M = game.max, k = game.nMain, D = M + 1, list = tickets.map((t) => (Array.isArray(t) ? { numbers: t } : t)), n = list.length;
  const use = new Int32Array(D), pairs = new Set(), triples = new Set(), keys = new Set(), specials = new Set();
  for (const t of list) {
    const s = t.numbers.slice().sort((a, b) => a - b);
    keys.add(s.join(',') + '|' + (t.special || ''));
    if (t.special) specials.add(t.special);
    for (let i = 0; i < s.length; i++) {
      use[s[i]]++;
      for (let j = i + 1; j < s.length; j++) {
        pairs.add(s[i] * D + s[j]);
        for (let l = j + 1; l < s.length; l++) triples.add((s[i] * D + s[j]) * D + s[l]);
      }
    }
  }
  const overlap = new Array(k + 1).fill(0);
  let sumOv = 0, maxOv = 0, cmp = 0;
  for (let i = 0; i < n; i++) {
    const a = new Set(list[i].numbers);
    for (let j = i + 1; j < n; j++) {
      let o = 0;
      for (const x of list[j].numbers) if (a.has(x)) o++;
      overlap[o]++; sumOv += o; cmp++;
      if (o > maxOv) maxOv = o;
    }
  }
  let covered = 0, minUse = Infinity, maxUse = 0;
  for (let x = 1; x <= M; x++) { if (use[x]) covered++; if (use[x] < minUse) minUse = use[x]; if (use[x] > maxUse) maxUse = use[x]; }
  const totalPairs = comb(M, 2), totalTriples = comb(M, 3);
  return {
    tickets: n, distinct: keys.size, duplicates: n - keys.size,
    numbers: covered, numbersTotal: M, numbersPct: covered / M, minUse: n ? minUse : 0, maxUse,
    pairs: pairs.size, pairsTotal: totalPairs, pairsPct: pairs.size / totalPairs, pairsMax: Math.min(totalPairs, n * comb(k, 2)),
    triples: triples.size, triplesTotal: totalTriples, triplesPct: triples.size / totalTriples,
    specials: specials.size, specialsTotal: game.hasBonus && game.bonusMax !== game.max ? game.bonusMax : 0,
    overlap, meanOverlap: cmp ? sumOv / cmp : 0, maxOverlap: maxOv,
    // kỳ vọng số quả trùng giữa hai vé NGẪU NHIÊN, để so sánh
    randomOverlap: (k * k) / M,
    diversity: cmp ? 1 - sumOv / cmp / k : 1,
    usage: Array.from(use).slice(1),
  };
}

module.exports = { optimize, bao, coverage };

    },
    './strategy': function (module, exports, require) {
'use strict';
/**
 * strategy.js - Prediction Engine + Scoring Engine.
 *
 * Mỗi chiến lược là một cách CHẤM ĐIỂM các số chỉ dựa trên những kỳ đã quay (không bao giờ nhìn kỳ tương lai),
 * rồi chọn k số điểm cao nhất. Các chiến lược độc lập nhau để backtest.js đo riêng từng cái.
 *
 * QUAN TRỌNG:
 *  - Điểm (score) là thước đo "bộ số này hợp với tiêu chí của chiến lược đến đâu", KHÔNG phải xác suất trúng.
 *  - Với máy quay công bằng, mọi bộ số có cùng xác suất trúng. Chiến lược nào có giá trị thật hay không là do backtest trả lời.
 *
 *  createState/push : trạng thái thống kê cập nhật dần từng kỳ (tần suất, cửa sổ trượt, khoảng cách, cặp, chuyển tiếp)
 *  scoreOf          : điểm từng số theo một chiến lược
 *  ticketOf         : bộ số của chiến lược cho kỳ kế tiếp
 *  auc              : chất lượng xếp hạng của một bảng điểm so với kết quả thật (0,5 = không có giá trị dự báo)
 *  propose          : đề xuất nhiều bộ số kèm giải thích từng tiêu chí
 */
const S = require('./stats');
const { rng, sampleK } = require('./mathx');
const portfolio = require('./portfolio');
const { crowdFactor } = require('./popular');

const LAMBDA = 0.98; // hệ số quên theo thời gian (chiến lược Bayes): kỳ càng cũ càng ít trọng lượng
const ALPHA = 20;    // độ mạnh tiên nghiệm của chiến lược Bayes, tính bằng số kỳ tương đương

const STRATEGIES = [
  { id: 'random', group: 'Đối chứng', name: 'Ngẫu nhiên', desc: 'Chọn hoàn toàn ngẫu nhiên. Là mốc so sánh cho mọi chiến lược khác.',
    limit: 'Không dùng thông tin gì; về lý thuyết không chiến lược nào thắng được mốc này.' },
  { id: 'freq', group: 'Tần suất', name: 'Ra nhiều nhất (toàn bộ lịch sử)', desc: 'Chọn các số có tổng số lần ra cao nhất từ trước đến nay (cửa sổ mở rộng dần).',
    limit: 'Số ra nhiều trong quá khứ không ra nhiều hơn ở tương lai nếu máy quay công bằng.' },
  { id: 'hot10', group: 'Tần suất', name: 'Số nóng 10 kỳ', desc: 'Chọn các số ra nhiều nhất trong 10 kỳ gần nhất (cửa sổ trượt).', limit: 'Cửa sổ ngắn nên chủ yếu là nhiễu ngẫu nhiên.' },
  { id: 'hot30', group: 'Tần suất', name: 'Số nóng 30 kỳ', desc: 'Chọn các số ra nhiều nhất trong 30 kỳ gần nhất (cửa sổ trượt).', limit: 'Giả định "đang vào cầu" không có cơ sở với máy quay độc lập từng kỳ.' },
  { id: 'hot100', group: 'Tần suất', name: 'Số nóng 100 kỳ', desc: 'Chọn các số ra nhiều nhất trong 100 kỳ gần nhất (cửa sổ trượt).', limit: 'Như trên, cửa sổ dài hơn.' },
  { id: 'cold30', group: 'Tần suất', name: 'Số lạnh 30 kỳ', desc: 'Chọn các số ra ít nhất trong 30 kỳ gần nhất.', limit: 'Giả định "sắp ra bù" là ngụy biện con bạc: máy quay không có trí nhớ.' },
  { id: 'cold100', group: 'Tần suất', name: 'Số lạnh 100 kỳ', desc: 'Chọn các số ra ít nhất trong 100 kỳ gần nhất.', limit: 'Như trên, cửa sổ dài hơn.' },
  { id: 'overdue', group: 'Chu kỳ', name: 'Lâu chưa ra nhất (số gan)', desc: 'Chọn các số đang vắng mặt nhiều kỳ liên tiếp nhất.', limit: 'Xác suất ra ở kỳ sau không phụ thuộc số kỳ đã vắng.' },
  { id: 'cycle', group: 'Chu kỳ', name: 'Đến chu kỳ riêng', desc: 'Chọn các số có khoảng vắng hiện tại dài nhất so với khoảng cách trung bình của chính số đó.', limit: 'Chu kỳ quan sát trong quá khứ không phải quy luật sẽ lặp lại.' },
  { id: 'trend', group: 'Chu kỳ', name: 'Xu hướng tăng', desc: 'Chọn các số có tần suất 30 kỳ gần nhất tăng mạnh nhất so với phần lịch sử trước đó.', limit: 'Chênh lệch ngắn hạn phần lớn là dao động ngẫu nhiên.' },
  { id: 'pair', group: 'Liên kết', name: 'Cặp hay ra cùng nhau', desc: 'Bắt đầu từ cặp ra cùng nhau nhiều nhất, lần lượt thêm số đi cùng các số đã chọn nhiều nhất.', limit: 'Kiểm định cho thấy cặp "hay đi cùng" ở nửa đầu lịch sử không giữ được ở nửa sau.' },
  { id: 'markov', group: 'Liên kết', name: 'Theo sau kỳ trước (Markov)', desc: 'Chọn các số hay ra nhất ở kỳ ngay sau những kỳ có các số vừa ra (ma trận chuyển tiếp).', limit: 'Chỉ có giá trị nếu kỳ sau phụ thuộc kỳ trước; kiểm định tự tương quan không thấy điều đó.' },
  { id: 'bayes', group: 'Mô hình', name: 'Bayes có trọng số thời gian', desc: 'Ước lượng Bayes tần suất từng số với tiên nghiệm tại k/M, kỳ gần đây có trọng lượng lớn hơn (hệ số quên 0,98).', limit: 'Hậu nghiệm luôn bị kéo về k/M; chênh lệch giữa các số rất nhỏ.' },
  { id: 'balanced', group: 'Cấu trúc', name: 'Cấu trúc cân bằng', desc: 'Chọn bộ số "giống kỳ quay điển hình": tổng gần trung bình, cân bằng chẵn/lẻ và nhỏ/lớn, ít số liền nhau.', limit: 'Bộ số trông "điển hình" không trúng nhiều hơn bộ số trông "kỳ lạ": mọi bộ số ngang xác suất.' },
  { id: 'rare', group: 'Chia giải', name: 'Ít người chọn', desc: 'Chọn các số có độ ưa chuộng thấp nhất (ước lượng từ số giải thực tế mỗi kỳ).', limit: 'Không tăng xác suất trúng; chỉ giảm khả năng phải chia jackpot nếu trúng.' },
  { id: 'ensemble', group: 'Mô hình', name: 'Kết hợp (ensemble)', desc: 'Cộng điểm chuẩn hóa của các chiến lược trên, trọng số = mức vượt ngẫu nhiên của từng chiến lược trong quá khứ (chỉ dùng dữ liệu trước kỳ dự đoán).', limit: 'Nếu không thành phần nào vượt ngẫu nhiên thì kết hợp cũng không vượt.' },
];
// Các thành phần được phép đưa vào ensemble / trọng số tùy chỉnh
const PARTS = ['freq', 'hot10', 'hot30', 'hot100', 'cold30', 'cold100', 'overdue', 'cycle', 'trend', 'pair', 'markov', 'bayes'];
const isPick = (game) => !!game.hasBonus && game.bonusMax !== game.max; // người chơi tự chọn số đặc biệt (Lotto 5/35)

// ------------------------------------------------------------------ Trạng thái cập nhật dần
function createState(game) {
  const M = game.max, D = M + 1, B = isPick(game) ? game.bonusMax : 0;
  return {
    game, M, k: game.nMain, t: 0, mains: [],
    cnt: new Float64Array(D), last: new Int32Array(D).fill(-1), gapSum: new Float64Array(D), gapN: new Int32Array(D),
    w10: new Float64Array(D), w30: new Float64Array(D), w100: new Float64Array(D),
    disc: new Float64Array(D), discTot: 0,
    pair: new Uint16Array(D * D), trans: new Uint16Array(D * D),
    sp: new Float64Array(B + 1), spLast: new Int32Array(B + 1).fill(-1),
  };
}
function push(st, draw) {
  const { M, k, t } = st, D = M + 1, main = draw.main, prev = t > 0 ? st.mains[t - 1] : null;
  for (let n = 1; n <= M; n++) st.disc[n] *= LAMBDA;
  st.discTot = st.discTot * LAMBDA + 1;
  for (let i = 0; i < k; i++) {
    const n = main[i];
    if (st.last[n] >= 0) { st.gapSum[n] += t - st.last[n]; st.gapN[n]++; }
    st.cnt[n]++; st.last[n] = t; st.w10[n]++; st.w30[n]++; st.w100[n]++; st.disc[n] += 1;
    for (let j = i + 1; j < k; j++) { st.pair[n * D + main[j]]++; st.pair[main[j] * D + n]++; }
    if (prev) for (let j = 0; j < k; j++) st.trans[prev[j] * D + n]++;
  }
  if (t - 10 >= 0) for (const n of st.mains[t - 10]) st.w10[n]--;
  if (t - 30 >= 0) for (const n of st.mains[t - 30]) st.w30[n]--;
  if (t - 100 >= 0) for (const n of st.mains[t - 100]) st.w100[n]--;
  st.mains.push(main);
  if (st.sp.length > 1 && draw.bonus && draw.bonus.length && draw.bonus[0] < st.sp.length) { st.sp[draw.bonus[0]]++; st.spLast[draw.bonus[0]] = t; }
  st.t = t + 1;
}
function buildState(game, draws) {
  const st = createState(game);
  for (const d of draws) push(st, d);
  return st;
}

// ------------------------------------------------------------------ Điểm từng số theo từng chiến lược
const neg = (a) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = -a[i]; return o; };
const waitOf = (st, n) => (st.last[n] < 0 ? st.t : st.t - 1 - st.last[n]);

function pairScore(st) {
  const { M } = st, D = M + 1, o = new Float64Array(D), used = new Uint8Array(D), aff = new Float64Array(D);
  let ba = 1, bb = 2, bc = -1;
  for (let a = 1; a <= M; a++) for (let b = a + 1; b <= M; b++) if (st.pair[a * D + b] > bc) { bc = st.pair[a * D + b]; ba = a; bb = b; }
  const take = (x, rank) => { used[x] = 1; o[x] = M - rank; for (let y = 1; y <= M; y++) aff[y] += st.pair[x * D + y]; };
  take(ba, 0); take(bb, 1);
  for (let rank = 2; rank < M; rank++) {
    let best = 0, bv = -1;
    for (let x = 1; x <= M; x++) if (!used[x] && aff[x] > bv) { bv = aff[x]; best = x; }
    take(best, rank);
  }
  return o;
}
function markovScore(st) {
  const { M } = st, D = M + 1, o = new Float64Array(D);
  if (!st.t) return o;
  for (const a of st.mains[st.t - 1]) {
    const den = Math.max(1, st.cnt[a] - 1); // số kỳ có số a và đã có kỳ kế tiếp
    for (let n = 1; n <= M; n++) o[n] += st.trans[a * D + n] / den;
  }
  return o;
}
function scoreOf(st, id, ctx = {}) {
  const { M, k } = st, D = M + 1, p0 = k / M;
  switch (id) {
    case 'freq': return st.cnt;
    case 'hot10': return st.w10;
    case 'hot30': return st.w30;
    case 'hot100': return st.w100;
    case 'cold30': return neg(st.w30);
    case 'cold100': return neg(st.w100);
    case 'overdue': { const o = new Float64Array(D); for (let n = 1; n <= M; n++) o[n] = waitOf(st, n); return o; }
    case 'cycle': {
      const o = new Float64Array(D);
      for (let n = 1; n <= M; n++) o[n] = (waitOf(st, n) + 1) / (st.gapN[n] ? st.gapSum[n] / st.gapN[n] : 1 / p0);
      return o;
    }
    case 'trend': {
      const o = new Float64Array(D), w = Math.min(30, st.t), rest = st.t - w;
      for (let n = 1; n <= M; n++) o[n] = (w ? st.w30[n] / w : p0) - (rest > 0 ? (st.cnt[n] - st.w30[n]) / rest : p0);
      return o;
    }
    case 'pair': return pairScore(st);
    case 'markov': return markovScore(st);
    case 'bayes': { const o = new Float64Array(D); for (let n = 1; n <= M; n++) o[n] = (ALPHA * p0 + st.disc[n]) / (ALPHA + st.discTot); return o; }
    case 'rare': {
      const o = new Float64Array(D);
      for (let n = 1; n <= M; n++) o[n] = ctx.theta ? -ctx.theta[n - 1] : (n > 31 ? 1 : 0); // chưa có ước lượng: tránh vùng ngày sinh 1..31
      return o;
    }
    case 'ensemble': case 'custom': return combine(st, ctx.weights, ctx);
    default: return null; // random, balanced: không chấm điểm từng số
  }
}
// Cộng điểm đã chuẩn hóa (z-score giữa các số) của các thành phần theo trọng số. Không có trọng số nào > 0 thì chia đều.
function combine(st, weights, ctx = {}) {
  const { M } = st, D = M + 1, o = new Float64Array(D);
  const w = weights || {}, keys = PARTS.filter((id) => w[id] > 0), use = keys.length ? keys : PARTS;
  for (const id of use) {
    const s = (ctx.scores && ctx.scores[id]) || scoreOf(st, id, ctx), wt = keys.length ? w[id] : 1;
    let mean = 0, sd = 0;
    for (let n = 1; n <= M; n++) mean += s[n];
    mean /= M;
    for (let n = 1; n <= M; n++) sd += (s[n] - mean) ** 2;
    sd = Math.sqrt(sd / M);
    if (sd > 0) for (let n = 1; n <= M; n++) o[n] += (wt * (s[n] - mean)) / sd;
  }
  return o;
}

// k số điểm cao nhất; hòa điểm thì theo thứ tự ngẫu nhiên có hạt giống `tie` (không thiên vị số nhỏ).
function topK(score, M, k, tie) {
  const idx = [];
  for (let n = 1; n <= M; n++) idx.push(n);
  idx.sort((a, b) => score[b] - score[a] || (tie ? tie[a] - tie[b] : a - b));
  return idx.slice(0, k).sort((a, b) => a - b);
}

/**
 * AUC của một bảng điểm so với kết quả thật: xác suất một số ĐÃ RA có điểm cao hơn một số KHÔNG RA (hòa tính một nửa).
 * 0,5 = bảng điểm không có giá trị dự báo. Dùng toàn bộ thứ hạng nên nhạy hơn nhiều so với chỉ đếm số quả trúng của 1 vé.
 */
function auc(score, M, k, mark) {
  const idx = [];
  for (let n = 1; n <= M; n++) idx.push(n);
  idx.sort((a, b) => score[a] - score[b]);
  let sum = 0, i = 0;
  while (i < M) {
    let j = i;
    while (j + 1 < M && score[idx[j + 1]] === score[idx[i]]) j++;
    const r = (i + j) / 2 + 1; // hạng trung bình của nhóm hòa điểm
    for (let q = i; q <= j; q++) if (mark[idx[q]]) sum += r;
    i = j + 1;
  }
  return (sum - (k * (k + 1)) / 2) / (k * (M - k));
}

// ------------------------------------------------------------------ Cấu trúc "điển hình"
const typCache = new Map();
function typicality(game) {
  const M = game.max, k = game.nMain, key = M + '/' + k;
  if (typCache.has(key)) return typCache.get(key);
  const H = Math.floor(M / 2), C = S.comb;
  const oddP = [], lowP = [], conP = [];
  for (let j = 0; j <= k; j++) { oddP.push(S.hyperPmf(M, Math.ceil(M / 2), k, j)); lowP.push(S.hyperPmf(M, H, k, j)); }
  for (let r = 0; r < k; r++) conP.push((C(k - 1, r) * C(M - k + 1, k - r)) / C(M, k));
  const sumP = S.sumProbs(M, k);
  const fn = (numbers) => {
    const s = numbers.slice().sort((a, b) => a - b);
    let sum = 0, odd = 0, low = 0, con = 0;
    for (let i = 0; i < k; i++) { sum += s[i]; if (s[i] % 2) odd++; if (s[i] <= H) low++; if (i && s[i] - s[i - 1] === 1) con++; }
    return Math.log(sumP[sum] || 1e-12) + Math.log(oddP[odd] || 1e-12) + Math.log(lowP[low] || 1e-12) + Math.log(conP[con] || 1e-12);
  };
  typCache.set(key, fn);
  return fn;
}
function balancedTicket(game, rnd, tries = 60) {
  const typ = typicality(game);
  let best = null, bv = -Infinity;
  for (let i = 0; i < tries; i++) { const t = sampleK(game.max, game.nMain, rnd), v = typ(t); if (v > bv) { bv = v; best = t; } }
  return best;
}

// Số đặc biệt tự chọn (Lotto 5/35): cùng tinh thần với chiến lược; các chiến lược khác thì ngẫu nhiên.
function specialOf(st, id, rnd) {
  const B = st.sp.length - 1;
  if (B < 1) return null;
  const arg = (f) => { let b = 1; for (let s = 2; s <= B; s++) if (f(s) > f(b)) b = s; return b; };
  if (['freq', 'hot10', 'hot30', 'hot100', 'bayes', 'trend', 'ensemble', 'custom'].includes(id)) return arg((s) => st.sp[s]);
  if (['cold30', 'cold100', 'overdue', 'cycle'].includes(id)) return arg((s) => (st.spLast[s] < 0 ? st.t : st.t - 1 - st.spLast[s]));
  return 1 + Math.floor(rnd() * B);
}

// Bộ số của một chiến lược cho kỳ kế tiếp (chỉ dùng những gì đã nạp vào state).
function ticketOf(st, id, ctx = {}) {
  const { M, k } = st, rnd = ctx.rnd || rng(st.t * 7919 + 13);
  let numbers, score = null;
  if (id === 'random') numbers = sampleK(M, k, rnd);
  else if (id === 'balanced') numbers = balancedTicket(st.game, rnd);
  else {
    score = scoreOf(st, id, ctx);
    const tie = new Float64Array(M + 1);
    for (let n = 1; n <= M; n++) tie[n] = rnd();
    numbers = topK(score, M, k, tie);
  }
  return { numbers, special: specialOf(st, id, rnd), score };
}

// ------------------------------------------------------------------ Scoring Engine: chấm một bộ số theo từng tiêu chí
const CRITERIA = [
  { id: 'freq', name: 'Tần suất dài hạn', hint: 'Tổng số lần ra của các số trong bộ từ trước đến nay.' },
  { id: 'recent', name: 'Tần suất 30 kỳ', hint: 'Tổng số lần ra của các số trong bộ ở 30 kỳ gần nhất.' },
  { id: 'trend', name: 'Xu hướng', hint: 'Tần suất gần đây trừ tần suất trước đó, cộng trên các số trong bộ.' },
  { id: 'cycle', name: 'Đến chu kỳ', hint: 'Khoảng vắng hiện tại so với khoảng cách trung bình của từng số, lấy trung bình.' },
  { id: 'pair', name: 'Liên kết cặp', hint: 'Tổng số lần từng cặp trong bộ đã ra cùng nhau.' },
  { id: 'structure', name: 'Cấu trúc điển hình', hint: 'Mức giống một kỳ quay điển hình về tổng, chẵn/lẻ, nhỏ/lớn, số liền nhau.' },
  { id: 'crowd', name: 'Ít người chọn', hint: 'Đảo của hệ số đông người: càng cao thì nếu trúng jackpot càng ít phải chia.' },
];
function rawCriteria(st, numbers, ctx = {}) {
  const { M, k } = st, D = M + 1, p0 = k / M, w = Math.min(30, st.t), rest = st.t - w;
  let freq = 0, recent = 0, trend = 0, cycle = 0, pair = 0;
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    freq += st.cnt[n]; recent += st.w30[n];
    trend += (w ? st.w30[n] / w : p0) - (rest > 0 ? (st.cnt[n] - st.w30[n]) / rest : p0);
    cycle += (waitOf(st, n) + 1) / (st.gapN[n] ? st.gapSum[n] / st.gapN[n] : 1 / p0);
    for (let j = i + 1; j < numbers.length; j++) pair += st.pair[n * D + numbers[j]];
  }
  return { freq, recent, trend, cycle: cycle / numbers.length, pair, structure: typicality(st.game)(numbers), crowd: ctx.theta ? -Math.log(crowdFactor(ctx.theta, numbers)) : 0 };
}
// Phân phối của từng tiêu chí trên `size` bộ số NGẪU NHIÊN: dùng làm thước đo "cao hơn bao nhiêu % bộ số ngẫu nhiên".
function reference(st, ctx = {}, size = 400, seed = 4242) {
  const rnd = rng(seed), vals = {};
  for (const c of CRITERIA) vals[c.id] = [];
  const sums = [];
  for (let i = 0; i < size; i++) {
    const t = sampleK(st.M, st.k, rnd), r = rawCriteria(st, t, ctx);
    for (const c of CRITERIA) vals[c.id].push(r[c.id]);
    if (ctx.score) sums.push(t.reduce((a, n) => a + ctx.score[n], 0));
  }
  for (const c of CRITERIA) vals[c.id].sort((a, b) => a - b);
  sums.sort((a, b) => a - b);
  return { vals, sums };
}
// Tỷ lệ phần tử của mảng đã sắp xếp nhỏ hơn x (hòa tính một nửa) -> bách phân vị 0..1
function pctOf(sorted, x) {
  let lo = 0, eq = 0;
  for (const v of sorted) { if (v < x) lo++; else if (v === x) eq++; }
  return sorted.length ? (lo + eq / 2) / sorted.length : 0.5;
}
function evaluateTicket(st, numbers, ref, ctx = {}) {
  const raw = rawCriteria(st, numbers, ctx), D = st.M + 1, k = st.k, M = st.M;
  const criteria = CRITERIA.filter((c) => c.id !== 'crowd' || ctx.theta).map((c) => ({ id: c.id, name: c.name, hint: c.hint, value: raw[c.id], pct: pctOf(ref.vals[c.id], raw[c.id]) }));
  const s = numbers.slice().sort((a, b) => a - b), H = Math.floor(M / 2);
  const pairs = [];
  const eP = (st.t * k * (k - 1)) / (M * (M - 1));
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) pairs.push({ a: s[i], b: s[j], c: st.pair[s[i] * D + s[j]] });
  pairs.sort((x, y) => y.c - x.c);
  let con = 0;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] === 1) con++;
  return {
    criteria,
    score: ctx.score && ref.sums.length ? pctOf(ref.sums, numbers.reduce((a, n) => a + ctx.score[n], 0)) : null,
    detail: s.map((n) => ({ n, count: st.cnt[n], recent: st.w30[n], wait: waitOf(st, n) })),
    structure: { sum: s.reduce((a, b) => a + b, 0), odd: s.filter((n) => n % 2).length, low: s.filter((n) => n <= H).length, consecutive: con, span: s[s.length - 1] - s[0] },
    topPairs: pairs.slice(0, 3), pairExpected: eP,
    crowd: ctx.theta ? crowdFactor(ctx.theta, numbers) : null,
  };
}

/**
 * Đề xuất bộ số cho kỳ kế tiếp.
 * opts: { strategy, count, seed, weights (cho 'custom'/'ensemble'), diversify (mặc định true), theta (độ ưa chuộng) }
 *  - Vé đầu tiên luôn là bộ số "đúng chiến lược nhất" (k số điểm cao nhất).
 *  - diversify = true: các vé sau lấy nhóm số điểm cao kế tiếp và tránh trùng số/cặp với vé trước (tối ưu độ bao phủ).
 *  - diversify = false: các vé sau rút ngẫu nhiên có trọng số theo điểm (có thể trùng nhiều số với nhau).
 */
function propose(draws, game, opts = {}) {
  const id = opts.strategy || 'ensemble', count = Math.max(1, Math.min(50, opts.count || 5)), seed = opts.seed || 1;
  const meta = STRATEGIES.find((s) => s.id === id) || { id, name: 'Trọng số tùy chỉnh', group: 'Mô hình', desc: 'Cộng điểm chuẩn hóa của các thành phần theo trọng số bạn đặt.', limit: 'Trọng số do người dùng đặt, chưa qua kiểm chứng.' };
  const st = buildState(game, draws), rnd = rng(seed * 2654435761 + st.t), M = st.M, k = st.k;
  const ctx = { theta: opts.theta, weights: opts.weights, rnd };
  const score = scoreOf(st, id, ctx);
  const diversify = opts.diversify !== false;
  let tickets = [];
  if (score) {
    if (diversify) tickets = portfolio.optimize(game, count, { score, rnd });
    else {
      // rút có trọng số: exp(điểm chuẩn hóa); vé đầu vẫn là top-k
      let mean = 0, sd = 0;
      for (let n = 1; n <= M; n++) mean += score[n];
      mean /= M;
      for (let n = 1; n <= M; n++) sd += (score[n] - mean) ** 2;
      sd = Math.sqrt(sd / M) || 1;
      const tie = new Float64Array(M + 1);
      for (let n = 1; n <= M; n++) tie[n] = rnd();
      const seen = new Set();
      const addT = (t) => { const key = t.join(','); if (!seen.has(key)) { seen.add(key); tickets.push(t); } };
      addT(topK(score, M, k, tie));
      for (let guard = 0; tickets.length < count && guard < count * 50; guard++) {
        const pool = [];
        for (let n = 1; n <= M; n++) pool.push({ n, w: Math.exp((score[n] - mean) / sd) });
        const pick = [];
        while (pick.length < k) {
          const total = pool.reduce((a, o) => a + o.w, 0);
          let r = rnd() * total, j = 0;
          for (; j < pool.length - 1; j++) { r -= pool[j].w; if (r <= 0) break; }
          pick.push(pool[j].n); pool.splice(j, 1);
        }
        addT(pick.sort((a, b) => a - b));
      }
    }
  } else if (id === 'balanced') {
    const seen = new Set();
    for (let guard = 0; tickets.length < count && guard < count * 50; guard++) {
      const t = balancedTicket(game, rnd), key = t.join(',');
      if (!seen.has(key)) { seen.add(key); tickets.push(t); }
    }
  } else tickets = diversify ? portfolio.optimize(game, count, { rnd }) : Array.from({ length: count }, () => sampleK(M, k, rnd));

  const ref = reference(st, { theta: opts.theta, score }, 400, 4242 + st.t);
  const B = st.sp.length - 1, sp0 = B >= 1 ? specialOf(st, id, rnd) : null;
  const sets = tickets.map((numbers, i) => ({
    numbers,
    // số đặc biệt: vé đầu theo chiến lược, các vé sau xoay vòng để phủ nhiều số đặc biệt khác nhau
    special: B >= 1 ? ((sp0 - 1 + i) % B) + 1 : null,
    ...evaluateTicket(st, numbers, ref, { theta: opts.theta, score }),
  }));
  let ranking = null;
  if (score) {
    ranking = [];
    for (let n = 1; n <= M; n++) ranking.push({ n, score: score[n] });
    ranking.sort((a, b) => b.score - a.score || a.n - b.n);
  }
  return { strategy: meta, draws: st.t, diversify, sets, ranking, coverage: portfolio.coverage(game, sets) };
}

module.exports = {
  STRATEGIES, PARTS, CRITERIA, createState, push, buildState, scoreOf, combine, topK, auc, ticketOf, specialOf,
  typicality, balancedTicket, rawCriteria, reference, evaluateTicket, propose, isPick,
};

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
  window.VL = { GAMES: {"535":{"page":"535","webpart":"Game535ResultDetailWebPart","nMain":5,"hasBonus":true,"max":35,"bonusMax":12,"label":"Lotto 5/35","schedule":{"days":[0,1,2,3,4,5,6],"times":["13:00","21:00"]}},"645":{"page":"645","webpart":"Game645ResultDetailWebPart","nMain":6,"hasBonus":false,"max":45,"bonusMax":0,"label":"Mega 6/45","schedule":{"days":[0,3,5],"times":["18:00"]}},"655":{"page":"655","webpart":"Game655ResultDetailWebPart","nMain":6,"hasBonus":true,"max":55,"bonusMax":55,"label":"Power 6/55","schedule":{"days":[2,4,6],"times":["18:00"]}}}, R: req('./rules'), S: req('./stats'), M: req('./mathx'), T: req('./ticket'), P: req('./prob'), E: req('./explore'), POP: req('./popular'), F: req('./portfolio'), G: req('./strategy') };
})();
