/* Thống kê Vietlott - các màn hình phân tích: Phân tích, Đề xuất bộ số, Tối ưu nhiều vé, Kiểm chứng, Xác suất & tiền thưởng.
 * Đăng ký vào app.js qua window.VLUI. Dữ liệu lấy qua /api/... (shim.js tính ngay trên máy từ các engine trong js/engine.js). */
(function ($) {
  'use strict';
  var U = window.VLUI, S = U.S, VL = window.VL;
  var esc = U.esc, pad2 = U.pad2, pad5 = U.pad5, fi = U.fi, fd = U.fd, fpct = U.fpct, fprob = U.fprob, fdate = U.fdate;
  var money = U.money, moneyShort = U.moneyShort, ballsHtml = U.ballsHtml, head = U.head, badge = U.badge;

  // Trạng thái riêng của các mục này (giữ khi chuyển mục)
  var X = {
    tab: 'tan-suat', win: 0, unit: 'year', explore: null,
    strat: 'ensemble', count: 5, seed: 1, diversify: true, useW: false, weights: {}, prop: null,
    budget: 100000, pfStrat: '', pfSeed: 1, pf: null, curve: 'ensemble'
  };
  var SKEL = '<div class="skeleton" aria-busy="true"><i></i><i></i><i></i><i></i></div>';
  var PICKS_KEY = 'vietlott-picks';

  /* ============================================================ tiện ích */
  var term = U.term, qm = U.qm, howto = U.howto, lv = U.lv;
  function pv(p) { return p == null ? '–' : p < 0.0001 ? '< 0,01%' : fpct(p); }
  function zf(z) { return (z >= 0 ? '+' : '−') + fd(Math.abs(z), 2); }
  function zCls(z) { return z >= 2 ? 'pos' : z <= -2 ? 'neg' : ''; }
  function ratio(x) { return fd(x * 100, x >= 0.1 ? 0 : 1) + '%'; }
  // Số liệu kỹ thuật: chỉ hiện khi bật "Hiện thêm số liệu kỹ thuật"
  function tech(html) { return '<span class="tech">' + html + '</span>'; }
  // Tỷ lệ so với giá vé -> số tiền nhận lại trên một vé 10.000đ (làm tròn 100đ)
  function back(r) { return money(Math.round(r * 100) * 100); }
  // Lãi/lỗ (roi = −0,86 nghĩa là lỗ 86%) -> số tiền thu về khi bỏ ra 100.000đ (làm tròn 1.000đ)
  function thuVe(roi) { return money(Math.max(0, Math.round((1 + roi) * 100)) * 1000); }
  // Mức "dễ gặp nếu quay ngẫu nhiên" nói bằng lời (p đã hiệu chỉnh)
  function chance(p) { return p == null ? '–' : p >= 0.2 ? 'thường gặp' : p >= 0.05 ? 'khá thường gặp' : p >= 0.01 ? 'ít gặp' : 'hiếm gặp'; }
  function kpi(k, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><span class="k">' + k + '</span><b' + (/txt/.test(cls || '') ? ' class="txt"' : '') + '>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function fact(k, v, cls) { return '<div class="fact' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  // heads: chuỗi hoặc { h, r: canh phải, t: số liệu kỹ thuật }; ô: html hoặc { v: html, c: lớp css }
  function table(heads, rows, cls) {
    var hs = heads.map(function (h) { return typeof h === 'string' ? { h: h } : h; });
    return '<div class="table-wrap' + (cls ? ' ' + cls : '') + '"><table class="data"><thead><tr>' +
      hs.map(function (h) { var c = ((h.r ? 'r ' : '') + (h.t ? 'tech' : '')).trim(); return '<th' + (c ? ' class="' + c + '"' : '') + '>' + esc(h.h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          var o = c != null && typeof c === 'object', h = hs[i] || {}, cc = ((h.r ? 'r ' : '') + (h.t ? 'tech ' : '') + (o && c.c ? c.c : '')).trim();
          return '<td' + (cc ? ' class="' + cc + '"' : '') + '>' + (o ? c.v : c) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function seg(name, items, cur) {
    return '<div class="seg" role="group">' + items.map(function (it) {
      return '<button type="button" data-seg="' + name + '" data-v="' + it[0] + '" aria-pressed="' + (String(it[0]) === String(cur)) + '">' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }
  function meter(label, pct, hint) {
    return '<div class="meter"' + (hint ? ' data-tip="' + esc(hint) + '"' : '') + '><span class="m-l">' + esc(label) + '</span><span class="m-t"><span class="m-f" style="width:' +
      (pct * 100).toFixed(1) + '%"></span></span><span class="m-v">' + fd(pct * 100, 0) + '</span></div>';
  }
  // Bảng số dạng phiếu; bấm ô mở hồ sơ của số (app.js)
  function grid(cells) {
    return '<div class="slip">' + cells.map(function (c) {
      return '<div class="cell ' + (c.cls || '') + '" tabindex="0" role="button" data-num="' + c.n + '" data-tip="' + esc(c.tip || '') + '"><span class="c-n">' + pad2(c.n) + '</span><span class="c-v">' + c.val + '</span></div>';
    }).join('') + '</div>';
  }
  var HEAT_LEGEND = '<div class="legend"><span><span class="sw" style="background:var(--cold-2)"></span>Thấp hơn hẳn</span><span><span class="sw" style="background:var(--cold-1)"></span>Thấp hơn</span>' +
    '<span><span class="sw" style="background:var(--mid)"></span>Gần trung bình</span><span><span class="sw" style="background:var(--hot-1)"></span>Cao hơn</span><span><span class="sw" style="background:var(--hot-2)"></span>Cao hơn hẳn</span></div>';
  function numList(title, arr, txt) {
    return '<section class="panel"><h3>' + title + '</h3><div class="mini-list" style="margin-top:12px">' + arr.map(function (r) {
      return '<div class="mini-row"><button type="button" class="num-btn" data-num="' + r.n + '" aria-label="Hồ sơ số ' + pad2(r.n) + '">' + U.ball(r.n, 'sm') + '</button><span>' + txt(r) + '</span></div>';
    }).join('') + '</div></section>';
  }
  function more(title, html) { return '<details class="more"><summary>' + esc(title) + '</summary>' + html + '</details>'; }

  // Tải dữ liệu cho mục đang mở; bỏ kết quả nếu người dùng đã đổi loại vé / mục / phạm vi trong lúc chờ
  function load(urls, sel, render) {
    var code = S.game, sec = S.section, last = S.last, list = $.isArray(urls) ? urls : [urls];
    $(sel).html(SKEL);
    return $.when.apply($, list.map(function (u) { return U.getJson(u); })).done(function () {
      if (S.game !== code || S.section !== sec || S.last !== last) return;
      var html;
      try { html = render.apply(null, arguments); } catch (e) { html = '<div class="alert error">Không hiển thị được mục này: ' + esc(e.message) + '</div>'; }
      $(sel).html('<div class="fade-in">' + html + '</div>');
    }).fail(function (m) {
      $(sel).html('<div class="alert error">' + esc(m) + ' <button type="button" class="btn btn-light btn-sm" data-retry="1">Thử lại</button></div>');
    });
  }

  // Biểu đồ đường. series: [{ pts: [[x, y], ...], cls }]; opt: { h, ref, band: [[x, lo, hi]], yFmt, xTicks: [[x, nhãn]], marks: [[x, y]] }
  function lineChart(series, opt) {
    opt = opt || {};
    var W = opt.w || U.chartW(1), H = opt.h || 230, L = 48, R = 10, T = 10, B = 26, xs = [], ys = [], v, i;
    series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    (opt.band || []).forEach(function (b) { ys.push(b[1], b[2]); });
    if (opt.ref != null) ys.push(opt.ref);
    if (!xs.length) return '';
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (opt.yMax != null) y1 = Math.min(y1, opt.yMax);
    if (y1 <= y0) y1 = y0 + 1;
    var step = U.niceStep((y1 - y0) / 4);
    y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
    var px = function (x) { return L + (W - L - R) * (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)); };
    var py = function (y) { return T + (H - T - B) * (1 - (Math.min(y1, Math.max(y0, y)) - y0) / (y1 - y0)); };
    var yFmt = opt.yFmt || function (t) { return fd(t, step < 1 ? (step < 0.1 ? 2 : 1) : 0); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.title || 'Biểu đồ') + '">';
    for (v = y0; v <= y1 + step / 2; v += step) {
      s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + py(v) + '" y2="' + py(v) + '"/><text class="tick" x="' + (L - 8) + '" y="' + (py(v) + 4) + '" text-anchor="end">' + yFmt(v) + '</text>';
    }
    if (opt.band && opt.band.length) {
      var up = opt.band.map(function (b) { return px(b[0]).toFixed(1) + ',' + py(b[2]).toFixed(1); });
      var dn = opt.band.slice().reverse().map(function (b) { return px(b[0]).toFixed(1) + ',' + py(b[1]).toFixed(1); });
      s += '<polygon class="band" points="' + up.concat(dn).join(' ') + '"/>';
    }
    if (opt.ref != null) s += '<line class="ref" x1="' + L + '" x2="' + (W - R) + '" y1="' + py(opt.ref) + '" y2="' + py(opt.ref) + '"/>';
    series.forEach(function (sr) {
      s += '<polyline class="line ' + (sr.cls || '') + '" points="' + sr.pts.map(function (p) { return px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1); }).join(' ') + '"/>';
    });
    (opt.marks || []).forEach(function (m) { s += '<circle class="mark" r="3" cx="' + px(m[0]).toFixed(1) + '" cy="' + py(m[1]).toFixed(1) + '"/>'; });
    (opt.xTicks || []).forEach(function (t, j, a) {
      s += '<text class="tick" x="' + px(t[0]) + '" y="' + (H - 8) + '" text-anchor="' + (j === 0 ? 'start' : j === a.length - 1 ? 'end' : 'middle') + '">' + esc(t[1]) + '</text>';
    });
    return s + '</svg>';
  }
  // Mỗi dòng một giá trị kèm khoảng tin cậy, có vạch mốc dọc. rows: [{ label, v, lo, hi, hl, tip }]
  function ciChart(rows, ref, opt) {
    opt = opt || {};
    var W = U.chartW(1), rowH = 24, L = Math.min(230, Math.round(W * 0.44)), R = 16, T = 6, B = 24, H = T + B + rows.length * rowH;
    var lo = ref, hi = ref;
    rows.forEach(function (r) { lo = Math.min(lo, r.lo); hi = Math.max(hi, r.hi); });
    var pad = (hi - lo) * 0.06 || 0.01; lo -= pad; hi += pad;
    var px = function (x) { return L + (W - L - R) * (x - lo) / (hi - lo); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.title || 'Biểu đồ') + '">';
    if (opt.band) s += '<rect class="band" x="' + px(opt.band[0]) + '" y="' + T + '" width="' + (px(opt.band[1]) - px(opt.band[0])) + '" height="' + (rows.length * rowH) + '"/>';
    s += '<line class="ref" x1="' + px(ref) + '" x2="' + px(ref) + '" y1="' + T + '" y2="' + (T + rows.length * rowH) + '"/>';
    rows.forEach(function (r, i) {
      var y = T + i * rowH + rowH / 2;
      s += '<text class="lbl" x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(r.label) + '</text>' +
        '<line class="ci" x1="' + px(r.lo) + '" x2="' + px(r.hi) + '" y1="' + y + '" y2="' + y + '"/><circle class="dot' + (r.hl ? ' hl' : '') + '" r="4" cx="' + px(r.v) + '" cy="' + y + '"/>' +
        '<rect class="hit" x="0" y="' + (y - rowH / 2) + '" width="' + W + '" height="' + rowH + '" data-tip="' + esc(r.tip || '') + '"/>';
    });
    [lo + pad, ref, hi - pad].forEach(function (t, j) {
      s += '<text class="tick" x="' + px(t) + '" y="' + (H - 6) + '" text-anchor="' + (j === 0 ? 'start' : j === 2 ? 'end' : 'middle') + '">' + (opt.fmt ? opt.fmt(t) : fd(t, 2)) + '</text>';
    });
    return s + '</svg>';
  }

  /* ============================================================ TỔNG QUAN: 4 ô tình trạng có hình minh họa, dải kỳ chia giải */
  function ring(frac, cls, inner) {
    var r = 22, c = 2 * Math.PI * r;
    return '<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="g-track" cx="28" cy="28" r="' + r + '"/><circle class="g-val ' + (cls || '') + '" cx="28" cy="28" r="' + r +
      '" stroke-dasharray="' + (c * frac).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 28 28)"/>' + (inner || '') + '</svg>';
  }
  // Nửa vòng: từ 0 đến max (tính theo giá vé), vạch đậm ở mức hòa vốn (bằng giá vé)
  function gauge(x, max) {
    var L = Math.PI * 22, f = Math.max(0, Math.min(1, x / max)), a = Math.PI * (1 - 1 / max), c = Math.cos(a), sn = Math.sin(a);
    return '<svg viewBox="0 0 56 56" aria-hidden="true"><path class="g-track" d="M6 38 A22 22 0 0 1 50 38"/><path class="g-val gold" d="M6 38 A22 22 0 0 1 50 38" stroke-dasharray="' + (L * f).toFixed(1) + ' 200"/>' +
      '<line class="g-tick" x1="' + (28 + 15 * c).toFixed(1) + '" y1="' + (38 - 15 * sn).toFixed(1) + '" x2="' + (28 + 29 * c).toFixed(1) + '" y2="' + (38 - 29 * sn).toFixed(1) + '"/>' +
      '</svg>';
  }
  function dots(list, cols) { return '<div class="dots" style="--c:' + (cols || 5) + '">' + list.map(function (c) { return '<i class="' + c + '"></i>'; }).join('') + '</div>'; }
  function stat(vis, k, b, small) { return '<div class="stat"><div class="stat-vis">' + vis + '</div><div><span class="k">' + k + '</span><b>' + b + '</b><small>' + small + '</small></div></div>'; }
  function overviewExtra(ins, pr) {
    var bt = ins.backtest, q = ins.quality, ts = ins.tests, out = { roll: '', stats: '' };
    var st = pr.forecast && pr.forecast.rolldown;
    if (st && st.pending) {
      var sc = pr.rollScenarios || [], mid = sc.filter(function (x) { return x.tickets === 3e6; })[0];
      var at = new Date(st.rollDate + 'T' + st.rollTime + ':00').getTime();
      out.roll = '<div class="rollbar"><div class="rb-cd"><b data-cd="' + at + '" data-cd-text>…</b><small>còn lại</small></div><div>' +
        '<h3>Kỳ chia giải: ' + esc(st.rollTime.replace(':00', 'h')) + ' ngày ' + fdate(st.rollDate) + ' (kỳ #' + pad5(st.rollNo) + ') ' + qm('chia-giai', 'Kỳ chia giải') + '</h3>' +
        '<p>Độc Đắc đã vượt ' + moneyShort(st.over) + ' mà chưa ai trúng. Nếu đến kỳ đó vẫn không ai trúng Độc Đắc, toàn bộ khoảng ' + moneyShort(st.jackpot) + ' được chia cho các giải Nhất đến Năm.' +
        (mid ? ' Khi đó trung bình một vé 10.000đ nhận lại khoảng <b>' + back(mid.net) + '</b>, kỳ thường chỉ khoảng ' + back(pr.history.summary.meanRatioNormal) + '.' : '') + '</p></div>' +
        '<a class="btn btn-light btn-sm" href="#xac-suat">Xem chi tiết</a></div>';
    }
    var okChecks = q.checks.filter(function (c) { return c.ok; }).length, h = '';
    h += stat(ring(q.errors ? okChecks / q.checks.length : 1, q.errors ? '' : 'good', q.errors ? '' : '<path class="g-check" d="M19 28.5 25.5 34.5 37.5 22"/>'),
      'Chất lượng dữ liệu', q.errors ? fi(q.errors) + ' lỗi' : 'Đạt ' + okChecks + '/' + q.checks.length, fi(q.draws) + ' kỳ, không thiếu kỳ nào' + (q.warnings ? '; ' + q.warnings + ' điểm cần xem' : ''));
    if (ts) {
      var flagged = ts.flaggedItems || [], list = [];
      for (var i = 0; i < ts.total; i++) list.push(i < ts.total - flagged.length ? 'ok' : (flagged[i - ts.total + flagged.length].level || 'watch'));
      h += stat(dots(list), 'Kiểm tra độ ngẫu nhiên ' + qm('kiem-tra', 'Phép kiểm tra độ ngẫu nhiên'), (ts.total - flagged.length) + '/' + ts.total + ' bình thường',
        flagged.length ? 'Cần theo dõi: ' + esc(flagged[0].question) + ' <a href="#phan-tich">Xem</a>' : 'trên toàn bộ lịch sử, không phép nào khác thường');
    }
    var r = pr.ev.net.ratio;
    h += stat(gauge(r, Math.max(2, r * 1.25)), 'Trung bình 1 vé nhận lại ' + qm('nhan-lai', 'Trung bình một vé nhận lại'), back(r),
      'trên vé 10.000đ ở kỳ tới, đã trừ thuế. Hòa vốn khi giải cao nhất ≈ ' + (pr.ev.breakEvenNet ? moneyShort(pr.ev.breakEvenNet) : 'không đạt được') + '. <a href="#xac-suat">Xem</a>');
    if (bt) {
      var real = bt.strategies.filter(function (s) { return s.id !== 'random'; }), sig = bt.significant || [];
      h += stat(dots(real.map(function (s) { return sig.indexOf(s.id) >= 0 || sig.indexOf(s.name) >= 0 ? 'watch' : 'off'; })), 'Cách chọn số hơn chọn bừa ' + qm('kiem-chung', 'Kiểm chứng'),
        sig.length + ' / ' + real.length + ' cách', 'thử trên ' + fi(bt.draws) + ' kỳ đã quay, so với ' + fi(bt.sims) + ' người chọn bừa. <a href="#kiem-chung">Xem</a>');
    }
    out.stats = h;
    return out;
  }
  function loadOverviewExtra() {
    var code = S.game;
    $.when(U.getJson('/api/insight?game=' + code), U.getJson('/api/prob?game=' + code)).done(function (ins, pr) {
      if (S.game !== code || S.section !== 'tong-quan') return;
      var o;
      try { o = overviewExtra(ins, pr); } catch (e) { o = { roll: '', stats: '' }; }
      $('#ov-roll').html(o.roll ? '<div class="fade-in">' + o.roll + '</div>' : '');
      $('#ov-stats').html(o.stats);
    }).fail(function () { $('#ov-stats').remove(); });
  }

  /* ============================================================ PHÂN TÍCH */
  var TABS = [['tan-suat', 'Số lần ra'], ['chu-ky', 'Chu kỳ'], ['cau-truc', 'Dạng kết quả'], ['thoi-gian', 'Thời gian'], ['nhom-so', 'Nhóm số'], ['kiem-dinh', 'Kiểm tra ngẫu nhiên']];
  U.render['phan-tich'] = function () { return '<div class="tabs">' + seg('tab', TABS, X.tab) + '</div><div id="px-body">' + SKEL + '</div>'; };
  function loadAnalysis() {
    load('/api/explore?game=' + S.game + '&last=' + S.last, '#px-body', function (x) { X.explore = x; return analysisTab(x); });
  }
  function analysisTab(x) {
    if (x.error) return '<div class="alert error">' + esc(x.error) + ' Hãy chọn phạm vi rộng hơn.</div>';
    return ({ 'tan-suat': tabFreq, 'chu-ky': tabCycle, 'cau-truc': tabStruct, 'thoi-gian': tabTime, 'nhom-so': tabGroups, 'kiem-dinh': tabTests }[X.tab] || tabFreq)(x);
  }

  function tabFreq(x) {
    var f = x.freq, W = x.window.draws, p0 = f.expectedRate;
    if (X.win && f.windows.indexOf(X.win) < 0) X.win = 0;
    var w = X.win, n = w || W, e = n * p0, val = function (r) { return w ? r.w[w].c : r.all; }, zz = function (r) { return w ? r.w[w].z : r.z; };
    var wins = [[0, 'Toàn bộ']].concat(f.windows.slice().reverse().map(function (v) { return [v, v + ' kỳ']; }));
    var cells = f.rows.map(function (r) {
      return { n: r.n, val: fi(val(r)) + ' lần', cls: U.heatClass(zz(r)), tip: '<b>Số ' + pad2(r.n) + '</b><br>' + fi(val(r)) + ' lần trong ' + fi(n) + ' kỳ, trung bình ' + fd(e, 1) + ' lần<br>' + (val(r) >= e ? 'Nhiều hơn' : 'Ít hơn') + ' trung bình: ' + lv(zz(r)) };
    });
    var by = f.rows.slice().sort(function (a, b) { return zz(b) - zz(a) || a.n - b.n; });
    var tr = f.rows.slice().sort(function (a, b) { return b.trendZ - a.trendZ; }), tw = f.trendWindow, te = tw * p0;
    var cnt = function (r) { return '<b class="num">' + fi(val(r)) + ' lần</b> <span class="muted">' + (val(r) >= e ? 'hơn' : 'kém') + ' trung bình ' + fd(Math.abs(val(r) - e), 0) + ' lần</span>' + tech(' <span class="muted">(' + zf(zz(r)) + 'σ)</span>'); };
    var tz = function (r) { var c = r.w[tw] ? r.w[tw].c : 0; return '<b class="num">' + fi(c) + ' lần trong ' + tw + ' kỳ</b> <span class="muted">trung bình ' + fd(te, 1) + '</span>' + tech(' <span class="muted">(' + zf(r.trendZ) + 'σ)</span>'); };
    var h = howto('Mỗi ô là một số. Ô đỏ: ra nhiều hơn ' + term('trung-binh', 'mức trung bình') + ', ô xanh: ra ít hơn; màu càng đậm là ' + term('lech', 'lệch càng nhiều') +
      '. Chọn "100 kỳ", "50 kỳ"… để chỉ xét các kỳ gần đây. Bấm vào một ô để xem hồ sơ của số. Số đang ' + term('nong-lanh', 'nóng hay lạnh') + ' không ra nhiều hơn ở kỳ sau.');
    h += '<section class="panel">' + head('Số lần ra ' + (w ? 'trong ' + w + ' kỳ gần nhất' : 'trong toàn bộ phạm vi'), 'Mỗi kỳ, một số có ' + fpct(p0) + ' cơ hội được quay trúng, nên trong ' + fi(n) + ' kỳ mỗi số ra trung bình ' + fd(e, 1) + ' lần.', seg('win', wins, w)) +
      grid(cells) + HEAT_LEGEND + '</section>';
    h += '<div class="grid-2">' + numList('Ra nhiều nhất', by.slice(0, 5), cnt) + numList('Ra ít nhất', by.slice(-5).reverse(), cnt) + '</div>';
    if (f.rows[0].w[tw]) h += '<div class="grid-2">' + numList(tw + ' kỳ gần đây ra nhiều hơn trước', tr.slice(0, 5), tz) + numList(tw + ' kỳ gần đây ra ít hơn trước', tr.slice(-5).reverse(), tz) + '</div>';
    h += '<p class="note">So ' + tw + ' kỳ gần nhất với phần lịch sử còn lại, sau khi đã tính việc xét cùng lúc ' + f.rows.length + ' số ' + qm('nhieu-lan', 'Thử nhiều lần thì dễ gặp may') + ': <b>' + f.trendFlag +
      ' số</b> thay đổi thật sự (không phải do may rủi), <b>' + f.unstable + ' số</b> có số lần ra thất thường giữa ' + f.blocks + ' giai đoạn.</p>';
    var heads = ['Số', { h: 'Toàn bộ', r: 1 }, { h: 'Lệch (σ)', r: 1, t: 1 }].concat(f.windows.slice().reverse().map(function (v) { return { h: v + ' kỳ', r: 1 }; }))
      .concat([{ h: 'Gần đây so với trước (σ)', r: 1, t: 1 }, { h: 'Ổn định (p)', r: 1, t: 1 }]);
    h += '<section class="panel">' + head('Bảng đầy đủ', 'Số lần ra của từng số trong từng khoảng thời gian. Ô tô màu khi lệch nhiều so với trung bình của khoảng đó.') + more('Mở bảng ' + f.rows.length + ' số', table(heads, f.rows.map(function (r) {
      return [U.ball(r.n, 'sm'), fi(r.all), { v: zf(r.z), c: zCls(r.z) }].concat(f.windows.slice().reverse().map(function (v) { return { v: fi(r.w[v].c), c: U.heatClass(r.w[v].z) }; }))
        .concat([{ v: zf(r.trendZ), c: zCls(r.trendZ) }, pv(r.dispP)]);
    }), 'tall')) + '</section>';
    var b = x.bayes, bs = b.rows.slice().sort(function (a, c) { return c.mean - a.mean; });
    h += '<section class="panel tech">' + head('Ước lượng Bayes cho tần suất từng số', 'Tiên nghiệm đặt tại ' + fpct(b.p0) + ' với độ mạnh tương đương ' + b.strength + ' kỳ. Khoảng tin cậy 95% của <b>' +
      b.outside.length + '/' + b.rows.length + ' số</b> không chứa mức lý thuyết (ngẫu nhiên thuần túy đã cho khoảng ' + fd(b.outsideExpected, 1) + ' số). ' + qm('bayes', 'Ước lượng Bayes')) +
      table(['Số', { h: 'Số lần', r: 1 }, { h: 'Tần suất thô', r: 1 }, { h: 'Ước lượng Bayes', r: 1 }, { h: 'Khoảng tin cậy 95%', r: 1 }, { h: 'P(cao hơn lý thuyết)', r: 1 }],
        bs.slice(0, 5).concat(bs.slice(-5)).map(function (r) {
          return [U.ball(r.n, 'sm'), fi(r.c), fpct(r.raw), fpct(r.mean), fpct(r.lo) + ' – ' + fpct(r.hi), fpct(r.pAbove)];
        })) + '<p class="note" style="margin-top:10px">Bảng hiện 5 số có ước lượng cao nhất và 5 số thấp nhất.</p></section>';
    return h;
  }

  function tabCycle(x) {
    var c = x.cycle, t = c.theory, rows = c.rows.slice().sort(function (a, b) { return (b.due || 0) - (a.due || 0); });
    var row = function (r) {
      return [U.ball(r.n, 'sm'), fi(r.wait), r.mean == null ? '–' : fd(r.mean, 1), r.median == null ? '–' : fi(r.median), r.min == null ? '–' : fi(r.min), r.max == null ? '–' : fi(r.max),
        r.sd == null ? '–' : fd(r.sd, 1), r.due == null ? '–' : { v: 'gấp ' + fd(r.due, 1) + ' lần', c: r.due >= 3 ? 'hot-2' : r.due >= 2 ? 'hot-1' : '' }, fpct(r.pWait)];
    };
    var heads = ['Số', { h: 'Đang vắng (kỳ)', r: 1 }, { h: 'Thường ra lại sau (kỳ)', r: 1 }, { h: 'Trung vị', r: 1, t: 1 }, { h: 'Ngắn nhất', r: 1 }, { h: 'Dài nhất', r: 1 }, { h: 'Độ lệch chuẩn', r: 1, t: 1 },
      { h: 'Đang vắng so với thường lệ', r: 1 }, { h: 'Dễ gặp nếu quay ngẫu nhiên', r: 1 }];
    var h = howto('"Chu kỳ" là số kỳ từ lần ra này đến lần ra sau của một số. Bảng cho biết số nào đang vắng lâu so với thói quen của chính nó. Vắng lâu không có nghĩa là sắp ra: ' + term('doc-lap', 'các kỳ quay không liên quan đến nhau') + '.');
    h += '<div class="kpis k3">' + kpi('Một số thường ra lại sau', fd(t.mean, 1) + ' kỳ', 'tính trung bình, nếu quay ngẫu nhiên') + kpi('Một nửa số lần ra lại trong', fi(t.median) + ' kỳ', 'nửa còn lại phải chờ lâu hơn') +
      kpi('Mức chênh thường gặp', '± ' + fd(t.sd, 1) + ' kỳ', 'khoảng cách giữa hai lần ra dao động rất rộng') + '</div>';
    h += '<section class="panel">' + head('Số đang vắng lâu nhất so với thói quen của chính nó', '"Đang vắng so với thường lệ" = số kỳ đang vắng chia cho số kỳ thường ra lại của số đó; gấp 2 lần nghĩa là đã vắng lâu gấp đôi bình thường. Cột cuối: nếu quay ngẫu nhiên, bao nhiêu phần trăm trường hợp một số vắng lâu cỡ đó ' + qm('de-gap', 'Dễ gặp cỡ nào') + '.') +
      table(heads, rows.slice(0, 12).map(row)) + more('Mở bảng ' + rows.length + ' số', table(heads, c.rows.map(row), 'tall')) + '</section>';
    h += '<section class="panel">' + head('Chu kỳ theo từng giai đoạn', 'Số kỳ trung bình giữa hai lần ra, tính riêng cho từng phần ba của phạm vi đang chọn.') +
      table(['Giai đoạn', { h: 'Số lần đếm', r: 1 }, { h: 'Thực tế (kỳ)', r: 1 }, { h: 'Nếu quay ngẫu nhiên', r: 1 }], c.parts.map(function (p) {
        return [fdate(p.from) + ' – ' + fdate(p.to), fi(p.gaps), p.mean == null ? '–' : fd(p.mean, 2), fd(t.mean, 2)];
      })) + '<p class="note" style="margin-top:10px">Số vừa ra và số đã vắng 50 kỳ có cùng cơ hội ra ở kỳ tới. Chu kỳ quan sát được không phải quy luật sẽ lặp lại.</p></section>';
    return h;
  }

  function tabStruct(x) {
    var st = x.structure, W = x.window.draws, k = U.game().nMain, m = st.means, L = st.latest;
    var items = function (arr, lab) { return arr.map(function (d) { return { label: lab(d), obs: d.obs, exp: d.exp, tip: '<b>' + esc(lab(d)) + '</b><br>Thực tế: ' + fi(d.obs) + '<br>Nếu quay ngẫu nhiên: ' + fd(d.exp, 1) }; }); };
    var panel = function (title, sub, chart) { return '<section class="panel">' + head(title, sub) + chart + '</section>'; };
    var h = howto('Mỗi biểu đồ so kết quả thật (cột xanh) với con số lẽ ra phải thấy nếu quay hoàn toàn ngẫu nhiên (vạch đen). Cột chạm gần vạch là bình thường. Dạng số nào hay gặp chỉ vì có nhiều cách tạo ra nó, không phải vì dễ trúng hơn.') + '<div class="grid-2">' +
      panel('Số nhỏ trong một kỳ', 'Số lượng số từ 1 đến ' + st.half + ' trong mỗi kỳ.', U.colChart(items(st.low, function (d) { return d.j + ' số'; }), { cols: 2, title: 'Số nhỏ mỗi kỳ' })) +
      panel('Cặp số liền nhau', 'Số cặp liền nhau (ví dụ 12–13) trong mỗi kỳ.', U.colChart(items(st.consecutive, function (d) { return d.r + ' cặp'; }), { cols: 2, title: 'Cặp liền nhau' })) +
      panel('Theo khoảng chục', 'Tổng số lần ra của các số trong từng khoảng.', U.colChart(items(st.decades, function (d) { return d.label; }), { cols: 2, title: 'Theo khoảng chục' })) +
      panel('Theo đuôi số', 'Tổng số lần ra theo chữ số cuối.', U.colChart(items(st.digits, function (d) { return 'đuôi ' + d.label; }), { cols: 2, title: 'Theo đuôi số', labelW: 46 })) + '</div>';
    var mrow = function (name, o, d) { return [name, fd(o.obs, d), o.theory == null ? '–' : fd(o.theory, d)]; };
    h += '<div class="grid-2 block"><section class="panel">' + head('Trung bình của một kỳ', 'Thực tế trong ' + fi(W) + ' kỳ so với con số lẽ ra phải thấy nếu quay ngẫu nhiên.') +
      table(['Chỉ số', { h: 'Thực tế', r: 1 }, { h: 'Nếu quay ngẫu nhiên', r: 1 }], [mrow('Tổng các số', m.sum, 1), mrow('Mức dao động của tổng (độ lệch chuẩn)', m.sumSd, 1), mrow('Số nhỏ nhất', m.first, 2), mrow('Số lớn nhất', m.last, 2),
        mrow('Khoảng trải (lớn nhất − nhỏ nhất)', m.span, 2), mrow('Độ dàn trải của các số trong một kỳ', m.sd, 2)]) + '</section>' +
      '<section class="panel">' + head('Kỳ gần nhất', 'Đặc điểm cấu trúc của kết quả mới nhất trong phạm vi.') + '<div style="margin:6px 0 12px">' + ballsHtml(L.sorted, null, 'sm') + '</div><div class="facts">' +
      fact('Tổng / trung bình / trung vị', L.sum + ' / ' + fd(L.mean, 1) + ' / ' + fd(L.median, 1)) + fact('Lẻ / chẵn', L.odd + ' / ' + (k - L.odd)) + fact('Nhỏ / lớn', L.low + ' / ' + (k - L.low)) +
      fact('Cặp liền nhau', L.consecutive) + fact('Khoảng cách nhỏ nhất / lớn nhất giữa hai số', L.gapMin + ' / ' + L.gapMax) + fact('Khoảng trải', L.span) + '</div></section></div>';
    h += '<section class="panel block">' + head('Các dạng kết quả theo số lẻ và số nhỏ', 'Số kỳ thực tế của từng dạng so với con số lẽ ra phải thấy nếu quay ngẫu nhiên. Dạng hay gặp chỉ vì có nhiều cách tạo ra nó, không phải vì dễ trúng hơn.') +
      table(['Dạng', { h: 'Số kỳ thực tế', r: 1 }, { h: 'Tỷ lệ thực tế', r: 1 }, { h: 'Nếu quay ngẫu nhiên (kỳ)', r: 1 }, { h: 'Tỷ lệ nếu quay ngẫu nhiên', r: 1 }], st.classes.map(function (c) {
        return [c.odd + ' lẻ, ' + (k - c.odd) + ' chẵn; ' + c.low + ' nhỏ, ' + (k - c.low) + ' lớn', fi(c.obs), fpct(c.obs / W), fd(c.exp, 1), fpct(c.p)];
      })) + '</section>';
    return h;
  }

  function tabTime(x) {
    var units = [['year', 'Năm'], ['quarter', 'Quý'], ['moy', 'Tháng trong năm'], ['weekday', 'Thứ']];
    if (x.periods.slot) units.push(['slot', 'Khung giờ']);
    if (!x.periods[X.unit]) X.unit = 'year';
    var pt = x.periods[X.unit], M = U.game().max;
    var nums = function (a) { return a.map(function (o) { return pad2(o.n) + ' <span class="muted">(' + o.c + ')</span>'; }).join(', '); };
    var h = howto('Chia các kỳ theo năm, quý, tháng, thứ trong tuần (hoặc khung giờ quay) rồi xem trong từng nhóm các số có ra đều nhau không. Nếu máy quay công bằng thì nhóm nào cũng "Bình thường"; một nhóm "Cần theo dõi" giữa nhiều nhóm vẫn có thể chỉ do may rủi ' + qm('nhieu-lan', 'Thử nhiều lần thì dễ gặp may') + '.');
    h += '<section class="panel">' + head('Theo thời gian', 'Mỗi dòng là một nhóm kỳ quay. Trong ngoặc là số lần ra của số đó trong nhóm.', seg('unit', units, X.unit)) +
      table(['Nhóm', { h: 'Số kỳ', r: 1 }, 'Kết luận', { h: 'p', r: 1, t: 1 }, { h: 'p hiệu chỉnh', r: 1, t: 1 }, 'Ra nhiều nhất', 'Ra ít nhất'], pt.rows.map(function (r) {
        return [esc(r.label), fi(r.draws), r.pAdj == null ? '<span class="muted">quá ít kỳ để kết luận</span>' : r.pAdj < 0.05 ? badge('watch', 'Cần theo dõi') : badge('ok', 'Bình thường'),
          pv(r.p), r.pAdj == null ? '–' : pv(r.pAdj), nums(r.hot), nums(r.cold)];
      }), pt.rows.length > 14 ? 'tall' : '') +
      (pt.pooled ? '<p class="note" style="margin-top:10px">Xét chung ' + pt.tested + ' nhóm: ' + (pt.minPAdj < 0.05 ? 'có nhóm khác thường sau khi đã tính việc xét nhiều nhóm, cần theo dõi thêm khi có thêm kỳ quay.' : 'không nhóm nào khác thường.') + tech(' p gộp = ' + pv(pt.pooled.p) + '.') + '</p>'
        : '<p class="note" style="margin-top:10px">Mỗi nhóm có quá ít kỳ để kiểm tra.</p>') + '</section>';
    var yr = x.periods.year.rows.filter(function (r) { return r.z; });
    if (yr.length) {
      var cols = 'grid-template-columns:42px repeat(' + M + ',minmax(15px,1fr))';
      var hr = '<div class="heat-row" style="' + cols + '"><span class="h"></span>';
      for (var n = 1; n <= M; n++) hr += '<span class="h" style="justify-content:center">' + n + '</span>';
      hr += '</div>';
      h += '<section class="panel">' + head('Bảng nhiệt: số × năm', 'Mỗi ô là một số trong một năm; đỏ là năm đó số này ra nhiều hơn trung bình, xanh là ít hơn. Nếu có quy luật thật, một cột sẽ cùng màu qua nhiều năm.') +
        '<div class="heat">' + hr + yr.map(function (r) {
          return '<div class="heat-row" style="' + cols + '"><span class="h">' + esc(r.label) + '</span>' + r.z.map(function (z, i) {
            return '<span class="' + U.heatClass(z) + '" data-tip="' + esc('<b>Số ' + pad2(i + 1) + ', năm ' + r.label + '</b><br>' + (z >= 0 ? 'Nhiều hơn' : 'Ít hơn') + ' trung bình: ' + lv(z)) + '"></span>';
          }).join('') + '</div>';
        }).join('') + '</div>' + HEAT_LEGEND + '</section>';
    }
    return h;
  }

  function tabGroups(x) {
    var p = x.pairs, t3 = x.triples, t4 = x.quads, ov = x.overlaps, W = x.window.draws;
    var prow = function (r) {
      return [pad2(r.a) + ' – ' + pad2(r.b), fi(r.c), 'gấp ' + fd(r.lift, 2) + ' lần', r.since == null ? '–' : fi(r.since), r.q < 0.05 ? badge('watch', 'Khác thường') : badge('ok', 'Do may rủi'),
        fpct(r.support), fpct(r.confA) + ' / ' + fpct(r.confB), pv(r.p), { v: pv(r.q), c: r.q < 0.05 ? 'hot-1' : '' }];
    };
    var ph = ['Cặp', { h: 'Số lần ra cùng nhau', r: 1 }, { h: 'So với trung bình', r: 1 }, { h: 'Số kỳ từ lần gần nhất', r: 1 }, 'Kết luận',
      { h: 'Support', r: 1, t: 1 }, { h: 'Confidence a→b / b→a', r: 1, t: 1 }, { h: 'p', r: 1, t: 1 }, { h: 'q (FDR)', r: 1, t: 1 }];
    var h = howto('Đếm số lần mỗi nhóm 2, 3, 4 số ra cùng nhau trong một kỳ, rồi so với ' + term('trung-binh', 'mức trung bình') + '. Có hàng trăm cặp nên luôn có cặp trông "hay đi cùng"; ứng dụng chỉ gọi là khác thường khi đã tính việc ' + term('nhieu-lan', 'xét nhiều cặp cùng lúc') + '.');
    h += '<div class="kpis">' + kpi('Số cặp số', fi(p.nPairs), 'mỗi cặp trung bình ra cùng nhau ' + fd(p.expected, 1) + ' lần') +
      kpi('Cặp trông "hay đi cùng"', fi(p.raw05), 'quay ngẫu nhiên cũng tự sinh ra khoảng ' + fi(p.raw05Expected) + ' cặp như vậy') +
      kpi('Cặp khác thường thật sự', fi(p.fdr05), p.fdr05 ? 'cần theo dõi thêm khi có thêm kỳ quay' : 'sau khi tính việc xét ' + fi(p.nPairs) + ' cặp cùng lúc', p.fdr05 ? 'bad' : 'good') +
      kpi('Cặp hay đi cùng có lặp lại?', Math.abs(p.halves.corr) < 0.15 ? 'Không' : p.halves.corr > 0 ? 'Có một phần' : 'Không', 'so nửa đầu với nửa sau của lịch sử' + tech(': tương quan ' + fd(p.halves.corr, 3) + ', p = ' + pv(p.halves.p))) + '</div>';
    h += '<section class="panel">' + head('Cặp ra cùng nhau nhiều nhất', '"Gấp 1,5 lần" nghĩa là ra cùng nhau nhiều gấp rưỡi mức trung bình ' + fd(p.expected, 1) + ' lần. ' + qm('cap-so', 'Cặp số ra cùng nhau')) +
      table(ph, p.top.slice(0, 12).map(prow)) + more('Xem thêm 28 cặp nhiều nhất và 20 cặp ít nhất', table(ph, p.top.slice(12).concat(p.bottom).map(prow), 'tall')) + '</section>';
    var gt = function (g, name) {
      var rare = g.pMax < 0.05;
      return '<section class="panel">' + head('Bộ ' + name + ' số ra cùng nhau nhiều nhất', 'Có ' + fi(g.nGroups) + ' bộ ' + name + ' số, mỗi bộ trung bình ra cùng nhau ' + fd(g.expected, g.expected < 1 ? 3 : 2) + ' lần. Có bộ ra cùng nhau ' + g.max + ' lần: nếu quay ngẫu nhiên thì chuyện này <b>' + chance(g.pMax) + '</b>' + tech(' (p = ' + pv(g.pMax) + ')') + (rare ? ', cần theo dõi.' : '.')) +
        table(['Bộ số', { h: 'Số lần ra cùng nhau', r: 1 }], g.top.slice(0, 6).map(function (r) { return [r.nums.map(pad2).join(' – '), fi(r.c)]; })) +
        '<div style="margin-top:14px">' + U.colChart(g.dist.map(function (d) { return { label: d.c + ' lần', obs: d.obs, exp: d.exp, tip: '<b>Ra cùng nhau ' + d.c + ' lần</b><br>Thực tế: ' + fi(d.obs) + ' bộ<br>Nếu quay ngẫu nhiên: ' + fd(d.exp, 1) + ' bộ' }; }), { cols: 2, title: 'Số bộ theo số lần ra cùng nhau', labelW: 46 }) + '</div></section>';
    };
    h += '<div class="grid-2">' + gt(t3, 'ba') + gt(t4, 'bốn') + '</div>';
    h += '<section class="panel">' + head('Hai kỳ quay giống nhau bao nhiêu số', 'So từng cặp hai kỳ bất kỳ trong ' + fi(W) + ' kỳ (' + fi(ov.pairs) + ' cặp kỳ): trùng nhau bao nhiêu số, so với con số lẽ ra phải thấy nếu quay ngẫu nhiên.' +
      (ov.identical ? ' Có <b>' + ov.identical + ' cặp kỳ ra giống hệt nhau</b> (nếu quay ngẫu nhiên: khoảng ' + fd(ov.dist[ov.dist.length - 1].exp, 2) + ').' : ' Chưa có hai kỳ nào ra giống hệt nhau.')) +
      table(['Số quả trùng', { h: 'Thực tế (cặp kỳ)', r: 1 }, { h: 'Nếu quay ngẫu nhiên', r: 1 }], ov.dist.map(function (d) { return [d.m, fi(d.obs), fd(d.exp, d.exp < 10 ? 2 : 0)]; })) + '</section>';
    return h;
  }

  function tabTests(x) {
    var v = x.verdict;
    var h = howto('Mỗi dòng là một câu hỏi về kết quả quay. Ứng dụng so dữ liệu thật với điều lẽ ra phải thấy nếu máy quay hoàn toàn ngẫu nhiên. "Bình thường" là không có gì khác thường. "Dễ gặp" cho biết nếu máy quay ngẫu nhiên thì mức lệch như dữ liệu thật xảy ra thường hay hiếm ' + qm('de-gap', 'Dễ gặp cỡ nào') + '.');
    h += '<div class="kpis k3">' + kpi('Số phép kiểm tra', v.total, 'cùng được tính việc làm nhiều phép một lúc ' + qm('nhieu-lan', 'Thử nhiều lần')) +
      kpi('Trông khác thường nếu xét riêng lẻ', v.raw05, 'quay ngẫu nhiên cũng tự sinh ra khoảng ' + fd(v.expectedRaw05, 1) + ' phép như vậy') +
      kpi('Khác thường thật sự', v.flagged, v.flagged ? 'cần theo dõi thêm khi có thêm kỳ quay' : 'không có dấu hiệu bất thường', v.level === 'ok' ? 'good' : 'bad') + '</div>';
    h += '<section class="panel">' + head('Kết quả từng phép kiểm tra', '') +
      x.tests.map(function (t) {
        return '<div class="check"><span class="v-icon sm ' + t.level + '" aria-hidden="true">' + U.LEVEL[t.level].icon + '</span><div><div class="q">' + esc(t.question) + '</div>' +
          '<div class="s">' + esc(t.facts || '') + '</div><div class="m">Nếu máy quay ngẫu nhiên, mức lệch này <b>' + chance(t.pAdj) + '</b>.' + tech(' ' + esc(t.method || '') + ' p = ' + pv(t.p) + '; p hiệu chỉnh = ' + pv(t.pAdj) + '.') + '</div></div>' +
          badge(t.level, t.level === 'ok' ? 'Bình thường' : t.level === 'watch' ? 'Cần theo dõi' : 'Bất thường') + '</div>';
      }).join('') + '</section>';
    return h;
  }

  /* ============================================================ ĐỀ XUẤT BỘ SỐ */
  function strategies() { return VL.G.STRATEGIES; }
  function stratName(id) { var s = strategies().filter(function (o) { return o.id === id; })[0]; return s ? s.name : id; }
  U.render['de-xuat'] = function () {
    var g = U.game(), groups = [], opts = '';
    strategies().forEach(function (s) { if (groups.indexOf(s.group) < 0) groups.push(s.group); });
    groups.forEach(function (gr) {
      opts += '<optgroup label="' + esc(gr) + '">' + strategies().filter(function (s) { return s.group === gr; }).map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === X.strat ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('') + '</optgroup>';
    });
    var cnt = [1, 3, 5, 10, 20].map(function (c) { return '<option value="' + c + '"' + (X.count === c ? ' selected' : '') + '>' + c + ' bộ</option>'; }).join('');
    var sliders = VL.G.PARTS.map(function (id) {
      var v = X.weights[id] || 0;
      return '<label>' + esc(stratName(id)) + ' <b data-wv="' + id + '">' + v + '</b><input type="range" min="0" max="5" step="1" value="' + v + '" data-w="' + id + '"></label>';
    }).join('');
    var sp = '';
    if (U.specialPick(g)) { sp = '<label class="field"><span>Số đặc biệt</span><select id="sc-sp"><option value="">–</option>'; for (var i = 1; i <= g.bonusMax; i++) sp += '<option>' + i + '</option>'; sp += '</select></label>'; }
    return U.howto('Chọn một cách chọn số rồi bấm Đề xuất. Mỗi bộ có điểm 0–100 cho biết bộ đó hợp với cách chọn đến đâu; <b>điểm không phải khả năng trúng</b>, mọi bộ số đều có cùng cơ hội. Phía trên các bộ là kết quả khi thử cách chọn đó trên các kỳ đã quay ' + qm('kiem-chung', 'Kiểm chứng') + '.') + '<section class="panel"><div class="form-row"><label class="field"><span>Cách chọn số</span><select id="dx-strat"' + (X.useW ? ' disabled' : '') + '>' + opts + '</select></label>' +
      '<label class="field"><span>Số bộ</span><select id="dx-count">' + cnt + '</select></label>' +
      '<label class="switch" data-tip="Bật: các bộ sau tránh trùng số và trùng cặp với bộ trước để phủ được nhiều kết quả hơn. Tắt: các bộ có thể trùng nhau nhiều."><input type="checkbox" id="dx-div"' + (X.diversify ? ' checked' : '') + '>Các bộ ít trùng nhau</label>' +
      '<div class="field"><span>&nbsp;</span><button class="btn" type="button" id="dx-go">Đề xuất</button></div>' +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="dx-again">Bộ khác</button></div></div>' +
      '<details class="more"' + (X.useW ? ' open' : '') + '><summary>Tự đặt mức ưu tiên cho từng tiêu chí</summary><div><label class="switch"><input type="checkbox" id="dx-usew"' + (X.useW ? ' checked' : '') +
      '>Dùng mức ưu tiên bên dưới thay cho cách chọn đã chọn</label><div class="weights">' + sliders + '</div><p class="note" style="margin-top:10px">Mỗi tiêu chí được nhân với mức ưu tiên (0 là bỏ qua, 5 là ưu tiên nhất) rồi cộng lại. Cách tự đặt này chưa được thử trên các kỳ đã quay; kết quả thử của từng tiêu chí có ở mục Kiểm chứng.</p></div></details></section>' +
      '<div id="dx-out" class="block"></div>' +
      '<section class="panel block">' + head('Chấm điểm bộ số của bạn', 'Nhập ' + g.nMain + ' số để xem bộ số đó hợp với từng tiêu chí đến đâu so với các bộ chọn bừa. Điểm không phải khả năng trúng.') +
      '<div class="form-row"><label class="field"><span>Các số (cách nhau bằng dấu cách)</span><input class="inp" type="text" inputmode="numeric" id="sc-nums" placeholder="vd: 03 11 19 27 34 42" style="width:260px"></label>' + sp +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="sc-go">Chấm điểm</button></div></div><div id="sc-out" style="margin-top:14px"></div></section>' +
      '<section class="panel block">' + head('Các bộ số đã lưu', 'Lưu trên chính máy này (không gửi đi đâu); tự đối chiếu khi có kết quả của kỳ tương ứng.') + '<div id="dx-picks"></div></section>';
  };
  function proposeUrl() {
    return '/api/propose?game=' + S.game + '&last=' + S.last + '&strategy=' + (X.useW ? 'custom' : X.strat) + '&count=' + X.count + '&seed=' + X.seed + '&diversify=' + (X.diversify ? 1 : 0) +
      (X.useW ? '&weights=' + encodeURIComponent(JSON.stringify(X.weights)) : '');
  }
  function runPropose() { load(proposeUrl(), '#dx-out', function (r) { X.prop = r; X.prop.game = S.game; return proposeHtml(r); }); }

  function recordHtml(r) {
    var rec = r.record, e = r.expected;
    if (!rec || !e) return '<p class="note" style="margin-top:10px">Cách chọn này chưa có kết quả thử trên các kỳ đã quay.</p>';
    var sig = (rec.pHolm != null && rec.pHolm < 0.05) || (rec.aucPHolm != null && rec.aucPHolm < 0.05);
    return '<div class="facts" style="margin-top:12px">' +
      fact('Thử trên các kỳ đã quay ' + qm('kiem-chung', 'Kiểm chứng'), 'mỗi vé trùng trung bình ' + fd(rec.mean, 2) + ' số <span class="muted">(chọn bừa: ' + fd(e.hits, 2) + ')</span>') +
      fact('Khoảng dao động ' + qm('khoang', 'Khoảng dao động'), fd(rec.ci[0], 2) + ' đến ' + fd(rec.ci[1], 2) + ' số') +
      fact('Bỏ 100.000đ mua vé theo cách này, thu về ' + qm('thu-ve', 'Thu về trên mỗi 100.000đ'), '<b>' + thuVe(rec.roi) + '</b> <span class="muted">(xếp trên ' + fd(rec.mcWonPct * 100, 0) + '% người chọn bừa)</span>') +
      fact('p sau hiệu chỉnh', rec.pHolm == null ? '–' : pv(rec.pHolm), 'tech') + (rec.auc != null ? fact('AUC (0,5 = như tung đồng xu)', fd(rec.auc, 4), 'tech') : '') +
      fact('Kết luận', sig ? badge('watch', 'Khác chọn bừa, cần theo dõi') : badge('ok', 'Không hơn chọn bừa')) + '</div>';
  }
  function setCard(s, i, g) {
    var k = g.nMain, st = s.structure, sp = s.special ? [s.special] : null;
    var sc = s.score != null ? Math.round(s.score * 100) : null;
    var score = sc != null ? '<div class="set-score" style="--p:' + sc + '" data-tip="Điểm theo cách chọn đang dùng: bộ số này hợp với tiêu chí hơn ' + sc + ' trong 100 bộ chọn bừa. KHÔNG phải khả năng trúng."><b>' + sc + '</b><small>điểm</small></div>' : '';
    var tp = s.topPairs.length ? 'Cặp trong bộ từng ra cùng nhau nhiều nhất: ' + s.topPairs.map(function (p) { return pad2(p.a) + '–' + pad2(p.b) + ' (' + p.c + ' lần)'; }).join(', ') + '; trung bình một cặp ' + fd(s.pairExpected, 0) + ' lần.' : '';
    return '<div class="set-card"><div class="set-head"><div><span class="tag">Bộ ' + (i + 1) + '</span><div style="margin-top:8px">' + ballsHtml(s.numbers, sp, '') + '</div></div>' + score + '</div>' +
      '<div class="set-meta"><span>Tổng các số <b>' + st.sum + '</b></span><span>Lẻ/chẵn <b>' + st.odd + '/' + (k - st.odd) + '</b></span><span>Nhỏ/lớn <b>' + st.low + '/' + (k - st.low) + '</b></span><span>Cặp liền nhau <b>' + st.consecutive + '</b></span>' +
      (s.crowd != null ? '<span data-tip="1,00 = mức trung bình. Dưới 1: các số này ít người chọn, nếu trúng giải lớn thì ít phải chia.">Độ đông người chọn <b>×' + fd(s.crowd, 2) + '</b> ' + qm('ua-chuong', 'Số được nhiều người chọn') + '</span>' : '') + '</div>' +
      '<div class="meters">' + s.criteria.map(function (c) { return meter(c.name, c.pct, c.hint + ' Hợp hơn ' + fd(c.pct * 100, 0) + ' trong 100 bộ chọn bừa.'); }).join('') + '</div>' +
      '<p class="note" style="margin-top:8px;font-size:12.5px">Mỗi thanh là điểm 0–100 theo một tiêu chí; vạch giữa (50) là ngang một bộ chọn bừa. ' + qm('diem', 'Điểm của bộ số') + '</p>' +
      (tp ? '<p class="note" style="margin-top:8px">' + tp + '</p>' : '') +
      '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" data-check="' + s.numbers.map(pad2).join(' ') + '" data-sp="' + (s.special || '') + '">Xem bộ này từng trúng những kỳ nào</button></div></div>';
  }
  function proposeHtml(r) {
    var g = U.game(), m = r.strategy, cv = r.coverage, ex = r.exact, sim = r.sim;
    var h = '<section class="panel">' + head(m.name, esc(m.desc), '<span class="tag">' + esc(m.group) + '</span>') +
      '<p class="note"><b>Hạn chế:</b> ' + esc(m.limit) + '</p>' + recordHtml(r) + '</section>';
    h += '<div class="sets">' + r.sets.map(function (s, i) { return setCard(s, i, g); }).join('') + '</div>';
    h += '<div class="kpis">' + kpi('Cơ hội giải cao nhất của cả ' + r.sets.length + ' bộ', '1 trên ' + fi(1 / ex.pJackpot), ex.distinct + ' bộ khác nhau, bộ nào cũng có cơ hội như nhau') +
      kpi('Kỳ có ít nhất 1 bộ trúng giải', fpct(sim.pAny), 'máy tính quay thử ' + fi(sim.sims) + ' kỳ ' + qm('mo-phong', 'Mô phỏng')) +
      kpi('Số được dùng', cv.numbers + ' / ' + cv.numbersTotal, 'các bộ phủ ' + fpct(cv.pairsPct) + ' số cặp số') +
      kpi('Hai bộ trùng nhau', fd(cv.meanOverlap, 1) + ' số', 'hai bộ chọn bừa trùng ' + fd(cv.randomOverlap, 1) + ' số; nhiều nhất: ' + cv.maxOverlap) + '</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn" id="dx-save">Lưu để đối chiếu với kỳ #' + pad5(r.nextNo) + '</button>' +
      '<span class="note">Chi phí: ' + money(ex.cost) + '. Tính trung bình, các giải cố định trả lại ' + money(ex.expectedFixed) + ', dù chọn số theo cách nào.</span></div>';
    if (r.ranking) {
      h += '<section class="panel">' + head('Xếp hạng các số theo cách chọn này', 'Điểm chỉ dùng để so các số với nhau trong cùng một cách chọn.') + more('Mở bảng xếp hạng', table(['Hạng', 'Số', { h: 'Điểm', r: 1 }], r.ranking.map(function (o, i) {
        return [i + 1, U.ball(o.n, 'sm'), fd(o.score, Math.abs(o.score) >= 100 ? 0 : 3)];
      }), 'tall')) + '</section>';
    }
    return h;
  }
  // ---- chấm điểm bộ số tự nhập
  function runScore() {
    var nums = $.trim($('#sc-nums').val()), sp = $('#sc-sp').val() || '';
    if (!nums) { $('#sc-out').html('<div class="alert info">Hãy nhập các số của bạn.</div>'); return; }
    $('#sc-out').html(SKEL);
    U.getJson('/api/score?game=' + S.game + '&last=' + S.last + '&numbers=' + encodeURIComponent(nums) + '&special=' + encodeURIComponent(sp)).done(function (r) {
      r.numbers = r.ticket.numbers; r.special = r.ticket.special; r.score = null;
      $('#sc-out').html('<div class="fade-in">' + setCard(r, 0, U.game()) + '</div>');
    }).fail(function (m) { $('#sc-out').html('<div class="alert error">' + esc(m) + '</div>'); });
  }
  // ---- lịch sử dự đoán (lưu trên máy)
  function picks() { try { return JSON.parse(localStorage.getItem(PICKS_KEY) || '[]'); } catch (e) { return []; } }
  function savePicks(list) { try { localStorage.setItem(PICKS_KEY, JSON.stringify(list.slice(0, 60))); return true; } catch (e) { return false; } }
  function addPick(game, forNo, label, sets) {
    var list = picks();
    list.unshift({ id: Date.now() + '-' + Math.floor(Math.random() * 1e6), game: game, forNo: forNo, at: new Date().toISOString().slice(0, 10), label: label,
      sets: sets.map(function (s) { return { numbers: (s.numbers || s).slice(), special: s.special || null }; }) });
    return savePicks(list);
  }
  function loadPicks() {
    var list = picks(), code = S.game, mine = list.filter(function (p) { return p.game === code; });
    if (!mine.length) { $('#dx-picks').html('<p class="empty">Chưa lưu bộ số nào cho ' + esc(U.game().label) + '. Bấm "Lưu để đối chiếu" sau khi đề xuất.</p>'); return; }
    U.getJson('/api/picks?data=' + encodeURIComponent(JSON.stringify(mine))).done(function (res) {
      if (S.game !== code) return;
      var by = {}, cost = 0, prize = 0, done = 0;
      res.forEach(function (r) { by[r.id] = r; });
      var rows = mine.map(function (p) {
        var r = by[p.id] || { pending: true }, bestM = 0;
        if (!r.pending) { done++; cost += r.cost; prize += r.prize; r.sets.forEach(function (s) { bestM = Math.max(bestM, s.m); }); }
        return ['#' + pad5(p.forNo), esc(p.label || ''), p.sets.length, r.pending ? '<span class="muted">chưa quay</span>' : ballsHtml(r.main, r.bonus, 'sm'),
          r.pending ? '–' : bestM + ' số', r.pending ? '–' : (r.best ? esc(r.best) : 'không trúng'), r.pending ? '–' : money(r.prize),
          '<button type="button" class="btn btn-light btn-sm" data-pick-del="' + p.id + '">Xóa</button>'];
      });
      $('#dx-picks').html((done ? '<div class="facts" style="margin-bottom:12px">' + fact('Đã có kết quả', done + ' lần lưu') + fact('Tổng tiền vé (nếu đã mua)', money(cost)) + fact('Tổng tiền trúng (nếu đã mua)', money(prize)) + '</div>' : '') +
        table(['Kỳ', 'Cách chọn', { h: 'Số bộ', r: 1 }, 'Kết quả', { h: 'Trùng nhiều nhất', r: 1 }, 'Giải cao nhất', { h: 'Thưởng', r: 1 }, ''], rows));
    }).fail(function (m) { $('#dx-picks').html('<div class="alert error">' + esc(m) + '</div>'); });
  }

  /* ============================================================ TỐI ƯU NHIỀU VÉ */
  U.render['nhieu-ve'] = function () {
    var opts = '<option value="">Không ưu tiên số nào (chỉ cần phủ rộng)</option>' + strategies().filter(function (s) { return s.id !== 'random' && s.id !== 'balanced'; }).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === X.pfStrat ? ' selected' : '') + '>Ưu tiên số theo: ' + esc(s.name) + '</option>';
    }).join('');
    return U.howto('Nhập số tiền định mua. Ứng dụng chia thành vé 10.000đ theo ba cách rồi cho máy quay thử nhiều kỳ để so sánh. Ba cách có <b>cùng cơ hội giải cao nhất và cùng số tiền nhận lại trung bình</b>; khác nhau ở chỗ bao lâu mới có vé trúng và mỗi lần trúng bao nhiêu vé ' + qm('do-phu', 'Phủ rộng') + '.') + '<section class="panel"><div class="form-row"><label class="field"><span>Số tiền mua vé (đồng)</span><input class="inp" type="number" id="pf-budget" min="10000" max="2000000" step="10000" value="' + X.budget + '"></label>' +
      '<label class="field"><span>Ưu tiên số</span><select id="pf-strat">' + opts + '</select></label>' +
      '<div class="field"><span>&nbsp;</span><button class="btn" type="button" id="pf-go">Tính phương án</button></div>' +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="pf-again">Phương án khác</button></div></div>' +
      '</section>' +
      '<div id="pf-out" class="block"></div>';
  };
  function runPortfolio() {
    var n = Math.max(1, Math.min(200, Math.floor((+$('#pf-budget').val() || X.budget) / 10000)));
    X.budget = n * 10000;
    load('/api/portfolio?game=' + S.game + '&n=' + n + '&strategy=' + X.pfStrat + '&seed=' + X.pfSeed, '#pf-out', function (r) { X.pf = r; return portfolioHtml(r); });
  }
  function portfolioHtml(r) {
    var g = U.game(), v0 = r.variants[0];
    var h = '<div class="kpis k3">' + kpi('Số vé', fi(r.n), 'chi phí ' + money(r.cost)) + kpi('Cơ hội giải cao nhất', '1 trên ' + fi(1 / v0.exact.pJackpot), 'như nhau với mọi cách mua ' + r.n + ' vé khác nhau') +
      kpi('Các giải cố định trả lại trung bình', money(Math.round(v0.exact.expectedFixed)), 'trên ' + money(r.cost) + ' bỏ ra, như nhau ở cả ba cách') + '</div>';
    h += '<div class="grid-3 block">' + r.variants.map(function (v) {
      var c = v.coverage, s = v.sim, wd = s.winnersDist, three = 0;
      for (var i = 3; i < wd.length; i++) three += wd[i];
      return '<section class="panel">' + head(v.name, esc(v.note)) + '<div class="facts">' +
        fact('Kỳ có ít nhất 1 vé trúng', '<b>' + fpct(s.pAny) + '</b>') +
        fact('Số được phủ', c.numbers + ' / ' + c.numbersTotal) + fact('Cặp số được phủ', fi(c.pairs) + ' <span class="muted">(' + fpct(c.pairsPct) + ')</span>') +
        (c.specialsTotal ? fact('Số đặc biệt được phủ', c.specials + ' / ' + c.specialsTotal) : '') +
        fact('Hai vé trùng nhau (trung bình / nhiều nhất)', fd(c.meanOverlap, 1) + ' / ' + c.maxOverlap + ' số') +
        fact('Số vé khác nhau', c.distinct + (c.duplicates ? ' (' + c.duplicates + ' vé trùng)' : '')) +
        fact('Kỳ có đúng 1 vé trúng', fpct(wd[1] || 0)) + fact('Kỳ có 2 vé trúng', fpct(wd[2] || 0)) + fact('Kỳ có từ 3 vé trúng', fpct(three)) +
        fact('Tiền trúng trung bình mỗi kỳ', money(Math.round(s.meanPrize))) + fact('Mức dao động của tiền trúng', money(Math.round(s.sdPrize)), 'tech') + '</div>' +
        more('Xem ' + v.tickets.length + ' vé', '<div class="mini-list">' + v.tickets.map(function (t) { return '<div>' + ballsHtml(t.numbers, t.special ? [t.special] : null, 'sm') + '</div>'; }).join('') + '</div>') +
        '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" data-pf-save="' + v.id + '">Lưu các vé này để đối chiếu</button></div></section>';
    }).join('') + '</div>';
    h += '<p class="note block">"Kỳ có ít nhất 1 vé trúng" tính bằng cách cho máy quay thử ' + fi(r.sims) + ' kỳ ' + qm('mo-phong', 'Mô phỏng') + '. Phủ rộng trúng thường xuyên hơn; tập trung hiếm trúng hơn nhưng khi trúng thì nhiều vé cùng trúng. ' +
      (U.specialPick(g) ? 'Với ' + esc(g.label) + ', mua ' + g.bonusMax + ' vé mang đủ ' + g.bonusMax + ' số đặc biệt khác nhau thì kỳ nào cũng có ít nhất một vé trúng (ít nhất là giải Khuyến Khích).' : '') + '</p>';
    return h;
  }

  /* ============================================================ KIỂM CHỨNG (BACKTEST) */
  U.render['kiem-chung'] = function () { return '<div id="bt-body">' + SKEL + '</div>'; };
  function loadBacktest() { load('/api/insight?game=' + S.game, '#bt-body', function (ins) { X.ins = ins; return backtestHtml(ins.backtest); }); }
  function curveHtml(bt) {
    var s = bt.strategies.filter(function (o) { return o.id === X.curve; })[0] || bt.strategies[0], n = s.curve.length;
    var pts = s.curve.map(function (v, i) { return [i + 1, v]; }), band = bt.baseline.envelope.map(function (e, i) { return [i + 1, -e, e]; });
    return lineChart([{ pts: pts }], { band: band, ref: 0, title: 'Số quả trùng cộng dồn so với chọn bừa', xTicks: [[1, fdate(bt.from)], [n, fdate(bt.to)]] }) +
      '<div class="legend"><span><span class="sw" style="background:var(--obs)"></span>' + esc(s.name) + ': số quả trùng cộng dồn, so với chọn bừa</span><span><span class="sw" style="background:var(--band)"></span>Nơi 95% người chọn bừa rơi vào</span></div>';
  }
  function backtestHtml(bt) {
    if (!bt) return '<div class="alert info">Chưa đủ số kỳ để kiểm chứng.</div>';
    var e = bt.expected, base = bt.baseline, real = bt.strategies.filter(function (s) { return s.id !== 'random'; });
    var sigOf = function (s) { return s.pHolm != null && s.pHolm < 0.05 && s.z > 0; };
    var h = howto('Với từng kỳ đã quay, ứng dụng chỉ dùng kết quả của các kỳ trước đó để chọn vé theo từng cách, rồi so với kết quả thật. Đồng thời cho ' + fi(base ? bt.sims : 0) + ' người chọn bừa mua vé trên đúng các kỳ đó để làm mốc. Một cách chọn chỉ có giá trị khi trúng nhiều hơn chọn bừa một cách rõ ràng, không phải do may rủi. ' + qm('kiem-chung', 'Kiểm chứng'));
    h += '<div class="kpis">' + kpi('Số kỳ đã thử', fi(bt.draws), fdate(bt.from) + ' – ' + fdate(bt.to) + '; ' + bt.warmup + ' kỳ đầu chỉ dùng làm dữ liệu khởi đầu') +
      kpi('Vé chọn bừa trùng trung bình', fd(e.hits, 2) + ' số', 'mỗi kỳ; ' + fpct(e.pAny) + ' số vé trúng một giải nào đó') +
      kpi('Cách chọn số hơn chọn bừa', bt.significant.length + ' / ' + real.length, bt.significant.length ? 'cần theo dõi thêm' : 'không cách nào hơn chọn bừa một cách rõ ràng', bt.significant.length ? 'bad' : 'good') +
      kpi('Người chọn bừa (người ở giữa)', thuVe(base.roi.median), 'thu về trên mỗi 100.000đ bỏ ra ' + qm('trung-vi', 'Trung vị')) + '</div>';
    h += '<section class="panel">' + head('Mỗi vé trùng trung bình bao nhiêu số', 'Chấm là kết quả của từng cách chọn, vạch ngang hai bên là ' + term('khoang', 'khoảng dao động') + '. Vạch đứt là mức của vé chọn bừa (' + fd(e.hits, 2) + ' số); dải nền là nơi 95% người chọn bừa rơi vào. Chấm nằm trong dải nền nghĩa là không khác chọn bừa.') +
      ciChart(bt.strategies.map(function (s) {
        return { label: s.name, v: s.mean, lo: s.ci[0], hi: s.ci[1], hl: s.id === 'random', tip: '<b>' + esc(s.name) + '</b><br>Mỗi vé trùng trung bình ' + fd(s.mean, 3) + ' số<br>' + (sigOf(s) ? 'Hơn chọn bừa, cần theo dõi' : 'Không hơn chọn bừa') };
      }), e.hits, { band: [base.hits.lo, base.hits.hi], title: 'Số quả trùng trung bình mỗi vé', fmt: function (t) { return fd(t, 2); } }) + '</section>';
    h += '<section class="panel">' + head('Kết quả từng cách chọn số', 'Cột "Thu về" là số tiền trúng khi bỏ ra 100.000đ mua vé theo cách đó ' + qm('thu-ve', 'Thu về trên mỗi 100.000đ') + '. "Xếp trên" là cách đó tốt hơn bao nhiêu phần trăm trong ' + fi(bt.sims) + ' người chọn bừa.') +
      table(['Cách chọn số', { h: 'Trùng mỗi vé', r: 1 }, { h: 'Số vé trúng', r: 1 }, { h: 'Tổng thưởng', r: 1 }, { h: 'Bỏ 100.000đ, thu về', r: 1 }, { h: 'Xếp trên người chọn bừa', r: 1 }, 'Kết luận',
        { h: 'z', r: 1, t: 1 }, { h: 'p', r: 1, t: 1 }, { h: 'p hiệu chỉnh', r: 1, t: 1 }, { h: 'AUC', r: 1, t: 1 }, { h: 'z kiểm chứng độc lập', r: 1, t: 1 }],
        bt.strategies.map(function (s) {
          return [esc(s.name) + ' <span class="tag">' + esc(s.group) + '</span>', fd(s.mean, 2) + ' số', '<span class="num">' + fi(s.wins) + ' <span class="muted">(' + fpct(s.winRate) + ')</span></span>', '<span class="num">' + moneyShort(s.won) + '</span>',
            thuVe(s.roi), fd(s.mcWonPct * 100, 0) + '%', s.id === 'random' ? '<span class="muted">mốc so sánh</span>' : sigOf(s) ? badge('watch', 'Hơn chọn bừa') : badge('ok', 'Như chọn bừa'),
            { v: zf(s.z), c: zCls(s.z) }, pv(s.p), s.pHolm == null ? '–' : { v: pv(s.pHolm), c: s.pHolm < 0.05 ? 'hot-1' : '' }, s.auc == null ? '–' : fd(s.auc, 4), { v: zf(s.hold.z), c: zCls(s.hold.z) }];
        })) + '</section>';
    var sel = bt.selection, held = sel.holdP < 0.05 && sel.holdZ > 0;
    h += '<div class="grid-2"><section class="panel">' + head('Đường tích lũy theo thời gian', 'Đường đi lên đều và thoát khỏi dải nền thì cách chọn đó mới có lợi thế thật. Đường loanh quanh trong dải nền là do may rủi.',
      '<select id="bt-curve" aria-label="Chọn cách chọn số">' + bt.strategies.map(function (s) { return '<option value="' + s.id + '"' + (s.id === X.curve ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>') +
      '<div id="bt-curve-out">' + curveHtml(bt) + '</div></section>' +
      '<section class="panel">' + head('Chọn cách "tốt nhất" rồi thử lại', 'Thử nhiều cách thì luôn có một cách trông tốt nhờ may mắn. Phép thử công bằng: chọn cách tốt nhất trên ' + fi(sel.trainDraws) + ' kỳ đầu, rồi xem nó làm được gì ở ' + fi(sel.holdDraws) + ' kỳ sau mà nó chưa từng thấy.') +
      '<div class="facts">' + fact('Tốt nhất ở ' + fi(sel.trainDraws) + ' kỳ đầu', esc(sel.name)) + fact('Ở ' + fi(sel.holdDraws) + ' kỳ sau', held ? 'vẫn hơn chọn bừa' : 'không còn hơn chọn bừa') +
      fact('z ở giai đoạn dò tìm / kiểm chứng', zf(sel.trainZ) + ' / ' + zf(sel.holdZ), 'tech') + fact('p ở giai đoạn kiểm chứng', pv(sel.holdP), 'tech') +
      fact('Kết luận', held ? badge('watch', 'Giữ được lợi thế, cần theo dõi') : badge('ok', 'Lợi thế biến mất khi thử lại')) + '</div></section></div>';
    var segW = function (z) { return Math.abs(z) < 1 ? 'ngang' : z > 0 ? (z >= 2 ? 'hơn rõ' : 'hơn chút') : (z <= -2 ? 'kém rõ' : 'kém chút'); };
    h += '<section class="panel">' + head('Có ổn định qua 4 giai đoạn không', 'So với chọn bừa trong từng phần tư thời gian. Cách chọn có giá trị thật phải "hơn" đều đặn; lúc hơn lúc kém là do may rủi.') +
      table(['Cách chọn số'].concat(bt.strategies[0].segments.map(function (sg) { return { h: fdate(sg.from).slice(3) + ' – ' + fdate(sg.to).slice(3), r: 1 }; })), bt.strategies.map(function (s) {
        return [esc(s.name)].concat(s.segments.map(function (sg) { return { v: segW(sg.z) + tech(' (' + zf(sg.z) + ')'), c: U.heatClass(sg.z) }; }));
      })) + '</section>';
    var pf = bt.portfolio;
    h += '<div class="grid-2"><section class="panel">' + head('Mua ' + pf.tickets + ' vé mỗi kỳ: phủ rộng hay chọn bừa', 'Phủ rộng là ' + pf.tickets + ' vé không trùng số nhau ' + qm('do-phu', 'Phủ rộng') + '. Kỳ có vé trúng nhiều hơn, nhưng tổng tiền thưởng tính trung bình không tăng.') +
      '<div class="facts">' + fact('Kỳ có ít nhất 1 vé trúng (phủ rộng)', '<b>' + fpct(pf.spread.anyRate) + '</b>') +
      fact('Cùng số vé, chọn bừa', fpct(pf.random.anyRate.median) + ' <span class="muted">(thường từ ' + fpct(pf.random.anyRate.lo) + ' đến ' + fpct(pf.random.anyRate.hi) + ')</span>') +
      fact('Bỏ 100.000đ, phủ rộng thu về', thuVe(pf.spread.roi)) + fact('Bỏ 100.000đ, chọn bừa thu về', thuVe(pf.random.roi.median) + ' <span class="muted">(người ở giữa)</span>') + '</div></section>';
    if (bt.timing && bt.timing.roi) {
      var tm = bt.timing;
      h += '<section class="panel">' + head('Chỉ mua ở kỳ chia giải', 'Mỗi ' + term('chia-giai', 'kỳ chia giải') + ' mua ' + tm.perDraw + ' vé chọn bừa, kỳ khác không mua. Quy tắc chỉ dùng thông tin biết trước kỳ quay; máy tính đóng vai nhiều người chơi.') +
        '<div class="facts">' + fact('Số kỳ chia giải đã có', tm.draws + ' <span class="muted">(' + tm.rolled + ' kỳ thật sự chia, ' + (tm.draws - tm.rolled) + ' kỳ có người trúng Độc Đắc trước)</span>') +
        fact('Tổng tiền mua vé', money(tm.cost)) + fact('Bỏ 100.000đ, người ở giữa thu về', '<b>' + thuVe(tm.roi.median) + '</b>') + fact('Tính trung bình mọi người', thuVe(tm.roi.mean)) +
        fact('Thường từ', thuVe(tm.roi.lo) + ' đến ' + thuVe(tm.roi.hi)) + fact('Số người có lãi', fpct(tm.pProfit)) + fact('So với mua mọi kỳ (người ở giữa)', thuVe(base.roi.median)) + '</div></section>';
    } else {
      h += '<section class="panel">' + head('Cách thử được thiết kế để không tự lừa mình', '') + '<div class="facts">' +
        fact('Chọn vé cho kỳ nào', 'chỉ dùng các kỳ trước kỳ đó') + fact('Tiền thưởng', 'theo bảng giải thật của từng kỳ') +
        fact('Mốc so sánh', fi(bt.sims) + ' người chọn bừa trên đúng các kỳ đó') + fact('Xét nhiều cách cùng lúc', 'đã tính để tránh gặp may ' + qm('nhieu-lan', 'Thử nhiều lần')) + fact('Mở lại có ra kết quả khác?', 'không, máy tính quay thử theo trình tự cố định') + '</div></section>';
    }
    h += '</div><p class="note">Kết luận chỉ đáng tin cho số quả trùng và các giải nhỏ. Giải cao nhất quá hiếm: trong ' + fi(bt.draws) + ' kỳ, một vé gần như chắc chắn không trúng lần nào, nên không có dữ liệu nào đủ để đánh giá cách chọn số nào dễ trúng giải cao nhất hơn.</p>';
    return h;
  }

  /* ============================================================ XÁC SUẤT & KỲ VỌNG */
  U.render['xac-suat'] = function () { return '<div id="pr-body">' + SKEL + '</div>'; };
  function loadProb() {
    load(['/api/prob?game=' + S.game, '/api/insight?game=' + S.game], '#pr-body', function (pr, ins) { X.pr = pr; return probHtml(pr, ins); });
  }
  function probHtml(pr, ins) {
    var g = U.game(), ev = pr.ev, hs = pr.history.summary, fc = pr.forecast;
    var h = howto('Cơ hội trúng được tính chính xác bằng cách đếm tổ hợp, không phải ước đoán. "Nhận lại" là tổng tiền thưởng chia đều cho mọi vé: cho biết tính trung bình một vé 10.000đ nhận về bao nhiêu ' + qm('nhan-lai', 'Trung bình một vé nhận lại') + '. Dưới 10.000đ là người mua lỗ.');
    h += '<div class="kpis">' + kpi('Số vé khác nhau có thể mua', fi(pr.total), 'vé nào cũng có cơ hội như nhau') + kpi('Trúng một giải bất kỳ', '1 trên ' + fd(1 / pr.pAny, 1), 'tức ' + fpct(pr.pAny) + ' số vé') +
      kpi('Trung bình 1 vé nhận lại', back(ev.net.ratio), 'trên vé 10.000đ ở kỳ tới, đã trừ thuế và tính việc chia giải') +
      kpi('Hòa vốn khi giải cao nhất', ev.breakEvenNet ? '≈ ' + moneyShort(ev.breakEvenNet) : 'không đạt được', 'đã tính thuế và việc nhiều người cùng trúng ' + qm('hoa-von', 'Hòa vốn')) + '</div>';
    h += '<section class="panel">' + head('Cơ hội trúng từng giải', 'Giá trị giải tích lũy của kỳ tới là ' + term('uoc-tinh', 'số ước tính') + '; số vé bán ra ước tính khoảng ' + fi(fc.tickets) + ' vé mỗi kỳ.') +
      table(['Giải', { h: 'Cơ hội', r: 1 }, { h: 'Số vé trúng / ' + fi(pr.total), r: 1, t: 1 }, { h: 'Xác suất', r: 1, t: 1 }, { h: 'Giá trị kỳ tới', r: 1 }, { h: 'Góp vào số tiền nhận lại', r: 1 }], pr.tiers.map(function (t, i) {
        return [esc(t.name) + (t.jackpot ? ' <span class="tag">tích lũy</span>' : ''), '1 trên ' + fi(t.oneIn), fi(t.ways), fprob(t.p), moneyShort(ev.net.parts[i].value), money(Math.round(ev.net.parts[i].ev))];
      }).concat([['<b>Không trúng</b>', fpct(pr.pNone) + ' số vé', fi(Math.round(pr.pNone * pr.total)), fpct(pr.pNone), '', '']])) +
      '<div class="facts" style="margin-top:14px">' + fact('Nhận lại trung bình, chưa trừ thuế, coi như không ai cùng trúng', back(ev.nominal.ratio)) +
      fact('Tính thêm việc nhiều người cùng trúng phải chia giải ' + qm('chia-jackpot', 'Chia giải'), back(ev.shared.ratio)) + fact('Trừ thêm thuế 10% phần thưởng vượt 10 triệu ' + qm('thue', 'Thuế'), '<b>' + back(ev.net.ratio) + '</b>') +
      fact('Riêng các giải có số tiền cố định', back(ev.nominal.fixedRatio)) + '</div>' +
      '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" id="pr-verify">Kiểm tra lại các con số bằng cách cho máy quay thử 300.000 kỳ</button></div><div id="pr-verify-out" style="margin-top:12px"></div></section>';

    if (fc.rolldown) {
      var st = fc.rolldown, rs = fc.rollStats || {};
      h += '<section class="panel">' + head('Kỳ chia giải ' + qm('chia-giai', 'Kỳ chia giải'), 'Khi Độc Đắc vượt ' + moneyShort(st.over) + ' mà chưa ai trúng, kỳ quay ' + esc(st.rollTime.replace(':00', 'h')) + ' ngày hôm sau là kỳ chia giải: nếu vẫn không ai trúng Độc Đắc thì toàn bộ Độc Đắc chia cho các giải dưới (Nhất 1/3; Nhì, Ba, Tư, Năm mỗi giải 1/6).') +
        (st.pending ? '<div class="callout" style="margin-bottom:14px"><h3>Sắp tới: ' + esc(st.rollTime.replace(':00', 'h')) + ' ngày ' + fdate(st.rollDate) + ', kỳ #' + pad5(st.rollNo) + '</h3><p>Còn ' + st.drawsLeft + ' kỳ nữa. Độc Đắc hiện tại ' + moneyShort(st.jackpot) +
          '. Kỳ đó chỉ thành kỳ chia giải nếu từ giờ đến lúc đó không ai trúng Độc Đắc.</p></div>' : '<p class="note" style="margin-bottom:12px">Hiện chưa có kỳ chia giải nào sắp tới. Độc Đắc đang ở ' + moneyShort(st.jackpot) + '.</p>') +
        '<div class="facts">' + fact('Số kỳ chia giải đã có', (rs.count || 0) + ' <span class="muted">(' + (rs.rolled || 0) + ' kỳ thật sự chia, còn lại có người trúng Độc Đắc trước)</span>') +
        fact('Ở các kỳ đó, 1 vé nhận lại trung bình', back(hs.meanRatioRoll) + ' <span class="muted">(kỳ thường: ' + back(hs.meanRatioNormal) + ')</span>') +
        fact('Số vé bán ra gần đây ở kỳ chia giải', fi(rs.tickets || 0) + ' vé <span class="muted">(kỳ thường: ' + fi(fc.tickets) + ' vé)</span>') + '</div>';
      if (pr.rollScenarios) {
        h += '<h3 style="margin-top:18px">Kỳ chia giải sắp tới: 1 vé 10.000đ nhận lại bao nhiêu</h3><p class="note" style="margin:6px 0 10px">Phụ thuộc số vé bán ra: càng nhiều người mua thì phần chia cho mỗi vé càng nhỏ. Độc Đắc trước kỳ đó ước ' + moneyShort(pr.rollBefore) + ', cộng thêm khoảng ' + ratio(rs.rate || 0.37) + ' tiền bán vé của chính kỳ đó.</p>' +
          table([{ h: 'Số vé bán ra', r: 1 }, { h: 'Độc Đắc', r: 1 }, { h: 'Khả năng không ai trúng Độc Đắc', r: 1 }, { h: 'Nhận lại, chưa trừ thuế', r: 1 }, { h: 'Nhận lại, sau thuế', r: 1 }], pr.rollScenarios.map(function (s) {
            return [fi(s.tickets), moneyShort(s.jackpot), fpct(s.pNoJackpot), { v: back(s.ratio), c: s.ratio >= 1 ? 'hot-1' : '' }, { v: back(s.net), c: s.net >= 1 ? 'hot-1' : '' }];
          })) + '<p class="note" style="margin-top:8px">Ô tô màu: nhận lại từ 10.000đ trở lên, tức tính trung bình là có lãi.</p>';
      }
      h += '<p class="note" style="margin-top:12px">Nhận lại trung bình cao không có nghĩa là dễ có lãi: phần lớn số tiền nằm ở các giải rất khó trúng, nên đa số người mua ít vé vẫn lỗ. Phần "Chỉ mua ở kỳ chia giải" ở mục Kiểm chứng cho thấy kết quả khi thử thật trên các kỳ đã quay.</p></section>';
    }
    if (pr.cap) {
      h += '<div class="alert info">Quy định trần của ' + esc(g.label) + ': khi ' + esc(pr.tiers[pr.cap.tier].name) + ' vượt ' + moneyShort(pr.cap.max) + ' mà kỳ đó không ai trúng nhưng có người trúng ' + esc(pr.tiers[pr.cap.to].name) +
        ', toàn bộ phần vượt được cộng cho ' + esc(pr.tiers[pr.cap.to].name) + '. Các con số ở trên đã tính quy định này.</div>';
    }
    var ser = pr.history.series, step = Math.max(1, Math.floor(ser.length / 700)), pts = [], marks = [];
    ser.forEach(function (r, i) { if (i % step === 0 || r[1] >= 1 || r[2]) pts.push([r[0], Math.min(r[1], 3)]); if (r[2]) marks.push([r[0], Math.min(r[1], 3)]); });
    var best = hs.best.slice(0, 8);
    h += '<section class="panel">' + head('Mỗi kỳ đã quay, 1 vé nhận lại bao nhiêu', 'Tính từ bảng giải thật và số vé bán ra ước tính của từng kỳ (chưa trừ thuế). Vạch đứt là 10.000đ, mức hòa vốn.' + (marks.length ? ' Chấm đỏ là kỳ chia giải.' : '')) +
      lineChart([{ pts: pts }], { ref: 1, marks: marks, title: 'Số tiền nhận lại trên vé 10.000đ theo từng kỳ', yFmt: function (v) { return fi(v * 10000) + 'đ'; }, xTicks: [[ser[0][0], fdate(ser[0][5])], [ser[ser.length - 1][0], fdate(ser[ser.length - 1][5])]] }) +
      '<div class="kpis" style="margin-top:16px">' + kpi('Trung bình mọi kỳ', back(hs.meanRatio), 'trên vé 10.000đ, ' + fi(hs.draws) + ' kỳ') + kpi('Số kỳ nhận lại từ 10.000đ', fi(hs.above1), 'trong ' + fi(hs.draws) + ' kỳ') +
      kpi('Tỷ lệ trả thưởng thực tế', ratio(hs.payout), 'tổng tiền trả thưởng / tiền bán vé ước tính (quy định: 55%)') + kpi('Vé bán ra gần đây', fi(hs.meanTickets), 'trung bình mỗi kỳ, 30 kỳ gần nhất') + '</div>' +
      '<h3 style="margin-top:18px">Những kỳ nhận lại nhiều nhất</h3>' + table(['Kỳ', 'Ngày', { h: 'Giải cao nhất', r: 1 }, { h: 'Vé bán ra (ước)', r: 1 }, { h: '1 vé nhận lại', r: 1 }, ''], best.map(function (b) {
        return ['#' + pad5(b.no), fdate(b.date), moneyShort(b.jackpot), fi(b.tickets), back(b.ratio), b.rolldown ? '<span class="tag won">chia giải</span>' : b.jackpotWon ? '<span class="tag">có người trúng</span>' : ''];
      })) + '</section>';
    h += '<section class="panel">' + head('Mua nhiều vé khác nhau', 'Cơ hội giải cao nhất tăng đúng theo số vé khác nhau. Cột "ít nhất 1 vé trúng" là khi các vé chọn bừa; mục Tối ưu nhiều vé cho thấy cách mua phủ rộng làm con số này cao hơn.') +
      table([{ h: 'Số vé', r: 1 }, { h: 'Chi phí', r: 1 }, { h: 'Giải cao nhất', r: 1 }, { h: 'Ít nhất 1 vé trúng', r: 1 }, { h: 'Số vé trúng trung bình', r: 1 }], pr.multi.map(function (m) {
        return [fi(m.n), money(m.cost), '1 trên ' + fi(1 / m.pJackpot), fpct(m.pAny), fd(m.prizes, 2)];
      })) + '</section>';
    if (ins && ins.popularity) h += popularityHtml(ins.popularity, g, fc.tickets, pr);
    return h;
  }
  function popularityHtml(p, g, tickets, pr) {
    var cells = p.numbers.map(function (x) {
      var z = Math.log(x.index) / 0.07; // thang màu: mỗi nấc ~7% độ ưa chuộng
      return { n: x.n, val: '×' + fd(x.index, 2), cls: U.heatClass(z), tip: '<b>Số ' + pad2(x.n) + '</b><br>Được chọn ×' + fd(x.index, 2) + ' so với mức trung bình (thường từ ×' + fd(x.lo, 2) + ' đến ×' + fd(x.hi, 2) + ')<br>' + (x.q < 0.05 ? 'Khác mức trung bình một cách rõ ràng' : 'Chưa đủ chắc chắn là khác mức trung bình') };
    });
    var srt = p.numbers.slice().sort(function (a, b) { return b.index - a.index; }), k = g.nMain;
    var lam = tickets * pr.tiers[0].p, share = function (c) { var l = lam * c; return l > 1e-9 ? (1 - Math.exp(-l)) / l : 1; };
    var stable = p.halvesCorr >= 0.3 && p.oosCorr >= 0.3;
    var h = '<section class="panel">' + head('Số nào được nhiều người chọn ' + qm('ua-chuong', 'Số được nhiều người chọn'), 'Ước lượng từ số người trúng thật của ' + fi(p.draws) + ' kỳ: kỳ nào ra các số được nhiều người chọn thì có nhiều vé trúng giải nhỏ hơn bình thường. ×1,00 là mức trung bình; ×1,20 là được chọn nhiều hơn 20%. Điều này không đổi cơ hội trúng, chỉ đổi việc phải chia giải lớn.') +
      grid(cells) + HEAT_LEGEND +
      '<div class="grid-2" style="margin-top:16px">' + numList('Được chọn nhiều nhất', srt.slice(0, 6), function (x) { return '<b class="num">×' + fd(x.index, 2) + '</b> <span class="muted">thường từ ×' + fd(x.lo, 2) + ' đến ×' + fd(x.hi, 2) + '</span>'; }) +
      numList('Ít người chọn nhất', srt.slice(-6).reverse(), function (x) { return '<b class="num">×' + fd(x.index, 2) + '</b> <span class="muted">thường từ ×' + fd(x.lo, 2) + ' đến ×' + fd(x.hi, 2) + '</span>'; }) + '</div>' +
      '<div class="facts" style="margin-top:16px">' + fact('Ước lượng có đáng tin không', stable ? 'Có: hai nửa lịch sử cho kết quả giống nhau' : 'Chưa chắc: hai nửa lịch sử cho kết quả khác nhau') +
      fact('Tương quan hai nửa lịch sử / nửa đầu dự báo nửa sau', fd(p.halvesCorr, 2) + ' / ' + fd(p.oosCorr, 2), 'tech') + fact('Số được chọn khác mức trung bình một cách rõ ràng', p.significant + ' / ' + p.numbers.length) +
      fact('Bộ ' + k + ' số đông người nhất / vắng người nhất', '×' + fd(p.crowdMax, 2) + ' / ×' + fd(p.crowdMin, 2)) +
      fact('Nếu trúng giải cao nhất, vé trung bình nhận được', fpct(share(1)) + ' số tiền giải') + fact('Vé vắng người nhất / đông người nhất nhận được', fpct(share(p.crowdMin)) + ' / ' + fpct(share(p.crowdMax))) + '</div>';
    if (p.special) {
      h += '<h3 style="margin-top:18px">Số đặc biệt được chọn nhiều hay ít</h3><p class="note" style="margin:6px 0 10px">Tỷ lệ vé chọn từng số đặc biệt. Nếu mọi người chọn đều thì mỗi số chiếm ' + fpct(1 / g.bonusMax) + '.</p>' +
        U.rankList(p.special.map(function (s) { return { label: U.ball(s.s, 'sm special'), value: s.share, text: fpct(s.share), tip: 'Số đặc biệt ' + s.s + ': ' + fpct(s.share) + ' số vé' }; }), { ref: 1 / g.bonusMax, refLabel: 'Mức nếu mọi số được chọn đều nhau' });
    }
    return h + '<p class="note" style="margin-top:12px">Đây là kết quả duy nhất trong ứng dụng đã được kiểm chứng là lặp lại được, vì nó đo thói quen của người chơi chứ không đo máy quay. Chọn số ít người chọn không làm bạn dễ trúng hơn; nó chỉ giúp nhận nhiều tiền hơn nếu trúng giải lớn.</p></section>';
  }
  function runVerify() {
    $('#pr-verify-out').html(SKEL);
    U.getJson('/api/prob-verify?game=' + S.game + '&sims=300000').done(function (r) {
      $('#pr-verify-out').html('<div class="fade-in">' + table(['Giải', { h: 'Theo công thức', r: 1 }, { h: 'Máy quay thử', r: 1 }, { h: 'Lệch (σ)', r: 1, t: 1 }], r.tiers.map(function (t) {
        var z = t.se > 0 ? (t.obs - t.p) / t.se : 0;
        return [esc(t.name), fprob(t.p), fprob(t.obs), { v: zf(z), c: Math.abs(z) > 3 ? 'hot-2' : '' }];
      }).concat([['<b>Trúng một giải bất kỳ</b>', fpct(r.pAny), fpct(r.obsAny), zf((r.obsAny - r.pAny) / r.seAny)]])) +
        '<p class="note" style="margin-top:8px">' + fi(r.sims) + ' kỳ quay thử. Hai cột gần nhau là công thức đúng; các giải quá hiếm có thể không xuất hiện lần nào khi quay thử.</p></div>');
    }).fail(function (m) { $('#pr-verify-out').html('<div class="alert error">' + esc(m) + '</div>'); });
  }

  /* ============================================================ nối vào app.js */
  var LOADERS = {
    'tong-quan': loadOverviewExtra, 'phan-tich': loadAnalysis, 'kiem-chung': loadBacktest, 'xac-suat': loadProb,
    'de-xuat': function () { runPropose(); loadPicks(); }, 'nhieu-ve': runPortfolio
  };
  U.onRender = function (id) { if (LOADERS[id] && S.stats && !S.stats.error) LOADERS[id](); };

  $(function () {
    $('#view')
      .on('click', '[data-seg]', function () {
        var name = $(this).attr('data-seg'), v = $(this).attr('data-v');
        if (name === 'tab') { X.tab = v; $(this).closest('.seg').find('button').each(function () { $(this).attr('aria-pressed', String($(this).attr('data-v') === v)); }); }
        else if (name === 'win') X.win = +v || 0;
        else if (name === 'unit') X.unit = v;
        if (X.explore) $('#px-body').html('<div class="fade-in">' + analysisTab(X.explore) + '</div>');
      })
      .on('click', '[data-retry]', function () { U.rerender(); })
      .on('change', '#dx-strat', function () { X.strat = $(this).val(); X.seed = 1; runPropose(); })
      .on('change', '#dx-count', function () { X.count = +$(this).val() || 5; runPropose(); })
      .on('change', '#dx-div', function () { X.diversify = this.checked; runPropose(); })
      .on('change', '#dx-usew', function () { X.useW = this.checked; $('#dx-strat').prop('disabled', X.useW); runPropose(); })
      .on('input change', '[data-w]', function () {
        var id = $(this).attr('data-w'); X.weights[id] = +$(this).val() || 0;
        $('[data-wv="' + id + '"]').text(X.weights[id]);
      })
      .on('change', '[data-w]', function () { if (X.useW) runPropose(); })
      .on('click', '#dx-go', runPropose)
      .on('click', '#dx-again', function () { X.seed++; runPropose(); })
      .on('click', '#dx-save', function () {
        var r = X.prop;
        if (!r || r.game !== S.game) return;
        var ok = addPick(S.game, r.nextNo, r.strategy.name, r.sets);
        U.flash(ok ? 'success' : 'error', ok ? 'Đã lưu ' + r.sets.length + ' bộ số để đối chiếu với kỳ #' + pad5(r.nextNo) + '.' : 'Trình duyệt này không cho lưu dữ liệu.');
        loadPicks();
      })
      .on('click', '[data-pick-del]', function () {
        var id = $(this).attr('data-pick-del');
        savePicks(picks().filter(function (p) { return p.id !== id; }));
        loadPicks();
      })
      .on('click', '#sc-go', runScore)
      .on('keydown', '#sc-nums', function (e) { if (e.key === 'Enter') runScore(); })
      .on('click', '#pf-go', runPortfolio)
      .on('change', '#pf-strat', function () { X.pfStrat = $(this).val(); runPortfolio(); })
      .on('click', '#pf-again', function () { X.pfSeed++; runPortfolio(); })
      .on('keydown', '#pf-budget', function (e) { if (e.key === 'Enter') runPortfolio(); })
      .on('click', '[data-pf-save]', function () {
        var id = $(this).attr('data-pf-save'), r = X.pf, v = r && r.variants.filter(function (o) { return o.id === id; })[0];
        if (!v) return;
        var no = (U.game().latestNo || 0) + 1;
        var ok = addPick(S.game, no, v.name, v.tickets);
        U.flash(ok ? 'success' : 'error', ok ? 'Đã lưu ' + v.tickets.length + ' vé để đối chiếu với kỳ #' + pad5(no) + '. Xem ở mục Đề xuất bộ số.' : 'Trình duyệt này không cho lưu dữ liệu.');
      })
      .on('change', '#bt-curve', function () { X.curve = $(this).val(); if (X.ins && X.ins.backtest) $('#bt-curve-out').html(curveHtml(X.ins.backtest)); })
      .on('click', '#pr-verify', runVerify);
  });
})(jQuery);
