/* Thống kê Vietlott - giao diện (jQuery). Dữ liệu lấy từ server.js qua /api/... */
(function ($) {
  'use strict';

  /* ============================================================ trạng thái */
  var DEFAULT_GAMES = [
    { code: '655', label: 'Power 6/55', nMain: 6, max: 55, hasBonus: true, bonusMax: 55, schedule: { days: [2, 4, 6], times: ['18:00'] } },
    { code: '645', label: 'Mega 6/45', nMain: 6, max: 45, hasBonus: false, bonusMax: 0, schedule: { days: [0, 3, 5], times: ['18:00'] } },
    { code: '535', label: 'Lotto 5/35', nMain: 5, max: 35, hasBonus: true, bonusMax: 12, schedule: { days: [0, 1, 2, 3, 4, 5, 6], times: ['13:00', '21:00'] } }
  ];
  var SECTIONS = [
    { id: 'tong-quan', label: 'Tổng quan', scope: true, sub: 'Kết quả mới nhất, kết luận về độ ngẫu nhiên và tần suất của từng số.' },
    { id: 'bang-so', label: 'Bảng số', scope: true, sub: 'Số lần ra và số kỳ chưa ra của từng số, xếp như trên phiếu dự thưởng.' },
    { id: 'so-gan', label: 'Số gan', scope: true, sub: 'Các số lâu chưa ra và quy luật khoảng cách giữa hai lần ra của một số.' },
    { id: 'cap-so', label: 'Cặp số', scope: true, sub: 'Hai số ra cùng nhau trong một kỳ: cặp nào ra nhiều, cặp nào ra ít.' },
    { id: 'ngau-nhien', label: 'Độ ngẫu nhiên', scope: true, sub: 'Các phép kiểm tra xem kết quả quay có đúng là ngẫu nhiên hay không.' },
    { id: 'kiem-tra-ve', label: 'Kiểm tra vé', scope: true, sub: 'Chọn số ngay trên bảng để xem xác suất trúng từng giải, các cặp số trong bộ số của bạn, và kết quả nếu bạn đã chơi bộ số đó ở các kỳ trước.' },
    { id: 'goi-y', label: 'Gợi ý bộ số', scope: true, sub: 'Sinh bộ số theo tiêu chí bạn chọn. Mọi bộ số đều có cùng cơ hội trúng.' },
    { id: 'the-le', label: 'Thể lệ & cách chơi', scope: true, sub: 'Cách chơi, điều kiện trúng từng giải và xác suất trúng của từng loại vé.' },
    { id: 'lich-su', label: 'Lịch sử kết quả', scope: false, sub: 'Kết quả 60 kỳ quay gần nhất.' },
    { id: 'phuong-phap', label: 'Phương pháp, kiểm chứng', scope: false, sub: 'Dữ liệu lấy từ đâu, đã được kiểm chứng như thế nào, và các phương pháp thống kê được dùng.' }
  ];
  var JACKPOT_TIERS = { '655': [0, 1], '645': [0], '535': [0] };
  var S = {
    game: '655', last: 0, section: 'tong-quan', games: DEFAULT_GAMES.slice(),
    stats: null, draws: null, cross: null, gridMetric: 'count', pairOf: null,
    ck: null, sgMode: 'uniform', sgCount: 5, sort: {}
  };
  try {
    var saved = JSON.parse(localStorage.getItem('vietlott-ui') || '{}');
    if (saved.game) S.game = saved.game;
    if (saved.last != null) S.last = +saved.last || 0;
  } catch (e) { /* trình duyệt chặn lưu trữ: dùng mặc định */ }
  function save() { try { localStorage.setItem('vietlott-ui', JSON.stringify({ game: S.game, last: S.last })); } catch (e) { /* bỏ qua */ } }

  /* ============================================================ định dạng */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function pad5(n) { return ('0000' + n).slice(-5); }
  function fi(x) { return Math.round(x).toLocaleString('vi-VN'); }
  function fd(x, d) { d = d == null ? 1 : d; return Number(x).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fpct(x) { var v = x * 100, a = Math.abs(v); return fd(v, a >= 10 ? 0 : a >= 1 ? 1 : 2) + '%'; }
  function fprob(p) { var v = p * 100; if (!(v > 0)) return '0%'; return fd(v, Math.min(10, Math.max(2, 1 - Math.floor(Math.log10(v))))) + '%'; }
  function fdate(s) { return s ? s.split('-').reverse().join('/') : ''; }
  var WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  function weekday(s) { return WD[new Date(s + 'T00:00:00').getDay()]; }
  function money(v) { return fi(v) + 'đ'; }
  function moneyShort(v) {
    if (v >= 1e9) return fd(v / 1e9, v >= 1e10 ? 1 : 2) + ' tỷ đồng';
    if (v >= 1e6) return fd(v / 1e6, v >= 1e7 ? 0 : 1) + ' triệu đồng';
    return money(v);
  }
  function toInt(s) { return Number(String(s == null ? '' : s).replace(/[^\d]/g, '')) || 0; }
  function ball(n, cls, tip) { return '<span class="ball ' + (cls || '') + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + pad2(n) + '</span>'; }
  function ballsHtml(main, special, cls) {
    var h = '<span class="balls">' + (main || []).map(function (n) { return ball(n, cls); }).join('');
    if (special && special.length) h += '<span class="sep" aria-hidden="true"></span>' + special.map(function (n) { return ball(n, 'special ' + (cls || ''), 'Số đặc biệt'); }).join('');
    return h + '</span>';
  }
  function game() { return S.games.filter(function (g) { return g.code === S.game; })[0] || S.games[0]; }
  function specialPick(g) { return !!(g.hasBonus && g.bonusMax && g.bonusMax !== g.max); }
  function section() { return SECTIONS.filter(function (s) { return s.id === S.section; })[0] || SECTIONS[0]; }

  // "Thứ Ba, Năm, Bảy lúc 18h" / "Hằng ngày lúc 13h và 21h"
  function scheduleText(g) {
    var s = g.schedule; if (!s) return '';
    var times = s.times.map(function (t) { return t.replace(':00', 'h'); }).join(' và ');
    if (s.days.length === 7) return 'Hằng ngày lúc ' + times;
    var names = { 1: 'Hai', 2: 'Ba', 3: 'Tư', 4: 'Năm', 5: 'Sáu', 6: 'Bảy' };
    var wk = s.days.filter(function (d) { return d !== 0; }).sort().map(function (d) { return names[d]; });
    var txt = wk.length ? 'Thứ ' + wk.join(', ') : '';
    if (s.days.indexOf(0) >= 0) txt += (txt ? ' và ' : '') + 'Chủ nhật';
    return txt + ' lúc ' + times;
  }
  function nextDrawText(g) {
    var s = g.schedule; if (!s) return '';
    var now = new Date();
    for (var i = 0; i < 8; i++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (s.days.indexOf(day.getDay()) < 0) continue;
      for (var j = 0; j < s.times.length; j++) {
        var hm = s.times[j].split(':'), at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), +hm[0], +hm[1]);
        if (at > now) {
          var when = i === 0 ? 'hôm nay' : i === 1 ? 'ngày mai' : WD[at.getDay()].toLowerCase();
          return 'Kỳ quay tiếp theo: ' + when + ', ' + pad2(at.getDate()) + '/' + pad2(at.getMonth() + 1) + ' lúc ' + s.times[j].replace(':00', 'h') + '.';
        }
      }
    }
    return '';
  }

  /* ============================================================ khung gợi ý (tooltip) */
  var $tip;
  function tipShow(html, x, y) {
    $tip.html(html).prop('hidden', false);
    var w = $tip.outerWidth(), h = $tip.outerHeight();
    var vw = window.innerWidth, vh = window.innerHeight;
    if (x + 14 + w > vw - 8) x = x - w - 28;
    x = Math.max(-6, Math.min(x, vw - w - 22)); // luôn nằm trọn trong màn hình
    if (y + 14 + h > vh - 8) y = y - h - 28;
    y = Math.max(-6, Math.min(y, vh - h - 22));
    $tip.css({ left: x + 14, top: y + 14 });
  }
  function tipHide() { if ($tip) $tip.prop('hidden', true); }

  /* ============================================================ tiện ích giao diện */
  function getJson(url, opts) {
    // then(function (d) { return d; }): chỉ trả dữ liệu (không kèm trạng thái, xhr) để $.when nhận đúng giá trị
    return $.ajax($.extend({ url: url, dataType: 'json' }, opts || {})).then(function (d) { return d; }, function (x) {
      var m = x.responseJSON && x.responseJSON.error ? x.responseJSON.error : 'Không tải được dữ liệu (' + (x.status || 'mất kết nối') + ').';
      return $.Deferred().reject(m);
    });
  }
  function notice(type, html) { $('#notice').html(html ? '<div class="alert ' + type + '">' + html + '</div>' : ''); }
  function head(title, sub, right) {
    return '<div class="panel-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  var LEVEL = {
    ok: { icon: '✓', title: 'Kết quả quay phù hợp với quay số ngẫu nhiên' },
    watch: { icon: '!', title: 'Có điểm cần theo dõi' },
    alert: { icon: '✕', title: 'Phát hiện dấu hiệu bất thường' }
  };
  function badge(level, text) { return '<span class="badge ' + level + '"><span aria-hidden="true">' + LEVEL[level].icon + '</span>' + esc(text) + '</span>'; }

  // Bảng sắp xếp được: cols = [{h, v(row), f(row), r: canh phải}]
  function sortTable(id, cols, rows, def) {
    var st = S.sort[id] || (S.sort[id] = { k: def ? def.k : 0, dir: def ? def.dir : 1 });
    var r = rows.slice().sort(function (a, b) {
      var x = cols[st.k].v(a), y = cols[st.k].v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * st.dir;
    });
    // Trên điện thoại bảng thành các thẻ (không có tiêu đề cột), nên sắp xếp bằng ô chọn này
    var sortBar = '<div class="sort-bar"><label>Sắp xếp theo <select class="sort-sel" data-sort-id="' + id + '">' + cols.map(function (c, i) {
      return '<option value="' + i + '"' + (i === st.k ? ' selected' : '') + '>' + esc(c.h) + '</option>';
    }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-light btn-sm sort-dir" data-sort-id="' + id + '">' + (st.dir > 0 ? 'Tăng dần ▲' : 'Giảm dần ▼') + '</button></div>';
    return sortBar + '<table class="data" data-sort="' + id + '"><thead><tr>' + cols.map(function (c, i) {
      return '<th class="sortable' + (c.r ? ' r' : '') + '" data-i="' + i + '" aria-sort="' + (i === st.k ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
        esc(c.h) + (i === st.k ? '<span class="arrow" aria-hidden="true">' + (st.dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + r.map(function (row) {
      return '<tr>' + cols.map(function (c) { return '<td' + (c.r ? ' class="r"' : '') + '>' + c.f(row) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  /* ============================================================ biểu đồ */
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function roundTop(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) +
      'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  // Chiều rộng vùng vẽ biểu đồ (px) theo số cột của lưới chứa nó, để chữ trên biểu đồ giữ cỡ đọc được thay vì bị co theo tỷ lệ.
  function chartW(cols) {
    var win = window.innerWidth || 1200, vw = $('#view').width() || 700;
    var n = cols === 3 ? (win > 1100 ? 3 : win > 860 ? 2 : 1) : cols === 2 ? (win > 860 ? 2 : 1) : 1;
    var pad = win <= 560 ? 34 : 46; // lề trong và viền của khối .panel
    return Math.round(Math.max(260, Math.min(1000, (vw - 20 * (n - 1)) / n - pad)));
  }
  // Cột "thực tế" + vạch "lý thuyết". items: [{label, obs, exp, tip}]
  function colChart(items, opt) {
    opt = opt || {};
    var W = opt.w || chartW(opt.cols || 1), H = opt.h || 230, L = 44, R = 8, T = 12, B = 30;
    var max = 0;
    items.forEach(function (d) { max = Math.max(max, d.obs, d.exp); });
    var step = niceStep(max / 4 || 1), top = Math.ceil(max / step) * step || 1;
    var iw = (W - L - R) / items.length, bw = Math.max(4, Math.min(24, iw * 0.62));
    var every = Math.ceil(items.length / Math.max(2, Math.min(opt.maxLabels || 12, Math.floor((W - L - R) / (opt.labelW || 34)))));
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.title || 'Biểu đồ') + '">';
    for (var v = 0; v <= top + 1e-9; v += step) {
      s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="tick" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fi(v) + '</text>';
    }
    s += '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    items.forEach(function (d, i) {
      var cx = L + iw * i + iw / 2;
      s += '<path class="bar" d="' + roundTop(cx - bw / 2, y(d.obs), bw, y(0) - y(d.obs), 4) + '"/>';
      s += '<line class="theory" x1="' + (cx - bw / 2 - 4) + '" x2="' + (cx + bw / 2 + 4) + '" y1="' + y(d.exp) + '" y2="' + y(d.exp) + '"/>';
      if (i % every === 0) s += '<text class="tick" x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(d.label) + '</text>';
      s += '<rect class="hit" x="' + (L + iw * i) + '" y="' + T + '" width="' + iw + '" height="' + (H - T - B) + '" data-tip="' + esc(d.tip || '') + '"/>';
    });
    return s + '</svg><div class="legend"><span><span class="sw" style="background:var(--obs);border-color:var(--obs)"></span>Thực tế</span>' +
      '<span><span class="ln"></span>Lý thuyết (nếu quay hoàn toàn ngẫu nhiên)</span></div>';
  }
  // Danh sách xếp hạng dạng thanh ngang. rows: [{label, value, text, tip}]
  function rankList(rows, opt) {
    opt = opt || {};
    var max = opt.max || Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([opt.ref || 0, 1]));
    return '<div class="rank" style="--lbl:' + (opt.lbl || '34px') + '">' + rows.map(function (r) {
      return '<div class="rank-row" data-tip="' + esc(r.tip || '') + '">' + r.label +
        '<div class="rank-track"><div class="rank-bar ' + (opt.cls || '') + '" style="width:' + ((r.value / max) * 100).toFixed(2) + '%"></div>' +
        (opt.ref != null ? '<div class="rank-ref" style="left:' + ((opt.ref / max) * 100).toFixed(2) + '%"></div>' : '') +
        '</div><div class="rank-val">' + r.text + '</div></div>';
    }).join('') + '</div>' + (opt.refLabel ? '<div class="legend"><span><span class="ln"></span>' + esc(opt.refLabel) + '</span></div>' : '');
  }

  /* ============================================================ bảng số kiểu phiếu dự thưởng */
  function heatClass(z) { return z <= -2 ? 'cold-2' : z <= -1 ? 'cold-1' : z < 1 ? '' : z < 2 ? 'hot-1' : 'hot-2'; }
  function ganClass(wait, avg) { var r = wait / avg; return r < 1 ? '' : r < 2 ? 'gan-1' : r < 3 ? 'gan-2' : r < 4 ? 'gan-3' : 'gan-4'; }
  function devText(d) { return d >= 0 ? 'nhiều hơn trung bình ' + fpct(d) : 'ít hơn trung bình ' + fpct(-d); }
  function lastSeen(n) { return n.lastNo ? 'kỳ #' + pad5(n.lastNo) + ', ' + fdate(n.lastDate) : 'chưa ra trong phạm vi này'; }

  // metric: 'count' (số lần ra) | 'wait' (số kỳ chưa ra) | 'pair' (ra cùng số S.pairOf)
  // Các số đang có trong ô Kiểm tra vé (cùng loại vé đang xem)
  function pickedNums() {
    var g = game();
    return S.ck && S.ck.game === S.game ? selNums(S.ck.nums, g) : [];
  }
  function slipHtml(metric) {
    var st = S.stats, M = st.game.max, avg = 1 / st.game.p0;
    var latest = S.draws && S.draws[0] ? S.draws[0].main : [];
    var picked = metric === 'pair' ? pickedNums() : [];
    var cells = st.numbers.map(function (n) {
      var cls = 'cell', val, tip;
      if (metric === 'wait') {
        cls += ' ' + ganClass(n.wait, avg);
        val = n.wait === 0 ? 'vừa ra' : fi(n.wait) + ' kỳ';
        tip = '<b>Số ' + pad2(n.n) + '</b><br>' + (n.wait === 0 ? 'Vừa ra ở kỳ gần nhất' : 'Đã ' + fi(n.wait) + ' kỳ chưa ra') +
          '<br>Lần ra gần nhất: ' + lastSeen(n) + '<br>Vắng lâu nhất: ' + fi(n.maxWait) + ' kỳ';
      } else if (metric === 'pair') {
        var a = S.pairOf;
        if (n.n === a) { cls += ' selected'; val = 'đang xem'; tip = '<b>Số ' + pad2(a) + '</b><br>Số đang chọn'; }
        else {
          var idx = (a - 1) * M + (n.n - 1), c = st.pairs.counts[idx], z = st.pairs.heat[idx];
          cls += ' ' + heatClass(z);
          val = fi(c) + ' lần';
          tip = '<b>Số ' + pad2(a) + ' và số ' + pad2(n.n) + '</b><br>Ra cùng nhau ' + fi(c) + ' lần<br>Trung bình một cặp: ' + fd(st.pairs.note.expected) + ' lần';
        }
        cls += ' clickable';
      } else {
        cls += ' ' + heatClass(n.z);
        val = fi(n.count) + ' lần';
        tip = '<b>Số ' + pad2(n.n) + '</b><br>Ra ' + fi(n.count) + ' lần (trung bình ' + fd(n.expected) + ')<br>' + devText(n.devPct) +
          '<br>Lần ra gần nhất: ' + lastSeen(n) + '<br>' + (n.wait === 0 ? 'Vừa ra ở kỳ gần nhất' : 'Đã ' + fi(n.wait) + ' kỳ chưa ra');
      }
      if (latest.indexOf(n.n) >= 0) { cls += ' latest'; tip += '<br>Có trong kết quả kỳ gần nhất'; }
      if (picked.indexOf(n.n) >= 0) { cls += ' picked'; tip += '<br>Đã có trong vé ở mục Kiểm tra vé'; }
      return '<div class="' + cls + '" tabindex="0" data-n="' + n.n + '" data-tip="' + esc(tip) + '"><span class="c-n">' + pad2(n.n) +
        '</span><span class="c-v">' + val + '</span></div>';
    });
    return '<div class="slip" data-metric="' + metric + '">' + cells.join('') + '</div>';
  }
  function slipLegend(metric) {
    if (metric === 'wait') {
      var a = 1 / S.stats.game.p0, r = function (x) { return fi(a * x); };
      return '<div class="legend"><span><span class="sw" style="background:var(--mid)"></span>Dưới ' + r(1) + ' kỳ</span>' +
        '<span><span class="sw" style="background:var(--gan-1)"></span>' + r(1) + '–' + r(2) + ' kỳ</span>' +
        '<span><span class="sw" style="background:var(--gan-2)"></span>' + r(2) + '–' + r(3) + ' kỳ</span>' +
        '<span><span class="sw" style="background:var(--gan-3)"></span>' + r(3) + '–' + r(4) + ' kỳ</span>' +
        '<span><span class="sw" style="background:var(--gan-4)"></span>Trên ' + r(4) + ' kỳ</span>' +
        '<span><span class="dot"></span>Có trong kỳ gần nhất</span></div>';
    }
    return '<div class="legend"><span><span class="sw" style="background:var(--cold-2)"></span>Ít hơn hẳn</span>' +
      '<span><span class="sw" style="background:var(--cold-1)"></span>Ít hơn</span>' +
      '<span><span class="sw" style="background:var(--mid)"></span>Gần trung bình</span>' +
      '<span><span class="sw" style="background:var(--hot-1)"></span>Nhiều hơn</span>' +
      '<span><span class="sw" style="background:var(--hot-2)"></span>Nhiều hơn hẳn</span>' +
      '<span><span class="dot"></span>Có trong kỳ gần nhất</span></div>' +
      '<p class="note" style="margin-top:6px">Mức màu so với dao động ngẫu nhiên thường gặp của một số. Có nhiều số cùng lúc nên vài ô đậm màu vẫn là chuyện bình thường.</p>';
  }

  /* ============================================================ tổng quan */
  function slotOf(d) {
    var g = game(), times = (g.schedule && g.schedule.times) || [];
    if (times.length < 2 || !S.draws) return '';
    var i = S.draws.filter(function (x) { return x.date === d.date && x.no < d.no; }).length;
    return times[i] ? ' (kỳ ' + times[i].replace(':00', 'h') + ')' : '';
  }
  function boardHtml(d) {
    var g = game(), prizes = d.prizes || [];
    var jp = (JACKPOT_TIERS[g.code] || [0]).map(function (i) { return prizes[i]; }).filter(Boolean);
    var right = jp.map(function (p) {
      var w = toInt(p[2]);
      return '<div class="board-prize"><div class="p-name">' + esc(p[0]) + '</div><div class="p-val">' + esc(moneyShort(toInt(p[3]))) + '</div>' +
        '<div class="p-win' + (w ? ' won' : '') + '">' + (w ? fi(w) + ' vé trúng' : 'Chưa có người trúng') + '</div></div>';
    }).join('');
    return '<section class="board" aria-label="Kết quả kỳ mới nhất"><div>' +
      '<div class="board-title"><b>Kỳ #' + pad5(d.no) + '</b>&nbsp;&nbsp;' + weekday(d.date) + ', ' + fdate(d.date) + esc(slotOf(d)) + '</div>' +
      ballsHtml(d.main, d.bonus, 'lg') +
      (d.bonus && d.bonus.length ? '<div class="board-label">Quả màu vàng là số đặc biệt.</div>' : '') +
      '</div><div class="board-prizes">' + right + '</div>' +
      '<div class="board-next">' + esc(nextDrawText(g)) + '</div></section>';
  }
  function crossText(code) {
    var c = S.cross && S.cross.games && S.cross.games[code];
    if (!c) return 'Chưa đối chiếu';
    if (c.toolWrong) return c.toolWrong + ' kỳ cần xem lại';
    return 'Chính xác (đã so ' + fi(c.compared) + ' kỳ)';
  }
  function renderOverview() {
    var st = S.stats, g = game(), w = st.window, v = st.verdict;
    var h = S.draws && S.draws[0] ? boardHtml(S.draws[0]) : '';
    h += '<div class="grid-2 block" style="margin-top:20px">' +
      '<section class="panel"><div class="verdict"><span class="v-icon ' + v.level + '" aria-hidden="true">' + LEVEL[v.level].icon + '</span><div>' +
      '<h2>' + esc(LEVEL[v.level].title) + '</h2><p class="sub" style="margin-top:6px">' + esc(v.text) + '</p>' +
      '<p class="small" style="margin-top:10px"><a href="#ngau-nhien">Xem chi tiết ' + v.total + ' phép kiểm tra</a></p></div></div></section>' +
      '<section class="panel"><h2>Dữ liệu đang dùng</h2><div class="facts" style="margin-top:12px">' +
      '<div class="fact"><span class="k">Số kỳ trong phạm vi</span><span class="v">' + fi(w.draws) + ' kỳ</span></div>' +
      '<div class="fact"><span class="k">Từ ngày đến ngày</span><span class="v">' + fdate(w.from) + ' – ' + fdate(w.to) + '</span></div>' +
      '<div class="fact"><span class="k">Đối chiếu nguồn độc lập</span><span class="v">' + esc(crossText(g.code)) + '</span></div>' +
      '<div class="fact"><span class="k">Cơ hội trúng giải cao nhất</span><span class="v">1 / ' + fi(st.game.jackpotOdds) + '</span></div>' +
      '</div><p class="small" style="margin-top:10px"><a href="#phuong-phap">Dữ liệu được kiểm chứng thế nào?</a></p></section></div>';
    h += '<section class="panel block">' + head('Bảng số', 'Mỗi ô là một số, xếp như trên phiếu dự thưởng. Đỏ là ra nhiều hơn trung bình, xanh là ra ít hơn. Rê chuột vào ô để xem chi tiết.') +
      slipHtml('count') + slipLegend('count') + '</section>';
    var byCount = st.numbers.slice().sort(function (a, b) { return b.count - a.count || a.n - b.n; });
    var byWait = st.numbers.slice().sort(function (a, b) { return b.wait - a.wait || a.n - b.n; });
    var list = function (title, arr, txt) {
      return '<section class="panel"><h3>' + title + '</h3><div class="mini-list" style="margin-top:12px">' + arr.map(function (n) {
        return '<div class="mini-row">' + ball(n.n, 'sm') + '<span>' + txt(n) + '</span></div>';
      }).join('') + '</div></section>';
    };
    h += '<div class="grid-3 block">' +
      list('Ra nhiều nhất', byCount.slice(0, 5), function (n) { return fi(n.count) + ' lần <span class="muted">(' + devText(n.devPct) + ')</span>'; }) +
      list('Ra ít nhất', byCount.slice(-5).reverse(), function (n) { return fi(n.count) + ' lần <span class="muted">(' + devText(n.devPct) + ')</span>'; }) +
      list('Lâu chưa ra nhất', byWait.slice(0, 5), function (n) { return fi(n.wait) + ' kỳ chưa ra'; }) + '</div>';
    h += '<p class="note block">Đây là số liệu của các kỳ đã quay. Mỗi kỳ quay độc lập với kỳ trước, nên số ra nhiều hay lâu chưa ra không làm thay đổi cơ hội ở kỳ sau.</p>';
    return h;
  }

  /* ============================================================ bảng số */
  function renderNumbers() {
    var st = S.stats, g = game();
    var seg = '<div class="seg" role="group" aria-label="Chỉ số hiển thị">' +
      '<button type="button" data-metric="count" aria-pressed="' + (S.gridMetric === 'count') + '">Số lần ra</button>' +
      '<button type="button" data-metric="wait" aria-pressed="' + (S.gridMetric === 'wait') + '">Số kỳ chưa ra</button></div>';
    var h = '<section class="panel">' + head(S.gridMetric === 'wait' ? 'Số kỳ chưa ra của từng số' : 'Số lần ra của từng số', S.gridMetric === 'wait'
      ? 'Ô càng đậm là số càng lâu chưa ra. Trung bình một số cách ' + fd(1 / st.game.p0) + ' kỳ thì ra lại.'
      : 'Số lần mỗi số đã ra trong ' + fi(st.window.draws) + ' kỳ; trung bình ' + fd(st.numbers[0].expected) + ' lần mỗi số.', seg) +
      slipHtml(S.gridMetric) + slipLegend(S.gridMetric) + '</section>';
    var cols = [
      { h: 'Số', v: function (n) { return n.n; }, f: function (n) { return ball(n.n, 'xs'); } },
      { h: 'Số lần ra', r: 1, v: function (n) { return n.count; }, f: function (n) { return fi(n.count); } },
      { h: 'So với trung bình', r: 1, v: function (n) { return n.devPct; }, f: function (n) { return '<span class="' + (n.devPct >= 0 ? 'up' : 'down') + '">' + (n.devPct >= 0 ? '+' : '−') + fpct(Math.abs(n.devPct)) + '</span>'; } },
      { h: 'Số kỳ chưa ra', r: 1, v: function (n) { return n.wait; }, f: function (n) { return fi(n.wait); } },
      { h: 'Vắng lâu nhất', r: 1, v: function (n) { return n.maxWait; }, f: function (n) { return fi(n.maxWait) + ' kỳ'; } },
      { h: 'Khoảng cách trung bình', r: 1, v: function (n) { return n.avgGap || 0; }, f: function (n) { return n.avgGap ? fd(n.avgGap) + ' kỳ' : '–'; } },
      { h: 'Lần ra gần nhất', v: function (n) { return n.lastNo || 0; }, f: function (n) { return n.lastNo ? '#' + pad5(n.lastNo) + ' <span class="muted">' + fdate(n.lastDate) + '</span>' : '–'; } }
    ];
    if (g.hasBonus) {
      var B = g.bonusMax || g.max;
      cols.push({ h: 'Là số đặc biệt', r: 1, v: function (n) { return n.bonus; }, f: function (n) { return n.n <= B ? fi(n.bonus) : '–'; } });
    }
    h += '<section class="panel block">' + head('Chi tiết từng số', 'Bấm vào tiêu đề cột để sắp xếp (trên điện thoại: chọn ở ô "Sắp xếp theo").') +
      '<div class="table-wrap tall" data-table="numbers">' + sortTable('numbers', cols, st.numbers, { k: 1, dir: -1 }) + '</div></section>';
    S._tables = { numbers: { cols: cols, rows: st.numbers } };
    return h;
  }

  /* ============================================================ số gan */
  function testOf(key) { return (S.stats.tests || []).filter(function (t) { return t.key === key; })[0]; }
  function checkLine(t) {
    if (!t) return '';
    return '<div class="verdict" style="margin-top:14px"><span class="v-icon sm ' + t.level + '" aria-hidden="true">' + LEVEL[t.level].icon + '</span>' +
      '<p class="sub">' + esc(t.summary) + '</p></div>';
  }
  function renderGan() {
    var st = S.stats, gi = st.gapInfo, avg = 1 / st.game.p0, rec = gi.record;
    var byWait = st.numbers.slice().sort(function (a, b) { return b.wait - a.wait || a.n - b.n; }).slice(0, 15);
    var rows = byWait.map(function (n) {
      return { label: ball(n.n, 'sm'), value: n.wait, text: fi(n.wait) + ' kỳ',
        tip: '<b>Số ' + pad2(n.n) + '</b><br>Đã ' + fi(n.wait) + ' kỳ chưa ra<br>Lần ra gần nhất: ' + lastSeen(n) + '<br>Vắng lâu nhất từ trước: ' + fi(n.maxWait) + ' kỳ' };
    });
    var h = '<div class="grid-2">' +
      '<section class="panel">' + head('Đang vắng lâu nhất', '15 số lâu chưa ra nhất tính đến kỳ #' + pad5(st.window.toNo) + '.') +
      rankList(rows, { cls: 'gan', ref: avg, refLabel: 'Khoảng cách trung bình giữa hai lần ra: ' + fd(avg) + ' kỳ' }) + '</section>' +
      '<section class="panel">' + head('Kỷ lục vắng mặt') +
      '<div class="facts"><div class="fact"><span class="k">Kỷ lục trong phạm vi</span><span class="v">' + fi(rec.length) + ' kỳ (số ' + pad2(rec.n) + ')</span></div>' +
      '<div class="fact"><span class="k">Thời gian</span><span class="v">' + (rec.current ? fdate(rec.fromDate) + ' – nay' : fdate(rec.fromDate) + ' – ' + fdate(rec.toDate)) + '</span></div>' +
      '<div class="fact"><span class="k">Đang vắng lâu nhất</span><span class="v">' + fi(gi.current.wait) + ' kỳ (số ' + pad2(gi.current.n) + ')</span></div>' +
      '<div class="fact"><span class="k">Tỷ lệ thời điểm có số vắng từ ' + fi(gi.current.wait) + ' kỳ trở lên</span><span class="v">' + fpct(gi.current.prob) + '</span></div></div>' +
      checkLine(testOf('record')) +
      '<p class="note" style="margin-top:12px">Với nhiều số cùng quay, lúc nào cũng có vài số vắng lâu. Số vắng lâu không vì thế mà dễ ra hơn ở kỳ sau.</p></section></div>';
    h += '<section class="panel block">' + head('Khoảng cách giữa hai lần ra', 'Số lần gặp mỗi độ dài khoảng cách (tính bằng số kỳ), so với lý thuyết của quay ngẫu nhiên.') +
      colChart(gi.dist.map(function (d) {
        return { label: d.label, obs: d.obs, exp: d.exp, tip: '<b>Khoảng cách ' + esc(d.label) + ' kỳ</b><br>Thực tế: ' + fi(d.obs) + ' lần<br>Lý thuyết: ' + fd(d.exp) + ' lần' };
      }), { title: 'Phân bố khoảng cách giữa hai lần ra' }) + checkLine(testOf('gaps')) + '</section>';
    return h;
  }

  /* ============================================================ cặp số */
  function renderPairs() {
    var st = S.stats, p = st.pairs, eP = p.note.expected;
    if (!S.pairOf || S.pairOf > st.game.max) S.pairOf = (S.draws && S.draws[0] ? S.draws[0].main[0] : 1);
    var inT = pickedNums(), has = inT.indexOf(S.pairOf) >= 0, left = game().nMain - inT.length;
    var pairRows = function (arr) {
      return rankList(arr.map(function (x) {
        return { label: '<span class="balls">' + ball(x.a, 'xs') + ball(x.b, 'xs') + '</span>', value: x.count, text: fi(x.count) + ' lần',
          tip: '<b>Số ' + pad2(x.a) + ' và số ' + pad2(x.b) + '</b><br>Ra cùng nhau ' + fi(x.count) + ' lần<br>Trung bình một cặp: ' + fd(eP) + ' lần' };
      }), { lbl: '58px', ref: eP, max: Math.max(p.top[0].count, eP) * 1.05, refLabel: 'Trung bình một cặp: ' + fd(eP) + ' lần' });
    };
    var h = '<section class="panel">' + head('Số ' + pad2(S.pairOf) + ' hay ra cùng số nào?', 'Bấm vào một ô để chọn số khác. Màu đỏ: ra cùng nhau nhiều hơn trung bình, màu xanh: ít hơn.',
      (has ? '<button type="button" class="btn btn-light btn-sm" id="pair-use" disabled>Số ' + pad2(S.pairOf) + ' đã có trong vé</button>'
        : '<button type="button" class="btn btn-light btn-sm" id="pair-use">Thêm số ' + pad2(S.pairOf) + ' vào vé</button>')) +
      slipHtml('pair') + slipLegend('pair') +
      '<p class="note pair-status">Vé đang có ' + inT.length + '/' + game().nMain + ' số.' +
      (left > 0 ? ' Chọn thêm ' + left + ' số, khi đủ sẽ tự chuyển sang Kiểm tra vé.' : ' Đã đủ số, bấm nút để sang Kiểm tra vé.') + '</p>' +
      '<div class="legend"><span><span class="sw picked-sw"></span>Đã có trong vé ở mục Kiểm tra vé</span></div></section>';
    h += '<div class="grid-2 block"><section class="panel">' + head('15 cặp ra cùng nhau nhiều nhất') + pairRows(p.top) + '</section>' +
      '<section class="panel">' + head('15 cặp ra cùng nhau ít nhất') + pairRows(p.bottom) + '</section></div>';
    h += '<section class="panel block">' + head('Kết luận về cặp số') + checkLine(testOf('pairs')).replace('margin-top:14px', 'margin-top:0') + '</section>';
    return h;
  }

  /* ============================================================ độ ngẫu nhiên */
  function renderRandomness() {
    var st = S.stats, v = st.verdict;
    var h = '<section class="panel"><div class="verdict"><span class="v-icon ' + v.level + '" aria-hidden="true">' + LEVEL[v.level].icon + '</span><div>' +
      '<h2>' + esc(LEVEL[v.level].title) + '</h2><p class="sub" style="margin-top:6px">' + esc(v.text) + '</p></div></div></section>';
    h += '<section class="panel block">' + head(v.total + ' phép kiểm tra', 'Mỗi phép trả lời một câu hỏi. Kết luận đã tính đến việc làm nhiều phép kiểm tra cùng lúc.') +
      '<div class="checks">' + st.tests.map(function (t) {
        return '<div class="check"><span class="v-icon sm ' + t.level + '" aria-hidden="true">' + LEVEL[t.level].icon + '</span>' +
          '<div><div class="q">' + esc(t.question) + '</div><div class="s">' + esc(t.summary) + '</div><div class="m">Cách kiểm tra: ' + esc(t.method) + '</div></div>' +
          badge(t.level, t.levelText) + '</div>';
      }).join('') + '</div></section>';
    var k = st.game.nMain;
    h += '<div class="grid-3 block">' +
      '<section class="panel">' + head('Số lẻ trong mỗi kỳ') + colChart(st.parityDist.map(function (d) {
        return { label: d.j + ' lẻ', obs: d.obs, exp: d.exp, tip: '<b>Kỳ có ' + d.j + ' số lẻ, ' + (k - d.j) + ' số chẵn</b><br>Thực tế: ' + fi(d.obs) + ' kỳ<br>Lý thuyết: ' + fd(d.exp) + ' kỳ' };
      }), { h: 220, cols: 3, title: 'Số lẻ trong mỗi kỳ' }) + '</section>' +
      '<section class="panel">' + head('Tổng các số trong kỳ') + colChart(st.sumHist.map(function (d) {
        return { label: String(d.from), obs: d.obs, exp: d.exp, tip: '<b>Tổng từ ' + d.from + ' đến ' + d.to + '</b><br>Thực tế: ' + fi(d.obs) + ' kỳ<br>Lý thuyết: ' + fd(d.exp) + ' kỳ' };
      }), { h: 220, cols: 3, maxLabels: 6, title: 'Tổng các số trong kỳ' }) + '</section>' +
      '<section class="panel">' + head('Số trùng với kỳ trước') + colChart(st.repeatDist.filter(function (d) { return d.obs > 0 || d.exp >= 0.5; }).map(function (d) {
        return { label: d.j + ' số', obs: d.obs, exp: d.exp, tip: '<b>Trùng ' + d.j + ' số với kỳ ngay trước</b><br>Thực tế: ' + fi(d.obs) + ' kỳ<br>Lý thuyết: ' + fd(d.exp) + ' kỳ' };
      }), { h: 220, cols: 3, title: 'Số trùng với kỳ trước' }) + '</section></div>';
    if (st.backtest) {
      var bt = st.backtest;
      h += '<section class="panel block">' + head('Chọn số theo thống kê có trúng nhiều hơn không?',
        'Thử lại trên ' + fi(bt.draws) + ' kỳ: mỗi kỳ chỉ dùng kết quả của các kỳ trước đó để chọn ' + k + ' số, rồi so với kết quả thật của kỳ đó.') +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Cách chọn</th><th class="r">Trúng trung bình mỗi kỳ</th><th class="r">Số kỳ trúng từ 3 số trở lên</th></tr></thead><tbody>' +
        bt.strategies.map(function (s) {
          return '<tr><td>' + esc(s.label) + '</td><td class="r">' + fd(s.mean, 2) + ' số</td><td class="r">' + fi(s.atLeast3.obs) + ' kỳ</td></tr>';
        }).join('') +
        '<tr><td><b>Chọn ngẫu nhiên (lý thuyết)</b></td><td class="r"><b>' + fd(bt.expectedHits, 2) + ' số</b></td><td class="r"><b>' + fd(bt.strategies[0].atLeast3.exp) + ' kỳ</b></td></tr>' +
        '</tbody></table></div>' + checkLine(testOf('predict')) + '</section>';
    }
    return h;
  }

  /* ============================================================ kiểm tra vé */
  function renderCheck() {
    var g = game(), keep = S.ck && S.ck.game === S.game ? S.ck : { nums: '', sp: '' }, ex = [];
    for (var i = 0; i < g.nMain; i++) ex.push(pad2(Math.round(((i + 0.5) * g.max) / g.nMain)));
    var spOpts = '<option value="">Chọn</option>';
    for (var s = 1; s <= g.bonusMax; s++) spOpts += '<option value="' + s + '"' + (String(keep.sp) === String(s) ? ' selected' : '') + '>' + pad2(s) + '</option>';
    var sel = selNums(keep.nums, g);
    var h = '<section class="panel">' + head('Chọn số của bạn', 'Chạm vào số để chọn, chạm lần nữa để bỏ chọn. Cũng có thể gõ số vào ô bên dưới.') +
      '<div id="ck-pick">' + pickHtml(g, sel) + '</div>' + msgBoxHtml(g) + '<hr class="divider"><form class="form-row" id="ck-form" autocomplete="off">' +
      '<label class="field" style="flex:1 1 320px"><span>' + g.nMain + ' số của bạn (từ 1 đến ' + g.max + ')</span>' +
      '<input class="input num" id="ck-nums" inputmode="numeric" autocomplete="off" placeholder="Ví dụ: ' + ex.join(' ') + '" value="' + esc(keep.nums) + '"></label>' +
      (specialPick(g) ? '<label class="field"><span>Số đặc biệt (1–' + g.bonusMax + ')</span><select id="ck-sp">' + spOpts + '</select></label>' : '') +
      '<div class="field"><span>&nbsp;</span><div style="display:flex;gap:8px"><button class="btn" type="submit">Kiểm tra</button>' +
      '<button class="btn btn-light" type="button" id="ck-rand">Chọn ngẫu nhiên</button></div></div></form></section><div id="ck-pairs">' + pairPanelHtml(g, sel) + '</div><div id="ck-out" class="block"></div>';
    return h;
  }
  // Các số đã chọn (đủ 2 chữ số, trong khoảng cho phép, không trùng) từ chuỗi trong ô nhập
  function selNums(str, g) {
    var d = String(str || '').replace(/\D/g, ''), out = [], i, v;
    for (i = 0; i + 1 < d.length; i += 2) {
      v = +d.substr(i, 2);
      if (v >= 1 && v <= g.max && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }
  // Bảng chọn số: chạm để chọn / bỏ chọn, đủ số thì các ô còn lại mờ đi
  function pickHtml(g, sel) {
    var full = sel.length >= g.nMain, h = '<div class="slip pick">', n, on;
    for (n = 1; n <= g.max; n++) {
      on = sel.indexOf(n) >= 0;
      h += '<button type="button" class="cell pick-cell' + (on ? ' on' : full ? ' dim' : '') + '" data-n="' + n + '" aria-pressed="' + on + '"><span class="c-n">' + pad2(n) + '</span></button>';
    }
    return h + '</div><div class="pick-count"><span>Đã chọn <b>' + sel.length + '/' + g.nMain + '</b> số' + (sel.length ? ': ' + sel.map(pad2).join(' ') : '') + '</span>' +
      (sel.length ? '<button type="button" class="btn btn-light btn-sm" id="ck-clear">Xóa hết</button>' : '') + '</div>';
  }
  // Thống kê các cặp trong bộ số đang chọn: mỗi cặp đã ra cùng nhau bao nhiêu lần
  function pairPanelHtml(g, sel) {
    var st = S.stats, rows = [], i, j, a, b;
    if (!st || !st.pairs || sel.length < 2) return '';
    var M = st.game.max, eP = st.pairs.note.expected;
    for (i = 0; i < sel.length; i++) {
      for (j = i + 1; j < sel.length; j++) {
        a = sel[i]; b = sel[j];
        rows.push({ a: a, b: b, count: st.pairs.counts[(a - 1) * M + (b - 1)] });
      }
    }
    rows.sort(function (x, y) { return y.count - x.count || x.a - y.a || x.b - y.b; });
    return '<section class="panel block">' + head('Các cặp trong bộ số của bạn',
      sel.length + ' số bạn chọn tạo thành ' + rows.length + ' cặp. Số lần mỗi cặp ra cùng nhau trong ' + fi(st.window.draws) + ' kỳ.') +
      rankList(rows.map(function (x) {
        return { label: '<span class="balls">' + ball(x.a, 'xs') + ball(x.b, 'xs') + '</span>', value: x.count, text: fi(x.count) + ' lần',
          tip: '<b>Số ' + pad2(x.a) + ' và số ' + pad2(x.b) + '</b><br>Ra cùng nhau ' + fi(x.count) + ' lần<br>Trung bình một cặp: ' + fd(eP) + ' lần' };
      }), { lbl: '58px', ref: eP, max: Math.max(rows[0].count, eP) * 1.05, refLabel: 'Trung bình một cặp: ' + fd(eP) + ' lần' }) +
      '<p class="note" style="margin-top:12px">Đây chỉ là số liệu quá khứ. Bộ số gồm các cặp hay ra cùng nhau cũng không có cơ hội trúng cao hơn bộ số khác.</p></section>';
  }
  // Tin nhắn gửi tổng đài: mẫu lưu theo từng loại vé, dùng {loai} {so} {db}
  function tplKey(g) { return 'vl_tpl_' + g.code; }
  function defTpl(g) { return specialPick(g) ? '{loai} {so} DB {db}' : '{loai} {so}'; }
  function getTpl(g) { var v = null; try { v = localStorage.getItem(tplKey(g)); } catch (e) {} return v || defTpl(g); }
  function msgBoxHtml(g) {
    return '<div class="msg-box"><label class="field"><span>Tin nhắn gửi tổng đài</span>' +
      '<textarea class="input" id="ck-msg-text" rows="2" readonly placeholder="Chọn đủ số để tạo tin nhắn"></textarea></label>' +
      '<button type="button" class="btn" id="ck-copy" disabled>Sao chép tin nhắn</button></div>' +
      '<details class="msg-tpl"><summary>Đổi mẫu tin nhắn</summary>' +
      '<input class="input" id="ck-tpl" value="' + esc(getTpl(g)) + '" autocomplete="off">' +
      '<p class="note">Dùng {loai} cho tên loại vé, {so} cho các số, {db} cho số đặc biệt. Ví dụ: ' + esc(defTpl(g)) +
      '. <a href="#" id="ck-tpl-reset">Khôi phục mẫu mặc định</a></p></details>';
  }
  function updateMsg() {
    var g = game(), nums = $('#ck-nums').val() || '', sp = $('#ck-sp').val() || '', sel = selNums(nums, g);
    var ok = sel.length === g.nMain && (!specialPick(g) || sp), txt = '';
    if (ok) {
      txt = ($('#ck-tpl').val() || defTpl(g)).split('{loai}').join(g.label).split('{so}').join(sel.map(pad2).join(' '))
        .split('{db}').join(sp ? pad2(+sp) : '');
    }
    $('#ck-msg-text').val(txt);
    $('#ck-copy').prop('disabled', !ok).text('Sao chép tin nhắn');
  }
  // Vẽ lại bảng chọn số và phần cặp số theo nội dung ô nhập
  function syncPick() {
    var g = game(), sel = selNums($('#ck-nums').val(), g);
    $('#ck-pick').html(pickHtml(g, sel));
    $('#ck-pairs').html(pairPanelHtml(g, sel));
    updateMsg();
  }
  // Tự kiểm tra khi đã chọn đủ số (và số đặc biệt nếu loại này cần); chưa đủ thì nhắc chọn thêm
  function autoCheck() {
    var g = game(), nums = $('#ck-nums').val() || '', sp = $('#ck-sp').val() || '', sel = selNums(nums, g), hint = '';
    S.ck = { game: S.game, nums: nums, sp: sp };
    updateMsg();
    if (sel.length === g.nMain && String(nums).replace(/\D/g, '').length === g.nMain * 2 && (!specialPick(g) || sp)) { runCheck(); return; }
    if (sel.length && sel.length < g.nMain) hint = 'Đã chọn ' + sel.length + '/' + g.nMain + ' số. Chọn thêm ' + (g.nMain - sel.length) + ' số để xem kết quả.';
    else if (sel.length === g.nMain && specialPick(g) && !sp) hint = 'Chọn thêm số đặc biệt (từ 1 đến ' + g.bonusMax + ') để xem kết quả.';
    $('#ck-out').html(hint ? '<div class="alert info">' + esc(hint) + '</div>' : '');
  }
  function fmtNums(raw, max) {
    var d = String(raw == null ? '' : raw).replace(/\D/g, '').slice(0, max * 2);
    var parts = d.match(/.{1,2}/g);
    return parts ? parts.join(' ') : '';
  }
  function caretAfterDigits(val, n) {
    var c = 0, i;
    if (n <= 0) return 0;
    for (i = 0; i < val.length; i++) {
      if (/\d/.test(val.charAt(i))) { c++; if (c === n) return i + 1; }
    }
    return val.length;
  }
  function numsProblem(g, nums) {
    var d = String(nums || '').replace(/\D/g, ''), seen = {}, i, v;
    if (d.length !== g.nMain * 2) return 'Cần nhập đủ ' + g.nMain + ' số, mỗi số gồm 2 chữ số. Hiện có ' + Math.floor(d.length / 2) + ' số.';
    for (i = 0; i < d.length; i += 2) {
      v = +d.substr(i, 2);
      if (v < 1 || v > g.max) return 'Số ' + pad2(v) + ' không hợp lệ, mỗi số phải từ 1 đến ' + g.max + '.';
      if (seen[v]) return 'Số ' + pad2(v) + ' bị nhập trùng, mỗi số chỉ nhập một lần.';
      seen[v] = true;
    }
    return '';
  }
  function runCheck() {
    var g = game(), nums = $.trim($('#ck-nums').val() || ''), sp = $('#ck-sp').val() || '', code = S.game;
    S.ck = { game: code, nums: nums, sp: sp };
    var problem = numsProblem(g, nums);
    if (problem) { $('#ck-out').html('<div class="alert info">' + esc(problem) + '</div>'); return; }
    if (specialPick(g) && !sp) { $('#ck-out').html('<div class="alert info">Chọn thêm số đặc biệt (từ 1 đến ' + g.bonusMax + ') rồi bấm Kiểm tra.</div>'); $('#ck-sp').trigger('focus'); return; }
    $('#ck-out').addClass('loading');
    getJson('/api/check?game=' + code + '&last=' + S.last + '&numbers=' + encodeURIComponent(nums) + (sp ? '&special=' + sp : ''))
      .done(function (r) { if (S.game === code && S.section === 'kiem-tra-ve') $('#ck-out').html(checkResultHtml(r)); })
      .fail(function (m) { $('#ck-out').html('<div class="alert error">' + esc(m) + '</div>'); })
      .always(function () { $('#ck-out').removeClass('loading'); });
  }
  function checkResultHtml(r) {
    var g = r.game, rp = r.replay, top = r.tiers[0];
    var h = '<section class="panel"><div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px">' + ballsHtml(r.ticket.numbers, r.ticket.special ? [r.ticket.special] : null) +
      '<span class="sub small">Tổng ' + r.sum + ', ' + r.odd + ' số lẻ và ' + (g.nMain - r.odd) + ' số chẵn</span></div>' +
      '<div class="grid-2" style="margin-top:16px"><div class="facts">' +
      '<div class="fact"><span class="k">Trúng ' + esc(top.name) + '</span><span class="v">1 / ' + fi(top.oneIn) + '</span></div>' +
      '<div class="fact"><span class="k">Trúng ít nhất một giải</span><span class="v">' + fprob(r.anyPrize.p) + ' (khoảng 1 trong ' + fd(r.anyPrize.oneIn, 0) + ' vé)</span></div>' +
      '<div class="fact"><span class="k">Tiền thưởng trung bình nhận lại</span><span class="v">' + money(r.ev) + ' trên mỗi vé ' + money(g.price) + '</span></div></div>' +
      '<div class="facts"><div class="fact"><span class="k">Nếu đã chơi bộ này ' + fi(rp.draws) + ' kỳ</span><span class="v">tốn ' + money(rp.spent) + '</span></div>' +
      '<div class="fact"><span class="k">Tiền thưởng nhận được</span><span class="v">' + money(rp.won) + '</span></div>' +
      '<div class="fact"><span class="k">Lãi / lỗ</span><span class="v ' + (rp.net < 0 ? 'up' : 'down') + '">' + (rp.net > 0 ? '+' : rp.net < 0 ? '−' : '') + money(Math.abs(rp.net)) + '</span></div></div></div>' +
      '<p class="note" style="margin-top:14px">Mọi bộ số ' + esc(g.label) + ' đều có đúng các xác suất này: các số được quay ngẫu nhiên và độc lập, nên chọn số nào cũng như nhau. ' +
      'Tiền thưởng trung bình tính theo giá trị giải kỳ #' + pad5(rp.toNo) + ', chưa trừ thuế và chưa tính việc chia giải khi nhiều người cùng trúng.</p></section>';
    h += '<section class="panel block">' + head('Xác suất trúng từng giải (một vé)') + '<div class="table-wrap"><table class="data"><thead><tr><th>Giải</th><th>Điều kiện</th>' +
      '<th class="r">Xác suất</th><th class="r">Cơ hội</th><th class="r">Giá trị giải kỳ #' + pad5(rp.toNo) + '</th><th class="r">Trung bình mỗi vé</th></tr></thead><tbody>' +
      r.tiers.map(function (t) {
        return '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.desc) + '</td><td class="r nowrap">' + fprob(t.p) + '</td><td class="r nowrap">1 / ' + fi(t.oneIn) +
          '</td><td class="r nowrap">' + money(t.value) + '</td><td class="r nowrap">' + money(t.ev) + '</td></tr>';
      }).join('') + '<tr><td colspan="2"><b>Trúng ít nhất một giải</b></td><td class="r"><b>' + fprob(r.anyPrize.p) + '</b></td><td class="r">1 / ' + fi(r.anyPrize.oneIn) +
      '</td><td></td><td class="r"><b>' + money(r.ev) + '</b></td></tr></tbody></table></div></section>';
    h += '<div class="grid-2 block"><section class="panel">' + head('Nếu đã chơi bộ số này ' + fi(rp.draws) + ' kỳ', 'Từ ' + fdate(rp.from) + ' đến ' + fdate(rp.to) + '.') +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Giải</th><th class="r">Số lần trúng</th><th class="r">Trung bình một bộ số</th></tr></thead><tbody>' +
      rp.tiers.map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td class="r">' + fi(t.count) + '</td><td class="r">' + fd(t.exp, t.exp < 1 ? 2 : 1) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="note" style="margin-top:10px">Cột cuối là số lần trúng trung bình của một bộ số bất kỳ trong ' + fi(rp.draws) + ' kỳ; chênh lệch quanh con số này là do may rủi.</p></section>' +
      '<section class="panel">' + head('Số lượng số trùng ở mỗi kỳ') + colChart(r.matchDist.map(function (d) {
        return { label: d.m + ' số', obs: d.obs, exp: d.exp, tip: '<b>Trùng ' + d.m + ' số</b><br>Thực tế: ' + fi(d.obs) + ' kỳ<br>Trung bình một bộ số: ' + fd(d.exp) + ' kỳ' };
      }), { h: 220, cols: 2, title: 'Số lượng số trùng ở mỗi kỳ' }) + '</section></div>';
    if (rp.best.length) {
      h += '<section class="panel block">' + head('Các kỳ bộ số này trúng giải', rp.winCount + ' lần' + (rp.winCount > rp.best.length ? ', hiển thị ' + rp.best.length + ' lần thưởng cao nhất' : '') + '.') +
        '<div class="table-wrap tall"><table class="data"><thead><tr><th>Kỳ</th><th>Ngày</th><th>Trùng</th><th>Giải</th><th class="r">Tiền thưởng</th></tr></thead><tbody>' +
        rp.best.map(function (w) {
          var needSp = /đặc biệt/.test(r.tiers[w.tier].desc);
          return '<tr><td>#' + pad5(w.no) + '</td><td>' + fdate(w.date) + '</td><td>' + w.m + ' số' + (w.s && needSp ? ' và số đặc biệt' : '') + '</td><td>' + esc(w.name) + '</td><td class="r">' + money(w.prize) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    } else h += '<p class="note block">Bộ số này chưa trúng giải nào trong phạm vi kỳ đã chọn.</p>';
    return h;
  }

  /* ============================================================ gợi ý bộ số */
  var SG_MODES = [
    { id: 'uniform', label: 'Ngẫu nhiên hoàn toàn' },
    { id: 'hot', label: 'Ưu tiên số ra nhiều' },
    { id: 'cold', label: 'Ưu tiên số lâu chưa ra' },
    { id: 'rare', label: 'Ưu tiên số lớn hơn 31' }
  ];
  function renderSuggest() {
    var cnt = '';
    [1, 3, 5, 10, 20].forEach(function (c) { cnt += '<option value="' + c + '"' + (S.sgCount === c ? ' selected' : '') + '>' + c + ' bộ</option>'; });
    return '<section class="panel"><div class="form-row"><div class="field"><span>Cách sinh</span><div class="seg" role="group" aria-label="Cách sinh">' +
      SG_MODES.map(function (m) { return '<button type="button" data-sg="' + m.id + '" aria-pressed="' + (S.sgMode === m.id) + '">' + m.label + '</button>'; }).join('') +
      '</div></div><label class="field"><span>Số bộ</span><select id="sg-count">' + cnt + '</select></label>' +
      '<div class="field"><span>&nbsp;</span><button class="btn" type="button" id="sg-go">Sinh bộ số</button></div></div>' +
      '<p class="note" style="margin-top:12px">Mọi bộ số đều có cùng cơ hội trúng giải cao nhất: 1 / ' + fi(S.stats.game.jackpotOdds) +
      '. Cách sinh chỉ thay đổi những số được chọn, không làm tăng cơ hội trúng. "Ưu tiên số lớn hơn 31" giúp tránh kiểu chọn theo ngày sinh mà nhiều người dùng, để nếu trúng thì ít phải chia giải hơn.</p></section>' +
      '<div id="sg-out" class="block"></div>';
  }
  function runSuggest() {
    var code = S.game;
    $('#sg-out').addClass('loading');
    getJson('/api/suggest?game=' + code + '&mode=' + S.sgMode + '&count=' + S.sgCount + '&last=' + S.last).done(function (r) {
      if (S.game !== code || S.section !== 'goi-y') return;
      $('#sg-out').html('<section class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>Bộ số</th><th class="r">Tổng</th><th class="r">Số lẻ</th><th></th></tr></thead><tbody>' +
        r.sets.map(function (s) {
          return '<tr><td>' + ballsHtml(s.numbers, null, 'sm') + '</td><td class="r">' + s.sum + '</td><td class="r">' + s.odd + '</td>' +
            '<td class="r"><button type="button" class="btn btn-light btn-sm" data-check="' + s.numbers.map(pad2).join(' ') + '">Kiểm tra bộ này</button></td></tr>';
        }).join('') + '</tbody></table></div></section>');
    }).fail(function (m) { $('#sg-out').html('<div class="alert error">' + esc(m) + '</div>'); })
      .always(function () { $('#sg-out').removeClass('loading'); });
  }

  /* ============================================================ lịch sử */
  function renderHistory() {
    var g = game(), list = S.draws || [];
    if (!list.length) return '<p class="empty">Chưa có dữ liệu.</p>';
    return '<section class="panel"><div class="table-wrap tall"><table class="data hist"><thead><tr><th>Kỳ</th><th>Ngày</th><th>Kết quả</th><th>Giải cao nhất</th></tr></thead><tbody>' +
      list.map(function (d) {
        var p = (d.prizes || [])[0], w = p ? toInt(p[2]) : 0;
        return '<tr><td class="nowrap c-no">#' + pad5(d.no) + '</td><td class="nowrap c-date">' + weekday(d.date) + ', ' + fdate(d.date) + esc(slotOf(d)) + '</td><td class="c-res">' + ballsHtml(d.main, d.bonus, 'sm') + '</td>' +
          '<td class="nowrap c-top">' + (p ? esc(moneyShort(toInt(p[3]))) + '<br><span class="small ' + (w ? 'up' : 'muted') + '">' + (w ? fi(w) + ' vé trúng' : 'chưa có người trúng') + '</span>' : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* ============================================================ phương pháp và kiểm chứng */
  var REFS = [
    ['Joe, H. (1993). Tests of uniformity for sets of lotto numbers. Statistics & Probability Letters 16, 181–188.', 'https://ideas.repec.org/a/eee/stapro/v16y1993i3p181-188.html'],
    ['Genest, C., Lockhart, R. A. & Stephens, M. A. (2002). χ² and the lottery. The Statistician 51(2), 243–257.', 'https://www.sfu.ca/~lockhart/Research/Papers/GenestLockhartStephensJRSSD02.pdf'],
    ['Spiegelhalter, D. & Pearson, M. Understanding uncertainty: A league table lottery. Plus Magazine (Đại học Cambridge).', 'https://plus.maths.org/content/understanding-uncertainty-league-table-lottery'],
    ['Haigh, J. (1997). The statistics of the National Lottery. Journal of the Royal Statistical Society, Series A 160(2).', 'https://rss.onlinelibrary.wiley.com/doi/pdf/10.1111/1467-985X.00056'],
    ['Kiểm định khoảng cách (gap test) theo Knuth, The Art of Computer Programming, tập 2 - tài liệu thư viện NAG.', 'https://www.nag.com/numeric/nl/nagdoc_27/clhtml/g08/g08edc.html'],
    ['Holm, S. (1979). A simple sequentially rejective multiple test procedure. Scandinavian Journal of Statistics 6, 65–70.', 'https://en.wikipedia.org/wiki/Holm%E2%80%93Bonferroni_method']
  ];
  function renderMethod() {
    var c = S.cross, rows = '';
    if (c && c.games) {
      ['655', '645', '535'].forEach(function (code) {
        var x = c.games[code]; if (!x) return;
        var extra = [];
        if (x.mismatches && x.mismatches.length) x.mismatches.forEach(function (m) {
          extra.push('Kỳ #' + pad5(m.no) + ': ' + (m.toolCorrect === true ? 'nguồn kia ghi sai, đã tra lại vietlott.vn và dữ liệu của tool đúng' : m.toolCorrect === false ? 'dữ liệu của tool khác vietlott.vn, cần cập nhật lại' : 'chưa tra được vietlott.vn'));
        });
        if (x.onlyOurs && x.onlyOurs.length) extra.push('Nguồn kia không có ' + x.onlyOurs.join(', ') + '.');
        rows += '<tr><td>' + esc(x.label) + '</td><td class="r">' + fi(x.compared) + '</td><td class="r">' + fi(x.matched) + '</td><td class="r">' + fi(x.mismatchCount) + '</td>' +
          '<td>' + (x.toolWrong ? badge('alert', 'Cần xem lại') : badge('ok', 'Chính xác')) + (extra.length ? '<div class="small sub" style="margin-top:4px">' + esc(extra.join(' ')) + '</div>' : '') + '</td></tr>';
      });
    }
    var h = '<section class="panel">' + head('Dữ liệu có chính xác không?',
      'Kết quả được lấy trực tiếp từ vietlott.vn, sau đó đối chiếu từng kỳ với một bộ dữ liệu độc lập do người khác thu thập (dự án vietlott-data trên GitHub).',
      '<button type="button" class="btn btn-light btn-sm" id="cross-run">Đối chiếu lại ngay</button>') +
      (rows ? '<div class="table-wrap"><table class="data"><thead><tr><th>Loại</th><th class="r">Số kỳ đối chiếu</th><th class="r">Khớp</th><th class="r">Lệch</th><th>Kết luận</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="note" style="margin-top:10px">Đối chiếu lần gần nhất: ' + new Date(c.checkedAt).toLocaleString('vi-VN') + '. Mỗi kỳ được so ngày quay, các số và số đặc biệt; kỳ nào lệch thì tool tự tra lại trên vietlott.vn để biết bên nào đúng. Việc đối chiếu chạy tự động mỗi ngày một lần.</p>'
        : '<p class="empty">Chưa đối chiếu lần nào. Bấm "Đối chiếu lại ngay".</p>') +
      '<hr class="divider"><div class="prose"><h3>Các con số được kiểm tra lại thế nào</h3><ul>' +
      '<li>Mỗi kỳ được kiểm tra: đủ số, không trùng số, nằm trong khoảng cho phép, không thiếu kỳ, ngày quay không lùi.</li>' +
      '<li>Số lần ra, số kỳ chưa ra, khoảng cách giữa hai lần ra, kỷ lục vắng, số lần ra cùng nhau của từng cặp và số đặc biệt đều được tính lại bằng một cách độc lập (truy vấn trực tiếp cơ sở dữ liệu) và phải khớp tuyệt đối.</li>' +
      '<li>Xác suất trúng từng giải được so với giá trị tính tay bằng tổ hợp, ví dụ Power 6/55 có 28.989.675 bộ số khác nhau.</li>' +
      '<li>Bộ kiểm thử chạy bằng lệnh <span class="num">npm test</span> trong thư mục tool.</li></ul></div></section>';
    var tests = (S.stats && S.stats.tests) || [];
    h += '<section class="panel block"><div class="prose"><h2>Phương pháp thống kê</h2>' +
      '<p style="margin-top:8px">Câu hỏi chính là: kết quả quay có giống quay ngẫu nhiên hoàn toàn không? Tool dùng các phương pháp chuẩn trong các nghiên cứu về xổ số, mỗi phương pháp trả lời một câu hỏi:</p><ul>' +
      tests.map(function (t) { return '<li><b>' + esc(t.question) + '</b> ' + esc(t.method) + '</li>'; }).join('') + '</ul>' +
      '<h3 style="margin-top:18px">Cách đọc kết luận</h3><ul>' +
      '<li>' + badge('ok', 'Bình thường') + ' Chênh lệch nằm trong dao động thường gặp của quay ngẫu nhiên.</li>' +
      '<li>' + badge('watch', 'Cần theo dõi') + ' Chênh lệch lớn, chỉ xảy ra dưới 5 trên 100 lần nếu quay ngẫu nhiên. Chưa đủ để kết luận, cần thêm dữ liệu.</li>' +
      '<li>' + badge('alert', 'Bất thường') + ' Chênh lệch rất lớn, chỉ xảy ra dưới 1 trên 100 lần nếu quay ngẫu nhiên.</li></ul>' +
      '<p>Vì làm nhiều phép kiểm tra cùng lúc, kết luận được hiệu chỉnh theo phương pháp Holm để tránh báo động nhầm: nếu chỉ dựa vào may rủi, cứ khoảng 20 phép kiểm tra sẽ có 1 phép trông "lệch". ' +
      'Mỗi phép kiểm tra đã được thử trên hàng nghìn bộ dữ liệu quay ngẫu nhiên giả lập để chắc chắn tỷ lệ báo nhầm đúng mức.</p>' +
      '<h3 style="margin-top:18px">Điều thống kê không làm được</h3>' +
      '<p>Mỗi kỳ quay độc lập với các kỳ trước. Thống kê quá khứ giúp kiểm tra máy quay có công bằng không, nhưng không thể dự đoán số của kỳ sau và không làm tăng cơ hội trúng.</p>' +
      '<h3 style="margin-top:18px">Tài liệu tham khảo</h3><ol class="ref-list">' +
      REFS.map(function (r) { return '<li><a href="' + r[1] + '" target="_blank" rel="noopener">' + esc(r[0]) + '</a></li>'; }).join('') + '</ol></div></section>';
    return h;
  }

  /* ============================================================ thể lệ & cách chơi */
  var RULE_INFO = {
    '655': {
      intro: 'Chọn 6 số khác nhau trong khoảng 1 đến 55. Sau khi quay 6 số chính, hệ thống quay thêm 1 số đặc biệt từ các số còn lại.',
      note: 'Vé được tính là trúng số đặc biệt khi số đặc biệt nằm trong 6 số bạn chọn. Số đặc biệt chỉ dùng cho giải Jackpot 2.',
      patterns: ['Trùng 6 số', 'Trùng 5 số và số đặc biệt', 'Trùng 5 số', 'Trùng 4 số', 'Trùng 3 số']
    },
    '645': {
      intro: 'Chọn 6 số khác nhau trong khoảng 1 đến 45. Không có số đặc biệt.',
      note: 'Chỉ so 6 số chính. Giải Jackpot là giải cao nhất, trùng đủ 6 số.',
      patterns: ['Trùng 6 số', 'Trùng 5 số', 'Trùng 4 số', 'Trùng 3 số']
    },
    '535': {
      intro: 'Chọn 5 số khác nhau trong khoảng 1 đến 35, và chọn thêm 1 số đặc biệt từ 1 đến 12.',
      note: 'Số đặc biệt do bạn chọn. Vé trúng số đặc biệt khi số đó trùng với số đặc biệt của kỳ quay.',
      patterns: ['Trùng 5 số và số đặc biệt', 'Trùng 5 số', 'Trùng 4 số và số đặc biệt', 'Trùng 4 số', 'Trùng 3 số và số đặc biệt', 'Trùng 3 số', 'Trùng 0 đến 2 số và số đặc biệt']
    }
  };
  function combN(n, k) { var r = 1, i; for (i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  function topOdds(g) { return g.code === '535' ? combN(35, 5) * 12 : combN(g.max, g.nMain); }
  function renderRules() {
    var g = game(), info = RULE_INFO[g.code] || RULE_INFO['655'];
    var d = S.draws && S.draws.length ? S.draws[0] : null;
    var prizes = d ? (d.prizes || []) : null;
    var rows = info.patterns.map(function (pat, i) {
      var row = prizes ? (prizes[i] || []) : [];
      return '<tr><td>' + esc(row[0] || 'Giải ' + (i + 1)) + '</td><td>' + esc(pat) + '</td>' +
        '<td class="r">' + (prizes ? fi(toInt(row[2])) : '—') + '</td><td class="r">' + (prizes ? money(toInt(row[3])) : '—') + '</td></tr>';
    }).join('');
    return '<section class="panel">' + head('Cách chơi ' + g.label, info.intro) +
      '<div class="facts">' +
      '<div class="fact"><span class="k">Giá một bộ số</span><span class="v">' + money(10000) + '</span></div>' +
      '<div class="fact"><span class="k">Xác suất trúng giải cao nhất</span><span class="v">1 trên ' + fi(topOdds(g)) + '</span></div></div>' +
      '<p class="note" style="margin-top:12px">' + esc(info.note) + '</p></section>' +
      '<section class="panel block">' + head('Bảng giải',
        d ? 'Tiền thưởng của kỳ ' + pad5(d.no) + ' ngày ' + fdate(d.date) + '. Giải Jackpot: nếu nhiều người cùng trúng thì chia đều; nếu không ai trúng thì cộng dồn sang kỳ sau.' : 'Đang tải dữ liệu kỳ quay...') +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Giải</th><th>Điều kiện trúng</th><th class="r">Số người trúng</th><th class="r">Tiền thưởng</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="note" style="margin-top:10px">Mọi bộ số đều có cùng xác suất trúng như nhau, không có bộ số nào dễ trúng hơn. Thống kê quá khứ không dự đoán được kỳ sau.</p></section>';
  }

  /* ============================================================ điều phối hiển thị */
  var RENDER = {
    'tong-quan': renderOverview, 'bang-so': renderNumbers, 'so-gan': renderGan, 'cap-so': renderPairs,
    'ngau-nhien': renderRandomness, 'kiem-tra-ve': renderCheck, 'goi-y': renderSuggest,
    'the-le': renderRules, 'lich-su': renderHistory, 'phuong-phap': renderMethod
  };
  // Tên mục rút gọn cho màn hình hẹp (để các nút xếp gọn trong ít hàng)
  var NAV_SHORT = { 'ngau-nhien': 'Ngẫu nhiên', 'kiem-tra-ve': 'Kiểm tra vé', 'goi-y': 'Gợi ý', 'the-le': 'Thể lệ', 'lich-su': 'Lịch sử', 'phuong-phap': 'Phương pháp' };
  function navLabel(s) {
    var sh = NAV_SHORT[s.id];
    return sh ? '<span class="lb-full">' + esc(s.label) + '</span><span class="lb-short">' + esc(sh) + '</span>' : esc(s.label);
  }
  function renderNav() {
    $('#game-list').html(S.games.map(function (g) {
      return '<button type="button" class="game-item" data-game="' + g.code + '" aria-current="' + (g.code === S.game) + '">' +
        '<span class="g-name">' + esc(g.label) + '</span><span class="g-when">' + esc(scheduleText(g)) + '</span></button>';
    }).join(''));
    $('#section-nav').html(SECTIONS.map(function (s) {
      return '<a class="nav-item" href="#' + s.id + '"' + (s.id === S.section ? ' aria-current="page"' : '') + '>' + navLabel(s) + '</a>';
    }).join(''));
  }
  function renderStatus() {
    var g = game();
    $('#data-status').html(g.latestNo ? 'Đã có <b>' + fi(g.draws) + ' kỳ</b> ' + esc(g.label) + ', mới nhất là kỳ #' + pad5(g.latestNo) + ' ngày ' + fdate(g.latestDate) : '');
  }
  function renderScope() {
    var g = game(), n = g.draws || 0, opts = [[0, 'Toàn bộ' + (n ? ' (' + fi(n) + ' kỳ)' : '')]];
    [500, 200, 100, 50].forEach(function (x) { if (!n || x < n) opts.push([x, x + ' kỳ gần nhất']); });
    $('#scope').html(opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === S.last ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''));
    $('#scope-wrap').toggle(!!section().scope);
  }
  // Thanh mục cuộn ngang trên điện thoại: kéo mục đang xem vào giữa
  function centerNav() {
    var nav = document.getElementById('section-nav'), el = nav && nav.querySelector('[aria-current="page"]');
    if (el && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
  }
  function renderSection() {
    centerNav();
    var sec = section();
    $('#page-title').text(sec.label);
    $('#page-sub').text(sec.sub);
    renderScope();
    document.title = sec.label + ' – ' + game().label + ' – Thống kê Vietlott';
    if (!S.stats) { $('#view').html('<p class="empty">Đang tải dữ liệu…</p>'); return; }
    if (S.stats.error) { $('#view').html('<div class="alert error">' + esc(S.stats.error) + ' Hãy chọn phạm vi rộng hơn.</div>'); return; }
    $('#view').html(RENDER[sec.id]());
    if (sec.id === 'kiem-tra-ve' && S.ck && S.ck.game === S.game && S.ck.nums) autoCheck();
  }
  function go(id) {
    if (!SECTIONS.some(function (s) { return s.id === id; })) id = 'tong-quan';
    S.section = id;
    tipHide();
    renderNav();
    renderSection();
    window.scrollTo(0, 0);
  }

  /* ============================================================ tải dữ liệu */
  var loadSeq = 0;
  function loadGameData() {
    var seq = ++loadSeq, code = S.game, last = S.last;
    $('#view').addClass('loading');
    return $.when(getJson('/api/stats?game=' + code + '&last=' + last), getJson('/api/draws?game=' + code + '&limit=60'))
      .done(function (st, dr) {
        if (seq !== loadSeq) return;
        S.stats = st;
        S.draws = $.isArray(dr) ? dr : [];
        S.loadedAt = Date.now();
        renderSection();
      })
      .fail(function (m) {
        if (seq !== loadSeq) return;
        notice('error', esc(m) + ' Hãy kiểm tra kết nối mạng rồi mở lại ứng dụng.');
      })
      .always(function () { if (seq === loadSeq) $('#view').removeClass('loading'); });
  }
  function loadGames() {
    return getJson('/api/games').done(function (list) {
      if ($.isArray(list) && list.length) {
        S.games = ['655', '645', '535'].map(function (c) { return list.filter(function (g) { return g.code === c; })[0]; }).filter(Boolean);
      }
      renderNav();
      renderStatus();
      renderScope();
    });
  }
  function loadCross() {
    return getJson('/api/crosscheck').done(function (c) {
      S.cross = c && !c.none ? c : null;
      if (S.stats && (S.section === 'tong-quan' || S.section === 'phuong-phap')) renderSection();
    });
  }
  function flash(type, html) {
    notice(type, html);
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { notice(''); }, 8000);
  }

  /* ============================================================ sự kiện */
  $(function () {
    $tip = $('#tip');
    // Quay lại tab sau một lúc thì tải lại dữ liệu để hiện kỳ quay mới nhất
    var refreshIfStale = function () {
      if (document.visibilityState === 'hidden' || !S.stats || Date.now() - (S.loadedAt || 0) < 60000) return;
      loadGames();
      loadGameData();
    };
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    $(document)
      .on('mousemove', '[data-tip]', function (e) { var t = $(this).attr('data-tip'); if (t) tipShow(t, e.clientX, e.clientY); else tipHide(); })
      .on('mouseleave', '[data-tip]', tipHide)
      .on('focusin', '[data-tip]', function () { var t = $(this).attr('data-tip'); if (!t) return; var r = this.getBoundingClientRect(); tipShow(t, r.right - 12, r.bottom - 12); })
      .on('focusout', '[data-tip]', tipHide)
      .on('touchstart', function (e) { if (!$(e.target).closest('[data-tip]').length) tipHide(); });
    $(window).on('scroll', tipHide).on('hashchange', function () { go(location.hash.slice(1)); });
    // Xoay màn hình / đổi cỡ cửa sổ: vẽ lại biểu đồ theo chiều rộng mới (bàn phím ảo chỉ đổi chiều cao nên bỏ qua)
    var rzT, rzW = window.innerWidth;
    $(window).on('resize', function () {
      clearTimeout(rzT);
      rzT = setTimeout(function () {
        if (Math.abs(window.innerWidth - rzW) < 40) return;
        rzW = window.innerWidth;
        if (S.stats && (S.section === 'so-gan' || S.section === 'ngau-nhien')) renderSection();
      }, 250);
    });

    // Gắn nhãn cột vào từng ô của mọi bảng, để trên điện thoại bảng hiện thành thẻ có nhãn (không phải cuộn ngang)
    function labelTables() {
      $('#view table.data').each(function () {
        var heads = $(this).find('thead th').map(function () { return $(this).text().replace(/[▲▼]/g, '').trim(); }).get();
        $(this).find('tbody tr').each(function () {
          var col = 0;
          $(this).children('td').each(function () {
            var span = +this.getAttribute('colspan') || 1;
            if (!this.hasAttribute('data-label')) this.setAttribute('data-label', span > 1 ? '' : (heads[col] || ''));
            col += span;
          });
        });
      });
    }
    new MutationObserver(labelTables).observe(document.getElementById('view'), { childList: true, subtree: true });
    $('#game-list').on('click', '.game-item', function () {
      var c = String($(this).attr('data-game'));
      if (c === S.game) return;
      S.game = c; S.stats = null; S.draws = null; S.pairOf = null;
      save(); renderNav(); renderStatus(); renderSection(); loadGameData();
    });
    $('#scope').on('change', function () { S.last = +$(this).val() || 0; save(); loadGameData(); });

    $('#view')
      .on('click', '.seg [data-metric]', function () { S.gridMetric = $(this).attr('data-metric'); renderSection(); })
      .on('click keydown', '.slip[data-metric="pair"] .cell', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        S.pairOf = +$(this).attr('data-n');
        tipHide();
        renderSection();
        $('.slip .cell[data-n="' + S.pairOf + '"]').trigger('focus');
      })
      .on('change', '.sort-sel', function () {
        var id = $(this).attr('data-sort-id'), i = +$(this).val(), st = S.sort[id], tb = S._tables && S._tables[id];
        if (!tb) return;
        st.k = i; st.dir = i === 0 ? 1 : -1;
        $(this).closest('.table-wrap').html(sortTable(id, tb.cols, tb.rows));
      })
      .on('click', '.sort-dir', function () {
        var id = $(this).attr('data-sort-id'), st = S.sort[id], tb = S._tables && S._tables[id];
        if (!tb) return;
        st.dir = -st.dir;
        $(this).closest('.table-wrap').html(sortTable(id, tb.cols, tb.rows));
      })
      .on('click', 'th.sortable', function () {
        var $t = $(this).closest('table'), id = $t.attr('data-sort'), i = +$(this).attr('data-i'), st = S.sort[id], tb = S._tables && S._tables[id];
        if (!tb) return;
        if (st.k === i) st.dir = -st.dir; else { st.k = i; st.dir = i === 0 ? 1 : -1; }
        $t.parent().html(sortTable(id, tb.cols, tb.rows));
      })
      .on('submit', '#ck-form', function (e) { e.preventDefault(); runCheck(); })
      .on('keydown', '#ck-nums', function (e) {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      })
      .on('input', '#ck-nums', function () {
        var el = this, g = game(), before = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
        var val = fmtNums(el.value, g.nMain);
        if (val !== el.value) {
          el.value = val;
          var pos = caretAfterDigits(val, before);
          el.setSelectionRange(pos, pos);
        }
        syncPick();
        autoCheck();
      })
      .on('click', '.pick-cell', function () {
        var g = game(), n = +$(this).attr('data-n'), sel = selNums($('#ck-nums').val(), g), i = sel.indexOf(n);
        if (i >= 0) sel.splice(i, 1);
        else if (sel.length < g.nMain) sel.push(n);
        else return;
        sel.sort(function (a, b) { return a - b; });
        $('#ck-nums').val(sel.map(pad2).join(' '));
        syncPick();
        autoCheck();
      })
      .on('click', '#ck-clear', function () {
        $('#ck-nums').val('');
        syncPick();
        autoCheck();
      })
      .on('change', '#ck-sp', autoCheck)
      .on('input', '#ck-tpl', function () {
        try { localStorage.setItem(tplKey(game()), this.value); } catch (e) {}
        updateMsg();
      })
      .on('click', '#ck-tpl-reset', function (e) {
        e.preventDefault();
        try { localStorage.removeItem(tplKey(game())); } catch (er) {}
        $('#ck-tpl').val(defTpl(game()));
        updateMsg();
      })
      .on('click', '#ck-copy', function () {
        var btn = $(this), ta = document.getElementById('ck-msg-text'), txt = ta.value;
        var done = function () { btn.text('Đã sao chép'); setTimeout(function () { btn.text('Sao chép tin nhắn'); }, 1800); };
        var fallback = function () { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { btn.text('Hãy giữ và chọn Sao chép'); } };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback);
        else fallback();
      })
      .on('click', '#pair-use', function () {
        var g = game(), same = S.ck && S.ck.game === S.game, cur = pickedNums();
        if (cur.indexOf(S.pairOf) < 0 && cur.length < g.nMain) cur.push(S.pairOf);
        cur.sort(function (a, b) { return a - b; });
        S.ck = { game: S.game, nums: cur.map(pad2).join(' '), sp: same ? S.ck.sp : '' };
        if (cur.length >= g.nMain) { location.hash = '#kiem-tra-ve'; return; }
        renderSection();
      })
      .on('click', '#ck-rand', function () {
        var g = game(), pool = [], i, j, t;
        for (i = 1; i <= g.max; i++) pool.push(i);
        for (i = pool.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
        $('#ck-nums').val(pool.slice(0, g.nMain).sort(function (a, b) { return a - b; }).map(pad2).join(' '));
        if (specialPick(g)) $('#ck-sp').val(String(1 + Math.floor(Math.random() * g.bonusMax)));
        syncPick();
        runCheck();
      })
      .on('click', '[data-sg]', function () {
        S.sgMode = $(this).attr('data-sg');
        $('[data-sg]').each(function () { $(this).attr('aria-pressed', String($(this).attr('data-sg') === S.sgMode)); });
      })
      .on('change', '#sg-count', function () { S.sgCount = +$(this).val() || 5; })
      .on('click', '#sg-go', runSuggest)
      .on('click', '[data-check]', function () {
        S.ck = { game: S.game, nums: $(this).attr('data-check'), sp: '' };
        location.hash = '#kiem-tra-ve';
      })
      .on('click', '#cross-run', function () {
        var $b = $(this).prop('disabled', true).text('Đang đối chiếu…');
        $.ajax({ url: '/api/crosscheck', method: 'POST', dataType: 'json' }).done(function (c) {
          S.cross = c;
          flash('success', 'Đã đối chiếu xong với nguồn độc lập.');
          renderSection();
        }).fail(function (x) {
          flash('error', 'Không đối chiếu được: ' + esc((x.responseJSON && x.responseJSON.error) || 'mất kết nối mạng'));
          $b.prop('disabled', false).text('Đối chiếu lại ngay');
        });
      });

    $('#btn-update').on('click', function () {
      var $b = $(this).prop('disabled', true).text('Đang cập nhật…');
      notice('info', 'Đang tải dữ liệu mới nhất…');
      $.ajax({ url: '/api/update?game=all', method: 'POST', dataType: 'json' }).done(function (r) {
        var got = 0;
        $.each(r.result || {}, function (k, v) { got += v.fetched || 0; });
        flash('success', got ? 'Đã cập nhật ' + got + ' kỳ mới.' : 'Dữ liệu đã mới nhất, chưa có kỳ mới.');
        loadGames().always(loadGameData);
      }).fail(function (x) {
        flash('error', 'Cập nhật không thành công: ' + esc((x.responseJSON && x.responseJSON.error) || 'mất kết nối'));
      }).always(function () { $b.prop('disabled', false).html('Cập nhật<span class="hide-sm"> dữ liệu</span>'); });
    });

    var h = location.hash.slice(1);
    S.section = SECTIONS.some(function (s) { return s.id === h; }) ? h : 'tong-quan';
    renderNav();
    renderSection();
    loadGames().always(function () { loadGameData(); });
    loadCross();
  });
})(jQuery);
