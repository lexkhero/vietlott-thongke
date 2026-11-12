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
    { id: 'tong-quan', label: 'Tổng quan', scope: true, sub: 'Kết quả mới nhất, kỳ quay tiếp theo, máy quay có ngẫu nhiên không và số lần ra của từng số.' },
    { id: 'phan-tich', label: 'Phân tích', scope: true, sub: 'Số nào ra nhiều, ra ít, vắng bao lâu, theo thời gian và theo nhóm; cùng toàn bộ các phép kiểm tra độ ngẫu nhiên.' },
    { id: 'cap-so', label: 'Cặp số', scope: true, sub: 'Chọn số cho vé của bạn từ bảng bên dưới: xem số nào hay ra cùng số nào, các cặp trong vé và những kỳ bộ số đó từng trúng giải.' },
    { id: 'de-xuat', label: 'Đề xuất bộ số', scope: true, sub: 'Bộ số theo từng cách chọn, kèm điểm, giải thích và kết quả thử trên các kỳ đã quay. Điểm không phải khả năng trúng: mọi bộ số có cùng cơ hội.' },
    { id: 'nhieu-ve', label: 'Tối ưu nhiều vé', scope: false, sub: 'Có một số tiền, nên mua các vé thế nào: độ phủ, độ trùng nhau và khả năng có ít nhất một vé trúng.' },
    { id: 'kiem-chung', label: 'Kiểm chứng', scope: false, sub: 'Thử từng cách chọn số trên các kỳ đã quay (chỉ dùng dữ liệu trước mỗi kỳ) rồi so với người chọn bừa.' },
    { id: 'xac-suat', label: 'Xác suất & tiền thưởng', scope: false, sub: 'Cơ hội trúng từng giải, trung bình một vé nhận lại bao nhiêu và những kỳ đáng mua hơn.' },
    { id: 'the-le', label: 'Thể lệ & cách chơi', scope: true, sub: 'Cách chơi, điều kiện trúng từng giải và cơ hội trúng của từng loại vé.' },
    { id: 'lich-su', label: 'Lịch sử kết quả', scope: false, sub: 'Kết quả 60 kỳ quay gần nhất.' },
    { id: 'thuat-ngu', label: 'Giải thích thuật ngữ', scope: false, sub: 'Các từ dùng trong ứng dụng, giải thích bằng lời thường kèm ví dụ.' }
  ];
  // Các mục trên thanh dưới cùng (điện thoại); các mục còn lại nằm trong bảng "Thêm"
  var TAB_MAIN = [['tong-quan', 'Tổng quan'], ['phan-tich', 'Phân tích'], ['cap-so', 'Cặp số'], ['de-xuat', 'Đề xuất']];
  var MORE_SUB = {
    'nhieu-ve': 'Chia một số tiền cho nhiều vé', 'kiem-chung': 'Các cách chọn số có hơn chọn bừa không', 'xac-suat': 'Cơ hội trúng và số tiền nhận lại',
    'the-le': 'Cách chơi và bảng giải', 'lich-su': '60 kỳ quay gần nhất', 'thuat-ngu': 'Lời giải thích cho các từ khó'
  };
  var GAME_COLOR = { '655': '#e5487c', '645': '#6278f5', '535': '#17a892' };
  var ICON = {
    'tong-quan': '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    'phan-tich': '<path d="M5 19V11"/><path d="M10 19V5"/><path d="M15 19v-6"/><path d="M20 19V9"/>',
    'cap-so': '<circle cx="8.5" cy="12" r="5.5"/><circle cx="15.5" cy="12" r="5.5"/>',
    'de-xuat': '<path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9z"/><path d="M19 3v3M17.5 4.5h3"/>',
    'nhieu-ve': '<rect x="3" y="8" width="14" height="11" rx="2"/><path d="M7 5h12a2 2 0 0 1 2 2v9"/>',
    'kiem-chung': '<path d="M4 12.5 9 17.5 20 6.5"/>',
    'xac-suat': '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle class="f" cx="9" cy="9" r="1.4"/><circle class="f" cx="15" cy="15" r="1.4"/><circle class="f" cx="15" cy="9" r="1.4"/><circle class="f" cx="9" cy="15" r="1.4"/>',
    'the-le': '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h6"/>',
    'lich-su': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'thuat-ngu': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.5"/><circle class="f" cx="12" cy="16.9" r="1.1"/>',
    more: '<circle class="f" cx="5" cy="12" r="1.8"/><circle class="f" cx="12" cy="12" r="1.8"/><circle class="f" cx="19" cy="12" r="1.8"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
    auto: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
    check: '<path d="M5 12.5 10 17 19 7"/>', info: '<path d="M12 11v6"/><circle class="f" cx="12" cy="7.5" r="1.3"/>', warn: '<path d="M12 6.5v7"/><circle class="f" cx="12" cy="17" r="1.3"/>'
  };
  function icon(k, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || '') + '</svg>'; }
  var JACKPOT_TIERS = { '655': [0, 1], '645': [0], '535': [0] };
  var S = {
    game: '655', last: 0, section: 'tong-quan', games: DEFAULT_GAMES.slice(),
    stats: null, draws: null, cross: null, gridMetric: 'count', pairOf: null,
    ck: null, sort: {}
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
  // Các thời điểm quay theo lịch: kỳ kế tiếp (sau hiện tại) và kỳ vừa qua (trước hiện tại)
  function drawAt(g, dir) {
    var s = g.schedule; if (!s) return null;
    var now = new Date();
    for (var i = 0; i < 9; i++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dir * i);
      if (s.days.indexOf(day.getDay()) < 0) continue;
      var times = dir > 0 ? s.times : s.times.slice().reverse();
      for (var j = 0; j < times.length; j++) {
        var hm = times[j].split(':'), at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), +hm[0], +hm[1]);
        if (dir > 0 ? at > now : at <= now) return at;
      }
    }
    return null;
  }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function hourText(at) { return at.getHours() + 'h' + (at.getMinutes() ? pad2(at.getMinutes()) : ''); }
  function whenText(at) {
    var now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), d1 = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    var i = Math.round((d1 - d0) / 864e5);
    var day = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : WD[at.getDay()] + ' ' + pad2(at.getDate()) + '/' + pad2(at.getMonth() + 1);
    return day + ', ' + hourText(at);
  }
  function nextDrawText(g) { var at = drawAt(g, 1); return at ? 'Kỳ quay tiếp theo: ' + whenText(at).toLowerCase() + '.' : ''; }
  // Đã tới giờ quay mà dữ liệu chưa có kỳ đó (trong vòng 4 giờ): đang chờ kết quả
  function waitingDraw(g) {
    var at = drawAt(g, -1), d = S.draws && S.draws[0];
    if (!at || !d || Date.now() - at > 4 * 36e5) return null;
    var day = ymd(at), slot = g.schedule.times.indexOf(pad2(at.getHours()) + ':' + pad2(at.getMinutes()));
    if (d.date > day) return null;
    if (d.date === day && S.draws.filter(function (x) { return x.date === day; }).length > slot) return null;
    return at;
  }
  // Đồng hồ đếm ngược: app.js cập nhật mọi phần tử [data-cd] mỗi giây
  function cdParts(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? [[d, 'ngày'], [h, 'giờ'], [m, 'phút']] : [[h, 'giờ'], [m, 'phút'], [s % 60, 'giây']];
  }
  function cdInner(el) {
    var ms = +el.getAttribute('data-cd') - Date.now(), p = cdParts(ms);
    if (el.hasAttribute('data-cd-text')) return p.slice(0, 2).map(function (x) { return x[0] + ' ' + x[1]; }).join(' ');
    return p.map(function (x) { return '<span class="cd-u"><b>' + pad2(x[0]) + '</b><small>' + x[1] + '</small></span>'; }).join('<span class="cd-c" aria-hidden="true">:</span>');
  }
  function tickCountdowns() {
    $('[data-cd]').each(function () {
      var html = cdInner(this);
      if (this._cd !== html) { this._cd = html; this.innerHTML = html; }
      if (+this.getAttribute('data-cd') < Date.now() && !this._done) { this._done = true; setTimeout(function () { loadGames(); loadGameData(); }, 1500); }
    });
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
    return '<div class="panel-head"><div><h2>' + (/<(button|span) /.test(title) ? title : esc(title)) + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  var LEVEL = {
    ok: { icon: '✓', title: 'Kết quả quay phù hợp với quay số ngẫu nhiên' },
    watch: { icon: '!', title: 'Có điểm cần theo dõi' },
    alert: { icon: '✕', title: 'Phát hiện dấu hiệu bất thường' }
  };
  function badge(level, text) { return '<span class="badge ' + level + '"><span aria-hidden="true">' + LEVEL[level].icon + '</span>' + esc(text) + '</span>'; }

  // Mức lệch so với trung bình nói bằng lời (z = số lần độ lệch chuẩn)
  function lv(z) { var a = Math.abs(z); return a < 1 ? 'gần mức trung bình' : a < 2 ? 'hơi lệch, vẫn bình thường' : a < 3 ? 'lệch nhiều' : 'lệch rất nhiều'; }
  // Từ có giải thích: gạch chân chấm, bấm vào mở khung giải thích (nội dung trong terms.js)
  function termOf(id) { var t = window.VLTERMS; return t ? t.items.filter(function (x) { return x.id === id; })[0] : null; }
  function term(id, label) { return '<button type="button" class="term" data-term="' + id + '">' + label + '</button>'; }
  function qm(id, label) { return '<button type="button" class="qm" data-term="' + id + '" aria-label="Giải thích: ' + esc(label || (termOf(id) || {}).name || '') + '">?</button>'; }
  function howto(html) { return '<div class="howto">' + icon('info') + '<div><b>Cách đọc trang này</b><p>' + html + '</p></div></div>'; }
  function termBody(t) { return t.text + (t.ex ? '<p class="term-ex"><b>Ví dụ.</b> ' + t.ex + '</p>' : ''); }
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
  // Nhãn tổng số lần về (cùng thang với Bảng số): tc-2 ít hẳn, tc-1 ít, th-1 nhiều, th-2 nhiều hẳn
  function totCls(z) { return z <= -2 ? 'tc-2' : z <= -1 ? 'tc-1' : z < 1 ? '' : z < 2 ? 'th-1' : 'th-2'; }
  function ganClass(wait, avg) { var r = wait / avg; return r < 1 ? '' : r < 2 ? 'gan-1' : r < 3 ? 'gan-2' : r < 4 ? 'gan-3' : 'gan-4'; }
  function devText(d) { return d >= 0 ? 'nhiều hơn trung bình ' + fpct(d) : 'ít hơn trung bình ' + fpct(-d); }
  function lastSeen(n) { return n.lastNo ? 'kỳ #' + pad5(n.lastNo) + ', ' + fdate(n.lastDate) : 'chưa ra trong phạm vi này'; }

  // metric: 'count' (số lần ra) | 'wait' (số kỳ chưa ra) | 'pair' (ra cùng số S.pairOf)
  // Các số đang có trong vé của bạn (cùng loại vé đang xem)
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
        val = n.wait === 0 ? 'vừa ra' : fi(n.wait) + '<span class="u"> kỳ</span>';
        tip = '<b>Số ' + pad2(n.n) + '</b><br>' + (n.wait === 0 ? 'Vừa ra ở kỳ gần nhất' : 'Đã ' + fi(n.wait) + ' kỳ chưa ra') +
          '<br>Lần ra gần nhất: ' + lastSeen(n) + '<br>Vắng lâu nhất: ' + fi(n.maxWait) + ' kỳ';
      } else if (metric === 'pair') {
        var a = S.pairOf;
        if (n.n === a) {
          cls += ' selected'; val = 'đang xem';
          tip = '<b>Số ' + pad2(a) + '</b><br>Số đang chọn<br>Đã về ' + fi(n.count) + ' lần trong ' + fi(st.window.draws) + ' kỳ';
        }
        else {
          var idx = (a - 1) * M + (n.n - 1), c = st.pairs.counts[idx], z = st.pairs.heat[idx];
          cls += ' ' + heatClass(z);
          val = fi(c) + ' lần';
          tip = '<b>Số ' + pad2(a) + ' và số ' + pad2(n.n) + '</b><br>Ra cùng nhau ' + fi(c) + ' lần<br>Trung bình một cặp: ' + fd(st.pairs.note.expected) + ' lần';
        }
        cls += ' clickable';
      } else {
        cls += ' ' + heatClass(n.z);
        val = fi(n.count) + '<span class="u"> lần</span>';
        tip = '<b>Số ' + pad2(n.n) + '</b><br>Ra ' + fi(n.count) + ' lần, trung bình ' + fi(n.expected) + ' lần<br>' + (n.count >= n.expected ? 'Nhiều hơn' : 'Ít hơn') + ' trung bình: ' + lv(n.z) +
          '<br>Lần ra gần nhất: ' + lastSeen(n) + '<br>' + (n.wait === 0 ? 'Vừa ra ở kỳ gần nhất' : 'Đã ' + fi(n.wait) + ' kỳ chưa ra');
      }
      if (latest.indexOf(n.n) >= 0) { cls += ' latest'; tip += '<br>Có trong kết quả kỳ gần nhất'; }
      if (picked.indexOf(n.n) >= 0) { cls += ' picked'; tip += '<br>Đã có trong vé của bạn'; }
      return '<div class="' + cls + '" tabindex="0" data-n="' + n.n + '"' + (metric === 'pair' ? '' : ' data-num="' + n.n + '" role="button" aria-label="Số ' + pad2(n.n) + ', ' + esc(String(val).replace(/<[^>]+>/g, '')) + '"') + ' data-tip="' + esc(tip) + '"><span class="c-n">' + pad2(n.n) +
        '</span><span class="c-v">' + val + '</span>' + (metric === 'pair' ? '<span class="c-g ' + ganClass(n.wait, avg) + '" title="Số gan: số kỳ chưa ra của số này">' + (n.wait === 0 ? 'vừa ra' : 'gan ' + fi(n.wait) + ' kỳ') + '</span><span class="c-t ' + totCls(n.z) + '">' + fi(n.count) + '</span>' : '') + '</div>';
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
  function moneyParts(v) {
    if (v >= 1e9) return [fd(v / 1e9, v >= 1e10 ? 1 : 2), 'tỷ đồng'];
    if (v >= 1e6) return [fd(v / 1e6, v >= 1e7 ? 0 : 1), 'triệu đồng'];
    return [fi(v), 'đồng'];
  }
  // Sân khấu: khay bóng của kỳ mới nhất, giải thưởng, kỳ quay tiếp theo và đồng hồ đếm ngược
  function stageHtml(d) {
    var g = game(), prizes = d.prizes || [], tiers = (JACKPOT_TIERS[g.code] || [0]).filter(function (i) { return prizes[i]; });
    var bonus = d.bonus || [], key = g.code + ':' + d.no, anim = S.dropKey !== key, k = 0;
    S.dropKey = key;
    var b = function (n, cls) { return '<span class="ball ' + cls + '" style="--i:' + (k++) + '">' + pad2(n) + '</span>'; };
    var slot = slotOf(d).replace(/[()]/g, '').trim();
    var h = '<div class="stage-in"><div class="stage-main">' +
      '<div class="stage-meta"><b>Kỳ #' + pad5(d.no) + '</b><span>' + weekday(d.date) + ', ' + fdate(d.date) + '</span>' + (slot ? '<span class="chip">' + esc(slot) + '</span>' : '') + '</div>' +
      '<div class="rack' + (anim ? ' drop' : '') + '" style="--n:' + (d.main.length + bonus.length) + '" role="img" aria-label="Kết quả: ' + d.main.map(pad2).join(', ') + (bonus.length ? '; số đặc biệt ' + bonus.map(pad2).join(', ') : '') + '">' +
      '<div class="rack-main">' + d.main.map(function (n) { return b(n, ''); }).join('') + '</div>' +
      (bonus.length ? '<div class="rack-sp" data-tip="Số đặc biệt">' + bonus.map(function (n) { return b(n, 'special'); }).join('') + '</div>' : '') + '</div>' +
      '<div class="stage-prizes">' + tiers.map(function (i) {
        var p = prizes[i], w = toInt(p[2]), mp = moneyParts(toInt(p[3]));
        return '<div class="sp"><div class="p-name">' + esc(p[0]) + '</div><div class="p-val">' + mp[0] + '<small>' + mp[1] + '</small></div>' +
          '<div class="p-win' + (w ? ' won' : '') + '">' + (w ? fi(w) + ' vé trúng' + (w > 1 ? ', mỗi vé nhận số tiền trên' : '') : 'Chưa có người trúng, giải được cộng dồn sang kỳ sau') + '</div></div>';
      }).join('') + '</div>' +
      '<p class="stage-odds">Cơ hội trúng giải cao nhất: 1 trên ' + fi(S.stats ? S.stats.game.jackpotOdds : 0) + ' vé ' + qm('co-hoi', 'Cơ hội 1 trên N') + (bonus.length ? '. Quả vàng là ' + term('so-dac-biet', 'số đặc biệt') : '') + '.</p></div>';
    var at = drawAt(g, 1), wait = waitingDraw(g), est = tiers.length ? estimateJackpot(tiers[0]) : null;
    if (at) {
      h += '<aside class="next" aria-label="Kỳ quay tiếp theo"><div class="next-head"><span class="next-lb">Kỳ quay tiếp theo</span><b>' + esc(whenText(at)) + '</b></div>' +
        (wait ? '<div class="next-wait"><span class="pulse" aria-hidden="true"></span><span>Đang chờ kết quả kỳ ' + hourText(wait) + '</span><button type="button" class="btn btn-ghost-light btn-sm" data-update>Tải lại</button></div>' : '') +
        '<div class="cd-box" data-cd="' + at.getTime() + '" aria-label="Thời gian còn lại">' + cdInner({ getAttribute: function () { return at.getTime(); }, hasAttribute: function () { return false; } }) + '</div>' +
        (est && est.value ? '<div class="next-est"><span>' + esc(prizes[tiers[0]][0]) + ' kỳ tới ' + qm('uoc-tinh', 'Số ước tính') + '</span><b>≈ ' + esc(moneyShort(est.value)) + '</b></div>' +
          '<p class="next-note">' + (est.reset ? 'Kỳ vừa rồi đã có người trúng nên giải quay về mức khởi điểm.' : 'Ước tính từ mức tăng thường thấy; Vietlott công bố số chính thức khi quay.') + '</p>' : '') +
        '</aside>';
    }
    return h + '</div>';
  }
  function renderStage() {
    var on = S.section === 'tong-quan' && S.draws && S.draws[0] && S.stats && !S.stats.error;
    var $s = $('#stage').prop('hidden', !on);
    if (on) $s.html(stageHtml(S.draws[0])); else $s.empty();
  }
  function crossText(code) {
    var c = S.cross && S.cross.games && S.cross.games[code];
    if (!c) return '';
    if (c.toolWrong) return ' Đối chiếu với nguồn độc lập: ' + c.toolWrong + ' kỳ cần xem lại.';
    return ' Đã đối chiếu ' + fi(c.compared) + ' kỳ với nguồn độc lập: khớp hoàn toàn.';
  }
  function renderOverview() {
    var st = S.stats, w = st.window, v = st.verdict, metric = S.gridMetric === 'wait' ? 'wait' : 'count';
    var sk = '<div class="stat"><i class="sk"></i><div class="skeleton" style="gap:6px"><i style="height:12px;width:70%"></i><i style="height:22px;width:45%"></i></div></div>';
    var h = '<div id="ov-roll"></div>';
    h += '<section class="panel status"><div class="verdict"><span class="v-icon ' + v.level + '" aria-hidden="true">' + LEVEL[v.level].icon + '</span><div>' +
      '<h2>' + esc(LEVEL[v.level].title) + ' ' + qm('kiem-tra', 'Phép kiểm tra độ ngẫu nhiên') + '</h2><p class="sub">' + esc(v.text) + '</p>' +
      '<p class="note" style="margin-top:6px">Đang tính trên ' + fi(w.draws) + ' kỳ, từ ' + fdate(w.from) + ' đến ' + fdate(w.to) + '.' + esc(crossText(game().code)) + '</p></div></div>' +
      '<div class="stat-grid" id="ov-stats">' + sk + sk + sk + sk + '</div></section>';
    var seg = '<div class="seg" role="group" aria-label="Hiển thị">' + [['count', 'Số lần ra'], ['wait', 'Số kỳ chưa ra']].map(function (o) {
      return '<button type="button" data-metric="' + o[0] + '" aria-pressed="' + (o[0] === metric) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    h += '<section class="panel">' + head('Bảng số', metric === 'wait'
      ? 'Mỗi ô là một số và số kỳ liên tiếp gần đây nó chưa ra (' + term('so-gan', 'số gan') + '). Màu càng đậm là vắng càng lâu. Bấm vào một ô để xem hồ sơ của số đó.'
      : 'Mỗi ô là một số và số lần nó đã ra. Ô đỏ: ra nhiều hơn ' + term('trung-binh', 'mức trung bình') + ' (' + fd(st.numbers[0].expected, 0) + ' lần), ô xanh: ra ít hơn. Bấm vào một ô để xem hồ sơ của số đó.', seg) +
      slipHtml(metric) + slipLegend(metric) + '</section>';
    var byCount = st.numbers.slice().sort(function (a, b) { return b.count - a.count || a.n - b.n; });
    var byWait = st.numbers.slice().sort(function (a, b) { return b.wait - a.wait || a.n - b.n; });
    var col = function (id, title, arr, txt) {
      return '<div class="tl-col" data-list="' + id + '"><h3>' + title + '</h3><div class="mini-list">' + arr.map(function (n) {
        return '<div class="mini-row"><button type="button" class="num-btn" data-num="' + n.n + '" aria-label="Hồ sơ số ' + pad2(n.n) + '">' + ball(n.n, 'sm') + '</button><span>' + txt(n) + '</span></div>';
      }).join('') + '</div></div>';
    };
    var cnt = function (n) { return '<b class="num">' + fi(n.count) + ' lần</b> <span class="muted">' + (n.count >= n.expected ? 'hơn' : 'kém') + ' trung bình ' + fi(Math.abs(n.count - n.expected)) + ' lần</span>'; };
    var tl = S.tl || 'most', tseg = '<div class="seg" role="group" aria-label="Chọn bảng xếp hạng">' + [['most', 'Ra nhiều'], ['least', 'Ra ít'], ['gan', 'Lâu chưa ra']].map(function (o) {
      return '<button type="button" data-tl="' + o[0] + '" aria-pressed="' + (o[0] === tl) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    h += '<section class="panel toplists" data-show="' + tl + '">' + head('Xếp hạng các số', 'Trong ' + fi(w.draws) + ' kỳ. Bấm vào một số để xem hồ sơ.', tseg) + '<div class="tl-grid">' +
      col('most', 'Ra nhiều nhất', byCount.slice(0, 5), cnt) + col('least', 'Ra ít nhất', byCount.slice(-5).reverse(), cnt) +
      col('gan', 'Lâu chưa ra nhất', byWait.slice(0, 5), function (n) { return '<b class="num">' + fi(n.wait) + ' kỳ</b> <span class="muted">vắng lâu nhất từng có: ' + fi(n.maxWait) + ' kỳ</span>'; }) + '</div>' +
      '<p class="note" style="margin-top:14px">Mỗi kỳ quay không liên quan đến kỳ trước ' + qm('doc-lap', 'Các kỳ quay không liên quan đến nhau') + ', nên số ra nhiều hay lâu chưa ra đều có cùng cơ hội ở kỳ tới.</p></section>';
    var rest = (S.draws || []).slice(1, 6);
    if (rest.length) {
      h += '<section class="panel">' + head('Các kỳ trước', '', '<a class="link-more" href="#lich-su">Xem 60 kỳ</a>') + '<div class="recent">' + rest.map(function (d) {
        var p = (d.prizes || [])[0], wn = p ? toInt(p[2]) : 0;
        return '<div class="recent-row"><div class="r-id"><b>#' + pad5(d.no) + '</b><span>' + weekday(d.date) + ', ' + fdate(d.date) + esc(slotOf(d)) + '</span></div>' + ballsHtml(d.main, d.bonus, 'sm') +
          '<div class="r-top">' + (p ? esc(moneyShort(toInt(p[3]))) : '') + (wn ? '<span class="tag won">' + fi(wn) + ' vé trúng</span>' : '') + '</div></div>';
      }).join('') + '</div></section>';
    }
    return h;
  }
  // Hồ sơ của một số: mở ở bảng trượt khi bấm vào số trên bảng số hoặc bảng xếp hạng
  function openNumber(n) {
    var st = S.stats; if (!st || st.error) return;
    var x = st.numbers.filter(function (o) { return o.n === n; })[0]; if (!x) return;
    var M = st.game.max, W = st.window.draws, draws = (S.draws || []).slice().reverse();
    var hits = draws.filter(function (d) { return d.main.indexOf(n) >= 0; }).length;
    var partners = [];
    for (var m = 1; m <= M; m++) if (m !== n) partners.push({ m: m, c: st.pairs.counts[(n - 1) * M + (m - 1)] });
    partners.sort(function (a, b) { return b.c - a.c || a.m - b.m; });
    var eP = st.pairs.note.expected, more = x.count >= x.expected;
    var body = '<div class="ns-head">' + ball(n, 'xl') + '<div><b>' + (Math.abs(x.z) < 1 ? 'Ra gần đúng mức trung bình' : more ? 'Ra nhiều hơn mức trung bình' : 'Ra ít hơn mức trung bình') + '</b>' +
      '<p>' + fi(x.count) + ' lần trong ' + fi(W) + ' kỳ; trung bình mỗi số ra ' + fi(x.expected) + ' lần. Mức lệch: ' + lv(x.z) + ' ' + qm('lech', 'Mức lệch') + '.</p></div></div>' +
      '<div class="ns-stats"><div><span>Số lần ra</span><b>' + fi(x.count) + '</b></div><div><span>Đang vắng</span><b>' + (x.wait ? fi(x.wait) + ' kỳ' : 'vừa ra') + '</b></div>' +
      '<div><span>Vắng lâu nhất</span><b>' + fi(x.maxWait) + ' kỳ</b></div><div><span>Thường ra lại sau</span><b>' + (x.avgGap ? fd(x.avgGap, 1) + ' kỳ' : '–') + '</b></div>' +
      '<div><span>Xếp hạng số lần ra</span><b>' + (x.rank || '–') + ' / ' + M + '</b></div><div><span>Lần ra gần nhất</span><b>' + (x.lastNo ? '#' + pad5(x.lastNo) : '–') + '</b></div></div>';
    if (draws.length) {
      body += '<div class="ns-sec"><h3>' + draws.length + ' kỳ gần nhất <small>ra ' + hits + ' lần</small></h3><div class="strip" role="img" aria-label="Số ' + pad2(n) + ' ra ' + hits + ' lần trong ' + draws.length + ' kỳ gần nhất">' + draws.map(function (d) {
        return '<i' + (d.main.indexOf(n) >= 0 ? ' class="on"' : '') + '></i>';
      }).join('') + '</div><div class="strip-ax"><span>' + fdate(draws[0].date) + '</span><span>mỗi vạch đỏ là một kỳ có số ' + pad2(n) + '</span><span>' + fdate(draws[draws.length - 1].date) + '</span></div></div>';
    }
    body += '<div class="ns-sec"><h3>Hay ra cùng các số <small>số lần ra cùng nhau</small></h3>' + rankList(partners.slice(0, 5).map(function (p) {
      return { label: ball(p.m, 'xs'), value: p.c, text: fi(p.c) + ' lần' };
    }), { ref: eP, max: Math.max(partners[0].c, eP) * 1.05, refLabel: 'Trung bình một cặp: ' + fd(eP, 0) + ' lần' }) + '</div>' +
      '<p class="note" style="margin-top:14px">Các con số trên là chuyện đã qua. Ở kỳ tới, số ' + pad2(n) + ' có cùng cơ hội như mọi số khác.</p>' +
      '<div class="ns-actions"><button type="button" class="btn btn-light" data-pair-of="' + n + '">Xem số ' + pad2(n) + ' hay ra cùng số nào</button><button type="button" class="btn" data-add-num="' + n + '">Thêm số ' + pad2(n) + ' vào vé của bạn</button></div>';
    openSheet('Số ' + pad2(n) + ' · ' + game().label, body);
  }

  /* ============================================================ cặp số */
  /* ước tính jackpot kỳ sắp tới của hạng i. Vietlott không công bố số này trước kỳ quay nên suy ra từ lịch sử:
     - kỳ gần nhất đã có người trúng: giá trị quay về mức khởi điểm (trung vị các kỳ ngay sau một kỳ có người trúng)
     - chưa ai trúng: giá trị kỳ gần nhất + mức tăng trung vị giữa hai kỳ liên tiếp đều chưa ai trúng */
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; }
  function estimateJackpot(i) {
    var L = S.draws || [], cur = L[0];
    if (!cur || !cur.prizes || !cur.prizes[i]) return null;
    var val = function (d) { return d && d.prizes && d.prizes[i] ? toInt(d.prizes[i][3]) : 0; };
    var won = function (d) { return d && d.prizes && d.prizes[i] ? toInt(d.prizes[i][2]) > 0 : false; };
    var starts = [], incs = [];
    for (var k = 0; k < L.length - 1; k++) {
      if (won(L[k + 1]) && val(L[k])) starts.push(val(L[k]));
      else if (!won(L[k + 1]) && val(L[k]) > val(L[k + 1]) && val(L[k + 1])) incs.push(val(L[k]) - val(L[k + 1]));
    }
    if (won(cur)) return { value: starts.length ? median(starts) : null, reset: true };
    return { value: val(cur) + median(incs), reset: false };
  }
  /* thanh thông tin đầu mục Cặp số: jackpot ước tính + kỳ quay sắp tới */
  function pairInfoHtml() {
    var g = game(), d = S.draws && S.draws[0];
    if (!d) return '';
    var prizes = d.prizes || [];
    var items = (JACKPOT_TIERS[g.code] || [0]).filter(function (i) { return prizes[i]; }).map(function (i) {
      var e = estimateJackpot(i);
      return '<div class="board-prize"><div class="p-name">' + esc(prizes[i][0]) + ' ước tính kỳ tới</div>' +
        '<div class="p-val">' + (e && e.value ? '≈ ' + esc(moneyShort(e.value)) : 'Chưa có dữ liệu') + '</div>' +
        '<div class="p-win">' + (e && e.reset ? 'Kỳ #' + pad5(d.no) + ' đã có người trúng nên quay về mức khởi điểm' : 'Kỳ #' + pad5(d.no) + ' chưa ai trúng, giải tiếp tục tích lũy') + '</div></div>';
    }).join('');
    return '<section class="board pair-info" aria-label="Giải thưởng và kỳ quay tiếp theo"><div><div class="board-title"><b>' + esc(g.label) + '</b></div>' +
      '<div class="board-label" style="font-size:13px">' + esc(nextDrawText(g)) + '</div>' +
      '<div class="board-label">Số tiền là ước tính từ dữ liệu các kỳ trước; Vietlott chỉ công bố số chính thức khi quay.</div></div>' +
      '<div class="board-prizes">' + items + '</div></section>';
  }
  function renderPairs() {
    var st = S.stats;
    if (!S.pairOf || S.pairOf > st.game.max) S.pairOf = (S.draws && S.draws[0] ? S.draws[0].main[0] : 1);
    return howto('Bấm một ô trong bảng để xem số đó hay ra cùng những số nào: ô đỏ là cặp ra cùng nhau nhiều hơn trung bình, ô xanh là ít hơn. Bấm "Thêm vào vé" để ghép dần một vé; đủ số thì ứng dụng tự tìm các kỳ vé đó từng trúng giải. ' + qm('cap-so', 'Cặp số ra cùng nhau')) + pairInfoHtml() + '<div id="pair-box" class="block">' + pairBoxHtml() + '</div>' + renderCheck();
  }
  // Bảng "số X hay ra cùng số nào" (vẽ lại riêng khi đổi số đang xem hoặc khi vé thay đổi)
  function pairBoxHtml() {
    var inT = pickedNums(), has = inT.indexOf(S.pairOf) >= 0, need = game().nMain, left = need - inT.length, full = left <= 0;
    var remain = '<span class="pair-left' + (full ? ' done' : '') + '">' + (full ? 'Đã đủ ' + need + '/' + need + ' số' : 'Còn thiếu ' + left + ' số (' + inT.length + '/' + need + ')') + '</span>';
    return '<section class="panel">' + head('Số ' + pad2(S.pairOf) + ' hay ra cùng số nào?', 'Bấm vào một ô để chọn số khác. Màu đỏ: ra cùng nhau nhiều hơn trung bình, màu xanh: ít hơn.',
      '<div class="pair-actions">' + remain + (has ? '<button type="button" class="btn btn-light btn-sm" id="pair-use" disabled>Số ' + pad2(S.pairOf) + ' đã có trong vé</button>'
        : '<button type="button" class="btn btn-light btn-sm" id="pair-use"' + (full ? ' disabled' : '') + '>Thêm số ' + pad2(S.pairOf) + ' vào vé</button>') + '</div>') +
      ticketRowHtml() + slipHtml('pair') + slipLegend('pair') +
      '<div class="legend"><span><span class="sw picked-sw"></span>Đã có trong vé của bạn</span></div>' +
      '<div class="legend"><span><span class="tot-sw th-2"></span>Số về nhiều hơn trung bình hẳn</span><span><span class="tot-sw th-1"></span>Số về nhiều hơn trung bình</span>' +
      '<span><span class="tot-sw tc-1"></span>Số về ít hơn trung bình</span><span><span class="tot-sw tc-2"></span>Số về ít hơn trung bình hẳn</span></div></section>';
  }

  /* ============================================================ vé của bạn (gộp vào mục Cặp số) */
  function renderCheck() {
    return '<div id="ck-pairs">' + pairPanelHtml(game(), pickedNums()) + '</div><div id="ck-out" class="block"></div>';
  }
  function curSp() { return S.ck && S.ck.game === S.game ? S.ck.sp || '' : ''; }
  // Hàng "Vé của bạn": các số đã chọn (bấm để bỏ), số đặc biệt nếu loại vé cần, nút xóa hết
  function ticketRowHtml() {
    var g = game(), sel = pickedNums(), sp = curSp(), h = '<div class="ticket-row">';
    if (sel.length) h += '<span class="balls">' + sel.map(function (n) { return '<button type="button" class="ball-btn" data-del="' + n + '" title="Bấm để bỏ số ' + pad2(n) + '">' + ball(n, 'sm') + '</button>'; }).join('') + '</span>';
    else h += '<span class="sub small">chưa chọn số nào</span>';
    if (specialPick(g)) {
      h += '<label class="field inline"><span>Số đặc biệt</span><select id="ck-sp"><option value="">Chọn</option>';
      for (var s = 1; s <= g.bonusMax; s++) h += '<option value="' + s + '"' + (String(sp) === String(s) ? ' selected' : '') + '>' + pad2(s) + '</option>';
      h += '</select></label>';
    }
    if (sel.length || sp) h += '<button type="button" class="btn btn-light btn-sm" id="ck-clear">Xóa hết</button>';
    return h + '</div>';
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
  // Cập nhật vé: vẽ lại bảng cặp số, các cặp trong vé rồi tự kiểm tra
  function setTicket(nums, sp) {
    nums.sort(function (a, b) { return a - b; });
    S.ck = { game: S.game, nums: nums.map(pad2).join(' '), sp: sp == null ? curSp() : sp };
    $('#pair-box').html(pairBoxHtml());
    $('#ck-pairs').html(pairPanelHtml(game(), nums));
    autoCheck();
  }
  // Tự kiểm tra khi đã chọn đủ số (và số đặc biệt nếu loại này cần); chưa đủ thì nhắc chọn thêm
  function autoCheck() {
    var g = game(), sel = pickedNums(), sp = curSp(), hint = '';
    if (sel.length === g.nMain && (!specialPick(g) || sp)) { runCheck(); return; }
    if (sel.length && sel.length < g.nMain) hint = 'Đã chọn ' + sel.length + '/' + g.nMain + ' số. Chọn thêm ' + (g.nMain - sel.length) + ' số để xem các kỳ bộ số trúng giải.';
    else if (sel.length === g.nMain && specialPick(g) && !sp) hint = 'Chọn thêm số đặc biệt (từ 1 đến ' + g.bonusMax + ') để xem các kỳ bộ số trúng giải.';
    $('#ck-out').html(hint ? '<div class="alert info">' + esc(hint) + '</div>' : '');
  }
  function runCheck() {
    var code = S.game, sel = pickedNums(), sp = curSp(), nums = sel.map(pad2).join(' ');
    $('#ck-out').addClass('loading');
    getJson('/api/check?game=' + code + '&last=' + S.last + '&numbers=' + encodeURIComponent(nums) + (sp ? '&special=' + sp : ''))
      .done(function (r) { if (S.game === code && S.section === 'cap-so' && nums === pickedNums().map(pad2).join(' ')) $('#ck-out').html(checkResultHtml(r)); })
      .fail(function (m) { $('#ck-out').html('<div class="alert error">' + esc(m) + '</div>'); })
      .always(function () { $('#ck-out').removeClass('loading'); });
  }
  // Chỉ còn danh sách các kỳ bộ số trúng giải (kèm các số đã quay)
  function checkResultHtml(r) {
    var rp = r.replay, h = '';
    if (rp.best.length) {
      var mine = r.ticket.numbers.map(Number), mySp = r.ticket.special ? +r.ticket.special : null;
      // kết quả kỳ đó: số trùng với vé hiện màu, số không trùng hiện mờ
      var drawBalls = function (w) {
        if (!w.main) return '';
        var b = '<span class="balls">' + w.main.map(function (n) { return ball(n, 'sm' + (mine.indexOf(n) >= 0 ? '' : ' flat'), mine.indexOf(n) >= 0 ? 'Trùng với vé của bạn' : ''); }).join('');
        if (w.bonus && w.bonus.length) b += '<span class="sep" aria-hidden="true"></span>' + w.bonus.map(function (n) {
          var hit = mySp != null ? n === mySp : mine.indexOf(n) >= 0;
          return ball(n, 'sm' + (hit ? ' special' : ' flat'), hit ? 'Số đặc biệt trùng với vé của bạn' : 'Số đặc biệt');
        }).join('');
        return b + '</span>';
      };
      h += '<section class="panel">' + head('Các kỳ bộ số này trúng giải', rp.winCount + ' lần' + (rp.winCount > rp.best.length ? ', hiển thị ' + rp.best.length + ' lần thưởng cao nhất' : '') + '. Số có màu là số trùng với vé của bạn.') +
        '<div class="table-wrap tall"><table class="data"><thead><tr><th>Kỳ</th><th>Ngày</th><th>Trùng</th><th>Giải</th><th class="r">Tiền thưởng</th><th>Kết quả kỳ đó</th></tr></thead><tbody>' +
        rp.best.map(function (w) {
          var needSp = /đặc biệt/.test(r.tiers[w.tier].desc);
          return '<tr><td>#' + pad5(w.no) + '</td><td>' + fdate(w.date) + '</td><td>' + w.m + ' số' + (w.s && needSp ? ' và số đặc biệt' : '') + '</td><td>' + esc(w.name) + '</td><td class="r">' + money(w.prize) + '</td><td class="c-res">' + drawBalls(w) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    } else h += '<p class="note">Bộ số này chưa trúng giải nào trong phạm vi kỳ đã chọn.</p>';
    return h;
  }

  /* ============================================================ gợi ý bộ số */
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

  /* ============================================================ bảng trượt, thông báo, giao diện sáng/tối */
  var sheetFocus = null, sheetT = 0;
  function openSheet(title, body) {
    tipHide();
    clearTimeout(sheetT);
    var $r = $('#sheet-root');
    if (!$r.hasClass('on')) sheetFocus = document.activeElement;
    $r.html('<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-grab" aria-hidden="true"></div>' +
      '<div class="sheet-head"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-close aria-label="Đóng">' + icon('close') + '</button></div>' +
      '<div class="sheet-body">' + body + '</div></div>').addClass('on');
    $('body').addClass('sheet-open');
    renderThemeSeg();
    requestAnimationFrame(function () { requestAnimationFrame(function () { $r.addClass('open'); $r.find('.sheet-head .icon-btn').trigger('focus'); }); });
  }
  function closeSheet() {
    var $r = $('#sheet-root');
    if (!$r.hasClass('on')) return;
    $r.removeClass('open');
    $('body').removeClass('sheet-open');
    sheetT = setTimeout(function () { $r.removeClass('on').empty(); }, 280);
    if (sheetFocus && document.body.contains(sheetFocus)) try { sheetFocus.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ }
    sheetFocus = null;
  }
  function openTerm(id) {
    var t = termOf(id); if (!t) return;
    openSheet(t.name, '<div class="term-body">' + termBody(t) + '</div><p class="term-all"><a href="#thuat-ngu" data-close>Xem tất cả thuật ngữ</a></p>');
  }
  function openMore() {
    var items = SECTIONS.filter(function (s) { return !TAB_MAIN.some(function (t) { return t[0] === s.id; }); });
    var g = game();
    openSheet('Thêm', '<nav class="more-list" aria-label="Các mục khác">' + items.map(function (s) {
      return '<a class="more-item" href="#' + s.id + '" data-close' + (s.id === S.section ? ' aria-current="page"' : '') + '><span class="mi-ic">' + icon(s.id) + '</span><span><b>' + esc(s.label) + '</b><small>' + esc(MORE_SUB[s.id] || '') + '</small></span>' + icon('chev') + '</a>';
    }).join('') + '</nav>' +
      '<div class="more-set"><span>Giao diện</span><div class="theme-seg" data-theme-seg role="group" aria-label="Giao diện"></div></div>' +
      '<div class="more-set"><label class="switch"><input type="checkbox" data-tech-toggle' + (techOn() ? ' checked' : '') + '>Hiện thêm số liệu kỹ thuật (p, z, AUC…) cho người rành thống kê</label></div>' +
      '<div class="more-data"><p>' + (g.latestNo ? 'Đã có ' + fi(g.draws) + ' kỳ ' + esc(g.label) + ', mới nhất là kỳ #' + pad5(g.latestNo) + ' ngày ' + fdate(g.latestDate) + '.' : '') + '</p>' +
      '<button type="button" class="btn btn-light btn-sm" data-update>' + icon('refresh') + 'Cập nhật dữ liệu</button></div>');
  }
  function toast(type, html) {
    type = type || 'info';
    var $t = $('<div class="toast ' + type + '"><span class="t-ic">' + icon(type === 'error' ? 'warn' : type === 'success' ? 'check' : 'info') + '</span><span>' + html + '</span></div>');
    $('#toasts').append($t);
    var kill = function () { $t.addClass('out'); setTimeout(function () { $t.remove(); }, 220); };
    $t.on('click', kill);
    setTimeout(kill, type === 'error' ? 7000 : 4200);
  }
  function flash(type, html) { toast(type, html); }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themeMode() { try { return localStorage.getItem('vietlott-theme') || 'auto'; } catch (e) { return 'auto'; } }
  function applyTheme(m) {
    try { localStorage.setItem('vietlott-theme', m); } catch (e) { /* bỏ qua */ }
    var dark = m === 'dark' || (m === 'auto' && mq && mq.matches), r = document.documentElement;
    r.setAttribute('data-theme', dark ? 'dark' : 'light');
    r.setAttribute('data-theme-mode', m);
    renderThemeSeg();
  }
  function renderThemeSeg() {
    var m = themeMode();
    $('[data-theme-seg]').html([['auto', 'Tự động', 'auto'], ['light', 'Sáng', 'sun'], ['dark', 'Tối', 'moon']].map(function (o) {
      return '<button type="button" data-theme-set="' + o[0] + '" aria-pressed="' + (o[0] === m) + '">' + icon(o[2]) + o[1] + '</button>';
    }).join(''));
  }
  function techOn() { return document.documentElement.getAttribute('data-tech') === '1'; }
  function setTech(on) {
    try { localStorage.setItem('vietlott-tech', on ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    document.documentElement.setAttribute('data-tech', on ? '1' : '0');
    $('[data-tech-toggle]').prop('checked', on);
  }
  /* ============================================================ giải thích thuật ngữ */
  function renderTerms() {
    var T = window.VLTERMS;
    if (!T) return '<p class="empty">Chưa tải được bảng thuật ngữ.</p>';
    return howto('Bấm vào tên mục bên dưới để mở lời giải thích. Trên các trang khác, những từ có gạch chân chấm và nút <span class="qm" aria-hidden="true">?</span> cũng mở đúng lời giải thích này.') +
      T.groups.map(function (gr) {
        return '<section class="panel"><h2>' + esc(gr[1]) + '</h2><div class="gl">' + T.items.filter(function (t) { return t.group === gr[0]; }).map(function (t) {
          return '<details class="gl-item" id="tn-' + t.id + '"><summary>' + esc(t.name) + '</summary><div class="term-body">' + termBody(t) + '</div></details>';
        }).join('') + '</div></section>';
      }).join('');
  }

  /* ============================================================ điều phối hiển thị */
  // Các mục mới (phân tích, đề xuất, nhiều vé, kiểm chứng, xác suất) do mobile/src/sections.js đăng ký qua VLUI.render
  var EXTRA = {};
  var RENDER = {
    'tong-quan': renderOverview, 'cap-so': renderPairs, 'the-le': renderRules, 'lich-su': renderHistory, 'thuat-ngu': renderTerms
  };
  function renderNav() {
    var item = function (g) { return ' data-game="' + g.code + '" style="--game:' + (GAME_COLOR[g.code] || '#888') + '"'; };
    $('#game-list').html(S.games.map(function (g) {
      return '<button type="button" class="game-item"' + item(g) + ' aria-current="' + (g.code === S.game) + '">' +
        '<span class="g-name">' + esc(g.label) + '</span><span class="g-when">' + esc(scheduleText(g)) + '</span></button>';
    }).join(''));
    $('#game-switch').html(S.games.map(function (g) {
      var p = g.label.split(' ');
      return '<button type="button" class="gs-item"' + item(g) + ' aria-pressed="' + (g.code === S.game) + '">' + esc(p[0]) + ' <i>' + esc(p[1] || '') + '</i></button>';
    }).join(''));
    $('#section-nav').html(SECTIONS.map(function (s) {
      return '<a class="nav-item" href="#' + s.id + '"' + (s.id === S.section ? ' aria-current="page"' : '') + '>' + icon(s.id) + '<span>' + esc(s.label) + '</span></a>';
    }).join(''));
    var inMain = TAB_MAIN.some(function (t) { return t[0] === S.section; });
    $('#tabbar').html(TAB_MAIN.map(function (t) {
      return '<a href="#' + t[0] + '"' + (t[0] === S.section ? ' aria-current="page"' : '') + '><span class="tb-ic">' + icon(t[0]) + '</span>' + esc(t[1]) + '</a>';
    }).join('') + '<button type="button" data-more' + (inMain ? '' : ' aria-current="page"') + '><span class="tb-ic">' + icon('more') + '</span>Thêm</button>');
    document.documentElement.setAttribute('data-game', S.game);
  }
  function renderStatus() {
    var g = game();
    $('#data-status').html(g.latestNo ? 'Đã có <b>' + fi(g.draws) + ' kỳ</b> ' + esc(g.label) + ', mới nhất là kỳ #' + pad5(g.latestNo) + ' ngày ' + fdate(g.latestDate) + '.' : '');
  }
  function renderScope() {
    var g = game(), n = g.draws || 0, opts = [[0, 'Toàn bộ' + (n ? ' (' + fi(n) + ' kỳ)' : '')]];
    [500, 200, 100, 50].forEach(function (x) { if (!n || x < n) opts.push([x, x + ' kỳ gần nhất']); });
    $('#scope').html(opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === S.last ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''));
    $('#scope-wrap').toggle(!!section().scope);
  }
  function renderSection() {
    var sec = section();
    document.body.setAttribute('data-section', sec.id);
    $('#page-title').text(sec.label);
    $('#page-sub').text(sec.sub).removeClass('open');
    renderScope();
    document.title = sec.label + ' – ' + game().label + ' – Thống kê Vietlott';
    renderStage();
    if (sec.id === 'thuat-ngu') { $('#view').html(renderTerms()); return; }
    if (!S.stats) { $('#view').html('<div class="skeleton" aria-busy="true"><i></i><i></i><i></i><i></i></div>'); return; }
    if (S.stats.error) { $('#view').html('<div class="alert error">' + esc(S.stats.error) + ' Hãy chọn phạm vi rộng hơn.</div>'); return; }
    var fn = RENDER[sec.id] || EXTRA[sec.id];
    $('#view').html(fn ? fn() : '<p class="empty">Mục này chưa sẵn sàng.</p>');
    if (sec.id === 'cap-so' && S.ck && S.ck.game === S.game && S.ck.nums) autoCheck();
    if (window.VLUI.onRender) window.VLUI.onRender(sec.id);
  }
  function go(id) {
    if (id === 'kiem-tra-ve') id = 'cap-so'; // mục Kiểm tra vé cũ đã gộp vào Cặp số
    if (id === 'goi-y') id = 'de-xuat';      // mục Gợi ý cũ đã thay bằng Đề xuất bộ số
    if (!SECTIONS.some(function (s) { return s.id === id; })) id = 'tong-quan';
    var same = S.section === id;
    S.section = id;
    tipHide();
    closeSheet();
    renderNav();
    renderSection();
    if (!same) window.scrollTo(0, 0);
  }
  function setGame(c) {
    if (!c || c === S.game) return;
    S.game = c; S.stats = null; S.draws = null; S.pairOf = null;
    save(); renderNav(); renderStatus(); renderSection(); loadGameData();
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
        notice('');
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
      if (S.stats && S.section === 'tong-quan') renderSection();
    });
  }
  function update() {
    var $b = $('[data-update]');
    if ($b.hasClass('busy')) return;
    $b.addClass('busy').prop('disabled', true);
    var before = S.draws && S.draws[0] ? S.draws[0].no : 0;
    $.ajax({ url: '/api/update?game=all', method: 'POST', dataType: 'json' }).done(function (r) {
      var got = 0;
      $.each(r.result || {}, function (k, v) { got += v.fetched || 0; });
      toast('success', got ? 'Đã có ' + got + ' kỳ mới.' : 'Dữ liệu đã mới nhất' + (before ? ' (kỳ #' + pad5(before) + ')' : '') + '.');
      loadGames().always(loadGameData);
    }).fail(function (x) {
      toast('error', 'Chưa cập nhật được: ' + esc((x.responseJSON && x.responseJSON.error) || 'mất kết nối mạng') + '.');
    }).always(function () { $('[data-update]').removeClass('busy').prop('disabled', false); });
  }

  /* ============================================================ cầu nối cho sections.js */
  window.VLUI = {
    S: S, LEVEL: LEVEL, render: EXTRA,
    esc: esc, pad2: pad2, pad5: pad5, fi: fi, fd: fd, fpct: fpct, fprob: fprob, fdate: fdate, weekday: weekday, money: money, moneyShort: moneyShort, toInt: toInt,
    ball: ball, ballsHtml: ballsHtml, head: head, badge: badge, colChart: colChart, rankList: rankList, chartW: chartW, niceStep: niceStep, heatClass: heatClass,
    getJson: getJson, game: game, specialPick: specialPick, notice: notice, flash: flash, toast: toast, go: go, rerender: renderSection,
    icon: icon, lv: lv, term: term, qm: qm, howto: howto, openSheet: openSheet, closeSheet: closeSheet, moneyParts: moneyParts
  };

  /* ============================================================ sự kiện */
  $(function () {
    $tip = $('#tip');
    try { if (!document.documentElement.hasAttribute('data-tech')) document.documentElement.setAttribute('data-tech', localStorage.getItem('vietlott-tech') === '1' ? '1' : '0'); } catch (e) { document.documentElement.setAttribute('data-tech', '0'); }
    renderThemeSeg();
    $('[data-tech-toggle]').prop('checked', techOn());
    if (mq) { var onMq = function () { if (themeMode() === 'auto') applyTheme('auto'); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
    setInterval(tickCountdowns, 1000);
    // Quay lại tab sau một lúc thì tải lại dữ liệu để hiện kỳ quay mới nhất
    var refreshIfStale = function () {
      if (document.visibilityState === 'hidden' || !S.stats || Date.now() - (S.loadedAt || 0) < 60000) return;
      loadGames();
      loadGameData();
    };
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    var hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    $(document)
      .on('mousemove', '[data-tip]', function (e) { if (!hover) return; var t = $(this).attr('data-tip'); if (t) tipShow(t, e.clientX, e.clientY); else tipHide(); })
      .on('mouseleave', '[data-tip]', tipHide)
      .on('focusin', '[data-tip]', function () { var t = $(this).attr('data-tip'); if (!t) return; var r = this.getBoundingClientRect(); tipShow(t, r.right - 12, r.bottom - 12); })
      .on('focusout', '[data-tip]', tipHide)
      .on('touchstart', function (e) { if (!$(e.target).closest('[data-tip]').length) tipHide(); })
      // chạm vào ô có gợi ý trên điện thoại (không có chuột): hiện gợi ý ngay chỗ chạm
      .on('click', '[data-tip]', function (e) {
        if (hover || $(e.target).closest('[data-num], button, a, select, input').length) return;
        var t = $(this).attr('data-tip'); if (t) tipShow(t, e.clientX, e.clientY);
      })
      .on('click', '.gs-item, .game-item', function () { setGame(String($(this).attr('data-game'))); })
      .on('click', '[data-update]', update)
      .on('click', '[data-more]', openMore)
      .on('click', '[data-close]', function () { closeSheet(); })
      .on('click', '[data-term]', function (e) { e.preventDefault(); e.stopPropagation(); openTerm($(this).attr('data-term')); })
      .on('click keydown', '[data-num]', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openNumber(+$(this).attr('data-num'));
      })
      .on('click', '[data-theme-set]', function () { applyTheme($(this).attr('data-theme-set')); })
      .on('change', '[data-tech-toggle]', function () { setTech(this.checked); })
      .on('click', '[data-pair-of]', function () {
        S.pairOf = +$(this).attr('data-pair-of');
        if (location.hash === '#cap-so') go('cap-so'); else location.hash = '#cap-so';
      })
      .on('click', '[data-add-num]', function () {
        var n = +$(this).attr('data-add-num'), g = game(), cur = pickedNums();
        if (cur.indexOf(n) >= 0) { toast('info', 'Số ' + pad2(n) + ' đã có trong vé của bạn.'); return; }
        if (cur.length >= g.nMain) { toast('error', 'Vé đã đủ ' + g.nMain + ' số. Bỏ bớt một số ở mục Cặp số rồi thêm lại.'); return; }
        cur.push(n); cur.sort(function (a, b) { return a - b; });
        S.ck = { game: S.game, nums: cur.map(pad2).join(' '), sp: curSp() };
        S.pairOf = n;
        toast('success', 'Đã thêm số ' + pad2(n) + ' vào vé (' + cur.length + '/' + g.nMain + ' số).');
        if (location.hash === '#cap-so') go('cap-so'); else location.hash = '#cap-so';
      })
      .on('click', '[data-tl]', function () {
        S.tl = $(this).attr('data-tl');
        $(this).closest('.toplists').attr('data-show', S.tl).find('[data-tl]').each(function () { $(this).attr('aria-pressed', String($(this).attr('data-tl') === S.tl)); });
      })
      .on('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); tipHide(); } });
    $('#page-sub').on('click', function () { $(this).toggleClass('open'); });
    $(window).on('scroll', tipHide).on('hashchange', function () { go(location.hash.slice(1)); });

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
    $('#scope').on('change', function () { S.last = +$(this).val() || 0; save(); loadGameData(); });

    $('#view')
      .on('click', '.seg [data-metric]', function () { S.gridMetric = $(this).attr('data-metric'); renderSection(); })
      .on('click keydown', '.slip[data-metric="pair"] .cell', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        S.pairOf = +$(this).attr('data-n');
        tipHide();
        $('#pair-box').html(pairBoxHtml());
        $('#pair-box .slip .cell[data-n="' + S.pairOf + '"]').trigger('focus');
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
      .on('click', '[data-del]', function () {
        var n = +$(this).attr('data-del');
        setTicket(pickedNums().filter(function (x) { return x !== n; }));
      })
      .on('click', '#ck-clear', function () { setTicket([], ''); })
      .on('change', '#ck-sp', function () { S.ck = { game: S.game, nums: pickedNums().map(pad2).join(' '), sp: $(this).val() || '' }; autoCheck(); })
      .on('click', '#pair-use', function () {
        var g = game(), cur = pickedNums();
        if (cur.indexOf(S.pairOf) >= 0 || cur.length >= g.nMain) return;
        cur.push(S.pairOf);
        setTicket(cur);
      })
      .on('click', '[data-check]', function () {
        S.ck = { game: S.game, nums: $(this).attr('data-check'), sp: $(this).attr('data-sp') || '' };
        if (location.hash === '#cap-so') renderSection(); else location.hash = '#cap-so';
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


    var h = location.hash.slice(1);
    if (h === 'kiem-tra-ve') h = 'cap-so';
    if (h === 'goi-y') h = 'de-xuat';
    S.section = SECTIONS.some(function (s) { return s.id === h; }) ? h : 'tong-quan';
    renderNav();
    renderSection();
    loadGames().always(function () { loadGameData(); });
    loadCross();
  });
})(jQuery);
