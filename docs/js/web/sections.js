/* Thống kê Vietlott - các màn hình phân tích: Phân tích, Đề xuất bộ số, Tối ưu nhiều vé, Kiểm chứng, Xác suất & kỳ vọng.
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
  function pv(p) { return p == null ? '–' : p < 0.0001 ? '< 0,01%' : fpct(p); }
  function zf(z) { return (z >= 0 ? '+' : '−') + fd(Math.abs(z), 2); }
  function zCls(z) { return z >= 2 ? 'pos' : z <= -2 ? 'neg' : ''; }
  function ratio(x) { return fd(x * 100, x >= 0.1 ? 0 : 1) + '%'; }
  function kpi(k, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><span class="k">' + k + '</span><b' + (/txt/.test(cls || '') ? ' class="txt"' : '') + '>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function fact(k, v) { return '<div class="fact"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  // heads: chuỗi hoặc { h, r: canh phải }; ô: html hoặc { v: html, c: lớp css }
  function table(heads, rows, cls) {
    var hs = heads.map(function (h) { return typeof h === 'string' ? { h: h } : h; });
    return '<div class="table-wrap' + (cls ? ' ' + cls : '') + '"><table class="data"><thead><tr>' +
      hs.map(function (h) { return '<th' + (h.r ? ' class="r"' : '') + '>' + esc(h.h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          var o = c != null && typeof c === 'object', cc = ((hs[i] && hs[i].r ? 'r ' : '') + (o && c.c ? c.c : '')).trim();
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
      (pct * 100).toFixed(1) + '%"></span></span><span class="m-v">' + fd(pct * 100, 0) + '%</span></div>';
  }
  function grid(cells) {
    return '<div class="slip">' + cells.map(function (c) {
      return '<div class="cell ' + (c.cls || '') + '" tabindex="0" data-tip="' + esc(c.tip || '') + '"><span class="c-n">' + pad2(c.n) + '</span><span class="c-v">' + c.val + '</span></div>';
    }).join('') + '</div>';
  }
  var HEAT_LEGEND = '<div class="legend"><span><span class="sw" style="background:var(--cold-2)"></span>Thấp hơn hẳn</span><span><span class="sw" style="background:var(--cold-1)"></span>Thấp hơn</span>' +
    '<span><span class="sw" style="background:var(--mid)"></span>Gần trung bình</span><span><span class="sw" style="background:var(--hot-1)"></span>Cao hơn</span><span><span class="sw" style="background:var(--hot-2)"></span>Cao hơn hẳn</span></div>';
  function numList(title, arr, txt) {
    return '<section class="panel"><h3>' + title + '</h3><div class="mini-list" style="margin-top:12px">' + arr.map(function (r) {
      return '<div class="mini-row">' + U.ball(r.n, 'sm') + '<span>' + txt(r) + '</span></div>';
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

  /* ============================================================ TỔNG QUAN: thẻ chỉ số bổ sung */
  function overviewExtra(ins, pr) {
    var g = U.game(), bt = ins.backtest, q = ins.quality, h = '';
    var st = pr.forecast && pr.forecast.rolldown;
    if (st && st.pending) {
      var sc = pr.rollScenarios || [], mid = sc.filter(function (x) { return x.tickets === 3e6; })[0];
      h += '<div class="callout block"><h3>Kỳ chia giải dự kiến: ' + esc(st.rollTime) + ' ngày ' + fdate(st.rollDate) + ' (kỳ #' + pad5(st.rollNo) + ')</h3>' +
        '<p>Giải Độc Đắc đã vượt ' + moneyShort(st.over) + ' từ kỳ #' + pad5(st.overNo) + ' mà chưa ai trúng. Nếu ' + (st.drawsLeft > 1 ? (st.drawsLeft - 1) + ' kỳ trước đó và ' : '') +
        'chính kỳ này vẫn không ai trúng Độc Đắc, toàn bộ Độc Đắc được chia xuống các giải thấp hơn. Kỳ vọng một vé ở kỳ chia giải cao hơn kỳ thường' +
        (mid ? ' (khoảng ' + ratio(mid.net) + ' giá vé sau thuế nếu bán ra 3 triệu vé, so với ' + ratio(pr.history.summary.meanRatioNormal) + ' ở kỳ thường)' : '') +
        '. <a href="#xac-suat">Xem chi tiết</a></p></div>';
    }
    var okChecks = q.checks.filter(function (c) { return c.ok; }).length, ts = ins.tests;
    h += '<div class="kpis">' +
      kpi('Chất lượng dữ liệu', q.errors ? fi(q.errors) + ' lỗi' : 'Đạt ' + okChecks + '/' + q.checks.length, fi(q.draws) + ' kỳ, không thiếu kỳ nào' + (q.warnings ? '; ' + q.warnings + ' điểm cần xem' : ''), q.errors ? 'bad' : 'good') +
      (ts ? kpi('Kiểm định trên toàn bộ lịch sử', (ts.total - ts.flagged) + '/' + ts.total + ' bình thường',
        ts.flagged ? 'Cần theo dõi: ' + esc(ts.flaggedItems[0].question) + ' <a href="#phan-tich">Xem</a>' : 'đã hiệu chỉnh khi thử nhiều giả thuyết', ts.level === 'ok' ? 'good' : '') : '') +
      kpi('Kỳ vọng 1 vé kỳ tới', ratio(pr.ev.net.ratio) + ' giá vé', 'đã trừ thuế và khả năng chia jackpot; hòa vốn khi jackpot ≈ ' + (pr.ev.breakEvenNet ? moneyShort(pr.ev.breakEvenNet) : 'không đạt được')) +
      (bt ? kpi('Chiến lược vượt ngẫu nhiên', bt.significant.length + ' / ' + (bt.strategies.length - 1), 'backtest ' + fi(bt.draws) + ' kỳ, so với ' + fi(bt.sims) + ' người chơi ngẫu nhiên. <a href="#kiem-chung">Xem</a>') : '') +
      '</div>';
    return h;
  }
  function loadOverviewExtra() {
    var code = S.game;
    $.when(U.getJson('/api/insight?game=' + code), U.getJson('/api/prob?game=' + code)).done(function (ins, pr) {
      if (S.game !== code || S.section !== 'tong-quan') return;
      try { $('#ov-extra').html('<div class="fade-in">' + overviewExtra(ins, pr) + '</div>'); } catch (e) { $('#ov-extra').empty(); }
    });
  }

  /* ============================================================ PHÂN TÍCH */
  var TABS = [['tan-suat', 'Tần suất'], ['chu-ky', 'Chu kỳ'], ['cau-truc', 'Cấu trúc'], ['thoi-gian', 'Thời gian'], ['nhom-so', 'Nhóm số'], ['kiem-dinh', 'Kiểm định']];
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
    var w = X.win, n = w || W, val = function (r) { return w ? r.w[w].c : r.all; }, zz = function (r) { return w ? r.w[w].z : r.z; };
    var wins = [[0, 'Toàn bộ']].concat(f.windows.slice().reverse().map(function (v) { return [v, v + ' kỳ']; }));
    var cells = f.rows.map(function (r) {
      return { n: r.n, val: fi(val(r)) + ' lần', cls: U.heatClass(zz(r)), tip: '<b>Số ' + pad2(r.n) + '</b><br>' + fi(val(r)) + ' lần trong ' + fi(n) + ' kỳ (kỳ vọng ' + fd(n * p0) + ')<br>Lệch ' + zf(zz(r)) + ' độ lệch chuẩn' };
    });
    var by = f.rows.slice().sort(function (a, b) { return zz(b) - zz(a) || a.n - b.n; });
    var tr = f.rows.slice().sort(function (a, b) { return b.trendZ - a.trendZ; });
    var cnt = function (r) { return fi(val(r)) + ' lần <span class="muted">(' + zf(zz(r)) + ' σ)</span>'; };
    var tz = function (r) { return 'xu hướng ' + zf(r.trendZ) + ' σ <span class="muted">(' + fi(r.w[f.trendWindow] ? r.w[f.trendWindow].c : 0) + ' lần / ' + f.trendWindow + ' kỳ)</span>'; };
    var h = '<section class="panel">' + head('Tần suất ' + (w ? w + ' kỳ gần nhất' : 'toàn bộ phạm vi'), 'Mỗi kỳ một số có xác suất ra ' + fpct(p0) + ' (lý thuyết). Màu ô cho biết số lần ra thực tế lệch bao nhiêu so với mức đó.', seg('win', wins, w)) +
      grid(cells) + HEAT_LEGEND + '</section>';
    h += '<div class="grid-2 block">' + numList('Nóng nhất trong cửa sổ', by.slice(0, 5), cnt) + numList('Lạnh nhất trong cửa sổ', by.slice(-5).reverse(), cnt) + '</div>';
    if (f.rows[0].w[f.trendWindow]) h += '<div class="grid-2 block">' + numList('Xu hướng tăng', tr.slice(0, 5), tz) + numList('Xu hướng giảm', tr.slice(-5).reverse(), tz) + '</div>';
    h += '<p class="note block">Xu hướng = tần suất ' + f.trendWindow + ' kỳ gần nhất trừ tần suất phần lịch sử còn lại. Sau hiệu chỉnh khi xét cùng lúc ' + f.rows.length + ' số: <b>' + f.trendFlag +
      ' số</b> có xu hướng vượt mức ngẫu nhiên, <b>' + f.unstable + ' số</b> có tần suất không ổn định qua ' + f.blocks + ' giai đoạn. Số nóng hay lạnh không có cơ hội ra cao hơn ở kỳ sau.</p>';
    var heads = ['Số', { h: 'Toàn bộ', r: 1 }, { h: 'Lệch (σ)', r: 1 }].concat(f.windows.slice().reverse().map(function (v) { return { h: v + ' kỳ', r: 1 }; })).concat([{ h: 'Xu hướng (σ)', r: 1 }, { h: 'Ổn định (p)', r: 1 }]);
    h += '<section class="panel block">' + head('Bảng đầy đủ', 'Số lần ra trong từng cửa sổ. Ô tô màu khi lệch từ 2 độ lệch chuẩn trở lên.') + more('Mở bảng ' + f.rows.length + ' số', table(heads, f.rows.map(function (r) {
      return [U.ball(r.n, 'sm'), fi(r.all), { v: zf(r.z), c: zCls(r.z) }].concat(f.windows.slice().reverse().map(function (v) { return { v: fi(r.w[v].c), c: U.heatClass(r.w[v].z) }; }))
        .concat([{ v: zf(r.trendZ), c: zCls(r.trendZ) }, pv(r.dispP)]);
    }), 'tall')) + '</section>';
    var b = x.bayes, bs = b.rows.slice().sort(function (a, c) { return c.mean - a.mean; });
    h += '<section class="panel block">' + head('Ước lượng Bayes cho tần suất từng số', 'Tiên nghiệm đặt tại ' + fpct(b.p0) + ' với độ mạnh tương đương ' + b.strength + ' kỳ. Ước lượng luôn bị kéo về mức lý thuyết; khoảng tin cậy 95% của <b>' +
      b.outside.length + '/' + b.rows.length + ' số</b> không chứa mức lý thuyết (ngẫu nhiên thuần túy đã cho khoảng ' + fd(b.outsideExpected, 1) + ' số).') +
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
        r.sd == null ? '–' : fd(r.sd, 1), r.due == null ? '–' : { v: '×' + fd(r.due, 2), c: r.due >= 3 ? 'hot-2' : r.due >= 2 ? 'hot-1' : '' }, fpct(r.pWait)];
    };
    var heads = ['Số', { h: 'Đang vắng (kỳ)', r: 1 }, { h: 'Cách TB', r: 1 }, { h: 'Trung vị', r: 1 }, { h: 'Ngắn nhất', r: 1 }, { h: 'Dài nhất', r: 1 }, { h: 'Độ lệch chuẩn', r: 1 }, { h: 'So với chu kỳ riêng', r: 1 }, { h: 'P(vắng lâu thế)', r: 1 }];
    var h = '<div class="kpis k3">' + kpi('Khoảng cách trung bình (lý thuyết)', fd(t.mean, 1) + ' kỳ', 'giữa hai lần ra của một số') + kpi('Trung vị (lý thuyết)', fi(t.median) + ' kỳ', 'một nửa số lần ra lại trong chừng đó kỳ') +
      kpi('Độ lệch chuẩn (lý thuyết)', fd(t.sd, 1) + ' kỳ', 'khoảng cách dao động rất rộng') + '</div>';
    h += '<section class="panel block">' + head('Số đang vắng lâu nhất so với chu kỳ của chính nó', '"So với chu kỳ riêng" = số kỳ đang vắng chia cho khoảng cách trung bình của số đó. "P(vắng lâu thế)" là xác suất một số bất kỳ vắng ít nhất chừng đó kỳ nếu quay ngẫu nhiên.') +
      table(heads, rows.slice(0, 12).map(row)) + more('Mở bảng ' + rows.length + ' số', table(heads, c.rows.map(row), 'tall')) + '</section>';
    h += '<section class="panel block">' + head('Chu kỳ theo từng giai đoạn', 'Khoảng cách trung bình giữa hai lần ra, tính riêng cho từng phần ba của phạm vi đang chọn.') +
      table(['Giai đoạn', { h: 'Số khoảng cách', r: 1 }, { h: 'Trung bình (kỳ)', r: 1 }, { h: 'Lý thuyết', r: 1 }], c.parts.map(function (p) {
        return [fdate(p.from) + ' – ' + fdate(p.to), fi(p.gaps), p.mean == null ? '–' : fd(p.mean, 2), fd(t.mean, 2)];
      })) + '<p class="note" style="margin-top:10px">Khoảng cách giữa các lần ra tuân theo phân phối hình học: số vừa ra và số đã vắng 50 kỳ có cùng xác suất ra ở kỳ tới. Chu kỳ quan sát được không phải quy luật sẽ lặp lại.</p></section>';
    return h;
  }

  function tabStruct(x) {
    var st = x.structure, W = x.window.draws, k = U.game().nMain, m = st.means, L = st.latest;
    var items = function (arr, lab) { return arr.map(function (d) { return { label: lab(d), obs: d.obs, exp: d.exp, tip: '<b>' + esc(lab(d)) + '</b><br>Thực tế: ' + fi(d.obs) + '<br>Lý thuyết: ' + fd(d.exp, 1) }; }); };
    var panel = function (title, sub, chart) { return '<section class="panel">' + head(title, sub) + chart + '</section>'; };
    var h = '<div class="grid-2">' +
      panel('Số nhỏ trong một kỳ', 'Số lượng số từ 1 đến ' + st.half + ' trong mỗi kỳ.', U.colChart(items(st.low, function (d) { return d.j + ' số'; }), { cols: 2, title: 'Số nhỏ mỗi kỳ' })) +
      panel('Cặp số liền nhau', 'Số cặp liền nhau (ví dụ 12–13) trong mỗi kỳ.', U.colChart(items(st.consecutive, function (d) { return d.r + ' cặp'; }), { cols: 2, title: 'Cặp liền nhau' })) +
      panel('Theo khoảng chục', 'Tổng số lần ra của các số trong từng khoảng.', U.colChart(items(st.decades, function (d) { return d.label; }), { cols: 2, title: 'Theo khoảng chục' })) +
      panel('Theo đuôi số', 'Tổng số lần ra theo chữ số cuối.', U.colChart(items(st.digits, function (d) { return 'đuôi ' + d.label; }), { cols: 2, title: 'Theo đuôi số', labelW: 46 })) + '</div>';
    var mrow = function (name, o, d) { return [name, fd(o.obs, d), o.theory == null ? '–' : fd(o.theory, d)]; };
    h += '<div class="grid-2 block"><section class="panel">' + head('Chỉ số trung bình của một kỳ', 'Thực tế trong ' + fi(W) + ' kỳ so với giá trị lý thuyết chính xác.') +
      table(['Chỉ số', { h: 'Thực tế', r: 1 }, { h: 'Lý thuyết', r: 1 }], [mrow('Tổng các số', m.sum, 1), mrow('Độ lệch chuẩn của tổng', m.sumSd, 1), mrow('Số nhỏ nhất', m.first, 2), mrow('Số lớn nhất', m.last, 2),
        mrow('Khoảng trải (lớn nhất − nhỏ nhất)', m.span, 2), mrow('Độ phân tán trong một kỳ', m.sd, 2)]) + '</section>' +
      '<section class="panel">' + head('Kỳ gần nhất', 'Đặc điểm cấu trúc của kết quả mới nhất trong phạm vi.') + '<div style="margin:6px 0 12px">' + ballsHtml(L.sorted, null, 'sm') + '</div><div class="facts">' +
      fact('Tổng / trung bình / trung vị', L.sum + ' / ' + fd(L.mean, 1) + ' / ' + fd(L.median, 1)) + fact('Lẻ / chẵn', L.odd + ' / ' + (k - L.odd)) + fact('Nhỏ / lớn', L.low + ' / ' + (k - L.low)) +
      fact('Cặp liền nhau', L.consecutive) + fact('Khoảng cách nhỏ nhất / lớn nhất giữa hai số', L.gapMin + ' / ' + L.gapMax) + fact('Khoảng trải', L.span) + '</div></section></div>';
    h += '<section class="panel block">' + head('Phân loại dãy số theo (số lẻ, số nhỏ)', 'Tỷ lệ từng dạng trong thực tế so với xác suất chính xác (siêu bội nhiều chiều). Dạng phổ biến chỉ vì có nhiều tổ hợp hơn, không phải vì dễ trúng hơn.') +
      table(['Dạng', { h: 'Thực tế', r: 1 }, { h: 'Tỷ lệ', r: 1 }, { h: 'Lý thuyết', r: 1 }, { h: 'Xác suất', r: 1 }], st.classes.map(function (c) {
        return [c.odd + ' lẻ ' + (k - c.odd) + ' chẵn · ' + c.low + ' nhỏ ' + (k - c.low) + ' lớn', fi(c.obs), fpct(c.obs / W), fd(c.exp, 1), fpct(c.p)];
      })) + '</section>';
    return h;
  }

  function tabTime(x) {
    var units = [['year', 'Năm'], ['quarter', 'Quý'], ['moy', 'Tháng trong năm'], ['weekday', 'Thứ']];
    if (x.periods.slot) units.push(['slot', 'Khung giờ']);
    if (!x.periods[X.unit]) X.unit = 'year';
    var pt = x.periods[X.unit], M = U.game().max;
    var nums = function (a) { return a.map(function (o) { return pad2(o.n) + ' <span class="muted">(' + o.c + ')</span>'; }).join(' · '); };
    var h = '<section class="panel">' + head('Tần suất theo thời gian', 'Với mỗi nhóm đủ dữ liệu, kiểm định xem các số có ra đều không (khi bình phương có hiệu chỉnh rút không hoàn lại), rồi hiệu chỉnh Holm vì xét nhiều nhóm.', seg('unit', units, X.unit)) +
      table(['Nhóm', { h: 'Số kỳ', r: 1 }, { h: 'p', r: 1 }, { h: 'p hiệu chỉnh', r: 1 }, 'Ra nhiều nhất', 'Ra ít nhất'], pt.rows.map(function (r) {
        return [esc(r.label), fi(r.draws), pv(r.p), r.pAdj == null ? '–' : { v: pv(r.pAdj), c: r.pAdj < 0.05 ? 'hot-1' : '' }, nums(r.hot), nums(r.cold)];
      }), pt.rows.length > 14 ? 'tall' : '') +
      (pt.pooled ? '<p class="note" style="margin-top:10px">Gộp ' + pt.tested + ' nhóm: p = ' + pv(pt.pooled.p) + '. ' + (pt.minPAdj < 0.05 ? 'Có nhóm lệch sau hiệu chỉnh, cần theo dõi thêm.' : 'Không nhóm nào lệch có ý nghĩa sau hiệu chỉnh.') + '</p>'
        : '<p class="note" style="margin-top:10px">Mỗi nhóm có quá ít kỳ để kiểm định.</p>') + '</section>';
    var yr = x.periods.year.rows.filter(function (r) { return r.z; });
    if (yr.length) {
      var cols = 'grid-template-columns:42px repeat(' + M + ',minmax(15px,1fr))';
      var hr = '<div class="heat-row" style="' + cols + '"><span class="h"></span>';
      for (var n = 1; n <= M; n++) hr += '<span class="h" style="justify-content:center">' + n + '</span>';
      hr += '</div>';
      h += '<section class="panel block">' + head('Bảng nhiệt: số × năm', 'Mỗi ô là một số trong một năm; màu theo mức lệch so với kỳ vọng của năm đó. Một quy luật thật sẽ hiện thành một cột cùng màu qua nhiều năm.') +
        '<div class="heat">' + hr + yr.map(function (r) {
          return '<div class="heat-row" style="' + cols + '"><span class="h">' + esc(r.label) + '</span>' + r.z.map(function (z, i) {
            return '<span class="' + U.heatClass(z) + '" data-tip="' + esc('<b>Số ' + pad2(i + 1) + ', năm ' + r.label + '</b><br>Lệch ' + zf(z) + ' độ lệch chuẩn') + '"></span>';
          }).join('') + '</div>';
        }).join('') + '</div>' + HEAT_LEGEND + '</section>';
    }
    return h;
  }

  function tabGroups(x) {
    var p = x.pairs, t3 = x.triples, t4 = x.quads, ov = x.overlaps, W = x.window.draws;
    var prow = function (r) {
      return [pad2(r.a) + ' – ' + pad2(r.b), fi(r.c), '×' + fd(r.lift, 2), fpct(r.support), fpct(r.confA) + ' / ' + fpct(r.confB), r.since == null ? '–' : fi(r.since), pv(r.p), { v: pv(r.q), c: r.q < 0.05 ? 'hot-1' : '' }];
    };
    var ph = ['Cặp', { h: 'Cùng ra', r: 1 }, { h: 'Lift', r: 1 }, { h: 'Support', r: 1 }, { h: 'Confidence a→b / b→a', r: 1 }, { h: 'Kỳ từ lần gần nhất', r: 1 }, { h: 'p', r: 1 }, { h: 'q (FDR)', r: 1 }];
    var h = '<div class="kpis">' + kpi('Số cặp', fi(p.nPairs), 'mỗi cặp kỳ vọng ' + fd(p.expected, 1) + ' lần cùng ra') +
      kpi('Cặp có p < 5%', fi(p.raw05), 'ngẫu nhiên thuần túy đã cho khoảng ' + fi(p.raw05Expected)) +
      kpi('Còn lại sau hiệu chỉnh', fi(p.fdr05), 'Benjamini–Hochberg (FDR 5%); Bonferroni: ' + p.bonf05, p.fdr05 ? 'bad' : 'good') +
      kpi('Tương quan hai nửa lịch sử', fd(p.halves.corr, 3), 'p = ' + pv(p.halves.p) + '; gần 0 nghĩa là cặp "hay đi cùng" không giữ được') + '</div>';
    h += '<section class="panel block">' + head('Cặp ra cùng nhau nhiều nhất', 'Lift = số lần thực tế chia cho kỳ vọng ' + fd(p.expected, 1) + ' lần (xác suất chuẩn k(k−1)/(M(M−1)) = ' + fpct(p.q0) + ' mỗi kỳ, đã tính việc rút không hoàn lại). Confidence lý thuyết: ' + fpct(p.confTheory) + '.') +
      table(ph, p.top.slice(0, 12).map(prow)) + more('Xem thêm 28 cặp nhiều nhất và 20 cặp ít nhất', table(ph, p.top.slice(12).concat(p.bottom).map(prow), 'tall')) + '</section>';
    var gt = function (g, name) {
      return '<section class="panel">' + head('Bộ ' + name + ' ra cùng nhau nhiều nhất', 'Có ' + fi(g.nGroups) + ' bộ ' + name + ', mỗi bộ kỳ vọng ' + fd(g.expected, g.expected < 1 ? 3 : 2) + ' lần. Xác suất có ít nhất một bộ đạt ' + g.max + ' lần nếu quay ngẫu nhiên: <b>' + pv(g.pMax) + '</b>.') +
        table(['Bộ số', { h: 'Cùng ra', r: 1 }], g.top.slice(0, 6).map(function (r) { return [r.nums.map(pad2).join(' – '), fi(r.c)]; })) +
        '<div style="margin-top:14px">' + U.colChart(g.dist.map(function (d) { return { label: d.c + ' lần', obs: d.obs, exp: d.exp, tip: '<b>Ra cùng nhau ' + d.c + ' lần</b><br>Thực tế: ' + fi(d.obs) + ' bộ<br>Lý thuyết: ' + fd(d.exp, 1) + ' bộ' }; }), { cols: 2, title: 'Phân bố số lần cùng ra', labelW: 46 }) + '</div></section>';
    };
    h += '<div class="grid-2 block">' + gt(t3, 'ba') + gt(t4, 'bốn') + '</div>';
    h += '<section class="panel block">' + head('Độ trùng giữa các kỳ quay', 'So mọi cặp kỳ trong ' + fi(W) + ' kỳ (' + fi(ov.pairs) + ' cặp kỳ): hai kỳ trùng nhau bao nhiêu số, so với phân phối siêu bội.' +
      (ov.identical ? ' Có <b>' + ov.identical + ' cặp kỳ ra giống hệt nhau</b> (kỳ vọng ' + fd(ov.dist[ov.dist.length - 1].exp, 2) + ').' : ' Chưa có hai kỳ nào ra giống hệt nhau.')) +
      table(['Số quả trùng', { h: 'Thực tế (cặp kỳ)', r: 1 }, { h: 'Lý thuyết', r: 1 }], ov.dist.map(function (d) { return [d.m, fi(d.obs), fd(d.exp, d.exp < 10 ? 2 : 0)]; })) + '</section>';
    return h;
  }

  function tabTests(x) {
    var v = x.verdict;
    var h = '<div class="kpis k3">' + kpi('Số phép kiểm định', v.total, 'tất cả cùng được hiệu chỉnh Holm') + kpi('p < 5% khi chưa hiệu chỉnh', v.raw05, 'ngẫu nhiên thuần túy đã cho khoảng ' + fd(v.expectedRaw05, 1)) +
      kpi('Còn lại sau hiệu chỉnh', v.flagged, v.flagged ? 'cần theo dõi thêm khi có nhiều kỳ hơn' : 'không có dấu hiệu bất thường', v.level === 'ok' ? 'good' : 'bad') + '</div>';
    h += '<section class="panel block">' + head('Kết quả từng phép kiểm định', 'p nhỏ nghĩa là dữ liệu khó xảy ra nếu máy quay hoàn toàn ngẫu nhiên. Vì làm nhiều phép thử cùng lúc nên chỉ kết luận theo p đã hiệu chỉnh.') +
      x.tests.map(function (t) {
        return '<div class="check"><span class="v-icon ' + t.level + '" style="width:24px;height:24px;font-size:13px" aria-hidden="true">' + U.LEVEL[t.level].icon + '</span><div><div class="q">' + esc(t.question) + '</div>' +
          '<div class="s">' + esc(t.facts || '') + '</div><div class="m">' + esc(t.method || '') + ' p = ' + pv(t.p) + '; sau hiệu chỉnh: ' + pv(t.pAdj) + '.</div></div>' +
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
    return '<section class="panel"><div class="form-row"><label class="field"><span>Chiến lược</span><select id="dx-strat"' + (X.useW ? ' disabled' : '') + '>' + opts + '</select></label>' +
      '<label class="field"><span>Số bộ</span><select id="dx-count">' + cnt + '</select></label>' +
      '<label class="switch" data-tip="Bật: các bộ sau tránh trùng số và trùng cặp với bộ trước để phủ được nhiều kết quả hơn. Tắt: rút ngẫu nhiên theo điểm, các bộ có thể trùng nhau nhiều."><input type="checkbox" id="dx-div"' + (X.diversify ? ' checked' : '') + '>Tối ưu độ đa dạng</label>' +
      '<div class="field"><span>&nbsp;</span><button class="btn" type="button" id="dx-go">Đề xuất</button></div>' +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="dx-again">Bộ khác</button></div></div>' +
      '<details class="more"' + (X.useW ? ' open' : '') + '><summary>Tự đặt trọng số cho từng thành phần</summary><div><label class="switch"><input type="checkbox" id="dx-usew"' + (X.useW ? ' checked' : '') +
      '>Dùng trọng số bên dưới thay cho chiến lược đã chọn</label><div class="weights">' + sliders + '</div><p class="note" style="margin-top:10px">Điểm của mỗi số = tổng (trọng số × điểm đã chuẩn hóa của thành phần). Trọng số tự đặt chưa qua kiểm chứng; kết quả backtest của từng thành phần có ở mục Kiểm chứng.</p></div></details></section>' +
      '<div id="dx-out" class="block"></div>' +
      '<section class="panel block">' + head('Chấm điểm bộ số của bạn', 'Nhập ' + g.nMain + ' số để xem bộ số đó đứng ở đâu so với các bộ số ngẫu nhiên theo từng tiêu chí.') +
      '<div class="form-row"><label class="field"><span>Các số (cách nhau bằng dấu cách)</span><input class="inp" type="text" inputmode="numeric" id="sc-nums" placeholder="vd: 03 11 19 27 34 42" style="width:260px"></label>' + sp +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="sc-go">Chấm điểm</button></div></div><div id="sc-out" style="margin-top:14px"></div></section>' +
      '<section class="panel block">' + head('Lịch sử dự đoán', 'Các bộ số bạn đã lưu trên máy này, tự đối chiếu khi có kết quả của kỳ tương ứng.') + '<div id="dx-picks"></div></section>';
  };
  function proposeUrl() {
    return '/api/propose?game=' + S.game + '&last=' + S.last + '&strategy=' + (X.useW ? 'custom' : X.strat) + '&count=' + X.count + '&seed=' + X.seed + '&diversify=' + (X.diversify ? 1 : 0) +
      (X.useW ? '&weights=' + encodeURIComponent(JSON.stringify(X.weights)) : '');
  }
  function runPropose() { load(proposeUrl(), '#dx-out', function (r) { X.prop = r; X.prop.game = S.game; return proposeHtml(r); }); }

  function recordHtml(r) {
    var rec = r.record, e = r.expected;
    if (!rec || !e) return '<p class="note" style="margin-top:10px">Chiến lược này chưa có kết quả kiểm chứng riêng.</p>';
    var sig = (rec.pHolm != null && rec.pHolm < 0.05) || (rec.aucPHolm != null && rec.aucPHolm < 0.05);
    return '<div class="facts" style="margin-top:12px">' +
      fact('Số quả trùng trung bình mỗi vé (backtest)', fd(rec.mean, 3) + ' <span class="muted">(ngẫu nhiên: ' + fd(e.hits, 3) + ')</span>') +
      fact('Khoảng tin cậy 95%', fd(rec.ci[0], 3) + ' – ' + fd(rec.ci[1], 3)) +
      fact('p sau hiệu chỉnh nhiều giả thuyết', rec.pHolm == null ? '–' : pv(rec.pHolm)) +
      (rec.auc != null ? fact('Chất lượng xếp hạng (AUC, 0,5 = vô nghĩa)', fd(rec.auc, 4)) : '') +
      fact('Lãi/lỗ giả định', ratio(rec.roi) + ' <span class="muted">(cao hơn ' + fd(rec.mcWonPct * 100, 0) + '% người chơi ngẫu nhiên)</span>') +
      fact('Kết luận', sig ? badge('watch', 'Khác ngẫu nhiên, cần theo dõi') : badge('ok', 'Không khác ngẫu nhiên')) + '</div>';
  }
  function setCard(s, i, g) {
    var k = g.nMain, st = s.structure, sp = s.special ? [s.special] : null;
    var score = s.score != null ? '<div class="set-score" data-tip="Điểm chiến lược: bộ số này hợp với tiêu chí của chiến lược hơn bao nhiêu phần trăm bộ số ngẫu nhiên. KHÔNG phải xác suất trúng."><b>' + fd(s.score * 100, 0) + '</b><small>điểm chiến lược</small></div>' : '';
    var tp = s.topPairs.length ? 'Cặp trong bộ từng ra cùng nhau nhiều nhất: ' + s.topPairs.map(function (p) { return pad2(p.a) + '–' + pad2(p.b) + ' (' + p.c + ' lần)'; }).join(', ') + '; trung bình một cặp: ' + fd(s.pairExpected, 1) + ' lần.' : '';
    return '<div class="set-card"><div class="set-head"><div><span class="tag">Bộ ' + (i + 1) + '</span><div style="margin-top:8px">' + ballsHtml(s.numbers, sp, '') + '</div></div>' + score + '</div>' +
      '<div class="set-meta"><span>Tổng <b>' + st.sum + '</b></span><span>Lẻ/chẵn <b>' + st.odd + '/' + (k - st.odd) + '</b></span><span>Nhỏ/lớn <b>' + st.low + '/' + (k - st.low) + '</b></span><span>Liền nhau <b>' + st.consecutive + '</b></span>' +
      (s.crowd != null ? '<span data-tip="1 = trung bình. Dưới 1: ít người chọn các số này, nếu trúng jackpot thì ít phải chia.">Hệ số đông người <b>×' + fd(s.crowd, 2) + '</b></span>' : '') + '</div>' +
      '<div class="meters">' + s.criteria.map(function (c) { return meter(c.name, c.pct, c.hint + ' Cao hơn ' + fd(c.pct * 100, 0) + '% bộ số ngẫu nhiên.'); }).join('') + '</div>' +
      (tp ? '<p class="note" style="margin-top:10px">' + tp + '</p>' : '') +
      '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" data-check="' + s.numbers.map(pad2).join(' ') + '" data-sp="' + (s.special || '') + '">Kiểm tra bộ này với lịch sử</button></div></div>';
  }
  function proposeHtml(r) {
    var g = U.game(), m = r.strategy, cv = r.coverage, ex = r.exact, sim = r.sim;
    var h = '<section class="panel">' + head(m.name, esc(m.desc)) + '<span class="tag">' + esc(m.group) + '</span>' +
      '<p class="note" style="margin-top:10px"><b>Hạn chế:</b> ' + esc(m.limit) + '</p>' + recordHtml(r) + '</section>';
    h += '<div class="sets block">' + r.sets.map(function (s, i) { return setCard(s, i, g); }).join('') + '</div>';
    h += '<div class="kpis block">' + kpi('Cơ hội giải cao nhất của cả tập', '1 / ' + fi(1 / ex.pJackpot), ex.distinct + ' bộ khác nhau; mỗi bộ ngang nhau') +
      kpi('Có ít nhất 1 bộ trúng giải', fpct(sim.pAny), 'mô phỏng ' + fi(sim.sims) + ' kỳ, sai số ±' + fpct(1.96 * sim.se)) +
      kpi('Số được phủ', cv.numbers + ' / ' + cv.numbersTotal, 'cặp số được phủ: ' + fpct(cv.pairsPct)) +
      kpi('Trùng nhau giữa hai bộ', fd(cv.meanOverlap, 2) + ' số', 'hai bộ ngẫu nhiên trùng ' + fd(cv.randomOverlap, 2) + ' số; nhiều nhất: ' + cv.maxOverlap) + '</div>';
    h += '<div class="block" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn" id="dx-save">Lưu để đối chiếu với kỳ #' + pad5(r.nextNo) + '</button>' +
      '<span class="note">Chi phí: ' + money(ex.cost) + '. Tiền thưởng kỳ vọng của các hạng cố định: ' + money(ex.expectedFixed) + ' (không đổi theo cách chọn số).</span></div>';
    if (r.ranking) {
      h += '<section class="panel block">' + head('Xếp hạng các số theo chiến lược', 'Điểm chỉ có ý nghĩa so sánh trong cùng chiến lược.') + more('Mở bảng xếp hạng', table(['Hạng', 'Số', { h: 'Điểm', r: 1 }], r.ranking.map(function (o, i) {
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
      $('#dx-picks').html((done ? '<div class="facts" style="margin-bottom:12px">' + fact('Đã có kết quả', done + ' lần lưu') + fact('Tổng chi giả định', money(cost)) + fact('Tổng thưởng giả định', money(prize)) + '</div>' : '') +
        table(['Kỳ', 'Chiến lược', { h: 'Số bộ', r: 1 }, 'Kết quả', { h: 'Trùng nhiều nhất', r: 1 }, 'Giải cao nhất', { h: 'Thưởng', r: 1 }, ''], rows));
    }).fail(function (m) { $('#dx-picks').html('<div class="alert error">' + esc(m) + '</div>'); });
  }

  /* ============================================================ TỐI ƯU NHIỀU VÉ */
  U.render['nhieu-ve'] = function () {
    var opts = '<option value="">Không ưu tiên số nào (thuần độ bao phủ)</option>' + strategies().filter(function (s) { return s.id !== 'random' && s.id !== 'balanced'; }).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === X.pfStrat ? ' selected' : '') + '>Ưu tiên theo: ' + esc(s.name) + '</option>';
    }).join('');
    return '<section class="panel"><div class="form-row"><label class="field"><span>Ngân sách (đồng)</span><input class="inp" type="number" id="pf-budget" min="10000" max="2000000" step="10000" value="' + X.budget + '"></label>' +
      '<label class="field"><span>Ưu tiên số</span><select id="pf-strat">' + opts + '</select></label>' +
      '<div class="field"><span>&nbsp;</span><button class="btn" type="button" id="pf-go">Tính phương án</button></div>' +
      '<div class="field"><span>&nbsp;</span><button class="btn btn-light" type="button" id="pf-again">Phương án khác</button></div></div>' +
      '<p class="note" style="margin-top:12px">So sánh ba cách dùng cùng một số tiền. Với máy quay công bằng: cơ hội giải cao nhất và tiền thưởng kỳ vọng của ba cách <b>bằng nhau</b>; khác nhau ở chỗ bao lâu thì có vé trúng và mỗi lần trúng bao nhiêu vé.</p></section>' +
      '<div id="pf-out" class="block"></div>';
  };
  function runPortfolio() {
    var n = Math.max(1, Math.min(200, Math.floor((+$('#pf-budget').val() || X.budget) / 10000)));
    X.budget = n * 10000;
    load('/api/portfolio?game=' + S.game + '&n=' + n + '&strategy=' + X.pfStrat + '&seed=' + X.pfSeed, '#pf-out', function (r) { X.pf = r; return portfolioHtml(r); });
  }
  function portfolioHtml(r) {
    var g = U.game(), v0 = r.variants[0];
    var h = '<div class="kpis k3">' + kpi('Số vé', fi(r.n), 'chi phí ' + money(r.cost)) + kpi('Cơ hội giải cao nhất', '1 / ' + fi(1 / v0.exact.pJackpot), 'như nhau với mọi tập ' + r.n + ' vé khác nhau') +
      kpi('Tiền thưởng kỳ vọng (hạng cố định)', money(v0.exact.expectedFixed), ratio(v0.exact.expectedFixed / r.cost) + ' số tiền bỏ ra, như nhau ở cả ba cách') + '</div>';
    h += '<div class="grid-3 block">' + r.variants.map(function (v) {
      var c = v.coverage, s = v.sim, wd = s.winnersDist, three = 0;
      for (var i = 3; i < wd.length; i++) three += wd[i];
      return '<section class="panel">' + head(v.name, esc(v.note)) + '<div class="facts">' +
        fact('Có ít nhất 1 vé trúng', '<b>' + fpct(s.pAny) + '</b> <span class="muted">±' + fpct(1.96 * s.se) + '</span>') +
        fact('Số được phủ', c.numbers + ' / ' + c.numbersTotal) + fact('Cặp số được phủ', fi(c.pairs) + ' <span class="muted">(' + fpct(c.pairsPct) + ')</span>') +
        (c.specialsTotal ? fact('Số đặc biệt được phủ', c.specials + ' / ' + c.specialsTotal) : '') +
        fact('Trùng nhau giữa hai vé (TB / nhiều nhất)', fd(c.meanOverlap, 2) + ' / ' + c.maxOverlap) +
        fact('Số vé khác nhau', c.distinct + (c.duplicates ? ' (' + c.duplicates + ' vé trùng)' : '')) +
        fact('Kỳ có đúng 1 vé trúng', fpct(wd[1] || 0)) + fact('Kỳ có 2 vé trúng', fpct(wd[2] || 0)) + fact('Kỳ có từ 3 vé trúng', fpct(three)) +
        fact('Thưởng TB mỗi kỳ (mô phỏng)', money(s.meanPrize)) + fact('Dao động của tiền thưởng', money(s.sdPrize)) + '</div>' +
        more('Xem ' + v.tickets.length + ' vé', '<div class="mini-list">' + v.tickets.map(function (t) { return '<div>' + ballsHtml(t.numbers, t.special ? [t.special] : null, 'sm') + '</div>'; }).join('') + '</div>') +
        '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" data-pf-save="' + v.id + '">Lưu tập này để đối chiếu</button></div></section>';
    }).join('') + '</div>';
    h += '<p class="note block">Xác suất "có ít nhất 1 vé trúng" tính bằng mô phỏng ' + fi(r.sims) + ' kỳ quay ngẫu nhiên có hạt giống cố định (lặp lại được). Phủ rộng trúng thường xuyên hơn; tập trung hiếm trúng hơn nhưng khi trúng thì nhiều vé cùng trúng. ' +
      (U.specialPick(g) ? 'Với ' + esc(g.label) + ', mua ' + g.bonusMax + ' vé mang đủ ' + g.bonusMax + ' số đặc biệt khác nhau thì kỳ nào cũng có ít nhất một vé trúng (ít nhất là giải Khuyến Khích).' : '') + '</p>';
    return h;
  }

  /* ============================================================ KIỂM CHỨNG (BACKTEST) */
  U.render['kiem-chung'] = function () { return '<div id="bt-body">' + SKEL + '</div>'; };
  function loadBacktest() { load('/api/insight?game=' + S.game, '#bt-body', function (ins) { X.ins = ins; return backtestHtml(ins.backtest); }); }
  function curveHtml(bt) {
    var s = bt.strategies.filter(function (o) { return o.id === X.curve; })[0] || bt.strategies[0], n = s.curve.length;
    var pts = s.curve.map(function (v, i) { return [i + 1, v]; }), band = bt.baseline.envelope.map(function (e, i) { return [i + 1, -e, e]; });
    return lineChart([{ pts: pts }], { band: band, ref: 0, title: 'Tích lũy số quả trùng vượt kỳ vọng', xTicks: [[1, fdate(bt.from)], [n, fdate(bt.to)]] }) +
      '<div class="legend"><span><span class="sw" style="background:var(--obs);border-color:var(--obs)"></span>' + esc(s.name) + ': tổng (số quả trùng − kỳ vọng)</span><span><span class="sw" style="background:#e8f0fb"></span>Vùng dao động 95% của ngẫu nhiên</span></div>';
  }
  function backtestHtml(bt) {
    if (!bt) return '<div class="alert info">Chưa đủ số kỳ để kiểm chứng.</div>';
    var e = bt.expected, base = bt.baseline, real = bt.strategies.filter(function (s) { return s.id !== 'random'; });
    var h = '<div class="kpis">' + kpi('Số kỳ kiểm chứng', fi(bt.draws), fdate(bt.from) + ' – ' + fdate(bt.to) + '; ' + bt.warmup + ' kỳ đầu chỉ dùng để khởi động') +
      kpi('Kỳ vọng của vé ngẫu nhiên', fd(e.hits, 3) + ' quả/vé', 'chính xác: k²/M; ' + fpct(e.pAny) + ' số vé trúng một giải nào đó') +
      kpi('Chiến lược vượt ngẫu nhiên', bt.significant.length + ' / ' + real.length, 'sau hiệu chỉnh Holm trên ' + real.length + ' chiến lược', bt.significant.length ? 'bad' : 'good') +
      kpi('Mốc ngẫu nhiên', fi(bt.sims) + ' người chơi', 'lãi/lỗ trung vị ' + ratio(base.roi.median) + ' (95%: ' + ratio(base.roi.lo) + ' đến ' + ratio(base.roi.hi) + ')') + '</div>';
    h += '<section class="panel block">' + head('Số quả trùng trung bình mỗi vé', 'Mỗi kỳ, mỗi chiến lược chọn 1 vé chỉ từ dữ liệu trước kỳ đó. Chấm = trung bình, thanh = khoảng tin cậy 95%, vạch đứt = kỳ vọng ngẫu nhiên ' + fd(e.hits, 3) + ', dải nền = 95% người chơi ngẫu nhiên.') +
      ciChart(bt.strategies.map(function (s) {
        return { label: s.name, v: s.mean, lo: s.ci[0], hi: s.ci[1], hl: s.id === 'random', tip: '<b>' + esc(s.name) + '</b><br>Trung bình ' + fd(s.mean, 4) + ' quả/vé<br>z = ' + zf(s.z) + ', p = ' + pv(s.p) + (s.pHolm != null ? '<br>p hiệu chỉnh = ' + pv(s.pHolm) : '') };
      }), e.hits, { band: [base.hits.lo, base.hits.hi], title: 'Số quả trùng trung bình', fmt: function (t) { return fd(t, 3); } }) + '</section>';
    h += '<section class="panel block">' + head('Bảng kết quả từng chiến lược', 'AUC đo cả bảng xếp hạng các số (0,5 = không có giá trị dự báo). "Hơn ngẫu nhiên" = tỷ lệ người chơi ngẫu nhiên có tiền thưởng không cao hơn. "Kiểm chứng độc lập" = z ở 30% kỳ cuối.') +
      table(['Chiến lược', { h: 'Quả trùng/vé', r: 1 }, { h: 'z', r: 1 }, { h: 'p', r: 1 }, { h: 'p hiệu chỉnh', r: 1 }, { h: 'AUC', r: 1 }, { h: 'Vé trúng', r: 1 }, { h: 'Thưởng', r: 1 }, { h: 'Lãi/lỗ', r: 1 }, { h: 'Hơn ngẫu nhiên', r: 1 }, { h: 'Kiểm chứng độc lập (z)', r: 1 }],
        bt.strategies.map(function (s) {
          return [esc(s.name) + ' <span class="tag">' + esc(s.group) + '</span>', fd(s.mean, 3), { v: zf(s.z), c: zCls(s.z) }, pv(s.p), s.pHolm == null ? '–' : { v: pv(s.pHolm), c: s.pHolm < 0.05 ? 'hot-1' : '' },
            s.auc == null ? '–' : fd(s.auc, 4), '<span class="num">' + fi(s.wins) + ' <span class="muted">(' + fpct(s.winRate) + ')</span></span>', '<span class="num">' + moneyShort(s.won) + '</span>', ratio(s.roi), fd(s.mcWonPct * 100, 0) + '%', { v: zf(s.hold.z), c: zCls(s.hold.z) }];
        })) + '</section>';
    var sel = bt.selection;
    h += '<div class="grid-2 block"><section class="panel">' + head('Đường tích lũy theo thời gian', 'Nếu chiến lược có lợi thế thật, đường sẽ đi lên đều và thoát khỏi vùng dao động của ngẫu nhiên.',
      '<select id="bt-curve">' + bt.strategies.map(function (s) { return '<option value="' + s.id + '"' + (s.id === X.curve ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>') +
      '<div id="bt-curve-out">' + curveHtml(bt) + '</div></section>' +
      '<section class="panel">' + head('Chọn chiến lược "tốt nhất" rồi kiểm chứng lại', 'Thử nhiều chiến lược thì luôn có cái trông tốt. Phép thử công bằng: chọn theo ' + fi(sel.trainDraws) + ' kỳ đầu, rồi xem nó làm được gì ở ' + fi(sel.holdDraws) + ' kỳ cuối chưa từng dùng.') +
      '<div class="facts">' + fact('Tốt nhất ở giai đoạn dò tìm', esc(sel.name)) + fact('z ở giai đoạn dò tìm', zf(sel.trainZ)) + fact('z ở giai đoạn kiểm chứng độc lập', zf(sel.holdZ)) + fact('p ở giai đoạn kiểm chứng', pv(sel.holdP)) +
      fact('Kết luận', sel.holdP < 0.05 && sel.holdZ > 0 ? badge('watch', 'Giữ được lợi thế, cần theo dõi') : badge('ok', 'Lợi thế biến mất khi kiểm chứng')) + '</div></section></div>';
    h += '<section class="panel block">' + head('Tính ổn định qua 4 giai đoạn', 'z của số quả trùng trong từng phần tư của thời gian kiểm chứng. Chiến lược có giá trị thật phải dương ổn định; đổi dấu qua lại là dao động ngẫu nhiên.') +
      table(['Chiến lược'].concat(bt.strategies[0].segments.map(function (sg) { return { h: fdate(sg.from).slice(3) + ' – ' + fdate(sg.to).slice(3), r: 1 }; })), bt.strategies.map(function (s) {
        return [esc(s.name)].concat(s.segments.map(function (sg) { return { v: zf(sg.z), c: U.heatClass(sg.z) }; }));
      })) + '</section>';
    var pf = bt.portfolio;
    h += '<div class="grid-2 block"><section class="panel">' + head('Danh mục ' + pf.tickets + ' vé mỗi kỳ: phủ rộng so với ngẫu nhiên', 'Phủ rộng = ' + pf.tickets + ' vé không trùng số nhau. Đây là hiệu ứng có thật của độ bao phủ, nhưng không làm tăng tiền thưởng kỳ vọng.') +
      '<div class="facts">' + fact('Kỳ có ít nhất 1 vé trúng (phủ rộng)', '<b>' + fpct(pf.spread.anyRate) + '</b> <span class="muted">(' + fpct(pf.spread.anyCi[0]) + ' – ' + fpct(pf.spread.anyCi[1]) + ')</span>') +
      fact('Cùng số vé chọn ngẫu nhiên độc lập', fpct(pf.random.anyRate.median) + ' <span class="muted">(95%: ' + fpct(pf.random.anyRate.lo) + ' – ' + fpct(pf.random.anyRate.hi) + ')</span>') +
      fact('Lý thuyết cho vé độc lập', fpct(pf.random.anyTheory)) + fact('Lãi/lỗ phủ rộng', ratio(pf.spread.roi)) + fact('Lãi/lỗ ngẫu nhiên (trung vị)', ratio(pf.random.roi.median)) + '</div></section>';
    if (bt.timing && bt.timing.roi) {
      var tm = bt.timing;
      h += '<section class="panel">' + head('Chiến lược thời điểm: chỉ mua ở kỳ chia giải', 'Quy tắc chỉ dùng thông tin biết trước kỳ quay. Mỗi kỳ chia giải mua ' + tm.perDraw + ' vé ngẫu nhiên; mô phỏng nhiều người chơi.') +
        '<div class="facts">' + fact('Số kỳ được xác định là kỳ chia giải', tm.draws + ' <span class="muted">(' + tm.rolled + ' kỳ thực sự chia, ' + (tm.draws - tm.rolled) + ' kỳ có người trúng Độc Đắc)</span>') +
        fact('Tổng chi', money(tm.cost)) + fact('Lãi/lỗ trung bình', ratio(tm.roi.mean)) + fact('Lãi/lỗ trung vị', ratio(tm.roi.median)) + fact('Khoảng 95%', ratio(tm.roi.lo) + ' đến ' + ratio(tm.roi.hi)) +
        fact('Tỷ lệ người chơi có lãi', fpct(tm.pProfit)) + fact('So với mua mọi kỳ (trung vị)', ratio(base.roi.median)) + '</div></section>';
    } else {
      h += '<section class="panel">' + head('Phương pháp', 'Cách kiểm chứng được thiết kế để không tự lừa mình.') + '<div class="facts">' +
        fact('Dữ liệu dùng để chọn số ở kỳ t', 'chỉ các kỳ trước t') + fact('Trọng số ensemble, độ ưa chuộng', 'cũng chỉ tính từ các kỳ trước t') + fact('Tiền thưởng', 'theo bảng giải thật của từng kỳ') +
        fact('Mốc so sánh', fi(bt.sims) + ' người chơi ngẫu nhiên trên đúng các kỳ đó') + fact('Hiệu chỉnh', 'Holm và Benjamini–Hochberg') + fact('Hạt giống mô phỏng', bt.seed + ' (kết quả lặp lại được)') + '</div></section>';
    }
    h += '</div><p class="note block">Kết luận chỉ có giá trị thống kê cho số quả trùng và các giải nhỏ. Jackpot quá hiếm (trong ' + fi(bt.draws) + ' vé, kỳ vọng số lần trúng gần bằng 0) nên không dữ liệu lịch sử nào đủ để đánh giá khả năng trúng jackpot của một chiến lược.</p>';
    return h;
  }

  /* ============================================================ XÁC SUẤT & KỲ VỌNG */
  U.render['xac-suat'] = function () { return '<div id="pr-body">' + SKEL + '</div>'; };
  function loadProb() {
    load(['/api/prob?game=' + S.game, '/api/insight?game=' + S.game], '#pr-body', function (pr, ins) { X.pr = pr; return probHtml(pr, ins); });
  }
  function probHtml(pr, ins) {
    var g = U.game(), ev = pr.ev, hs = pr.history.summary, fc = pr.forecast;
    var h = '<div class="kpis">' + kpi('Số vé khác nhau có thể có', fi(pr.total), 'mỗi vé có cùng xác suất') + kpi('Trúng một giải bất kỳ', fpct(pr.pAny), 'khoảng 1 trong ' + fd(1 / pr.pAny, 1) + ' vé') +
      kpi('Kỳ vọng 1 vé kỳ tới', money(ev.net.ev), ratio(ev.net.ratio) + ' giá vé (sau thuế, có tính chia jackpot)') +
      kpi('Jackpot để hòa vốn', ev.breakEvenNet ? moneyShort(ev.breakEvenNet) : 'không đạt được', 'chưa thuế, không ai cùng trúng: ' + (ev.breakEven ? moneyShort(ev.breakEven) : '–')) + '</div>';
    h += '<section class="panel block">' + head('Xác suất chính xác từng hạng giải', 'Đếm bằng tổ hợp (phân phối siêu bội). Giá trị giải tích lũy của kỳ tới là ước tính từ các kỳ gần nhất; số vé bán ra ước tính: ' + fi(fc.tickets) + ' vé.') +
      table(['Hạng giải', { h: 'Số vé trúng / ' + fi(pr.total), r: 1 }, { h: 'Xác suất', r: 1 }, { h: '1 trên', r: 1 }, { h: 'Giá trị kỳ tới', r: 1 }, { h: 'Đóng góp vào kỳ vọng', r: 1 }], pr.tiers.map(function (t, i) {
        return [esc(t.name) + (t.jackpot ? ' <span class="tag">tích lũy</span>' : ''), fi(t.ways), fprob(t.p), fi(t.oneIn), moneyShort(ev.net.parts[i].value), money(ev.net.parts[i].ev)];
      }).concat([['<b>Không trúng</b>', fi(Math.round(pr.pNone * pr.total)), fpct(pr.pNone), '', '', '']])) +
      '<div class="facts" style="margin-top:14px">' + fact('Kỳ vọng danh nghĩa (chưa thuế, không ai cùng trúng)', money(ev.nominal.ev) + ' = ' + ratio(ev.nominal.ratio) + ' giá vé') +
      fact('Có tính khả năng chia jackpot', money(ev.shared.ev) + ' = ' + ratio(ev.shared.ratio)) + fact('Sau thuế 10% phần vượt 10 triệu', money(ev.net.ev) + ' = ' + ratio(ev.net.ratio)) +
      fact('Riêng các hạng cố định', ratio(ev.nominal.fixedRatio) + ' giá vé') + '</div>' +
      '<div class="set-actions"><button type="button" class="btn btn-light btn-sm" id="pr-verify">Kiểm chứng công thức bằng mô phỏng 300.000 vé</button></div><div id="pr-verify-out" style="margin-top:12px"></div></section>';

    if (fc.rolldown) {
      var st = fc.rolldown, rs = fc.rollStats || {};
      h += '<section class="panel block">' + head('Kỳ chia giải', 'Khi Độc Đắc vượt ' + moneyShort(st.over) + ' mà chưa ai trúng, kỳ quay ' + esc(st.rollTime) + ' của ngày kế tiếp là kỳ chia giải: nếu vẫn không ai trúng Độc Đắc thì toàn bộ Độc Đắc chia cho các hạng dưới (Nhất 1/3; Nhì, Ba, Tư, Năm mỗi hạng 1/6).') +
        (st.pending ? '<div class="callout" style="margin-bottom:14px"><h3>Sắp tới: ' + esc(st.rollTime) + ' ngày ' + fdate(st.rollDate) + ', kỳ #' + pad5(st.rollNo) + '</h3><p>Còn ' + st.drawsLeft + ' kỳ nữa. Độc Đắc hiện tại ' + moneyShort(st.jackpot) +
          '. Kỳ này chỉ thành kỳ chia giải nếu từ giờ đến đó không ai trúng Độc Đắc.</p></div>' : '<p class="note" style="margin-bottom:12px">Hiện chưa có kỳ chia giải nào được xác định. Độc Đắc đang ở ' + moneyShort(st.jackpot) + '.</p>') +
        '<div class="facts">' + fact('Số kỳ từng được xác định là kỳ chia giải', (rs.count || 0) + ' <span class="muted">(' + (rs.rolled || 0) + ' kỳ thực sự chia, còn lại có người trúng Độc Đắc)</span>') +
        fact('Kỳ vọng trung bình ở các kỳ đó', ratio(hs.meanRatioRoll) + ' giá vé <span class="muted">(kỳ thường: ' + ratio(hs.meanRatioNormal) + ')</span>') +
        fact('Doanh số gần đây ở kỳ chia giải', fi(rs.tickets || 0) + ' vé <span class="muted">(kỳ thường: ' + fi(fc.tickets) + ' vé)</span>') + '</div>';
      if (pr.rollScenarios) {
        h += '<h3 style="margin-top:18px">Kỳ vọng của 1 vé ở kỳ chia giải sắp tới theo số vé bán ra</h3><p class="note" style="margin:6px 0 10px">Độc Đắc trước kỳ đó ước ' + moneyShort(pr.rollBefore) + ', cộng thêm khoảng ' + ratio(rs.rate || 0.37) +
          ' doanh thu của chính kỳ đó. Càng nhiều người mua thì phần chia cho mỗi vé càng nhỏ.</p>' +
          table([{ h: 'Số vé bán ra', r: 1 }, { h: 'Độc Đắc', r: 1 }, { h: 'Không ai trúng Độc Đắc', r: 1 }, { h: 'Kỳ vọng (chưa thuế)', r: 1 }, { h: 'Kỳ vọng (sau thuế)', r: 1 }], pr.rollScenarios.map(function (s) {
            return [fi(s.tickets), moneyShort(s.jackpot), fpct(s.pNoJackpot), { v: ratio(s.ratio), c: s.ratio >= 1 ? 'hot-1' : '' }, { v: ratio(s.net), c: s.net >= 1 ? 'hot-1' : '' }];
          }));
      }
      h += '<p class="note" style="margin-top:12px">Kỳ vọng cao không có nghĩa là dễ có lãi: phần lớn giá trị nằm ở các giải rất hiếm (Độc Đắc, giải Nhất), nên đa số người mua ít vé vẫn lỗ. Xem phần "Chiến lược thời điểm" ở mục Kiểm chứng để biết kết quả mô phỏng thực tế.</p></section>';
    }
    if (pr.cap) {
      h += '<div class="alert info block">Quy định trần của ' + esc(g.label) + ': khi ' + esc(pr.tiers[pr.cap.tier].name) + ' vượt ' + moneyShort(pr.cap.max) + ' mà kỳ đó không ai trúng nhưng có người trúng ' + esc(pr.tiers[pr.cap.to].name) +
        ', toàn bộ phần vượt được cộng cho ' + esc(pr.tiers[pr.cap.to].name) + '. Công thức kỳ vọng ở trên đã tính quy định này.</div>';
    }
    // lịch sử kỳ vọng
    var ser = pr.history.series, step = Math.max(1, Math.floor(ser.length / 700)), pts = [], marks = [];
    ser.forEach(function (r, i) { if (i % step === 0 || r[1] >= 1 || r[2]) pts.push([r[0], Math.min(r[1], 3)]); if (r[2]) marks.push([r[0], Math.min(r[1], 3)]); });
    var best = hs.best.slice(0, 8);
    h += '<section class="panel block">' + head('Kỳ vọng của một vé qua từng kỳ đã quay', 'Tỷ lệ kỳ vọng / giá vé, tính từ bảng giải thật và số vé bán ra ước tính của từng kỳ (có tính khả năng chia jackpot, chưa trừ thuế). Vạch đứt = hòa vốn (100%).' + (marks.length ? ' Chấm đỏ = kỳ chia giải.' : '')) +
      lineChart([{ pts: pts }], { ref: 1, marks: marks, title: 'Kỳ vọng theo kỳ', yFmt: function (v) { return fd(v * 100, 0) + '%'; }, xTicks: [[ser[0][0], fdate(ser[0][5])], [ser[ser.length - 1][0], fdate(ser[ser.length - 1][5])]] }) +
      '<div class="kpis block" style="margin-top:16px">' + kpi('Kỳ vọng trung bình', ratio(hs.meanRatio), 'trên ' + fi(hs.draws) + ' kỳ') + kpi('Số kỳ kỳ vọng ≥ 100%', fi(hs.above1), fpct(hs.above1 / hs.draws) + ' số kỳ') +
      kpi('Tỷ lệ trả thưởng thực tế', ratio(hs.payout), 'tổng tiền trả / doanh thu ước tính (quy định: 55%)') + kpi('Vé bán ra gần đây', fi(hs.meanTickets), 'trung bình 30 kỳ gần nhất') + '</div>' +
      '<h3 style="margin-top:18px">Những kỳ có kỳ vọng cao nhất</h3>' + table(['Kỳ', 'Ngày', { h: 'Giải cao nhất', r: 1 }, { h: 'Vé bán ra (ước)', r: 1 }, { h: 'Kỳ vọng', r: 1 }, ''], best.map(function (b) {
        return ['#' + pad5(b.no), fdate(b.date), moneyShort(b.jackpot), fi(b.tickets), ratio(b.ratio), b.rolldown ? '<span class="tag">chia giải</span>' : b.jackpotWon ? '<span class="tag">có người trúng</span>' : ''];
      })) + '</section>';
    h += '<section class="panel block">' + head('Mua nhiều vé khác nhau', 'Cơ hội giải cao nhất tăng đúng tỷ lệ với số vé khác nhau. Cột "ít nhất 1 vé trúng" tính cho các vé chọn độc lập; mục Tối ưu nhiều vé cho thấy phủ rộng làm tăng con số này.') +
      table([{ h: 'Số vé', r: 1 }, { h: 'Chi phí', r: 1 }, { h: 'Giải cao nhất', r: 1 }, { h: 'Ít nhất 1 vé trúng', r: 1 }, { h: 'Số vé trúng kỳ vọng', r: 1 }], pr.multi.map(function (m) {
        return [fi(m.n), money(m.cost), '1 / ' + fi(1 / m.pJackpot), fpct(m.pAny), fd(m.prizes, 2)];
      })) + '</section>';
    if (ins && ins.popularity) h += popularityHtml(ins.popularity, g, fc.tickets, pr);
    return h;
  }
  function popularityHtml(p, g, tickets, pr) {
    var cells = p.numbers.map(function (x) {
      var z = Math.log(x.index) / 0.07; // thang màu: mỗi nấc ~7% độ ưa chuộng
      return { n: x.n, val: '×' + fd(x.index, 2), cls: U.heatClass(z), tip: '<b>Số ' + pad2(x.n) + '</b><br>Độ ưa chuộng ×' + fd(x.index, 2) + ' (khoảng 95%: ' + fd(x.lo, 2) + ' – ' + fd(x.hi, 2) + ')<br>' + (x.q < 0.05 ? 'Khác trung bình có ý nghĩa thống kê' : 'Chưa đủ chắc chắn là khác trung bình') };
    });
    var srt = p.numbers.slice().sort(function (a, b) { return b.index - a.index; }), k = g.nMain;
    var lam = tickets * pr.tiers[0].p, share = function (c) { var l = lam * c; return l > 1e-9 ? (1 - Math.exp(-l)) / l : 1; };
    var h = '<section class="panel block">' + head('Số nào được nhiều người chọn', 'Ước lượng từ số giải thực tế của ' + fi(p.draws) + ' kỳ: kỳ nào ra các số được ưa chuộng thì tỷ lệ vé trùng 4 số so với trùng 3 số cao hơn lý thuyết. ×1,00 = trung bình. Độ ưa chuộng không ảnh hưởng xác suất trúng, chỉ ảnh hưởng việc phải chia jackpot.') +
      grid(cells) + HEAT_LEGEND +
      '<div class="grid-2" style="margin-top:16px">' + numList('Được chọn nhiều nhất', srt.slice(0, 6), function (x) { return '×' + fd(x.index, 2) + ' <span class="muted">(' + fd(x.lo, 2) + ' – ' + fd(x.hi, 2) + ')</span>'; }) +
      numList('Ít người chọn nhất', srt.slice(-6).reverse(), function (x) { return '×' + fd(x.index, 2) + ' <span class="muted">(' + fd(x.lo, 2) + ' – ' + fd(x.hi, 2) + ')</span>'; }) + '</div>' +
      '<div class="facts" style="margin-top:16px">' + fact('Kiểm chứng 1: hai nửa lịch sử cho kết quả giống nhau', 'tương quan ' + fd(p.halvesCorr, 2)) +
      fact('Kiểm chứng 2: hệ số nửa đầu dự báo nửa sau', 'tương quan ' + fd(p.oosCorr, 2)) + fact('Số có độ ưa chuộng khác trung bình (FDR 5%)', p.significant + ' / ' + p.numbers.length) +
      fact('Bộ ' + k + ' số đông người nhất / vắng người nhất', '×' + fd(p.crowdMax, 2) + ' / ×' + fd(p.crowdMin, 2)) +
      fact('Phần jackpot nhận được nếu trúng (vé trung bình)', fpct(share(1))) + fact('Nếu chọn bộ vắng người nhất / đông người nhất', fpct(share(p.crowdMin)) + ' / ' + fpct(share(p.crowdMax))) + '</div>';
    if (p.special) {
      h += '<h3 style="margin-top:18px">Số đặc biệt được chọn nhiều hay ít</h3><p class="note" style="margin:6px 0 10px">Tỷ lệ vé chọn từng số đặc biệt, suy ra từ số giải có và không có số đặc biệt. Chọn đều thì mỗi số chiếm ' + fpct(1 / g.bonusMax) + '.</p>' +
        U.rankList(p.special.map(function (s) { return { label: U.ball(s.s, 'sm special'), value: s.share, text: fpct(s.share), tip: 'Số đặc biệt ' + s.s + ': ' + fpct(s.share) + ' số vé' }; }), { ref: 1 / g.bonusMax, refLabel: 'Mức nếu mọi số được chọn đều nhau' });
    }
    return h + '<p class="note" style="margin-top:12px">Đây là kết quả duy nhất trong ứng dụng có giá trị dự báo đã kiểm chứng ngoài mẫu, vì nó đo thói quen của người chơi chứ không đo máy quay. Chọn số ít người chọn không làm bạn dễ trúng hơn; nó chỉ giúp phần thưởng lớn hơn nếu trúng jackpot.</p></section>';
  }
  function runVerify() {
    $('#pr-verify-out').html(SKEL);
    U.getJson('/api/prob-verify?game=' + S.game + '&sims=300000').done(function (r) {
      $('#pr-verify-out').html('<div class="fade-in">' + table(['Hạng giải', { h: 'Công thức', r: 1 }, { h: 'Mô phỏng', r: 1 }, { h: 'Lệch (σ)', r: 1 }], r.tiers.map(function (t) {
        var z = t.se > 0 ? (t.obs - t.p) / t.se : 0;
        return [esc(t.name), fprob(t.p), fprob(t.obs), { v: zf(z), c: Math.abs(z) > 3 ? 'hot-2' : '' }];
      }).concat([['<b>Trúng một giải bất kỳ</b>', fpct(r.pAny), fpct(r.obsAny), zf((r.obsAny - r.pAny) / r.seAny)]])) +
        '<p class="note" style="margin-top:8px">' + fi(r.sims) + ' kỳ quay ngẫu nhiên. Lệch trong khoảng ±3σ là khớp; các hạng quá hiếm có thể không xuất hiện lần nào trong mô phỏng.</p></div>');
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
