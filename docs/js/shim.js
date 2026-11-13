/* Bản mobile (chạy tĩnh, không cần máy chủ): thay thế các lời gọi /api/... của giao diện
 * bằng tính toán ngay trên điện thoại. Dữ liệu các kỳ quay lấy từ file JSON trong thư mục data/. */
(function ($) {
  'use strict';
  var VL = window.VL;
  var gamesInfo = null, cross = null, sig = '', gamesP = null;
  var rowsByGame = {}, memo = {}, insightByGame = {};

  function fetchJson(name) {
    return fetch('data/' + name + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); } // cùng dạng dữ liệu như máy chủ trả về
  function reject(status, msg) {
    var d = $.Deferred();
    d.reject({ status: status, responseJSON: { error: msg } });
    return d.promise();
  }
  function httpError(status, msg) { return Object.assign(new Error(msg), { status: status }); }

  // Tải danh sách loại + tóm tắt; nếu có kỳ mới thì bỏ bộ nhớ đệm để tải lại dữ liệu từng loại.
  function loadGames() {
    return fetchJson('games.json').then(function (g) {
      var s = g.version + '|' + g.games.map(function (x) { return x.latestNo + ':' + x.draws; }).join(',');
      if (s !== sig) { sig = s; rowsByGame = {}; memo = {}; insightByGame = {}; }
      gamesInfo = g.games;
      cross = g.cross || null;
      return gamesInfo;
    });
  }
  function games(force) {
    if (force || !gamesP) {
      gamesP = loadGames().catch(function (e) {
        if (gamesInfo) return gamesInfo; // mất mạng: dùng dữ liệu đã tải
        gamesP = null;
        throw e;
      });
    }
    return gamesP;
  }
  function rows(code) {
    if (rowsByGame[code]) return Promise.resolve(rowsByGame[code]);
    return fetchJson(code + '.json').then(function (r) { rowsByGame[code] = r; return r; });
  }

  // Phân tích tính sẵn lúc dựng (backtest, độ ưa chuộng, chất lượng dữ liệu): data/analysis-<mã>.json
  function insight(code) {
    if (insightByGame[code]) return Promise.resolve(insightByGame[code]);
    return fetchJson('analysis-' + code + '.json').then(function (r) { insightByGame[code] = r; return r; });
  }
  function insightOrNull(code) { return insight(code).catch(function () { return null; }); }
  function memoize(key, fn) { if (!memo[key]) memo[key] = fn(); return memo[key]; }

  function getGame(q) {
    var code = q.get('game') || '655';
    if (!VL.GAMES[code]) throw httpError(400, 'game không hợp lệ: ' + code);
    return code;
  }
  function intParam(q, name, def, min, max) {
    var v = parseInt(q.get(name), 10);
    return isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  }
  function light(all) { return all.map(function (r) { return { no: r.no, date: r.date, main: r.main, bonus: r.bonus }; }); }
  function analysis(code, last, all) {
    var key = code + '|' + last + '|' + all.length;
    if (!memo[key]) memo[key] = VL.S.analyze(light(all), VL.GAMES[code], { last: last });
    return memo[key];
  }

  var ROUTES = {
    '/api/stats': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000);
      return rows(code).then(function (all) { return analysis(code, last, all); });
    },
    '/api/draws': function (q) {
      var code = getGame(q), limit = intParam(q, 'limit', 30, 1, 500);
      return rows(code).then(function (all) { return all.slice(-limit).reverse(); });
    },
    '/api/check': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000), game = VL.GAMES[code];
      var ticket = VL.T.parseTicket(code, game, q.get('numbers'), q.get('special'));
      return rows(code).then(function (all) {
        var res = VL.T.checkTicket(code, game, last > 0 ? all.slice(-last) : all, ticket);
        var info = new Map(analysis(code, last, all).numbers.map(function (n) { return [n.n, n]; }));
        res.numbers = ticket.numbers.map(function (n) { return info.get(n); });
        return res;
      });
    },
    '/api/crosscheck': function () { return cross || { none: true }; },
    // ---- Statistical Engine chuyên sâu (tính trên điện thoại theo phạm vi đang chọn)
    '/api/explore': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000);
      return rows(code).then(function (all) {
        return memoize('x|' + code + '|' + last + '|' + all.length, function () {
          return VL.E.explore(light(all), VL.GAMES[code], { last: last, baseTests: analysis(code, last, all).tests });
        });
      });
    },
    // ---- Kết quả tính sẵn: backtest, độ ưa chuộng, chất lượng dữ liệu
    '/api/insight': function (q) { return insight(getGame(q)); },
    // ---- Probability Engine: xác suất từng hạng, kỳ vọng kỳ tới, lịch sử kỳ vọng, kỳ chia giải
    '/api/prob': function (q) {
      var code = getGame(q), P = VL.P;
      return rows(code).then(function (all) {
        return memoize('p|' + code + '|' + all.length, function () {
          var tb = P.tierTable(code), fc = P.forecast(code, all), hist = P.evHistory(code, all), price = tb.rules.price;
          var out = {
            total: tb.total, pAny: tb.pAny, pNone: tb.pNone, price: price, match: tb.match,
            tiers: tb.tiers.map(function (t, i) { return { name: t.name, jackpot: !!t.jackpot, ways: t.ways, p: t.p, oneIn: t.oneIn, value: fc.values[i], min: t.min || null }; }),
            forecast: fc,
            ev: {
              nominal: P.expectedValue(code, fc.values),
              shared: P.expectedValue(code, fc.values, { tickets: fc.tickets }),
              net: P.expectedValue(code, fc.values, { tickets: fc.tickets, tax: true }),
              breakEven: P.breakEvenJackpot(code, fc.values),
              breakEvenNet: P.breakEvenJackpot(code, fc.values, { tickets: fc.tickets, tax: true })
            },
            multi: [1, 5, 10, 20, 50, 100].map(function (n) {
              return { n: n, cost: n * price, pJackpot: n * tb.tiers[0].p, pAny: 1 - Math.pow(1 - tb.pAny, n), prizes: n * tb.pAny };
            }),
            history: {
              summary: hist.summary,
              series: hist.rows.map(function (r) { return [r.no, Math.round(r.ratio * 1000) / 1000, r.scheduled ? (r.rolldown ? 2 : 1) : 0, r.jackpot, r.tickets, r.date]; })
            },
            cap: tb.rules.cap || null
          };
          if (fc.rolldown) {
            // Kịch bản cho kỳ chia giải: Độc Đắc = giá trị trước kỳ đó + phần doanh thu của chính kỳ đó cộng vào
            var st = fc.rolldown, rate = (fc.rollStats && fc.rollStats.rate) || 0.37;
            var before = st.jackpot + Math.max(0, (st.drawsLeft || 1) - 1) * Math.max(0, fc.values[0] - st.jackpot);
            out.rollScenarios = [0.5e6, 1e6, 2e6, 3e6, 4e6, 5e6].map(function (n) {
              var J = before + rate * n * price, a = P.rolldownEV(code, J, n), b = P.rolldownEV(code, J, n, { tax: true });
              return { tickets: n, jackpot: J, ratio: a.ratio, net: b.ratio, pNoJackpot: a.pNoJackpot };
            });
            out.rollBefore = before;
          }
          return out;
        });
      });
    },
    // Kiểm chứng công thức xác suất bằng mô phỏng: 1 vé cố định qua nhiều kỳ quay ngẫu nhiên
    '/api/prob-verify': function (q) {
      var code = getGame(q), g = VL.GAMES[code], sims = intParam(q, 'sims', 300000, 1000, 2000000);
      var numbers = []; for (var i = 1; i <= g.nMain; i++) numbers.push(i * Math.floor(g.max / g.nMain));
      var tb = VL.P.tierTable(code), sim = VL.P.simulatePortfolio(code, [{ numbers: numbers, special: 1 }], { sims: sims, seed: intParam(q, 'seed', 7, 1, 1e9) });
      return { sims: sims, tiers: tb.tiers.map(function (t, i) { return { name: t.name, p: t.p, obs: sim.tierMean[i], se: Math.sqrt(t.p * (1 - t.p) / sims) }; }), pAny: tb.pAny, obsAny: sim.pAny, seAny: sim.se };
    },
    // ---- Prediction + Scoring Engine
    '/api/propose': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000), game = VL.GAMES[code];
      var strategy = q.get('strategy') || 'ensemble', weights = null;
      try { weights = q.get('weights') ? JSON.parse(q.get('weights')) : null; } catch (e) { weights = null; }
      return Promise.all([rows(code), insightOrNull(code)]).then(function (r) {
        var d = light(r[0]), ins = r[1], bt = ins && ins.backtest;
        if (last > 0) d = d.slice(-last);
        if (strategy === 'ensemble' && !weights && bt) weights = bt.ensembleWeights;
        var res = VL.G.propose(d, game, {
          strategy: strategy, count: intParam(q, 'count', 5, 1, 50), seed: intParam(q, 'seed', 1, 1, 1e9), weights: weights,
          diversify: q.get('diversify') !== '0', theta: ins && ins.popularity ? ins.popularity.theta : null
        });
        res.record = bt ? (bt.strategies.filter(function (s) { return s.id === strategy; })[0] || null) : null;
        res.expected = bt ? bt.expected : null;
        res.exact = VL.P.portfolioExact(code, res.sets);
        res.sim = VL.P.simulatePortfolio(code, res.sets, { sims: 30000, seed: 99 });
        res.nextNo = r[0].length ? r[0][r[0].length - 1].no + 1 : null;
        return res;
      });
    },
    '/api/score': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000), game = VL.GAMES[code];
      // Chấm điểm chỉ xét các số chính nên số đặc biệt không bắt buộc (với loại tự chọn số đặc biệt thì tạm lấy 1 để qua bước kiểm tra)
      var spIn = q.get('special') || '', ticket = VL.T.parseTicket(code, game, q.get('numbers'), spIn || (VL.G.isPick(game) ? '1' : ''));
      if (!spIn) ticket.special = null;
      return Promise.all([rows(code), insightOrNull(code)]).then(function (r) {
        var d = light(r[0]), theta = r[1] && r[1].popularity ? r[1].popularity.theta : null;
        if (last > 0) d = d.slice(-last);
        var st = VL.G.buildState(game, d), ref = VL.G.reference(st, { theta: theta }, 600, 77);
        var out = VL.G.evaluateTicket(st, ticket.numbers, ref, { theta: theta });
        out.ticket = ticket;
        return out;
      });
    },
    // ---- Portfolio Optimization: so sánh 3 cách phân bổ cùng số vé
    '/api/portfolio': function (q) {
      var code = getGame(q), game = VL.GAMES[code], n = intParam(q, 'n', 10, 1, 200), seed = intParam(q, 'seed', 1, 1, 1e9);
      var G = VL.G, F = VL.F, P = VL.P, rnd = VL.M.rng(seed * 7919 + n), k = game.nMain, M = game.max;
      var B = G.isPick(game) ? game.bonusMax : 0, strategy = q.get('strategy') || '';
      return Promise.all([rows(code), insightOrNull(code)]).then(function (r) {
        var ins = r[1], score = null;
        if (strategy && strategy !== 'random') {
          var st = G.buildState(game, light(r[0]));
          score = G.scoreOf(st, strategy, { theta: ins && ins.popularity ? ins.popularity.theta : null, weights: ins && ins.backtest ? ins.backtest.ensembleWeights : null });
        }
        var sp0 = B ? Math.floor(rnd() * B) : 0;
        var withSp = function (list, mode) {
          return list.map(function (t, i) { return { numbers: t, special: B ? (mode === 'spread' ? ((sp0 + i) % B) + 1 : mode === 'same' ? sp0 + 1 : 1 + Math.floor(rnd() * B)) : null }; });
        };
        var spread = withSp(F.optimize(game, n, { score: score, rnd: rnd }), 'spread');
        var random = []; for (var i = 0; i < n; i++) random.push(VL.M.sampleK(M, k, rnd));
        random = withSp(random, 'random');
        // tập trung: n vé đầu của một "bao" nhỏ nhất đủ n tổ hợp (trùng lặp tối đa)
        var N = k; while (VL.S.comb(N, k) < n && N < M) N++;
        var base = score ? G.topK(score, M, N) : VL.M.sampleK(M, N, rnd);
        var focus = withSp(F.bao(base, k, n), 'same');
        var sims = n <= 20 ? 40000 : n <= 60 ? 20000 : 8000;
        var pack = function (id, name, note, tickets) {
          var sim = P.simulatePortfolio(code, tickets, { sims: sims, seed: 4711 });
          return { id: id, name: name, note: note, tickets: tickets, coverage: F.coverage(game, tickets), exact: P.portfolioExact(code, tickets), sim: sim };
        };
        return {
          n: n, cost: n * P.tierTable(code).rules.price, sims: sims, baoSize: N,
          variants: [
            pack('spread', 'Phủ rộng (tối ưu độ bao phủ)', 'Các vé dùng số đều nhau, tránh trùng số và trùng cặp.', spread),
            pack('random', 'Ngẫu nhiên độc lập', 'Mỗi vé chọn ngẫu nhiên, không quan tâm vé khác.', random),
            pack('focus', 'Tập trung (kiểu bao ' + N + ' số)', 'Mọi vé lấy từ cùng ' + N + ' số nên trùng nhau rất nhiều.', focus)
          ]
        };
      });
    },
    // ---- Lịch sử dự đoán: đối chiếu các bộ số đã lưu với kết quả thật
    '/api/picks': function (q) {
      var picks = []; try { picks = JSON.parse(q.get('data') || '[]'); } catch (e) { picks = []; }
      var codes = picks.map(function (p) { return p.game; }).filter(function (c, i, a) { return VL.GAMES[c] && a.indexOf(c) === i; });
      return Promise.all(codes.map(rows)).then(function (lists) {
        var by = {}; codes.forEach(function (c, i) { by[c] = lists[i]; });
        return picks.filter(function (p) { return by[p.game]; }).map(function (p) {
          var all = by[p.game], d = all.length ? all[p.forNo - all[0].no] : null;
          if (!d || d.no !== p.forNo) return { id: p.id, pending: true };
          var rule = VL.R.rulesAt(p.game, d.date), total = 0, best = -1;
          var sets = p.sets.map(function (s) {
            var m = s.numbers.filter(function (x) { return d.main.indexOf(x) >= 0; }).length;
            var sp = rule.special === 'pool' ? s.numbers.indexOf(d.bonus[0]) >= 0 : rule.special === 'pick' ? s.special === d.bonus[0] : false;
            var ti = VL.T.tierIndex(rule, m, sp), prize = 0;
            if (ti >= 0) { var row = (d.prizes || [])[ti] || []; prize = rule.tiers[ti].jackpot ? VL.R.jackpotTotal(p.game, all, p.forNo - all[0].no, ti) / (VL.R.toInt(row[2]) + 1) : VL.R.toInt(row[3]); total += prize; if (best < 0 || ti < best) best = ti; }
            return { m: m, s: sp, tier: ti >= 0 ? rule.tiers[ti].name : null, prize: prize };
          });
          return { id: p.id, pending: false, date: d.date, main: d.main, bonus: d.bonus, sets: sets, prize: total, best: best >= 0 ? rule.tiers[best].name : null, cost: p.sets.length * rule.price };
        });
      });
    }
  };

  function handle(opts) {
    var u = new URL(opts.url, location.href), q = u.searchParams;
    var method = String(opts.method || opts.type || 'GET').toUpperCase();
    var path = '/api/' + u.pathname.split('/api/').pop();
    var d = $.Deferred();
    var done = function (v) { d.resolve(clone(v)); };
    var bad = function (e) { d.reject({ status: e.status || 500, responseJSON: { error: e.message || String(e) } }); };

    setTimeout(function () {
      try {
        if (path === '/api/games' && method === 'GET') {
          games(true).then(done, function () { bad(httpError(0, 'Không tải được dữ liệu.')); });
        } else if (path === '/api/update' && method === 'POST') {
          var before = {};
          (gamesInfo || []).forEach(function (g) { before[g.code] = g.draws; });
          games(true).then(function (list) {
            var out = {};
            list.forEach(function (g) { out[g.code] = { fetched: Math.max(0, g.draws - (before[g.code] || g.draws)) }; });
            done({ ok: true, result: out, log: [] });
          }, function () { bad(httpError(0, 'không tải được dữ liệu mới, hãy kiểm tra mạng.')); });
        } else if (path === '/api/crosscheck' && method === 'POST') {
          games(true).then(function () {
            if (cross) done(cross); else bad(httpError(400, 'Đối chiếu nguồn chỉ chạy được trên máy tính.'));
          }, function () { bad(httpError(0, 'không tải được dữ liệu.')); });
        } else if (method === 'GET' && ROUTES[path]) {
          games(false).then(function () {
            return new Promise(function (ok) { setTimeout(ok, 15); }).then(function () { return ROUTES[path](q); });
          }).then(done, function (e) { bad(e && e.status ? e : httpError(e && e.status === 0 ? 0 : 500, (e && e.message) || 'Lỗi')); });
        } else {
          bad(httpError(404, 'Không có API này'));
        }
      } catch (e) { bad(e); }
    }, 0);
    return d.promise();
  }

  var realAjax = $.ajax;
  $.ajax = function (url, settings) {
    var opts = typeof url === 'string' ? $.extend({ url: url }, settings || {}) : url;
    if (opts && /(^|\/)api\//.test(String(opts.url).split('?')[0])) return handle(opts);
    return realAjax.apply(this, arguments);
  };
})(jQuery);
