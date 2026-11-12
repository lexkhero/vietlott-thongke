/* Thống kê Vietlott - giao diện cho 4 giải bổ sung: Max 3D, Max 3D Pro, Keno, Bingo18.
 * Dữ liệu tính sẵn lúc dựng (data/x-<mã>.json). app.js gọi window.VLX khi giải đang chọn có cờ x. */
(function ($) {
  'use strict';
  var U = window.VLUI, esc = U.esc, fi = U.fi, fd = U.fd, fpct = U.fpct, fdate = U.fdate, head = U.head, badge = U.badge;
  var term = U.term, qm = U.qm, howto = U.howto;

  var SECTIONS = [
    { id: 'tong-quan', label: 'Tổng quan', sub: 'Kết quả mới nhất, máy quay có ngẫu nhiên không và số lần ra của từng số.' },
    { id: 'phan-tich', label: 'Phân tích', sub: 'Các phép kiểm tra độ ngẫu nhiên, nói bằng lời dễ hiểu.' },
    { id: 'xac-suat', label: 'Xác suất & tiền thưởng', sub: 'Cơ hội trúng từng giải và trung bình một vé nhận lại bao nhiêu.' },
    { id: 'kiem-chung', label: 'Kiểm chứng', sub: 'Thử các cách chọn số trên các kỳ đã quay (chỉ dùng dữ liệu trước mỗi kỳ) rồi so với chọn bừa.' },
    { id: 'the-le', label: 'Thể lệ & cách chơi', sub: 'Cách chơi và bảng giải theo thể lệ của Vietlott.' },
    { id: 'lich-su', label: 'Lịch sử kết quả', sub: 'Kết quả 60 kỳ quay gần nhất.' },
    { id: 'thuat-ngu', label: 'Giải thích thuật ngữ', sub: 'Các từ dùng trong ứng dụng, giải thích bằng lời thường kèm ví dụ.' }
  ];
  var TAB_MAIN = [['tong-quan', 'Tổng quan'], ['phan-tich', 'Phân tích'], ['xac-suat', 'Xác suất'], ['kiem-chung', 'Kiểm chứng']];

  /* ---------------------------------------------------------------- tiện ích */
  function kpi(k, v, sub) { return '<div class="kpi"><span class="k">' + k + '</span><b>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function fact(k, v) { return '<div class="fact"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function table(heads, rows) {
    var hs = heads.map(function (h) { return typeof h === 'string' ? { h: h } : h; });
    return '<div class="table-wrap"><table class="data"><thead><tr>' + hs.map(function (h) { return '<th' + (h.r ? ' class="r"' : '') + '>' + esc(h.h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (hs[i].r ? ' class="r"' : '') + ' data-label="' + esc(hs[i].h) + '">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function money(v) { return fi(v) + 'đ'; }
  function oneIn(p) { return p > 0 ? '1 trên ' + fi(1 / p) : '–'; }
  function pct(p) { var v = p * 100; return fd(v, v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.01 ? 3 : 6) + '%'; }
  function back(rtp) { return money(Math.round(rtp * 10000 / 10) * 10); }
  function tri(n) { return ('00' + n).slice(-3); }
  function triChip(n) { return '<span class="tri">' + tri(n) + '</span>'; }
  function die(n) { return '<span class="ball sm die">' + n + '</span>'; }
  function drawHtml(g, d) {
    if (g.kind === 'keno') return '<span class="balls">' + d.nums.map(function (n) { return U.ball(n, 'sm'); }).join('') + '</span>';
    if (g.kind === 'bingo') return '<span class="balls">' + d.nums.map(die).join('') + '</span><span class="sum-chip">Tổng ' + (d.nums[0] + d.nums[1] + d.nums[2]) + '</span>';
    return '<span class="tri-line">' + d.nums.slice(0, 2).map(triChip).join('') + '</span>';
  }
  var GRP = [['Giải Đặc biệt', 0, 2], ['Giải Nhất', 2, 6], ['Giải Nhì', 6, 12], ['Giải Ba', 12, 20]];
  function triGroups(d) {
    return GRP.map(function (g) { return '<div class="tri-grp"><span class="tg-n">' + g[0] + '</span><span class="tg-v">' + d.nums.slice(g[1], g[2]).map(triChip).join('') + '</span></div>'; }).join('');
  }
  function empty(x) {
    return '<div class="alert info">Chưa có dữ liệu ' + esc(x.label) + '. Trên máy tính hãy chạy <b>UPDATE_DATA.bat</b> để tải kết quả, rồi đăng lại bản mobile.</div>';
  }
  var VERDICT_BADGE = function (v) { return v.significant ? badge('alert', 'Có dấu hiệu bất thường') : badge('ok', 'Phù hợp với quay số ngẫu nhiên'); };
  function level(t) { return t.level === 'bad' ? badge('alert', 'Lệch rõ') : t.level === 'warn' ? badge('watch', 'Hơi lệch, có thể do tình cờ') : badge('ok', 'Bình thường'); }
  function dataNote(x) {
    var n = (x.kind === 'keno' || x.kind === 'bingo') ? ' Giải này quay liên tục nên bản mobile chỉ giữ các ngày gần đây (' + fi(x.draws) + ' kỳ, từ ' + fdate(x.firstDate) + ').' : '';
    return 'Dữ liệu cập nhật đến kỳ #' + x.latestNo + ' ngày ' + fdate(x.latestDate) + '.' + n;
  }

  /* ---------------------------------------------------------------- sân khấu */
  function stage(x) {
    var g = U.game(), d = x.recent[0];
    var h = '<div class="stage-in"><div class="stage-main"><div class="stage-meta"><b>Kỳ #' + d.no + '</b><span>' + U.weekday(d.date) + ', ' + fdate(d.date) + '</span></div>';
    if (x.kind === 'triple') h += '<div class="tri-rows">' + triGroups(d) + '</div>';
    else if (x.kind === 'keno') h += '<div class="rack xrack" role="img" aria-label="Kết quả: ' + d.nums.join(', ') + '"><div class="rack-main">' + d.nums.map(function (n, i) { return '<span class="ball" style="--i:' + i + '">' + U.pad2(n) + '</span>'; }).join('') + '</div></div>';
    else h += '<div class="rack xrack"><div class="rack-main">' + d.nums.map(function (n, i) { return '<span class="ball xl die" style="--i:' + i + '">' + n + '</span>'; }).join('') + '</div></div>' +
      '<p class="stage-odds">Tổng ba số: <b>' + (d.nums[0] + d.nums[1] + d.nums[2]) + '</b> (' + (d.nums[0] + d.nums[1] + d.nums[2] >= 12 ? 'Lớn' : d.nums[0] + d.nums[1] + d.nums[2] <= 9 ? 'Nhỏ' : 'Hòa') + ')</p>';
    h += '</div>';
    if (x.kind === 'triple') {
      var at = U.drawAt(g, 1);
      if (at) h += '<aside class="next" aria-label="Kỳ quay tiếp theo"><div class="next-head"><span class="next-lb">Kỳ quay tiếp theo</span><b>' + esc(U.whenText(at)) + '</b></div>' +
        '<div class="cd-box" data-cd="' + at.getTime() + '" aria-label="Thời gian còn lại">' + U.cdInner({ getAttribute: function () { return at.getTime(); }, hasAttribute: function () { return false; } }) + '</div></aside>';
    } else {
      var every = x.kind === 'keno' ? 8 : 6, span = x.kind === 'keno' ? '06h00 đến 21h52' : '06h00 đến 21h53';
      h += '<aside class="next" aria-label="Lịch quay"><div class="next-head"><span class="next-lb">Quay liên tục</span><b>Cứ ' + every + ' phút một kỳ</b></div><p class="next-note">Mỗi ngày từ ' + span + ', khoảng ' + (x.kind === 'keno' ? 119 : 159) + ' kỳ. Dữ liệu trong ứng dụng cập nhật theo lần đăng gần nhất, không theo từng kỳ: kỳ mới nhất ở đây là #' + x.latestNo + '.</p></aside>';
    }
    return h + '</div>';
  }

  /* ---------------------------------------------------------------- tổng quan */
  function digitsChart(x, i, title) {
    var dg = x.analysis.digits[i], n = x.draws * 20 / 10;
    return '<section class="panel">' + head(title, 'Số lần mỗi chữ số 0–9 xuất hiện trong ' + fi(x.draws) + ' kỳ, so với con số lẽ ra phải thấy nếu quay ngẫu nhiên.') +
      U.colChart(dg.map(function (v, k) { return { label: String(k), obs: v, exp: n, tip: 'Chữ số ' + k + ': ' + fi(v) + ' lần (lý thuyết ' + fi(n) + ')' }; }), { cols: 3, h: 190, maxLabels: 10, labelW: 22, title: title }) + '</section>';
  }
  function overview(x) {
    if (!x.draws) return empty(x);
    var a = x.analysis, h = '';
    h += howto('Các giải này quay số ngẫu nhiên và trả thưởng theo bảng cố định, nên thống kê quá khứ không giúp đoán kỳ sau. Trang này chỉ cho bạn thấy máy quay có hoạt động ngẫu nhiên không và một vé trung bình nhận lại bao nhiêu.');
    var rtpTxt = rtpRange(x);
    if (a.error) h += '<div class="alert info">' + esc(a.error) + '</div>';
    else {
      var v = a.verdict;
      h += '<div class="kpis k3">' + kpi('Số kỳ đã lưu', fi(x.draws), 'từ ' + fdate(x.firstDate) + ' đến ' + fdate(x.latestDate)) +
        kpi('Kiểm tra độ ngẫu nhiên ' + qm('kiem-tra', 'Phép kiểm tra độ ngẫu nhiên'), (v.tested - v.rawBelow05) + '/' + v.tested + ' bình thường', 'kỳ vọng ngẫu nhiên: khoảng ' + fd(v.expectedByChance, 1) + ' phép thấp hơn 5% do tình cờ') +
        kpi('Một vé 10.000đ trung bình nhận lại ' + qm('nhan-lai', 'Trung bình một vé nhận lại'), rtpTxt.range, rtpTxt.sub) + '</div>';
      h += '<section class="panel block"><div class="verdict">' + VERDICT_BADGE(v) + '<div><b>Máy quay có ngẫu nhiên không?</b><p class="sub">' + esc(v.text) + '</p></div></div><p class="note" style="margin-top:10px">' + esc(dataNote(x)) + '</p></section>';
    }
    if (x.kind === 'keno') h += kenoOverview(x);
    else if (x.kind === 'bingo') h += '<section class="panel block">' + head('Tổng ba số', 'Tổng nào cũng có thể ra; tổng ở giữa (10, 11) ra nhiều nhất vì có nhiều cách tạo ra nó. Cột là thực tế, vạch là lý thuyết.') +
      U.colChart(a.sumDist.map(function (v, k) { return { label: String(k + 3), obs: v, exp: a.sumExp[k], tip: 'Tổng ' + (k + 3) + ': ' + fi(v) + ' kỳ (lý thuyết ' + fd(a.sumExp[k], 0) + ')' }; }), { title: 'Phân bố tổng ba số', maxLabels: 16, labelW: 20 }) + '</section>';
    else h += '<div class="grid-3 block">' + digitsChart(x, 0, 'Chữ số hàng trăm') + digitsChart(x, 1, 'Chữ số hàng chục') + digitsChart(x, 2, 'Chữ số hàng đơn vị') + '</div>' + tripleTop(x);
    return h;
  }
  function rtpRange(x) {
    var p = x.prob, vals = [];
    if (x.kind === 'keno') { p.tiers.forEach(function (t) { vals.push(t.rtp); }); Object.keys(p.side).forEach(function (k) { vals.push(p.side[k].rtp); }); }
    else if (x.kind === 'bingo') p.bets.forEach(function (b) { vals.push(b.rtp); });
    else { vals.push(p.pair.rtp); if (p.single) vals.push(p.single.basic.rtp); }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var same = Math.abs(hi - lo) < 0.005;
    if (same) return { range: back(lo), sub: 'mọi cách chơi đều như nhau; phần còn lại (khoảng ' + fd((1 - lo) * 100, 0) + '%) không quay lại người chơi' };
    return { range: back(lo) + ' – ' + back(hi), sub: 'tùy cách chơi; phần còn lại (khoảng ' + fd((1 - hi) * 100, 0) + '–' + fd((1 - lo) * 100, 0) + '%) không quay lại người chơi' };
  }
  function kenoOverview(x) {
    var e = x.extra, a = x.analysis, N = x.draws, cells = [], zs = [], i;
    var sd = Math.sqrt(N * 0.25 * 0.75);
    for (i = 0; i < 80; i++) { var z = (e.counts[i] - e.expected) / sd; cells.push({ n: i + 1, c: e.counts[i], z: z }); }
    var grid = '<div class="slip xslip">' + cells.map(function (c) {
      return '<div class="cell ' + U.heatClass(c.z) + '" data-tip="Số ' + c.n + ': ra ' + c.c + ' lần (trung bình ' + fd(e.expected, 0) + '), vắng ' + e.gap[c.n - 1] + ' kỳ"><span class="c-n">' + U.pad2(c.n) + '</span><span class="c-v">' + c.c + '</span></div>';
    }).join('') + '</div>';
    var by = cells.slice().sort(function (p, q) { return q.c - p.c || p.n - q.n; });
    var gaps = cells.slice().sort(function (p, q) { return e.gap[q.n - 1] - e.gap[p.n - 1] || p.n - q.n; });
    function list(title, arr, f) { return '<section class="panel">' + head(title) + U.rankList(arr.map(function (c) { return { label: '<span class="ball xs">' + U.pad2(c.n) + '</span>', value: f(c), text: f(c) + ' ' + (title.indexOf('Vắng') === 0 ? 'kỳ' : 'lần') }; }), { lbl: '34px', cls: '' }) + '</section>'; }
    return '<section class="panel block">' + head('Số lần ra của 80 số', 'Mỗi ô là một số, con số nhỏ là số lần ra trong ' + fi(N) + ' kỳ. Trung bình mỗi số ra ' + fd(e.expected, 0) + ' lần. Ô đậm màu chỉ là chênh lệch tình cờ, không phải số "dễ ra" hơn.') + grid + '</section>' +
      '<div class="grid-3 block">' + list('Ra nhiều nhất', by.slice(0, 5), function (c) { return c.c; }) + list('Ra ít nhất', by.slice(-5).reverse(), function (c) { return c.c; }) + list('Vắng lâu nhất hiện nay', gaps.slice(0, 5), function (c) { return e.gap[c.n - 1]; }) + '</div>';
  }
  function tripleTop(x) {
    var e = x.extra; if (!e || !e.top) return '';
    return '<section class="panel block">' + head('Bộ ba ra nhiều nhất', 'Mỗi bộ ba trong 1.000 bộ trung bình ra ' + fd(e.expected, 1) + ' lần trong ' + fi(x.draws) + ' kỳ; có ' + fi(e.distinct) + '/1.000 bộ đã từng ra. Bộ ra nhiều nhất chỉ nhỉnh hơn vì may rủi.') +
      table(['Bộ ba', { h: 'Số lần ra', r: true }, { h: 'Kỳ ra gần nhất', r: true }], e.top.map(function (t) { return [triChip(t.n), fi(t.k), '#' + t.last]; })) + '</section>';
  }

  /* ---------------------------------------------------------------- phân tích */
  function analysis(x) {
    if (!x.draws) return empty(x);
    var a = x.analysis; if (a.error) return '<div class="alert info">' + esc(a.error) + '</div>';
    var h = howto('Mỗi dòng là một câu hỏi: "máy quay có lệch khỏi ngẫu nhiên theo cách này không?". Kết quả "Bình thường" nghĩa là không thấy gì lạ. Với nhiều phép kiểm tra, thỉnh thoảng một phép báo "hơi lệch" chỉ do tình cờ (cứ 20 phép thì trung bình 1 phép), nên chỉ coi là bất thường khi vẫn lệch sau khi đã tính đến việc thử nhiều phép ' + qm('nhieu-lan', 'Thử nhiều lần') + '.');
    h += '<section class="panel block">' + head('Các phép kiểm tra độ ngẫu nhiên', fi(x.draws) + ' kỳ. ' + a.verdict.text) +
      table(['Câu hỏi', 'Kết quả', 'Chi tiết'],
        a.tests.map(function (t) { return [esc(t.question), level(t), (esc(t.detail || '') || '–') + '<span class="tech"><br>p = ' + pv(t.p) + ', sau hiệu chỉnh ' + pv(t.pAdj) + '</span>']; })) + '</section>';
    if (x.kind === 'keno') {
      h += '<div class="grid-2 block"><section class="panel">' + head('Số quả từ 41 đến 80 trong mỗi kỳ', 'Mỗi kỳ có bao nhiêu số "lớn" (41–80)? Cột là thực tế, vạch là lý thuyết.') +
        U.colChart(a.bigDist.map(function (v, k) { return { label: String(k), obs: v, exp: a.bigExp[k], tip: k + ' số lớn: ' + fi(v) + ' kỳ (lý thuyết ' + fd(a.bigExp[k], 0) + ')' }; }).slice(3, 18), { cols: 2, title: 'Số quả lớn mỗi kỳ', maxLabels: 15, labelW: 20 }) + '</section>' +
        '<section class="panel">' + head('Số quả chẵn trong mỗi kỳ', 'Cùng cách đọc: bao nhiêu số chẵn trong 20 số của mỗi kỳ.') +
        U.colChart(a.evenDist.map(function (v, k) { return { label: String(k), obs: v, exp: a.bigExp[k], tip: k + ' số chẵn: ' + fi(v) + ' kỳ (lý thuyết ' + fd(a.bigExp[k], 0) + ')' }; }).slice(3, 18), { cols: 2, title: 'Số quả chẵn mỗi kỳ', maxLabels: 15, labelW: 20 }) + '</section></div>';
    }
    if (x.kind === 'bingo') {
      h += '<div class="grid-2 block"><section class="panel">' + head('Sáu mặt 1–6', 'Số lần mỗi mặt xuất hiện trong ' + fi(x.draws * 3) + ' lần quay.') +
        U.colChart(a.faces.map(function (v, k) { return { label: String(k + 1), obs: v, exp: x.draws * 0.5, tip: 'Mặt ' + (k + 1) + ': ' + fi(v) + ' lần' }; }), { cols: 2, h: 200, title: 'Số lần mỗi mặt', maxLabels: 6, labelW: 20 }) + '</section>' +
        '<section class="panel">' + head('Kiểu ba số', 'Ba số giống nhau / có một cặp / khác nhau.') +
        U.colChart(a.kind.map(function (v, k) { return { label: ['Giống hệt', 'Một cặp', 'Khác nhau'][k], obs: v, exp: x.draws * [6, 90, 120][k] / 216, tip: '' }; }), { cols: 2, h: 200, title: 'Kiểu ba số', maxLabels: 3, labelW: 70 }) + '</section></div>';
    }
    return h;
  }
  function pv(p) { return p == null ? '–' : p < 0.0001 ? '< 0,01%' : fpct(p); }

  /* ---------------------------------------------------------------- xác suất & tiền thưởng */
  function probability(x) {
    var p = x.prob, h = '';
    h += howto('"Trung bình một vé 10.000đ nhận lại" là số tiền thắng trung bình tính trên rất nhiều vé, theo đúng bảng giải của Vietlott. Nó luôn thấp hơn giá vé: chơi lâu dài thì số tiền không quay lại người chơi chính là phần giữ lại của nhà phát hành. Không có cách chọn số nào làm con số này tăng lên.');
    if (x.kind === 'keno') {
      h += '<section class="panel block">' + head('Cách chơi cơ bản theo bậc', 'Bậc là số lượng số bạn chọn (1 đến 10) ' + qm('bac-keno', 'Bậc chơi') + '. Mỗi kỳ quay 20 số trong 80 số. Bấm vào một bậc để xem từng mức trùng.') +
        '<div class="acc">' + p.tiers.map(function (t) {
          var rows = t.rows.filter(function (r) { return r.value > 0; });
          return '<details class="acc-i"><summary><b>Bậc ' + t.k + '</b><span>trúng giải: ' + pct(t.pAny) + '</span><span>nhận lại ' + back(t.rtp) + '</span></summary>' +
            table(['Trùng', { h: 'Cơ hội', r: true }, { h: 'Tiền thưởng', r: true }], rows.map(function (r) { return [r.match + ' số', oneIn(r.p), money(r.value)]; })) +
            (t.k >= 8 ? '<p class="note">Bậc 8, 9, 10: tổng tiền trả cho cả hạng cao nhất mỗi kỳ không quá 10 tỷ đồng, nếu vượt thì chia đều. Số trên đây là mức đầy đủ.</p>' : '') + '</details>';
        }).join('') + '</div></section>' +
        '<section class="panel block">' + head('Cách chơi bổ sung (Lớn/Nhỏ, Chẵn/Lẻ)', 'Đoán kết quả của cả 20 số quay thay vì số cụ thể ' + qm('lon-nho', 'Lớn/Nhỏ, Chẵn/Lẻ') + '.') +
        table(['Cách chơi', { h: 'Cơ hội trúng', r: true }, { h: 'Nhận lại / vé 10.000đ', r: true }, 'Tiền thưởng'], Object.keys(p.side).map(function (k) {
          var s = p.side[k]; return [esc(s.label), pct(s.pWin), back(s.rtp), s.tiers.map(function (t) { return money(t.value); }).join(' / ')];
        })) + '</section>';
    } else if (x.kind === 'bingo') {
      var groups = []; p.bets.forEach(function (b) { if (groups.indexOf(b.group) < 0) groups.push(b.group); });
      h += groups.map(function (gr) {
        var list = p.bets.filter(function (b) { return b.group === gr; });
        return '<section class="panel block">' + head(gr, gr === 'Cộng tổng' ? 'Chọn một tổng từ 3 đến 18; trúng khi tổng ba số quay đúng bằng số đó ' + qm('tong-bingo', 'Tổng ba số') + '.' : gr === 'Lớn Hòa Nhỏ' ? 'Nhỏ: tổng 3–9; Hòa: 10 hoặc 11; Lớn: 12–18 ' + qm('lon-nho', 'Lớn/Nhỏ') + '.' : 'Mỗi vé 10.000đ.') +
          table(['Cách chơi', { h: 'Cơ hội trúng', r: true }, { h: 'Nhận lại / vé 10.000đ', r: true }, { h: 'Tiền thưởng', r: true }], list.map(function (b) {
            return [esc(b.name), pct(b.pWin), back(b.rtp), b.tiers.map(function (t) { return money(t.value); }).join(' / ')];
          })) + '</section>';
      }).join('');
    } else {
      if (p.single) {
        var lab = { basic: 'Một bộ ba, đúng thứ tự', combo3: 'Tổ hợp 3 (ví dụ 112 trúng cả 121, 211)', combo6: 'Tổ hợp 6 (ba số khác nhau, mọi thứ tự)' };
        h += '<section class="panel block">' + head('Max 3D: vé một bộ ba số', 'Mỗi kỳ quay 20 bộ ba: 2 Đặc biệt, 4 Nhất, 6 Nhì, 8 Ba. Trúng khi bộ ba của bạn trùng một bộ ba quay thưởng ' + qm('bo-ba-so', 'Bộ ba số') + '.') +
          table(['Cách chơi', { h: 'Cơ hội trúng ít nhất 1 giải', r: true }, { h: 'Nhận lại / vé 10.000đ', r: true }], ['basic', 'combo3', 'combo6'].map(function (k) { return [lab[k], pct(p.single[k].pAny), back(p.single[k].rtp)]; })) + '</section>';
      }
      var pn = { db: x.code === 'max3dpro' ? 'Giải Đặc biệt (đúng thứ tự)' : 'Giải Đặc biệt', pdb: 'Giải phụ Đặc biệt (ngược thứ tự)', n1: 'Giải Nhất', n2: 'Giải Nhì', n3: 'Giải Ba', tu: 'Giải Tư', nam: 'Giải Năm', sau: 'Giải Sáu' };
      h += '<section class="panel block">' + head(x.code === 'max3dpro' ? 'Max 3D Pro: vé hai bộ ba số' : 'Max 3D+: vé hai bộ ba số', 'Một vé gồm hai bộ ba khác nhau. Tính chính xác bằng cách liệt kê mọi khả năng của 20 bộ ba quay thưởng. Trung bình một vé 10.000đ nhận lại ' + back(p.pair.rtp) + ', và cơ hội trúng ít nhất một giải là ' + pct(p.pair.pAny) + '.') +
        table(['Giải', { h: 'Cơ hội', r: true }, { h: 'Tiền thưởng', r: true }], p.pair.tiers.map(function (t) { return [pn[t.key], oneIn(t.p), money(t.value)]; })) +
        '<p class="note" style="margin-top:10px">Quy ước tính: trúng nhiều giải thì nhận tổng các giải; giải Năm và Sáu tính theo từng bộ ba trên vé. Thể lệ chưa nói rõ cách tính khi cả hai bộ cùng trúng, nhưng chỗ chưa rõ này làm kỳ vọng lệch dưới 0,02%.</p></section>';
    }
    return h;
  }

  /* ---------------------------------------------------------------- kiểm chứng */
  function backtest(x) {
    var b = x.backtest;
    if (!x.draws) return empty(x);
    if (b.error) return '<div class="alert info">' + esc(b.error) + '</div>';
    var h = howto('Ta thử từng cách chọn số trên quá khứ: mỗi kỳ chỉ dùng dữ liệu của các kỳ TRƯỚC để chọn, rồi xem kỳ đó trúng bao nhiêu. Nếu một cách chọn thật sự hơn chọn bừa thì kết quả phải cao hơn con số lẽ ra (cột "Nếu chọn bừa") một cách rõ ràng và lặp lại được.');
    var isMoney = x.kind === 'bingo', isPct = x.kind === 'triple';
    var f = function (v) { return isMoney ? money(Math.round(v)) : isPct ? pct(v) : fd(v, 3); };
    h += '<section class="panel block">' + head('Thử trên ' + fi(b.draws) + ' kỳ', 'Từ ' + fdate(b.from) + ' đến ' + fdate(b.to) + '. ' + esc(b.metric)) +
      table(['Cách chọn', { h: 'Thực tế', r: true }, { h: 'Nếu chọn bừa', r: true }, 'Kết luận', { h: 'Xác suất tình cờ', r: true }], b.strategies.map(function (s) {
        var verdict = s.p >= 0.05 ? badge('ok', 'Không khác chọn bừa') : badge('watch', s.z > 0 ? 'Cao hơn, nhưng xem ghi chú' : 'Thấp hơn chọn bừa');
        return [esc(s.label), f(s.mean), f(s.expected), verdict, pv(s.p)];
      })) + '<div class="alert ' + (b.minPAdj < 0.05 ? 'error' : 'info') + '" style="margin-top:12px"><b>Kết luận:</b> ' + esc(b.verdict) + ' Chọn nhiều cách một lúc thì thế nào cũng có vài cách nhỉnh hơn do tình cờ, nên ở đây đã tính cả điều đó.</div></section>';
    return h;
  }

  /* ---------------------------------------------------------------- thể lệ */
  var P10 = '10.000đ';
  function rules(x) {
    var src = '<p class="note">Nguồn: trang "Giới thiệu sản phẩm" của vietlott.vn, đọc ngày 12/11/2026. Vietlott có thể thay đổi thể lệ, hãy đối chiếu trước khi chơi.</p>';
    if (x.kind === 'keno') {
      var rows = [];
      for (var k = 1; k <= 10; k++) { var pay = x.prob.pay[k]; rows.push([String(k), Object.keys(pay).map(Number).sort(function (a, b) { return b - a; }).map(function (m) { return 'trùng ' + m + ': ' + money(pay[m]); }).join('<br>')]); }
      return '<section class="panel">' + head('Cách chơi Keno', 'Mỗi kỳ quay 20 số trong 80 số (01–80). Bạn chọn từ 1 đến 10 số (bậc 1 đến 10), giá ' + P10 + ' một lần. Quay cứ 8 phút một kỳ, từ 06h00 đến 21h52 mỗi ngày.') +
        '<p class="note">Bạn có thể chơi thêm cách bổ sung: Lớn/Nhỏ (đoán nhiều số từ 41–80 hay 01–40), Chẵn/Lẻ (đoán nhiều số chẵn hay lẻ). Xem bảng ở mục Xác suất & tiền thưởng.</p></section>' +
        '<section class="panel block">' + head('Bảng giải (vé ' + P10 + ')', 'Số tiền theo số lượng số trùng, tính cho mỗi bậc.') + table(['Bậc', 'Số trùng và tiền thưởng'], rows) + src + '</section>';
    }
    if (x.kind === 'bingo') {
      return '<section class="panel">' + head('Cách chơi Bingo18', 'Mỗi kỳ quay 3 lần, mỗi lần ra một số từ 1 đến 6 (như ba hạt xúc xắc). Giá ' + P10 + ' một lần. Quay cứ 6 phút một kỳ, từ 06h00 đến 21h53 mỗi ngày.') +
        '<p class="note">Các cách chơi: chọn một số (ra 1, 2 hay 3 lần được 12.000đ, 20.000đ, 30.000đ); hai số trùng (75.000đ); ba số trùng (1.200.000đ hoặc ba số bất kỳ 200.000đ); cộng tổng (tổng 3–18); Lớn, Hòa, Nhỏ. Bảng chi tiết xem ở mục Xác suất & tiền thưởng.</p></section><section class="panel block">' + src + '</section>';
    }
    var t = x.code === 'max3dpro'
      ? 'Chọn hai bộ ba số, mỗi số từ 0 đến 9 (bộ ba từ 000 đến 999). Quay vào 18h00 các ngày Thứ Ba, Năm, Bảy. Giá ' + P10 + ' một lần. Giải Đặc biệt 2 tỷ đồng cho vé trùng đúng hai bộ ba giải Đặc biệt theo đúng thứ tự quay; ngược thứ tự là giải phụ Đặc biệt 400 triệu đồng.'
      : 'Chọn một bộ ba số (hoặc hai bộ ba với cách Max 3D+), mỗi số từ 0 đến 9. Quay vào 18h00 các ngày Thứ Hai, Tư, Sáu. Giá ' + P10 + ' một lần. Vé một bộ ba trùng bộ ba quay thưởng theo đúng thứ tự: Đặc biệt 1.000.000đ, Nhất 350.000đ, Nhì 210.000đ, Ba 100.000đ. Có thêm cách chơi tổ hợp (trúng theo bất kỳ thứ tự).';
    return '<section class="panel">' + head('Cách chơi ' + x.label, t) + '<p class="note">Mỗi kỳ quay 20 bộ ba: 2 bộ giải Đặc biệt, 4 bộ giải Nhất, 6 bộ giải Nhì, 8 bộ giải Ba. Bảng chi tiết xem ở mục Xác suất & tiền thưởng.</p></section><section class="panel block">' + src + '</section>';
  }

  /* ---------------------------------------------------------------- lịch sử */
  function history(x) {
    if (!x.recent.length) return empty(x);
    return '<section class="panel"><div class="table-wrap tall"><table class="data hist"><thead><tr><th>Kỳ</th><th>Ngày</th><th>Kết quả</th></tr></thead><tbody>' + x.recent.map(function (d) {
      var res = x.kind === 'triple' ? '<div class="tri-compact">' + triGroups(d) + '</div>' : drawHtml(x, d);
      return '<tr><td class="nowrap c-no">#' + d.no + '</td><td class="nowrap c-date">' + U.weekday(d.date) + ', ' + fdate(d.date) + '</td><td class="c-res">' + res + '</td></tr>';
    }).join('') + '</tbody></table></div></section>';
  }

  window.VLX = {
    SECTIONS: SECTIONS, TAB_MAIN: TAB_MAIN, stage: stage,
    render: { 'tong-quan': overview, 'phan-tich': analysis, 'xac-suat': probability, 'kiem-chung': backtest, 'the-le': rules, 'lich-su': history }
  };
})(jQuery);
